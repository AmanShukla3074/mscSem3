"""
routers/detect.py
Image-upload detection endpoint using the white-hot thermal ONNX model.
POST /api/detect/image   — upload a single image, receive detections + annotated JPEG
GET  /api/detect/status  — model readiness check
GET  /api/detect/dataset — browse dataset sample images
"""

from __future__ import annotations

import base64
import io
import os
import random
from pathlib import Path
from typing import List, Optional

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.services.onnx_detector import onnx_detector, OnnxDetection, CLASS_NAMES

router = APIRouter(prefix="/api/detect", tags=["detect"])

DATASET_ROOT = Path(
    r"C:\Projects\mscSem3\Dataset\claude_ds_28sep\dataset_white_hot\images"
)


# ─────────────────────────────────────────────
# Response models
# ─────────────────────────────────────────────

class DetectionBox(BaseModel):
    class_id:     int
    class_name:   str
    display_name: str
    confidence:   float
    bbox_norm: dict   # {x, y, width, height} 0–1
    bbox_abs:  dict   # {x1, y1, x2, y2}


class DetectImageResponse(BaseModel):
    success:      bool
    image_width:  int
    image_height: int
    detections:   List[DetectionBox]
    count:        int
    inference_ms: float
    annotated_jpeg_b64: str  # base64-encoded annotated JPEG


class ModelStatusResponse(BaseModel):
    ready:       bool
    model_path:  str
    load_error:  Optional[str]
    classes:     dict


class DatasetSampleResponse(BaseModel):
    split:      str
    filename:   str
    jpeg_b64:   str
    label_path: Optional[str]


# ─────────────────────────────────────────────
# GET /api/detect/status
# ─────────────────────────────────────────────

@router.get("/status", response_model=ModelStatusResponse)
def get_model_status() -> ModelStatusResponse:
    """Return ONNX model readiness and class map."""
    # Trigger lazy load if not yet loaded
    onnx_detector._ensure_loaded()
    return ModelStatusResponse(
        ready=onnx_detector.is_ready,
        model_path=str(onnx_detector._model_path),
        load_error=onnx_detector.load_error,
        classes=CLASS_NAMES,
    )


# ─────────────────────────────────────────────
# POST /api/detect/image
# ─────────────────────────────────────────────

@router.post("/image", response_model=DetectImageResponse)
async def detect_image(
    file: UploadFile = File(...),
    conf_threshold: float = Form(default=0.25),
) -> DetectImageResponse:
    """
    Upload an image (JPEG / PNG / BMP) and run YOLO detection.
    Returns detections + base64-encoded annotated JPEG.
    """
    # Validate content type
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Only image files are supported")

    raw = await file.read()
    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    # Decode image
    nparr = np.frombuffer(raw, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise HTTPException(status_code=422, detail="Cannot decode image — unsupported format or corrupted file")

    orig_h, orig_w = img_bgr.shape[:2]

    # Run inference
    detections, infer_ms = onnx_detector.run(img_bgr, conf_threshold=conf_threshold)

    # Draw boxes
    annotated = onnx_detector.draw_boxes(img_bgr, detections)

    # Encode annotated image to JPEG base64
    encode_ok, jpeg_buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 88])
    if not encode_ok:
        raise HTTPException(status_code=500, detail="Failed to encode annotated image")
    jpeg_b64 = base64.b64encode(jpeg_buf.tobytes()).decode("utf-8")

    return DetectImageResponse(
        success=True,
        image_width=orig_w,
        image_height=orig_h,
        detections=[
            DetectionBox(
                class_id=d.class_id,
                class_name=d.class_name,
                display_name=d.display_name,
                confidence=d.confidence,
                bbox_norm=d.bbox_norm,
                bbox_abs=d.bbox_abs,
            )
            for d in detections
        ],
        count=len(detections),
        inference_ms=infer_ms,
        annotated_jpeg_b64=jpeg_b64,
    )


# ─────────────────────────────────────────────
# GET /api/detect/dataset
# ─────────────────────────────────────────────

@router.get("/dataset")
def list_dataset_images(
    split: str = "val",
    animal: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> JSONResponse:
    """
    List images available in the dataset for a given split (train/val/test).
    Optionally filter by animal class name (nilgai, boar, cow).
    Returns filename list + total count.
    """
    split = split.lower()
    if split not in ("train", "val", "test"):
        raise HTTPException(status_code=400, detail="split must be one of: train, val, test")

    split_dir = DATASET_ROOT / split
    if not split_dir.exists():
        raise HTTPException(status_code=404, detail=f"Dataset split '{split}' not found at {split_dir}")

    files = [f for f in sorted(split_dir.iterdir()) if f.suffix.lower() in (".png", ".jpg", ".jpeg")]

    # Filter by animal prefix
    if animal:
        animal_lower = animal.lower()
        files = [f for f in files if f.stem.lower().startswith(animal_lower)]

    total = len(files)
    page_files = files[offset: offset + limit]

    return JSONResponse({
        "split": split,
        "total": total,
        "offset": offset,
        "limit": limit,
        "animal_filter": animal,
        "files": [f.name for f in page_files],
        "available_animals": list(set(f.stem.split("_")[0] for f in files)),
    })


# ─────────────────────────────────────────────
# GET /api/detect/dataset/sample
# ─────────────────────────────────────────────

@router.get("/dataset/sample")
def get_dataset_sample(
    split: str = "val",
    animal: Optional[str] = None,
    filename: Optional[str] = None,
) -> JSONResponse:
    """
    Return a single dataset image as base64 JPEG for preview.
    If `filename` is given, serves that specific file.
    Otherwise picks a random one (filtered by `animal` if provided).
    """
    split = split.lower()
    if split not in ("train", "val", "test"):
        raise HTTPException(status_code=400, detail="split must be: train, val, test")

    split_dir = DATASET_ROOT / split
    if not split_dir.exists():
        raise HTTPException(status_code=404, detail=f"Dataset split not found: {split_dir}")

    if filename:
        img_path = split_dir / filename
    else:
        files = [f for f in sorted(split_dir.iterdir()) if f.suffix.lower() in (".png", ".jpg", ".jpeg")]
        if animal:
            files = [f for f in files if f.stem.lower().startswith(animal.lower())]
        if not files:
            raise HTTPException(status_code=404, detail="No images found for given filters")
        img_path = random.choice(files)

    if not img_path.exists():
        raise HTTPException(status_code=404, detail=f"Image not found: {img_path.name}")

    img_bgr = cv2.imread(str(img_path))
    if img_bgr is None:
        raise HTTPException(status_code=422, detail=f"Cannot read image: {img_path.name}")

    ok, buf = cv2.imencode(".jpg", img_bgr, [cv2.IMWRITE_JPEG_QUALITY, 88])
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to encode image")

    # Try to find corresponding label file
    label_dir = DATASET_ROOT.parent.parent / "labels" / split
    label_file = label_dir / (img_path.stem + ".txt")
    label_content: Optional[str] = None
    if label_file.exists():
        label_content = label_file.read_text(encoding="utf-8").strip()

    return JSONResponse({
        "split": split,
        "filename": img_path.name,
        "width": img_bgr.shape[1],
        "height": img_bgr.shape[0],
        "jpeg_b64": base64.b64encode(buf.tobytes()).decode("utf-8"),
        "label_txt": label_content,  # raw YOLO label lines (may be null)
    })

