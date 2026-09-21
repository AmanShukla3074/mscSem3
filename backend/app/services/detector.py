"""
services/detector.py
Real-time YOLO object detection service for Fasal Rakshak.

Loads yolov8n.pt once at import time (lazy, thread-safe singleton).
Applies CLAHE contrast enhancement before inference.
Filters results to the target class list with a confidence threshold.

Usage:
    from app.services.detector import detector
    detections = detector.run(frame_bgr)
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

import cv2
import numpy as np

# ── Target classes and their AnimalType enum mapping ──────────────────────────

# YOLO COCO class names that we care about → AnimalType enum value
YOLO_CLASS_MAP: dict[str, str] = {
    "cell phone": "Mobile Phone",
    "mouse":      "Mouse",
    "remote":     "Duster / Remote",
}

ALERT_CLASS_THRESHOLDS: dict[str, float] = {
    "cell phone": 0.65,   # High threshold to prevent hands/earbuds from triggering
    "mouse": 0.28,        # Sensitivity tuned for desk mice
    "remote": 0.35,       # Dusters / handheld remotes
}

MODEL_PATH = Path(__file__).parent.parent.parent / "models" / "yolov8n.pt"


# ── Detection result dataclass ─────────────────────────────────────────────────

@dataclass
class Detection:
    class_name: str          # AnimalType enum value string, e.g. "Person"
    confidence: float        # 0–1
    bbox_norm: dict          # {x, y, width, height} normalised 0–1


# ── Singleton detector ─────────────────────────────────────────────────────────

class YOLODetector:
    """
    Thread-safe singleton that wraps a YOLOv8n model.
    Model loading is deferred to the first call to run() so uvicorn startup
    is not delayed by the ~1s torch load time.
    """

    def __init__(self) -> None:
        self._model = None
        self._lock = threading.Lock()
        self._load_error: Optional[str] = None

    def _load(self) -> None:
        """Load the YOLO model (called once, under lock)."""
        try:
            from ultralytics import YOLO  # imported here to avoid top-level side effects
            print(f"[detector] Loading YOLO model from {MODEL_PATH} ...")
            self._model = YOLO(str(MODEL_PATH))
            print("[detector] YOLO model loaded ✓")
        except Exception as exc:
            self._load_error = str(exc)
            print(f"[detector] YOLO load failed: {exc}")

    def run(self, frame_bgr: np.ndarray) -> List[Detection]:
        """
        Run YOLO inference on a BGR frame.
        Returns a list of Detection objects for matched classes.
        """
        # Lazy load under lock
        if self._model is None and self._load_error is None:
            with self._lock:
                if self._model is None and self._load_error is None:
                    self._load()

        if self._model is None:
            return []

        try:
            h, w = frame_bgr.shape[:2]

            # Feed original color frame to retain color and edge context
            results = self._model(frame_bgr, imgsz=640, conf=0.25, verbose=False)[0]

            detections: List[Detection] = []
            for box in results.boxes:
                conf = float(box.conf[0])
                cls_id = int(box.cls[0])
                cls_name_raw = results.names[cls_id].lower()
                animal_type = YOLO_CLASS_MAP.get(cls_name_raw)
                
                if animal_type is None:
                    continue  # not in our target list
                    
                # Apply per-class confidence thresholds
                thresh = ALERT_CLASS_THRESHOLDS.get(cls_name_raw, 0.40)
                if conf < thresh:
                    continue

                # xyxy absolute → normalised xywh
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                bw, bh = (x2 - x1) / w, (y2 - y1) / h
                bx, by = x1 / w, y1 / h

                detections.append(Detection(
                    class_name=animal_type,
                    confidence=round(conf, 4),
                    bbox_norm={
                        "x": round(max(0.0, min(1.0, bx)), 4),
                        "y": round(max(0.0, min(1.0, by)), 4),
                        "width": round(max(0.01, min(1.0, bw)), 4),
                        "height": round(max(0.01, min(1.0, bh)), 4),
                    },
                ))

            return detections

        except Exception as exc:
            print(f"[detector] Inference error: {exc}")
            return []


# Module-level singleton — import and use directly
detector = YOLODetector()
