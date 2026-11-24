"""
services/onnx_detector.py
YOLOv8 detector for the white-hot thermal ONNX model.
Uses ultralytics YOLO (loaded from best.onnx) so all preprocessing /
postprocessing / NMS is handled by ultralytics — no manual cv2.dnn pipeline.

All values returned to FastAPI are cast to native Python types so Pydantic
can serialise them without hitting numpy.float32 serialisation errors.

Classes (from data.yaml): 0 = nilgai  |  1 = boar  |  2 = cow
"""

from __future__ import annotations

import threading
import time
import base64
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

import cv2
import numpy as np

# ── Model path ────────────────────────────────────────────────────────────────
# backend/app/services/onnx_detector.py  →  ../../models/best.onnx
ONNX_MODEL_PATH = Path(__file__).parent.parent.parent / "models" / "best.onnx"

# ── Class map (matches data.yaml) ─────────────────────────────────────────────
CLASS_NAMES: dict[int, str] = {0: "nilgai", 1: "boar", 2: "cow"}

CLASS_DISPLAY: dict[str, str] = {
    "nilgai": "Nilgai",
    "boar":   "Wild Boar",
    "cow":    "Cow",
}

# Colour palette for box drawing (BGR)
CLASS_BGR: dict[str, tuple] = {
    "nilgai": (128, 255, 0),    # green
    "boar":   (255, 128, 0),    # blue-ish
    "cow":    (0, 200, 255),    # amber
}

DEFAULT_CONF = 0.25


# ── Detection dataclass ────────────────────────────────────────────────────────

@dataclass
class OnnxDetection:
    class_id:     int
    class_name:   str    # "nilgai" / "boar" / "cow"
    display_name: str    # "Nilgai"  / "Wild Boar" / "Cow"
    confidence:   float  # native Python float  (0–1)
    bbox_norm:    dict   # {x, y, width, height}  all native float 0–1
    bbox_abs:     dict   # {x1, y1, x2, y2}       all native int


# ── Detector class ─────────────────────────────────────────────────────────────

class OnnxYOLODetector:
    """
    Thread-safe, lazily-loaded wrapper around ultralytics YOLO loaded from
    the ONNX weights file.  All numpy values are cast to Python builtins
    before being stored so Pydantic can serialise the responses.
    """

    def __init__(self, model_path: Path = ONNX_MODEL_PATH) -> None:
        self._model_path = model_path
        self._model = None          # ultralytics YOLO instance
        self._lock  = threading.Lock()
        self._load_error: Optional[str] = None

    # ── Loading ───────────────────────────────────────────────────────────────

    def _load(self) -> None:
        try:
            from ultralytics import YOLO  # lazy import to avoid startup overhead
            print(f"[onnx_detector] Loading YOLO from {self._model_path} ...")
            if not self._model_path.exists():
                raise FileNotFoundError(f"Model not found: {self._model_path}")
            t0 = time.monotonic()
            self._model = YOLO(str(self._model_path))
            ms = (time.monotonic() - t0) * 1000
            print(f"[onnx_detector] Model loaded in {ms:.0f} ms OK")
        except Exception as exc:
            self._load_error = str(exc)
            print(f"[onnx_detector] Load failed: {exc}")

    def _ensure_loaded(self) -> None:
        if self._model is None and self._load_error is None:
            with self._lock:
                if self._model is None and self._load_error is None:
                    self._load()

    @property
    def is_ready(self) -> bool:
        return self._model is not None

    @property
    def load_error(self) -> Optional[str]:
        return self._load_error

    # ── Inference ─────────────────────────────────────────────────────────────

    def run(
        self,
        img_bgr: np.ndarray,
        conf_threshold: float = DEFAULT_CONF,
    ) -> tuple[List[OnnxDetection], float]:
        """
        Run YOLO inference on a BGR image.
        Returns (detections, inference_ms).
        Every numeric value in the returned OnnxDetection objects is a
        native Python int / float — safe for Pydantic serialisation.
        """
        self._ensure_loaded()
        if self._model is None:
            return [], 0.0

        orig_h, orig_w = int(img_bgr.shape[0]), int(img_bgr.shape[1])

        t0 = time.monotonic()
        results = self._model(img_bgr, imgsz=640, conf=float(conf_threshold), verbose=False)[0]
        infer_ms = round((time.monotonic() - t0) * 1000, 1)

        detections: List[OnnxDetection] = []

        for box in results.boxes:
            # ── Cast EVERYTHING to native Python types ──────────────────────
            conf    = float(box.conf[0])          # numpy.float32 → float
            cls_id  = int(box.cls[0])             # numpy.float32 → int
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]

            # Map class id → label
            raw_name = CLASS_NAMES.get(cls_id)
            if raw_name is None:
                continue  # unknown class — skip

            bw = x2 - x1
            bh = y2 - y1

            detections.append(OnnxDetection(
                class_id=cls_id,
                class_name=raw_name,
                display_name=CLASS_DISPLAY.get(raw_name, raw_name.title()),
                confidence=round(conf, 4),
                bbox_norm={
                    "x":      round(max(0.0, x1 / orig_w), 4),
                    "y":      round(max(0.0, y1 / orig_h), 4),
                    "width":  round(max(0.01, bw / orig_w), 4),
                    "height": round(max(0.01, bh / orig_h), 4),
                },
                bbox_abs={
                    "x1": int(x1), "y1": int(y1),
                    "x2": int(x2), "y2": int(y2),
                },
            ))

        return detections, infer_ms

    # ── Drawing ───────────────────────────────────────────────────────────────

    def draw_boxes(
        self,
        img_bgr: np.ndarray,
        detections: List[OnnxDetection],
    ) -> np.ndarray:
        """Draw bounding boxes and labels on a copy of the image."""
        out = img_bgr.copy()
        for det in detections:
            x1 = det.bbox_abs["x1"]
            y1 = det.bbox_abs["y1"]
            x2 = det.bbox_abs["x2"]
            y2 = det.bbox_abs["y2"]
            color = CLASS_BGR.get(det.class_name, (200, 200, 200))
            cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
            label = f"{det.display_name} {det.confidence:.2f}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
            cv2.rectangle(out, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
            cv2.putText(
                out, label, (x1 + 2, y1 - 4),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 1, cv2.LINE_AA,
            )
        return out


# ── Module-level singleton ─────────────────────────────────────────────────────
onnx_detector = OnnxYOLODetector()
