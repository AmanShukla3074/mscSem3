"""
routers/cameras.py
Camera CRUD, MJPEG stream, JPEG snapshot, and ping endpoints.
"""

from __future__ import annotations

import asyncio
import socket
import time
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse

from app.schemas import (
    CameraCreate,
    CameraOut,
    CameraStatus,
    CameraUpdate,
    PingResult,
)
from app.services.store import store
from app.services.video_stream import camera_registry
from app.shutdown import shutdown_event

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _cam_to_out(cam: dict) -> CameraOut:
    return CameraOut(
        id=cam["id"],
        name=cam["name"],
        type=cam["type"],
        stream_url=cam["stream_url"],
        ip_address=cam["ip_address"],
        port=cam["port"],
        field_location=cam["field_location"],
        crop_density=cam["crop_density"],
        status=cam["status"],
        latency_ms=cam.get("latency_ms", 0),
        last_seen_at=cam.get("last_seen_at", datetime.now(timezone.utc).isoformat()),
    )


def _ensure_stream(cam: dict) -> None:
    """Start the CameraManager for a camera if it's online."""
    if cam["status"] == "online":
        camera_registry.start(cam["id"], cam["stream_url"])


# ─────────────────────────────────────────────
# GET /api/cameras
# ─────────────────────────────────────────────

@router.get("", response_model=List[CameraOut])
def list_cameras() -> List[CameraOut]:
    """Return all registered cameras."""
    cameras = store.get_cameras()
    # Sync online status with actual stream manager
    for cam in cameras:
        mgr = camera_registry.get(cam["id"])
        if mgr is not None:
            actual_status = "online" if mgr.is_online else "offline"
            if cam["status"] != actual_status:
                store.set_camera_status(cam["id"], actual_status)
                cam["status"] = actual_status
    return [_cam_to_out(c) for c in cameras]


# ─────────────────────────────────────────────
# POST /api/cameras
# ─────────────────────────────────────────────

@router.post("", response_model=CameraOut, status_code=201)
def create_camera(payload: CameraCreate) -> CameraOut:
    """Register a new IR camera."""
    cam_id = f"cam-{uuid.uuid4().hex[:8]}"
    cam = {
        "id": cam_id,
        "name": payload.name,
        "type": payload.type.value,
        "stream_url": payload.stream_url,
        "ip_address": payload.ip_address,
        "port": payload.port,
        "field_location": payload.field_location,
        "crop_density": payload.crop_density.value,
        "status": "offline",
        "latency_ms": 0,
        "last_seen_at": datetime.now(timezone.utc).isoformat(),
    }
    store.add_camera(cam)
    return _cam_to_out(cam)


# ─────────────────────────────────────────────
# PUT /api/cameras/{id}
# ─────────────────────────────────────────────

@router.put("/{camera_id}", response_model=CameraOut)
def update_camera(camera_id: str, payload: CameraUpdate) -> CameraOut:
    """Update camera metadata or RTSP URL."""
    updates: dict = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.type is not None:
        updates["type"] = payload.type.value
    if payload.stream_url is not None:
        updates["stream_url"] = payload.stream_url
    if payload.ip_address is not None:
        updates["ip_address"] = payload.ip_address
    if payload.port is not None:
        updates["port"] = payload.port
    if payload.field_location is not None:
        updates["field_location"] = payload.field_location
    if payload.crop_density is not None:
        updates["crop_density"] = payload.crop_density.value
    if payload.status is not None:
        updates["status"] = payload.status.value

    cam = store.update_camera(camera_id, updates)
    if cam is None:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")

    # If the stream URL changed, tell the existing worker to reconnect with
    # the new URL — no thread teardown, no blocking OpenCV call in the handler.
    if "stream_url" in updates:
        mgr = camera_registry.get(camera_id)
        if mgr:
            mgr.update_url(cam["stream_url"])   # non-blocking; worker reconnects naturally
        else:
            # No worker yet — start one (thread is a daemon, returns immediately)
            camera_registry.start(camera_id, cam["stream_url"])

    return _cam_to_out(cam)


