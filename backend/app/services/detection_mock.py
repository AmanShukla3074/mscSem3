"""
services/detection_mock.py
Simulated edge IR wildlife detection engine.
Generates realistic bounding boxes, confidence scores, and crop occlusion
metrics without requiring a real YOLO model — drop in the real model here.
"""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone
from typing import Optional

import cv2
import numpy as np


# ─────────────────────────────────────────────
# Detection parameters
# ─────────────────────────────────────────────

ANIMAL_POOL = ["Nilgai", "Fawn", "Wild Boar", "Rabbit", "Fox", "Unknown"]
DENSITY_POOL = ["Light", "Medium", "Heavy"]

# Weight towards larger animals (higher safety priority)
ANIMAL_WEIGHTS = [0.25, 0.20, 0.20, 0.15, 0.12, 0.08]

# Bounding box colour per animal (BGR)
ANIMAL_COLORS = {
    "Nilgai":    (0,   80, 255),   # Red
    "Fawn":      (0,  200, 255),   # Orange
    "Wild Boar": (0,   0,  255),   # Bright red
    "Rabbit":    (0,  255, 180),   # Green
    "Fox":       (0,  180, 255),   # Amber
    "Unknown":   (180, 180, 180),  # Gray
}


# ─────────────────────────────────────────────
# Detection result dataclass
# ─────────────────────────────────────────────

class DetectionResult:
    __slots__ = (
        "alert_id", "camera_id", "animal_type", "confidence",
        "bbox_norm", "crop_density", "severity", "timestamp",
    )

    def __init__(
        self,
        alert_id: str,
        camera_id: str,
        animal_type: str,
        confidence: float,
        bbox_norm: dict,      # {x, y, width, height} normalised 0–1
        crop_density: str,
        severity: str,
        timestamp: str,
    ) -> None:
        self.alert_id = alert_id
        self.camera_id = camera_id
        self.animal_type = animal_type
        self.confidence = confidence
        self.bbox_norm = bbox_norm
        self.crop_density = crop_density
        self.severity = severity
        self.timestamp = timestamp


# ─────────────────────────────────────────────
# Core detection logic
# ─────────────────────────────────────────────

