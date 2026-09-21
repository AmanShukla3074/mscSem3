"""
main.py
AgriIR Guard — FastAPI application entry point.
Initialises CORS, mounts routers, and manages lifespan (store load/persist,
camera stream startup).
"""

from __future__ import annotations

from contextlib import asynccontextmanager
import asyncio
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import cameras, alerts, system
from app.services.store import store, DATA_DIR
from app.services.video_stream import camera_registry
from app.shutdown import shutdown_event


# ─────────────────────────────────────────────
# Lifespan (startup / shutdown)
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # ── Startup ──
    print("[startup] Loading data store...")
    store.load()

    # Auto-start stream workers for every registered camera.
    # Workers connect in the background — if a camera is unreachable the worker
    # will keep retrying every 2 s without blocking the HTTP server.
    cameras_in_store = store.get_cameras()
    for cam in cameras_in_store:
        print(f"[startup] Starting stream worker for camera '{cam['id']}' → {cam['stream_url']}")
        camera_registry.start(cam["id"], cam["stream_url"])

    print(f"[startup] AgriIR Guard backend ready — {len(cameras_in_store)} camera(s) registered.")
    yield

    # ── Shutdown ──
    print("[shutdown] Signalling streaming generators to stop...")
    shutdown_event.set()          # unblocks MJPEG + SSE generators immediately
    await asyncio.sleep(0.1)      # one event-loop tick for generators to see it
    print("[shutdown] Stopping all camera streams...")
    camera_registry.stop_all()
    print("[shutdown] Persisting store to disk...")
    store.persist()
    print("[shutdown] Done.")


# ─────────────────────────────────────────────
# App
# ─────────────────────────────────────────────

app = FastAPI(
    title="AgriIR Guard API",
    description=(
        "Edge IR wildlife detection system for harvester safety. "
        "Ground-level infrared detection of Nilgai, fawns, and boars "
        "occluded in crops during harvesting operations."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

# CORS — allow all origins for LAN development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Routers
# ─────────────────────────────────────────────

app.include_router(cameras.router)
app.include_router(alerts.router)
app.include_router(system.router)


# ─────────────────────────────────────────────
# Root health check
# ─────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "status": "AgriIR Guard backend running",
        "version": "0.2.0",
        "docs": "/docs",
    }


@app.get("/api/health")
def api_health():
    return {"status": "ok"}