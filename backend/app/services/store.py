"""
services/store.py
Thread-safe in-memory data store for cameras, alerts, and snapshots.
Optionally persists to backend/data/store.json on shutdown / loads on startup.
"""

from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from app.schemas import (
    AlertStatus,
    AlertSeverity,
    AnimalType,
    BoundingBox,
    CameraStatus,
    ConnectionType,
    CropDensity,
)


# ─────────────────────────────────────────────
# Internal record types (plain dicts kept in memory)
# ─────────────────────────────────────────────

def _cam_record(
    id: str,
    name: str,
    stream_url: str,
    ip_address: str,
    port: int,
    field_location: str,
    crop_density: str,
    conn_type: str,
    status: str = "online",
    latency_ms: int = 42,
) -> dict:
    return {
        "id": id,
        "name": name,
        "type": conn_type,
        "stream_url": stream_url,
        "ip_address": ip_address,
        "port": port,
        "field_location": field_location,
        "crop_density": crop_density,
        "status": status,
        "latency_ms": latency_ms,
        "last_seen_at": datetime.now(timezone.utc).isoformat(),
    }


def _alert_record(
    id: str,
    camera_id: str,
    camera_name: str,
    animal_type: str,
    confidence: float,
    crop_density: str,
    bbox: dict,
    status: str,
    severity: str,
    resolution_note: Optional[str] = None,
    timestamp_offset_s: int = 0,
) -> dict:
    ts = datetime.fromtimestamp(
        datetime.now(timezone.utc).timestamp() - timestamp_offset_s,
        tz=timezone.utc,
    ).isoformat()
    return {
        "id": id,
        "camera_id": camera_id,
        "camera_name": camera_name,
        "timestamp": ts,
        "animal_type": animal_type,
        "confidence_score": confidence,
        "crop_density": crop_density,
        "snapshot_uri": f"mock://snapshot/{id}",
        "bounding_box": bbox,
        "status": status,
        "severity": severity,
        "resolution_note": resolution_note,
    }


# ─────────────────────────────────────────────
# Seed data (matches frontend mockData.ts)
# ─────────────────────────────────────────────

_SEED_CAMERAS: List[dict] = [
    _cam_record(
        "cam-1", "CP-E25A Forward Harvester", 
        "rtsp://admin:amanhehe@10.24.158.124:5543/live/channel1",
        "10.24.158.124", 5543, "Plot A - Front Header", "Medium", "WiFi",
        status="online", latency_ms=42,
    ),
    _cam_record(
        "cam-001", "Front Left IR",
        "rtsp://192.168.1.101:554/stream1",
        "192.168.1.101", 554, "Field A — North Quadrant", "Heavy", "WiFi",
        status="online", latency_ms=42,
    ),
    _cam_record(
        "cam-002", "Front Right IR",
        "rtsp://192.168.1.102:554/stream1",
        "192.168.1.102", 554, "Field A — North Quadrant", "Heavy", "WiFi",
        status="online", latency_ms=58,
    ),
    _cam_record(
        "cam-003", "Rear Centre IR",
        "rtsp://10.0.0.50:8554/live",
        "10.0.0.50", 8554, "Field B — East Row", "Medium", "LAN",
        status="online", latency_ms=31,
    ),
    _cam_record(
        "cam-004", "Side Flank IR",
        "rtsp://10.0.0.51:8554/thermal",
        "10.0.0.51", 8554, "Field B — West Row", "Light", "RTSP",
        status="offline", latency_ms=0,
    ),
]

