"""
services/video_stream.py
Thread-safe RTSP camera manager using OpenCV.
Uses a dedicated grab-only background thread per camera to eliminate
RTSP buffer backlog, stutter, and JPEG encoding bottlenecks.
"""

from __future__ import annotations

import asyncio
import os
import threading
import time
from typing import AsyncGenerator, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import Request

import cv2
import numpy as np

# ── MUST be set before any cv2.VideoCapture call ──────────────────────────────
# ONLY rtsp_transport;tcp — verified working on 2026-09-21.
# Extra flags (stimeout, fflags, flags=low_delay) break the handshake on this stream.
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = (
    "rtsp_transport;tcp;stimeout;4000000;fflags;nobuffer;flags;low_delay"
)


# ─────────────────────────────────────────────
# Synthetic IR offline frame generator
# ─────────────────────────────────────────────

def _make_offline_frame(width: int = 640, height: int = 360) -> np.ndarray:
    """
    Generate a charcoal-themed IR-style test pattern with an
    'OFFLINE / RECONNECTING' overlay. Runs without a live camera.
    """
    # Deep charcoal base (#0A0A1E in BGR)
    frame = np.full((height, width, 3), (30, 10, 10), dtype=np.uint8)

    # Subtle blue-grey gradient noise to simulate thermal background
    noise = np.random.randint(0, 20, (height, width, 3), dtype=np.uint8)
    frame = cv2.add(frame, noise)

    # Scan-line grid overlay (thin horizontal lines every 8px)
    for y in range(0, height, 8):
        cv2.line(frame, (0, y), (width, y), (45, 25, 25), 1)

    # Simulated warm hotspots (animal-shaped blobs)
    cv2.ellipse(frame, (int(width * 0.25), int(height * 0.35)),
                (45, 30), 0, 0, 360, (35, 60, 120), -1)
    cv2.GaussianBlur(frame, (0, 0), 5, frame)

    # Corner IR crosshair decorations
    ch_color = (80, 80, 80)
    for cx, cy in [(20, 20), (width - 20, 20), (20, height - 20), (width - 20, height - 20)]:
        cv2.line(frame, (cx - 10, cy), (cx + 10, cy), ch_color, 1)
        cv2.line(frame, (cx, cy - 10), (cx, cy + 10), ch_color, 1)

    # "NO SIGNAL" title
    font = cv2.FONT_HERSHEY_SIMPLEX
    label = "OFFLINE / RECONNECTING"
    sub = "Camera stream unavailable"
    (lw, lh), _ = cv2.getTextSize(label, font, 0.7, 2)
    (sw, sh), _ = cv2.getTextSize(sub, font, 0.4, 1)
    lx, ly = (width - lw) // 2, height // 2 - 10
    sx, sy = (width - sw) // 2, ly + lh + 14

    # Text shadow
    cv2.putText(frame, label, (lx + 1, ly + 1), font, 0.7, (0, 0, 0), 2)
    cv2.putText(frame, label, (lx, ly), font, 0.7, (40, 100, 220), 2)   # amber-ish in BGR
    cv2.putText(frame, sub, (sx, sy), font, 0.4, (110, 110, 110), 1)

    # Amber warning triangle (simplified)
    pts = np.array([
        [width // 2, ly - 45],
        [width // 2 - 18, ly - 15],
        [width // 2 + 18, ly - 15],
    ], dtype=np.int32)
    cv2.fillPoly(frame, [pts], (0, 140, 240))   # BGR orange
    cv2.putText(frame, "!", (width // 2 - 4, ly - 20), font, 0.5, (0, 0, 0), 2)

    # Live-IR badge (top-left)
    cv2.rectangle(frame, (6, 6), (70, 22), (0, 0, 0), -1)
    cv2.putText(frame, "● OFFLINE", (8, 18), font, 0.35, (80, 80, 200), 1)

    return frame


# ─────────────────────────────────────────────
# CameraManager
# ─────────────────────────────────────────────

class CameraManager:
    """
    Manages a single RTSP/HTTP camera stream with a dedicated grab-only
    background thread. The thread does nothing but call cap.grab() as fast as
    possible, always overwriting `_latest_frame` so consumers always get the
    most recent decoded image without any queue backlog.
    """

    RECONNECT_DELAY_S: float = 5.0
    # Quality 65 encodes ~2× faster than 80 with negligible visible difference
    JPEG_QUALITY: int = 65
    # Target ~30 FPS for the MJPEG HTTP stream
    MJPEG_INTERVAL_S: float = 1.0 / 30.0

    def __init__(self, camera_id: str, rtsp_url: str) -> None:
        self.camera_id = camera_id
        self.rtsp_url = rtsp_url

        # Single-frame slot: grab thread writes, consumers read
        self._latest_frame: Optional[np.ndarray] = None
        self._frame_lock = threading.Lock()

        self._stop_event = threading.Event()
        self._is_online = threading.Event()

        # Timestamp of the last successfully decoded frame.
        # Initialised to 0 so the stall-check triggers immediately on startup
        # if no frame arrives within the timeout window.
        self.last_frame_time: float = 0.0

        # Kept so stop() can release the cap and unblock cap.read() immediately.
        self._cap_lock = threading.Lock()
        self._current_cap: Optional[cv2.VideoCapture] = None

        self._thread = threading.Thread(
            target=self._grab_loop,
            name=f"cam-grab-{camera_id}",
            daemon=True,
        )
        self._thread.start()

    # Frames older than this are treated as stale (camera powered off / silent freeze)
    FRAME_STALE_S: float = 2.5

    def _is_frame_stale(self) -> bool:
        """True when no valid frame has arrived for more than FRAME_STALE_S seconds."""
        return self.last_frame_time == 0.0 or (time.time() - self.last_frame_time > self.FRAME_STALE_S)

    def get_latest_frame(self) -> np.ndarray:
        """
        Return the most recent decoded frame.
        If the frame is stale (camera offline/frozen) or missing, return the
        offline placeholder so the consumer never sees a frozen image.
        """
        if self._is_frame_stale():
            return _make_offline_frame()
        with self._frame_lock:
            if self._latest_frame is not None:
                return self._latest_frame.copy()
        return _make_offline_frame()

    def get_jpeg_frame(self) -> bytes:
        """
        Encode the latest frame as JPEG bytes.
        Serves a distinct dark-slate 'CAMERA OFFLINE — RECONNECTING...' frame
        when the stream is stale, so the browser feed never shows a frozen image.
        """
        if self._is_frame_stale():
            # Strict "OFFLINE" slate — no frozen frame ever shown
            slate = np.zeros((360, 640, 3), dtype=np.uint8)
            cv2.putText(
                slate,
                "OFFLINE",
                (240, 190),
                cv2.FONT_HERSHEY_SIMPLEX,
                1.2,
                (0, 0, 255),
                3,
                cv2.LINE_AA,
            )
            ok, buf = cv2.imencode(".jpg", slate)
            return buf.tobytes() if ok else b""

        with self._frame_lock:
            frame = self._latest_frame.copy() if self._latest_frame is not None else None

        if frame is None:
            return b""

        ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), self.JPEG_QUALITY])
        return buf.tobytes() if ok else b""


    async def generate_mjpeg(
        self,
        request: "Optional[Request]" = None,
        shutdown_event: "Optional[asyncio.Event]" = None,
    ) -> AsyncGenerator[bytes, None]:
        """
        Async generator that yields multipart/x-mixed-replace frame chunks
        for FastAPI StreamingResponse. Throttled to ~30 FPS via asyncio.sleep.

        Exits immediately when:
        - The CameraManager is stopped (_stop_event).
        - The HTTP client disconnects (request.is_disconnected()).
        - The server signals shutdown (shutdown_event).
        """
        while not self._stop_event.is_set():
            # Fast-path exit checks — both are non-blocking
            if shutdown_event is not None and shutdown_event.is_set():
                break
            if request is not None and await request.is_disconnected():
                break

            jpeg = self.get_jpeg_frame()
            if jpeg:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
                )
            # Yield control to the event loop and throttle to ~30 FPS
            await asyncio.sleep(self.MJPEG_INTERVAL_S)

    @property
    def is_online(self) -> bool:
        return self._is_online.is_set()

    def stop(self) -> None:
        """
        Signal the background grab thread to terminate and immediately release
        the active VideoCapture so any blocking cap.read() call unblocks at once.
        Without this, cap.read() on a live RTSP stream can block for up to 30 s,
        causing Uvicorn to hang on "Waiting for connections to close".
        """
        self._stop_event.set()
        with self._cap_lock:
            cap = self._current_cap
            self._current_cap = None
        if cap is not None:
            try:
                cap.release()
            except Exception:
                pass

    def update_url(self, new_url: str) -> None:
        """
        Non-destructively update the RTSP URL without stopping the worker thread.
        Releases the current cap so the reconnect loop picks up the new URL on
        the very next cycle — no thread tear-down, no event-loop blocking.
        """
        self.rtsp_url = new_url
        with self._cap_lock:
            cap = self._current_cap
            self._current_cap = None
        if cap is not None:
            try:
                cap.release()   # unblocks cap.read(); worker will reconnect with new URL
            except Exception:
                pass
        self._is_online.clear()
        self.last_frame_time = 0.0
        with self._frame_lock:
            self._latest_frame = None

    # ── Grab loop (background daemon) ────────

    # Seconds without a valid frame before the stream is considered stalled
    STALL_TIMEOUT_S: float = 3.0
    # Seconds to wait between reconnection attempts when offline
    RECONNECT_SLEEP_S: float = 1.5

    def _grab_loop(self) -> None:
        """
        Background capture thread using the verified-working cap.read() pattern.

        Uses cap.read() instead of grab()+retrieve() — simpler and confirmed
        working with this stream. Reconnects automatically on read failure.
        Stall detection marks the camera offline if no frame arrives within
        STALL_TIMEOUT_S seconds (handles silent stream freeze after power loss).
        """
        print(f"[cam {self.camera_id}] Worker started for {self.rtsp_url}")
        while not self._stop_event.is_set():
            cap = self._open_capture()
            if cap is None:
                self._is_online.clear()
                with self._frame_lock:
                    self._latest_frame = None
                print(f"[cam {self.camera_id}] Open failed — retrying in {self.RECONNECT_SLEEP_S}s")
                deadline = time.monotonic() + self.RECONNECT_SLEEP_S
                while not self._stop_event.is_set() and time.monotonic() < deadline:
                    time.sleep(0.1)
                continue

            # Register the open cap so stop() can release it immediately
            with self._cap_lock:
                self._current_cap = cap

            self._is_online.set()
            self.last_frame_time = time.time()
            print(f"[cam {self.camera_id}] Stream open ✓  {self.rtsp_url}")

            while not self._stop_event.is_set():
                # ── Stall detection ──────────────────────────────────────────
                if time.time() - self.last_frame_time > self.STALL_TIMEOUT_S:
                    print(
                        f"[cam {self.camera_id}] No frame for {self.STALL_TIMEOUT_S}s "
                        f"— releasing cap and reconnecting"
                    )
                    with self._cap_lock:
                        self._current_cap = None
                    cap.release()
                    cap = None  # type: ignore[assignment]
                    self._is_online.clear()
                    with self._frame_lock:
                        self._latest_frame = None
                    break

                # ── Verified-working read pattern ────────────────────────────
                ret, frame = cap.read()  # type: ignore[union-attr]

                # Check stop immediately after read — cap.read() is the one
                # blocking call that can hold for 30 s on an RTSP stream.
                if self._stop_event.is_set():
                    break

                if ret and frame is not None:
                    self.last_frame_time = time.time()
                    if not self._is_online.is_set():
                        self._is_online.set()
                        print(f"[cam {self.camera_id}] Stream recovered ✓")
                    with self._frame_lock:
                        self._latest_frame = frame
                else:
                    # Read failed — release and reconnect immediately
                    print(f"[cam {self.camera_id}] cap.read() failed — reconnecting")
                    with self._cap_lock:
                        self._current_cap = None
                    cap.release()
                    cap = None  # type: ignore[assignment]
                    self._is_online.clear()
                    with self._frame_lock:
                        self._latest_frame = None
                    break

            # Release cap if still open (reached on normal stop or stall break)
            with self._cap_lock:
                self._current_cap = None
            if cap is not None:
                try:
                    cap.release()
                except Exception:
                    pass
            self._is_online.clear()
            with self._frame_lock:
                self._latest_frame = None

            if not self._stop_event.is_set():
                print(f"[cam {self.camera_id}] Reconnecting in {self.RECONNECT_SLEEP_S}s...")
                deadline = time.monotonic() + self.RECONNECT_SLEEP_S
                while not self._stop_event.is_set() and time.monotonic() < deadline:
                    time.sleep(0.1)

        print(f"[cam {self.camera_id}] Worker stopped.")

    def _open_capture(self) -> Optional[cv2.VideoCapture]:
        """
        Open VideoCapture with the verified-working minimal settings.
        Does NOT do a warm-up grab — on this stream, the extra grab call
        during _open_capture was found to cause connection failures.
        """
        try:
            cap = cv2.VideoCapture(self.rtsp_url, cv2.CAP_FFMPEG)
            # Keep internal FFMPEG buffer at 1 frame to avoid stale-frame buildup
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if not cap.isOpened():
                cap.release()
                return None
            return cap
        except Exception as exc:
            print(f"[cam {self.camera_id}] Open error: {exc}")
            return None


# ─────────────────────────────────────────────
# Manager registry
# ─────────────────────────────────────────────

class CameraRegistry:
    """Singleton registry mapping camera_id → CameraManager."""

    def __init__(self) -> None:
        self._managers: dict[str, CameraManager] = {}
        self._lock = threading.Lock()

    def start(self, camera_id: str, rtsp_url: str) -> CameraManager:
        with self._lock:
            if camera_id in self._managers:
                mgr = self._managers[camera_id]
                if mgr.rtsp_url != rtsp_url:
                    # URL changed — tell the worker non-destructively; it will
                    # reconnect with the new URL on its next cycle.
                    mgr.update_url(rtsp_url)
                return mgr
            mgr = CameraManager(camera_id, rtsp_url)
            self._managers[camera_id] = mgr
            return mgr

    def get(self, camera_id: str) -> Optional[CameraManager]:
        with self._lock:
            return self._managers.get(camera_id)

    def stop_all(self) -> None:
        with self._lock:
            for mgr in self._managers.values():
                mgr.stop()
            self._managers.clear()

    def active_count(self) -> int:
        with self._lock:
            return sum(1 for m in self._managers.values() if m.is_online)


camera_registry = CameraRegistry()
