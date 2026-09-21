/**
 * @file types/index.ts
 * Central type definitions for the IR Wildlife Detection frontend.
 * All interfaces mirror the FastAPI Pydantic models — swap mock services
 * for real API calls without changing any UI code.
 */

// ─────────────────────────────────────────────
// Enumerations / Union Types
// ─────────────────────────────────────────────

export type CropDensity = 'Light' | 'Medium' | 'Heavy';

export type ConnectionType = 'WiFi' | 'LAN' | 'RTSP';

export type CameraStatus = 'online' | 'offline' | 'connecting';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export type UserRole = 'operator' | 'admin';

export type AnimalType =
  | 'Nilgai'
  | 'Fawn'
  | 'Wild Boar'
  | 'Rabbit'
  | 'Fox'
  | 'Unknown'
  | 'Mobile Phone'
  | 'Mouse'
  | 'Duster / Remote';

export type AlertSeverity = 'critical' | 'warning' | 'info';

// ─────────────────────────────────────────────
// Camera Model
// ─────────────────────────────────────────────

export interface Camera {
  id: string;
  name: string;
  type: ConnectionType;
  /** RTSP / HTTP stream URL */
  streamUrl: string;
  ipAddress: string;
  port: number;
  fieldLocation: string;
  cropDensity: CropDensity;
  status: CameraStatus;
  /** Simulated round-trip latency in ms */
  latencyMs: number;
  /** ISO timestamp of last frame received */
  lastSeenAt: string;
}

// ─────────────────────────────────────────────
// Alert / Detection Event Model
// ─────────────────────────────────────────────

export interface BoundingBox {
  /** Normalized 0–1 coordinates relative to frame */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Alert {
  id: string;
  cameraId: string;
  cameraName: string;
  /** ISO timestamp of detection */
  timestamp: string;
  animalType: AnimalType;
  /** 0–1 confidence score from YOLO model */
  confidenceScore: number;
  cropDensity: CropDensity;
  /** URI to the thermal snapshot image */
  snapshotUri: string;
  /** Bounding box overlay data for the snapshot */
  boundingBox: BoundingBox;
  status: AlertStatus;
  /** Operator notes after resolution */
  resolutionNote?: string;
  severity: AlertSeverity;
}

// ─────────────────────────────────────────────
// User / Auth Model
// ─────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Farm or machinery operator ID */
  operatorId?: string;
}

// ─────────────────────────────────────────────
// App Settings Model
// ─────────────────────────────────────────────

export interface AppSettings {
  /** FastAPI backend base URL */
  apiBaseUrl: string;
  /** YOLO confidence threshold (0–1) */
  confidenceThreshold: number;
  /** Interval in ms for simulate-stream mock */
  simulateStreamIntervalMs: number;
  /** Whether to simulate real-time inference */
  simulateStreamEnabled: boolean;
  /** Whether audio alerts are enabled */
  audioAlertsEnabled: boolean;
}

// ─────────────────────────────────────────────
// Filter / Query Params
// ─────────────────────────────────────────────

export interface AlertFilters {
  dateFrom?: string;
  dateTo?: string;
  animalType?: AnimalType | 'All';
  minConfidence?: number;
  cropDensity?: CropDensity | 'All';
  status?: AlertStatus | 'All';
}

// ─────────────────────────────────────────────
// API Response wrappers (for future real API)
// ─────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
