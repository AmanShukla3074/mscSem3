"""
routers/system.py
Edge pipeline diagnostics, health telemetry, and WebSocket alert broadcast.
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Dict, List

import psutil
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.schemas import SystemHealthOut
from app.services.store import store
from app.services.video_stream import camera_registry

router = APIRouter(prefix="/api/system", tags=["system"])

# Track WebSocket connections
_ws_clients: List[WebSocket] = []

# Server start time
_start_time = time.monotonic()


# ─────────────────────────────────────────────
# GET /api/system/health
# ─────────────────────────────────────────────

@router.get("/health", response_model=SystemHealthOut)
def get_health() -> SystemHealthOut:
    """Return edge pipeline diagnostics and server telemetry."""
    cameras = store.get_cameras()
    active_alerts = store.active_alert_count()
    active_streams = camera_registry.active_count()

    # FPS estimate: 15 FPS target when any stream is online
    fps = 15.0 * (active_streams / max(len(cameras), 1)) if cameras else 0.0

    return SystemHealthOut(
        status="ok",
        fps=round(fps, 1),
        inference_latency_ms=45.0,  # Target edge latency
        active_streams=active_streams,
        camera_count=len(cameras),
        active_alert_count=active_alerts,
        uptime_s=round(time.monotonic() - _start_time, 1),
        cpu_percent=psutil.cpu_percent(interval=0.1),
        memory_percent=psutil.virtual_memory().percent,
    )


# ─────────────────────────────────────────────
# WS /api/system/ws/alerts
# ─────────────────────────────────────────────

@router.websocket("/ws/alerts")
async def ws_alert_stream(websocket: WebSocket) -> None:
    """
    WebSocket endpoint — broadcasts new alert JSON to all connected clients.
    The frontend can connect here to receive live push events without polling.
    """
    await websocket.accept()
    _ws_clients.append(websocket)
    try:
        # Send initial heartbeat
        await websocket.send_json({"event": "connected", "data": {"status": "listening"}})
        # Keep alive — wait for disconnect
        while True:
            try:
                # Echo any client pings back
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                if msg == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # Heartbeat
                await websocket.send_json({"event": "heartbeat"})
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in _ws_clients:
            _ws_clients.remove(websocket)


async def broadcast_ws(alert: Dict[str, Any]) -> None:
    """Push alert to all connected WebSocket clients."""
    dead: List[WebSocket] = []
    for ws in list(_ws_clients):
        try:
            await ws.send_json({"event": "alert", "data": alert})
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in _ws_clients:
            _ws_clients.remove(ws)