_SEED_ALERTS: List[dict] = [
    _alert_record("alert-001", "cam-001", "Front Left IR", "Nilgai", 0.942, "Heavy",
                  {"x": 0.35, "y": 0.2, "width": 0.28, "height": 0.45}, "active", "critical",
                  timestamp_offset_s=240),
    _alert_record("alert-002", "cam-002", "Front Right IR", "Fawn", 0.874, "Heavy",
                  {"x": 0.55, "y": 0.3, "width": 0.18, "height": 0.32}, "acknowledged", "critical",
                  "Operator slowed harvester. Fawn moved to field edge.", timestamp_offset_s=1080),
    _alert_record("alert-003", "cam-003", "Rear Centre IR", "Wild Boar", 0.789, "Medium",
                  {"x": 0.2, "y": 0.4, "width": 0.35, "height": 0.38}, "resolved", "critical",
                  "Harvester stopped. Animal cleared.", timestamp_offset_s=2700),
    _alert_record("alert-004", "cam-001", "Front Left IR", "Rabbit", 0.651, "Medium",
                  {"x": 0.6, "y": 0.5, "width": 0.12, "height": 0.15}, "resolved", "warning",
                  "False alarm confirmed after second pass.", timestamp_offset_s=7200),
    _alert_record("alert-005", "cam-003", "Rear Centre IR", "Nilgai", 0.918, "Heavy",
                  {"x": 0.28, "y": 0.15, "width": 0.32, "height": 0.5}, "resolved", "critical",
                  "Emergency stop triggered. Animal evaded.", timestamp_offset_s=10800),
    _alert_record("alert-006", "cam-002", "Front Right IR", "Fox", 0.713, "Light",
                  {"x": 0.45, "y": 0.35, "width": 0.2, "height": 0.25}, "resolved", "warning",
                  "Dismissed — fox moved before harvester reached.", timestamp_offset_s=18000),
    _alert_record("alert-007", "cam-001", "Front Left IR", "Fawn", 0.962, "Heavy",
                  {"x": 0.38, "y": 0.22, "width": 0.22, "height": 0.38}, "resolved", "critical",
                  "Emergency stop. Fawn carried to field edge by operator.", timestamp_offset_s=28800),
    _alert_record("alert-008", "cam-003", "Rear Centre IR", "Unknown", 0.502, "Medium",
                  {"x": 0.5, "y": 0.4, "width": 0.15, "height": 0.2}, "resolved", "info",
                  "Unidentified. Likely debris. Dismissed.", timestamp_offset_s=43200),
    _alert_record("alert-009", "cam-002", "Front Right IR", "Wild Boar", 0.881, "Heavy",
                  {"x": 0.22, "y": 0.28, "width": 0.4, "height": 0.42}, "resolved", "critical",
                  "Harvester detoured. Boar cleared.", timestamp_offset_s=57600),
    _alert_record("alert-010", "cam-001", "Front Left IR", "Nilgai", 0.835, "Medium",
                  {"x": 0.3, "y": 0.18, "width": 0.3, "height": 0.48}, "resolved", "critical",
                  "Resolved — slow approach, animal left field.", timestamp_offset_s=72000),
    _alert_record("alert-011", "cam-003", "Rear Centre IR", "Rabbit", 0.612, "Light",
                  {"x": 0.65, "y": 0.55, "width": 0.1, "height": 0.12}, "resolved", "warning",
                  "Dismissed as false alarm.", timestamp_offset_s=86400),
    _alert_record("alert-012", "cam-002", "Front Right IR", "Fawn", 0.945, "Heavy",
                  {"x": 0.4, "y": 0.25, "width": 0.25, "height": 0.4}, "resolved", "critical",
                  "Emergency stop. Fawn relocated.", timestamp_offset_s=100800),
]

# ─────────────────────────────────────────────
# Store
# ─────────────────────────────────────────────

DATA_DIR = Path(__file__).parent.parent.parent / "data"
STORE_FILE = DATA_DIR / "store.json"