def run_detection(
    frame: np.ndarray,
    camera_id: str,
    animal_type: Optional[str] = None,
    crop_density: Optional[str] = None,
) -> DetectionResult:
    """
    Simulate an edge YOLO inference pass.
    Generates a DetectionResult with realistic bbox placement and confidence.
    """
    animal = animal_type or random.choices(ANIMAL_POOL, weights=ANIMAL_WEIGHTS, k=1)[0]
    density = crop_density or random.choice(DENSITY_POOL)

    # Confidence: Nilgai/Fawn tend to have higher IR signature; Unknown lower
    base_conf = {"Nilgai": 0.72, "Fawn": 0.68, "Wild Boar": 0.70,
                 "Rabbit": 0.58, "Fox": 0.63, "Unknown": 0.50}.get(animal, 0.60)
    confidence = round(min(0.99, base_conf + random.uniform(0.0, 0.27)), 3)

    # Severity
    is_critical = confidence > 0.75 or animal in ("Nilgai", "Fawn", "Wild Boar")
    severity = "critical" if is_critical else ("warning" if confidence > 0.60 else "info")

    # Bounding box — larger animals get bigger boxes
    size_map = {"Nilgai": (0.18, 0.28), "Fawn": (0.12, 0.20),
                "Wild Boar": (0.20, 0.30), "Rabbit": (0.06, 0.10),
                "Fox": (0.10, 0.16), "Unknown": (0.08, 0.15)}
    w_range, h_range = size_map.get(animal, (0.10, 0.20)), size_map.get(animal, (0.12, 0.24))
    bw = round(random.uniform(*size_map.get(animal, (0.12, 0.25))), 3)
    bh = round(random.uniform(*size_map.get(animal, (0.15, 0.30))), 3)
    bx = round(random.uniform(0.05, max(0.06, 0.90 - bw)), 3)
    by = round(random.uniform(0.10, max(0.11, 0.85 - bh)), 3)

    bbox_norm = {"x": bx, "y": by, "width": bw, "height": bh}

    # Simulate SIoU latency (realistic for edge hardware)
    import time
    t0 = time.monotonic()
    _ = np.sum(frame[:50, :50])   # tiny tensor op to burn a few µs realistically
    elapsed_ms = (time.monotonic() - t0) * 1000
    # Target ~45ms edge latency; pad with synthetic sleep if needed
    target_ms = 45.0
    if elapsed_ms < target_ms:
        import time as _time
        _time.sleep((target_ms - elapsed_ms) / 1000)

    return DetectionResult(
        alert_id=f"alert-{uuid.uuid4().hex[:8]}",
        camera_id=camera_id,
        animal_type=animal,
        confidence=confidence,
        bbox_norm=bbox_norm,
        crop_density=density,
        severity=severity,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# ─────────────────────────────────────────────
# Frame annotation
# ─────────────────────────────────────────────

def annotate_frame(frame: np.ndarray, detection: DetectionResult) -> np.ndarray:
    """
    Draw a SIoU-style bounding box and label onto a copy of the frame.
    Returns the annotated frame (does not modify original).
    """
    out = frame.copy()
    h, w = out.shape[:2]
    bbox = detection.bbox_norm

    # Pixel coordinates
    x1 = int(bbox["x"] * w)
    y1 = int(bbox["y"] * h)
    x2 = int((bbox["x"] + bbox["width"]) * w)
    y2 = int((bbox["y"] + bbox["height"]) * h)

    color = ANIMAL_COLORS.get(detection.animal_type, (180, 180, 180))

    # Main bounding box
    cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)

    # Corner brackets for SIoU aesthetic
    blen = max(8, min(20, (x2 - x1) // 5))
    for (cx, cy), (dx, dy) in [
        ((x1, y1), (1, 1)), ((x2, y1), (-1, 1)),
        ((x1, y2), (1, -1)), ((x2, y2), (-1, -1))
    ]:
        cv2.line(out, (cx, cy), (cx + dx * blen, cy), color, 3)
        cv2.line(out, (cx, cy), (cx, cy + dy * blen), color, 3)

    # Label background
    label = f"{detection.animal_type}  {detection.confidence * 100:.1f}%"
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.45
    (lw, lh), baseline = cv2.getTextSize(label, font, font_scale, 1)
    label_y = max(y1 - 4, lh + 4)
    cv2.rectangle(out, (x1, label_y - lh - baseline - 2), (x1 + lw + 4, label_y + 2), color, -1)
    cv2.putText(out, label, (x1 + 2, label_y - baseline), font, font_scale, (0, 0, 0), 1)

    # Timestamp overlay (bottom-left)
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S UTC")
    cv2.putText(out, f"DETECT {ts}", (6, h - 8), font, 0.35, (200, 200, 200), 1)

    # "LIVE IR" badge (top-left)
    cv2.rectangle(out, (4, 4), (62, 18), (0, 0, 0), -1)
    cv2.circle(out, (12, 11), 4, (0, 0, 220), -1)
    cv2.putText(out, "LIVE IR", (20, 15), font, 0.32, (220, 220, 220), 1)

    # Crop density tag (top-right)
    density_colors = {"Heavy": (0, 0, 180), "Medium": (0, 140, 220), "Light": (0, 180, 80)}
    dc = density_colors.get(detection.crop_density, (100, 100, 100))
    d_label = f"CROP: {detection.crop_density.upper()}"
    (dw, dh), _ = cv2.getTextSize(d_label, font, 0.32, 1)
    cv2.rectangle(out, (w - dw - 10, 4), (w - 4, 18), dc, -1)
    cv2.putText(out, d_label, (w - dw - 8, 15), font, 0.32, (0, 0, 0), 1)

    return out


def generate_snapshot_bytes(
    frame: np.ndarray,
    detection: DetectionResult,
    quality: int = 85,
) -> bytes:
    """Annotate frame and encode to JPEG bytes for storage/serving."""
    annotated = annotate_frame(frame, detection)
    ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buf.tobytes() if ok else b""