# ─────────────────────────────────────────────
# DELETE /api/cameras/{id}
# ─────────────────────────────────────────────

@router.delete("/{camera_id}", status_code=204)
def delete_camera(camera_id: str) -> None:
    """Remove a camera and stop its stream."""
    if not store.delete_camera(camera_id):
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")
    mgr = camera_registry.get(camera_id)
    if mgr:
        mgr.stop()


# ─────────────────────────────────────────────
# GET /api/cameras/{id}/snapshot
# ─────────────────────────────────────────────

@router.get("/{camera_id}/snapshot")
def get_snapshot(camera_id: str) -> Response:
    """Return a fresh JPEG still from the camera stream."""
    cam = store.get_camera(camera_id)
    if cam is None:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")

    _ensure_stream(cam)
    mgr = camera_registry.get(camera_id)

    if mgr is None:
        # Start on first access
        mgr = camera_registry.start(camera_id, cam["stream_url"])
        time.sleep(0.3)  # brief settle before first read

    jpeg = mgr.get_jpeg_frame()
    return Response(content=jpeg, media_type="image/jpeg")


# ─────────────────────────────────────────────
# GET /api/cameras/{id}/stream
# ─────────────────────────────────────────────

@router.get("/{camera_id}/stream")
async def get_stream(camera_id: str, request: Request) -> StreamingResponse:
    """Return a continuous MJPEG stream."""
    cam = store.get_camera(camera_id)
    if cam is None:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")

    _ensure_stream(cam)
    mgr = camera_registry.get(camera_id)
    if mgr is None:
        mgr = camera_registry.start(camera_id, cam["stream_url"])

    return StreamingResponse(
        mgr.generate_mjpeg(request=request, shutdown_event=shutdown_event),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ─────────────────────────────────────────────
# POST /api/cameras/{id}/ping
# ─────────────────────────────────────────────

@router.post("/{camera_id}/ping", response_model=PingResult)
async def ping_camera(camera_id: str) -> PingResult:
    """
    Non-blocking ping: inspects the background stream-worker state first.
    Only performs a raw socket connect (via asyncio.to_thread) when the
    camera has no active manager yet, ensuring the FastAPI event loop is
    never blocked and the frontend never sees an AbortError/timeout.
    """
    cam = store.get_camera(camera_id)
    if cam is None:
        raise HTTPException(status_code=404, detail=f"Camera '{camera_id}' not found")

    t0 = time.monotonic()
    mgr = camera_registry.get(camera_id)

    if mgr is not None:
        # ── Fast path: read worker state directly, zero blocking ──
        stall_age = time.time() - mgr.last_frame_time
        is_alive = mgr.is_online and (stall_age < 3.0)
        latency_ms = int(stall_age * 1000) if is_alive else 0
        new_status = "online" if is_alive else "offline"
    else:
        # ── No manager yet: quick socket probe (non-blocking via thread) ──
        ip = cam.get("ip_address", "")
        port = int(cam.get("port", 554))

        def _socket_probe() -> bool:
            try:
                with socket.create_connection((ip, port), timeout=1.0):
                    return True
            except OSError:
                return False

        reachable = await asyncio.to_thread(_socket_probe)
        latency_ms = int((time.monotonic() - t0) * 1000)
        is_alive = reachable
        new_status = "online" if reachable else "offline"

        # Kick off stream manager if the camera is reachable
        if reachable:
            camera_registry.start(camera_id, cam["stream_url"])

    store.set_camera_status(camera_id, new_status, latency_ms if is_alive else 0)

    return PingResult(
        success=is_alive,
        latency_ms=latency_ms if is_alive else 0,
        status=CameraStatus(new_status),
        message=(
            f"Stream healthy (last frame {latency_ms}ms ago)"
            if is_alive
            else "Camera offline or stream stalled"
        ),
    )
