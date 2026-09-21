"""
schemas.py
Pydantic v2 models for the AgriIR Guard FastAPI backend.
All models mirror the TypeScript types in frontend/src/types/index.ts.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ─────────────────────────────────────────────
# Enumerations
# ─────────────────────────────────────────────

class CropDensity(str, Enum):
    light = "Light"
    medium = "Medium"
    heavy = "Heavy"


class ConnectionType(str, Enum):
    wifi = "WiFi"
    lan = "LAN"
    rtsp = "RTSP"


class CameraStatus(str, Enum):
    online = "online"
    offline = "offline"
    connecting = "connecting"


class AlertStatus(str, Enum):
    active = "active"
    acknowledged = "acknowledged"
    resolved = "resolved"


class AlertSeverity(str, Enum):
    critical = "critical"
    warning = "warning"
    info = "info"


class AnimalType(str, Enum):
    # Original wildlife classes
    nilgai = "Nilgai"
    fawn = "Fawn"
    wild_boar = "Wild Boar"
    rabbit = "Rabbit"
    fox = "Fox"
    unknown = "Unknown"
    # Target alert classes
    mobile_phone = "Mobile Phone"
    mouse = "Mouse"
    remote = "Duster / Remote"


# ─────────────────────────────────────────────
# Camera Schemas
# ─────────────────────────────────────────────

class CameraBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(..., min_length=1, max_length=100)
    type: ConnectionType = ConnectionType.wifi
    stream_url: str = Field(..., alias="streamUrl", min_length=5)
    ip_address: str = Field(..., alias="ipAddress", min_length=7)
    port: int = Field(default=554, ge=1, le=65535)
    field_location: str = Field(..., alias="fieldLocation", min_length=1)
    crop_density: CropDensity = Field(default=CropDensity.medium, alias="cropDensity")


class CameraCreate(CameraBase):
    pass


class CameraUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = None
    type: Optional[ConnectionType] = None
    stream_url: Optional[str] = Field(default=None, alias="streamUrl")
    ip_address: Optional[str] = Field(default=None, alias="ipAddress")
    port: Optional[int] = Field(default=None, ge=1, le=65535)
    field_location: Optional[str] = Field(default=None, alias="fieldLocation")
    crop_density: Optional[CropDensity] = Field(default=None, alias="cropDensity")
    status: Optional[CameraStatus] = None


class CameraOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    type: ConnectionType
    stream_url: str = Field(serialization_alias="streamUrl")
    ip_address: str = Field(serialization_alias="ipAddress")
    port: int
    field_location: str = Field(serialization_alias="fieldLocation")
    crop_density: CropDensity = Field(serialization_alias="cropDensity")
    status: CameraStatus
    latency_ms: int = Field(default=0, serialization_alias="latencyMs")
    last_seen_at: str = Field(serialization_alias="lastSeenAt")


# ─────────────────────────────────────────────
# Bounding Box
# ─────────────────────────────────────────────

class BoundingBox(BaseModel):
    """Normalized 0–1 coordinates (x, y, width, height) relative to frame."""
    x: float = Field(..., ge=0.0, le=1.0)
    y: float = Field(..., ge=0.0, le=1.0)
    width: float = Field(..., ge=0.01, le=1.0)
    height: float = Field(..., ge=0.01, le=1.0)


# ─────────────────────────────────────────────
# Alert Schemas
# ─────────────────────────────────────────────

class AlertOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    camera_id: str = Field(serialization_alias="cameraId")
    camera_name: str = Field(serialization_alias="cameraName")
    timestamp: str
    animal_type: AnimalType = Field(serialization_alias="animalType")
    confidence_score: float = Field(serialization_alias="confidenceScore")
    crop_density: CropDensity = Field(serialization_alias="cropDensity")
    snapshot_uri: str = Field(serialization_alias="snapshotUri")
    bounding_box: BoundingBox = Field(serialization_alias="boundingBox")
    status: AlertStatus
    severity: AlertSeverity
    resolution_note: Optional[str] = Field(default=None, serialization_alias="resolutionNote")


class SimulateAlertRequest(BaseModel):
    camera_id: Optional[str] = Field(default=None, alias="cameraId")
    animal_type: Optional[AnimalType] = Field(default=None, alias="animalType")
    crop_density: Optional[CropDensity] = Field(default=None, alias="cropDensity")


class AlertResolveRequest(BaseModel):
    note: Optional[str] = Field(default=None, description="Operator resolution notes")


# ─────────────────────────────────────────────
# System Schemas
# ─────────────────────────────────────────────

class SystemHealthOut(BaseModel):
    status: str = "ok"
    fps: float
    inference_latency_ms: float = Field(serialization_alias="inferenceLatencyMs")
    active_streams: int = Field(serialization_alias="activeStreams")
    camera_count: int = Field(serialization_alias="cameraCount")
    active_alert_count: int = Field(serialization_alias="activeAlertCount")
    uptime_s: float = Field(serialization_alias="uptimeS")
    cpu_percent: float = Field(serialization_alias="cpuPercent")
    memory_percent: float = Field(serialization_alias="memoryPercent")


class PingResult(BaseModel):
    success: bool
    latency_ms: int = Field(serialization_alias="latencyMs")
    status: CameraStatus
    message: str
