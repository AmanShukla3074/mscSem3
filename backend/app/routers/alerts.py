"""
routers/alerts.py
Alert querying, filtering, simulation, acknowledgement, resolution, and SSE stream.
"""

from __future__ import annotations

import asyncio
import json
import random
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator, List, Optional

from fastapi import APIRouter, Body, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.schemas import (
    AlertOut,
    AlertResolveRequest,
    AlertStatus,
    AnimalType,
    BoundingBox,
    CropDensity,
    SimulateAlertRequest,
)
from app.services.detection_mock import generate_snapshot_bytes, run_detection
from app.services.store import store
from app.services.video_stream import camera_registry, _make_offline_frame
from app.shutdown import shutdown_event

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

# SSE broadcast queue — shared with WebSocket handler in system.py
_sse_queues: List[asyncio.Queue] = []


def broadcast_alert(alert_dict: dict) -> None:
    """Push a new alert dict to all active SSE/WS listeners."""
    for q in list(_sse_queues):
        try:
            q.put_nowait(alert_dict)
        except asyncio.QueueFull:
            pass


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _alert_to_out(a: dict) -> AlertOut:
    bbox = a.get("bounding_box", {"x": 0.3, "y": 0.2, "width": 0.2, "height": 0.3})
    return AlertOut(
        id=a["id"],
        camera_id=a["camera_id"],
        camera_name=a["camera_name"],
        timestamp=a["timestamp"],
        animal_type=AnimalType(a["animal_type"]),
        confidence_score=a["confidence_score"],
        crop_density=CropDensity(a["crop_density"]),
        snapshot_uri=a.get("snapshot_uri", ""),
        bounding_box=BoundingBox(**bbox),
        status=AlertStatus(a["status"]),
        severity=a["severity"],
        resolution_note=a.get("resolution_note"),
    )


# ─────────────────────────────────────────────
# GET /api/alerts
# ─────────────────────────────────────────────

@router.get("", response_model=List[AlertOut])
def list_alerts(
    status: Optional[str] = Query(default=None),
    crop_density: Optional[str] = Query(default=None, alias="cropDensity"),
    animal_type: Optional[str] = Query(default=None, alias="animalType"),
    limit: int = Query(default=100, ge=1, le=500),
) -> List[AlertOut]:
    """Return alerts with optional filters."""
    alerts = store.get_alerts(
        status=status,
        crop_density=crop_density,
        animal_type=animal_type,
        limit=limit,
    )
    return [_alert_to_out(a) for a in alerts]


# ─────────────────────────────────────────────
# POST /api/alerts/simulate
# ─────────────────────────────────────────────

@router.post("/simulate", response_model=AlertOut, status_code=201)
def simulate_alert(payload: SimulateAlertRequest = Body(default=SimulateAlertRequest())) -> AlertOut:
    """
    Force-trigger an immediate detection alert.
    Grabs the latest camera frame, runs mock detection, annotates it,
    and stores the snapshot bytes for serving.
    """
    # Choose camera
    cameras = store.get_cameras()
    cam = None

    if payload.camera_id:
        cam = store.get_camera(payload.camera_id)

    if cam is None:
        # Prefer the primary cam-1 (real RTSP), fallback to first cam
        cam = store.get_camera("cam-1") or (cameras[0] if cameras else None)

    if cam is None:
        raise HTTPException(status_code=404, detail="No cameras registered")

    # Get or start camera stream manager
    mgr = camera_registry.get(cam["id"])
    if mgr is None:
        mgr = camera_registry.start(cam["id"], cam["stream_url"])

    frame = mgr.get_latest_frame()
    if frame is None:
        frame = _make_offline_frame()

    # Run mock detection (animal type / density can be forced via payload)
    detection = run_detection(
        frame,
        cam["id"],
        animal_type=payload.animal_type.value if payload.animal_type else None,
        crop_density=payload.crop_density.value if payload.crop_density else None,
    )

    # Annotate and encode snapshot
    jpeg_bytes = generate_snapshot_bytes(frame, detection)
    store.save_snapshot(detection.alert_id, jpeg_bytes)

    # Build alert record
    alert = {
        "id": detection.alert_id,
        "camera_id": cam["id"],
        "camera_name": cam["name"],
        "timestamp": detection.timestamp,
        "animal_type": detection.animal_type,
        "confidence_score": detection.confidence,
        "crop_density": detection.crop_density,
        "snapshot_uri": f"/api/alerts/{detection.alert_id}/snapshot",
        "bounding_box": detection.bbox_norm,
        "status": "active",
        "severity": detection.severity,
        "resolution_note": None,
    }
    store.add_alert(alert)

    # Broadcast to SSE/WS subscribers
    broadcast_alert(alert)

    return _alert_to_out(alert)


# ─────────────────────────────────────────────
# GET /api/alerts/{id}/snapshot  (annotated JPEG)
# ─────────────────────────────────────────────

from fastapi.responses import Response as FastAPIResponse

@router.get("/{alert_id}/snapshot")
def get_alert_snapshot(alert_id: str):
    """Return the annotated JPEG snapshot for an alert."""
    jpeg = store.get_snapshot(alert_id)
    if jpeg is None:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return FastAPIResponse(content=jpeg, media_type="image/jpeg")


# ─────────────────────────────────────────────
# PUT /api/alerts/{id}/acknowledge
# ─────────────────────────────────────────────

@router.put("/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge_alert(
    alert_id: str,
    body: AlertResolveRequest = Body(default=AlertResolveRequest()),
) -> AlertOut:
    """Mark an alert as acknowledged."""
    updated = store.update_alert_status(
        alert_id, "acknowledged",
        note=body.note or "Operator acknowledged — slowing harvester",
    )
    if updated is None:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")
    return _alert_to_out(updated)


# ─────────────────────────────────────────────
# PUT /api/alerts/{id}/resolve
# ─────────────────────────────────────────────

@router.put("/{alert_id}/resolve", response_model=AlertOut)
def resolve_alert(
    alert_id: str,
    body: AlertResolveRequest = Body(default=AlertResolveRequest()),
) -> AlertOut:
    """Mark an alert as resolved with operator action notes."""
    note = body.note or "Harvester slowed down; animal cleared canopy"
    updated = store.update_alert_status(alert_id, "resolved", note=note)
    if updated is None:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")
    return _alert_to_out(updated)


# ─────────────────────────────────────────────
# GET /api/alerts/stream  (Server-Sent Events)
# ─────────────────────────────────────────────

@router.get("/stream", include_in_schema=True)
async def alert_sse_stream(request: Request) -> StreamingResponse:
    """
    Server-Sent Events stream — pushes new alert JSON to all connected clients.
    Connect once; the browser/app receives push events when simulate_alert fires.
    """
    q: asyncio.Queue = asyncio.Queue(maxsize=20)
    _sse_queues.append(q)

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # Send an initial "connected" heartbeat
            yield "event: connected\ndata: {\"status\": \"listening\"}\n\n"
            while not await request.is_disconnected():
                # Exit immediately if the server is shutting down
                if shutdown_event.is_set():
                    break
                try:
                    # Short timeout (1 s) so the loop re-checks disconnect /
                    # shutdown_event frequently; heartbeat fires on every timeout.
                    alert = await asyncio.wait_for(q.get(), timeout=1.0)
                    data = json.dumps(alert, default=str)
                    yield f"event: alert\ndata: {data}\n\n"
                except asyncio.TimeoutError:
                    if shutdown_event.is_set():
                        break
                    # Heartbeat to keep the SSE connection alive
                    yield ": heartbeat\n\n"
        finally:
            _sse_queues.remove(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