class DataStore:
    """Thread-safe in-memory store with optional JSON file persistence."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.cameras: Dict[str, dict] = {}
        self.alerts: List[dict] = []
        self.snapshots: Dict[str, bytes] = {}  # alert_id → annotated JPEG bytes

    # ── Persistence ──────────────────────────

    def load(self) -> None:
        """Load persisted state from store.json, falling back to seed data."""
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        if STORE_FILE.exists():
            try:
                with open(STORE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                with self._lock:
                    cam_list = data.get("cameras", [])
                    self.cameras = {c["id"]: c for c in cam_list}
                    self.alerts = data.get("alerts", [])
                # Re-seed missing default cam if store was partial
                if "cam-1" not in self.cameras:
                    self._seed()
                print(f"[store] Loaded {len(self.cameras)} cameras, {len(self.alerts)} alerts from {STORE_FILE}")
                return
            except Exception as e:
                print(f"[store] Could not load {STORE_FILE}: {e} — using seed data")
        self._seed()

    def _seed(self) -> None:
        """Populate with seed data."""
        with self._lock:
            for cam in _SEED_CAMERAS:
                self.cameras[cam["id"]] = cam.copy()
            self.alerts = [a.copy() for a in _SEED_ALERTS]
        print(f"[store] Seeded {len(self.cameras)} cameras, {len(self.alerts)} alerts")

    def persist(self) -> None:
        """Write current state to store.json."""
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            with self._lock:
                data = {
                    "cameras": list(self.cameras.values()),
                    "alerts": self.alerts,
                }
            with open(STORE_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)
            print(f"[store] Persisted to {STORE_FILE}")
        except Exception as e:
            print(f"[store] Persist failed: {e}")

    # ── Camera operations ────────────────────

    def get_cameras(self) -> List[dict]:
        with self._lock:
            return list(self.cameras.values())

    def get_camera(self, camera_id: str) -> Optional[dict]:
        with self._lock:
            return self.cameras.get(camera_id)

    def add_camera(self, camera: dict) -> dict:
        with self._lock:
            self.cameras[camera["id"]] = camera
        return camera

    def update_camera(self, camera_id: str, updates: dict) -> Optional[dict]:
        with self._lock:
            cam = self.cameras.get(camera_id)
            if cam is None:
                return None
            cam.update({k: v for k, v in updates.items() if v is not None})
            cam["last_seen_at"] = datetime.now(timezone.utc).isoformat()
            return cam

    def delete_camera(self, camera_id: str) -> bool:
        with self._lock:
            if camera_id in self.cameras:
                del self.cameras[camera_id]
                return True
            return False

    def set_camera_status(self, camera_id: str, status: str, latency_ms: int = 0) -> None:
        with self._lock:
            cam = self.cameras.get(camera_id)
            if cam:
                cam["status"] = status
                cam["latency_ms"] = latency_ms
                if status == "online":
                    cam["last_seen_at"] = datetime.now(timezone.utc).isoformat()

    # ── Alert operations ─────────────────────

    def get_alerts(
        self,
        status: Optional[str] = None,
        crop_density: Optional[str] = None,
        animal_type: Optional[str] = None,
        limit: int = 100,
    ) -> List[dict]:
        with self._lock:
            results = list(self.alerts)

        results.sort(key=lambda a: a["timestamp"], reverse=True)

        if status:
            results = [a for a in results if a["status"] == status]
        if crop_density:
            results = [a for a in results if a["crop_density"] == crop_density]
        if animal_type:
            results = [a for a in results if a["animal_type"] == animal_type]

        return results[:limit]

    def add_alert(self, alert: dict) -> dict:
        with self._lock:
            self.alerts.insert(0, alert)
        return alert

    def update_alert_status(
        self, alert_id: str, status: str, note: Optional[str] = None
    ) -> Optional[dict]:
        with self._lock:
            for alert in self.alerts:
                if alert["id"] == alert_id:
                    alert["status"] = status
                    if note is not None:
                        alert["resolution_note"] = note
                    return alert
        return None

    def get_alert(self, alert_id: str) -> Optional[dict]:
        with self._lock:
            for alert in self.alerts:
                if alert["id"] == alert_id:
                    return alert
        return None

    def active_alert_count(self) -> int:
        with self._lock:
            return sum(1 for a in self.alerts if a["status"] == "active")

    # ── Snapshot buffer ──────────────────────

    def save_snapshot(self, alert_id: str, jpeg_bytes: bytes) -> None:
        with self._lock:
            self.snapshots[alert_id] = jpeg_bytes

    def get_snapshot(self, alert_id: str) -> Optional[bytes]:
        with self._lock:
            return self.snapshots.get(alert_id)


# Singleton store instance
store = DataStore()
