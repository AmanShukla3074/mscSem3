/**
 * @file services/apiClient.ts
 * Real API service layer — drop-in replacement for mockCameraService and
 * mockAlertService. Method signatures are identical so contexts require
 * only an import swap, with zero UI changes.
 *
 * Maps to FastAPI endpoints:
 *   /api/cameras   — Camera CRUD + stream + ping
 *   /api/alerts    — Alert querying, simulate, acknowledge, resolve
 *   /api/system    — Health diagnostics
 */

import { api, getSnapshotUrl, getAlertSnapshotUrl } from '@/services/api';
import type {
  Alert,
  AlertFilters,
  AlertStatus,
  Camera,
} from '@/types';

// ─────────────────────────────────────────────
// Re-export CameraPayload type (was in mockCameraService)
// ─────────────────────────────────────────────

export type CameraPayload = Omit<Camera, 'id' | 'status' | 'latencyMs' | 'lastSeenAt'>;

// ─────────────────────────────────────────────
// Response shape adapters (backend uses snake_case aliases)
// The FastAPI schemas use serialization_alias so the JSON coming back
// is already camelCase. We just typecast.
// ─────────────────────────────────────────────

function normCamera(raw: any): Camera {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    streamUrl: raw.streamUrl ?? raw.stream_url ?? '',
    ipAddress: raw.ipAddress ?? raw.ip_address ?? '',
    port: raw.port ?? 554,
    fieldLocation: raw.fieldLocation ?? raw.field_location ?? '',
    cropDensity: raw.cropDensity ?? raw.crop_density ?? 'Medium',
    status: raw.status ?? 'offline',
    latencyMs: raw.latencyMs ?? raw.latency_ms ?? 0,
    lastSeenAt: raw.lastSeenAt ?? raw.last_seen_at ?? new Date().toISOString(),
  };
}

function normAlert(raw: any): Alert {
  const snapshotUri = raw.snapshotUri ?? raw.snapshot_uri ?? '';
  // If the snapshot is an API path (not mock://), prefix with base URL
  const resolvedSnapshot =
    snapshotUri.startsWith('/api/')
      ? getAlertSnapshotUrl(raw.id)
      : snapshotUri;

  const bbox = raw.boundingBox ?? raw.bounding_box ?? { x: 0.3, y: 0.2, width: 0.2, height: 0.3 };

  return {
    id: raw.id,
    cameraId: raw.cameraId ?? raw.camera_id,
    cameraName: raw.cameraName ?? raw.camera_name ?? '',
    timestamp: raw.timestamp,
    animalType: raw.animalType ?? raw.animal_type,
    confidenceScore: raw.confidenceScore ?? raw.confidence_score ?? 0,
    cropDensity: raw.cropDensity ?? raw.crop_density ?? 'Medium',
    snapshotUri: resolvedSnapshot,
    boundingBox: {
      x: bbox.x ?? 0.3,
      y: bbox.y ?? 0.2,
      width: bbox.width ?? 0.2,
      height: bbox.height ?? 0.3,
    },
    status: raw.status ?? 'active',
    severity: raw.severity ?? 'warning',
    resolutionNote: raw.resolutionNote ?? raw.resolution_note,
  };
}

// ─────────────────────────────────────────────
// Camera API Service
// ─────────────────────────────────────────────

export const cameraApiService = {
  /** Fetch all cameras */
  getAll: async (): Promise<Camera[]> => {
    const data = await api.get<any[]>('/api/cameras');
    return data.map(normCamera);
  },

  /** Get a single camera */
  getById: async (id: string): Promise<Camera | undefined> => {
    try {
      const data = await api.get<any>(`/api/cameras/${id}`);
      return normCamera(data);
    } catch {
      return undefined;
    }
  },

  /** Create a new camera */
  create: async (payload: CameraPayload): Promise<Camera> => {
    const body = {
      name: payload.name,
      type: payload.type,
      streamUrl: payload.streamUrl,
      ipAddress: payload.ipAddress,
      port: payload.port,
      fieldLocation: payload.fieldLocation,
      cropDensity: payload.cropDensity,
    };
    const data = await api.post<any>('/api/cameras', body);
    return normCamera(data);
  },

  /** Update an existing camera */
  update: async (id: string, payload: Partial<CameraPayload>): Promise<Camera> => {
    const body: Record<string, unknown> = {};
    if (payload.name !== undefined) body.name = payload.name;
    if (payload.type !== undefined) body.type = payload.type;
    if (payload.streamUrl !== undefined) body.streamUrl = payload.streamUrl;
    if (payload.ipAddress !== undefined) body.ipAddress = payload.ipAddress;
    if (payload.port !== undefined) body.port = payload.port;
    if (payload.fieldLocation !== undefined) body.fieldLocation = payload.fieldLocation;
    if (payload.cropDensity !== undefined) body.cropDensity = payload.cropDensity;
    const data = await api.put<any>(`/api/cameras/${id}`, body);
    return normCamera(data);
  },

  /** Delete a camera */
  delete: async (id: string): Promise<void> => {
    await api.delete<void>(`/api/cameras/${id}`);
  },

  /** Test RTSP connection and return latency */
  testConnection: async (id: string): Promise<{ success: boolean; latencyMs: number }> => {
    const data = await api.post<any>(`/api/cameras/${id}/ping`);
    return {
      success: data.success,
      latencyMs: data.latencyMs ?? data.latency_ms ?? 0,
    };
  },

  /**
   * Refresh camera statuses from backend.
   * Replaces the mock latency jitter with real backend values.
   */
  refreshStatuses: async (): Promise<Camera[]> => {
    const data = await api.get<any[]>('/api/cameras');
    return data.map(normCamera);
  },
};

// ─────────────────────────────────────────────
// Alert API Service
// ─────────────────────────────────────────────

export const alertApiService = {
  /** Fetch alerts with optional filters */
  getAll: async (filters?: AlertFilters): Promise<Alert[]> => {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'All') params.set('status', filters.status);
    if (filters?.cropDensity && filters.cropDensity !== 'All') params.set('cropDensity', filters.cropDensity);
    if (filters?.animalType && filters.animalType !== 'All') params.set('animalType', filters.animalType);

    const qs = params.toString();
    const path = `/api/alerts${qs ? `?${qs}` : ''}`;
    const data = await api.get<any[]>(path);
    return data.map(normAlert);
  },

  /** Get single alert */
  getById: async (id: string): Promise<Alert | undefined> => {
    const data = await api.get<any[]>('/api/alerts');
    const found = data.find((a: any) => a.id === id);
    return found ? normAlert(found) : undefined;
  },

  /** Update alert status (acknowledge / resolve) */
  updateStatus: async (
    id: string,
    status: AlertStatus,
    resolutionNote?: string,
  ): Promise<Alert> => {
    const path = status === 'acknowledged'
      ? `/api/alerts/${id}/acknowledge`
      : `/api/alerts/${id}/resolve`;
    const data = await api.put<any>(path, { note: resolutionNote });
    return normAlert(data);
  },

  /** Simulate a live detection alert from the backend */
  simulateDetection: async (cameraId: string, _cameraName: string): Promise<Alert> => {
    const data = await api.post<any>('/api/alerts/simulate', { cameraId });
    return normAlert(data);
  },

  /** Count active alerts */
  getActiveCount: async (): Promise<number> => {
    const data = await api.get<any[]>('/api/alerts?status=active&limit=500');
    return data.length;
  },
};

// ─────────────────────────────────────────────
// System API Service
// ─────────────────────────────────────────────

export interface SystemHealth {
  status: string;
  fps: number;
  inferenceLatencyMs: number;
  activeStreams: number;
  cameraCount: number;
  activeAlertCount: number;
  uptimeS: number;
  cpuPercent: number;
  memoryPercent: number;
}

export const systemApiService = {
  getHealth: async (): Promise<SystemHealth> => {
    const data = await api.get<any>('/api/system/health');
    return {
      status: data.status ?? 'ok',
      fps: data.fps ?? 0,
      inferenceLatencyMs: data.inferenceLatencyMs ?? data.inference_latency_ms ?? 45,
      activeStreams: data.activeStreams ?? data.active_streams ?? 0,
      cameraCount: data.cameraCount ?? data.camera_count ?? 0,
      activeAlertCount: data.activeAlertCount ?? data.active_alert_count ?? 0,
      uptimeS: data.uptimeS ?? data.uptime_s ?? 0,
      cpuPercent: data.cpuPercent ?? data.cpu_percent ?? 0,
      memoryPercent: data.memoryPercent ?? data.memory_percent ?? 0,
    };
  },
};
