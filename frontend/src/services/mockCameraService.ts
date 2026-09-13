/**
 * @file services/mockCameraService.ts
 * In-memory CRUD service for IR cameras.
 * All functions simulate 100–200ms latency.
 * Replace with `api.get('/cameras')` etc. when backend is ready.
 */

import { MOCK_CAMERAS } from '@/constants/mockData';
import type { Camera, ConnectionType, CropDensity } from '@/types';

// In-memory store (mutable copy of seed data)
let _cameras: Camera[] = [...MOCK_CAMERAS];

const delay = (ms = 150) => new Promise(res => setTimeout(res, ms));
const uid = () => `cam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export type CameraPayload = Omit<Camera, 'id' | 'status' | 'latencyMs' | 'lastSeenAt'>;

export const mockCameraService = {
  /** Fetch all cameras */
  getAll: async (): Promise<Camera[]> => {
    await delay();
    return [..._cameras];
  },

  /** Get a single camera by id */
  getById: async (id: string): Promise<Camera | undefined> => {
    await delay(80);
    return _cameras.find(c => c.id === id);
  },

  /** Create a new camera */
  create: async (payload: CameraPayload): Promise<Camera> => {
    await delay(200);
    const camera: Camera = {
      ...payload,
      id: uid(),
      status: 'offline', // New cameras start offline until connected
      latencyMs: 0,
      lastSeenAt: new Date().toISOString(),
    };
    _cameras = [..._cameras, camera];
    return camera;
  },

  /** Update an existing camera */
  update: async (id: string, payload: Partial<CameraPayload>): Promise<Camera> => {
    await delay(180);
    const idx = _cameras.findIndex(c => c.id === id);
    if (idx === -1) throw new Error(`Camera ${id} not found`);
    const updated: Camera = { ..._cameras[idx]!, ...payload };
    _cameras = [..._cameras.slice(0, idx), updated, ..._cameras.slice(idx + 1)];
    return updated;
  },

  /** Delete a camera */
  delete: async (id: string): Promise<void> => {
    await delay(150);
    _cameras = _cameras.filter(c => c.id !== id);
  },

  /**
   * Simulate a "Test Connection / Ping" — randomly resolves online with a
   * latency between 20–120ms or rejects with an offline status.
   */
  testConnection: async (id: string): Promise<{ success: boolean; latencyMs: number }> => {
    await delay(800 + Math.random() * 400);
    const success = Math.random() > 0.25; // 75% success rate in demo
    const latencyMs = success ? Math.round(20 + Math.random() * 100) : 0;

    if (success) {
      // Update in-memory status
      const idx = _cameras.findIndex(c => c.id === id);
      if (idx !== -1) {
        _cameras = [
          ..._cameras.slice(0, idx),
          { ..._cameras[idx]!, status: 'online', latencyMs, lastSeenAt: new Date().toISOString() },
          ..._cameras.slice(idx + 1),
        ];
      }
    }

    return { success, latencyMs };
  },

  /** Refresh mock latency values (call periodically to simulate live status) */
  refreshStatuses: async (): Promise<Camera[]> => {
    _cameras = _cameras.map(cam => ({
      ...cam,
      latencyMs:
        cam.status === 'online'
          ? Math.round(cam.latencyMs + (Math.random() - 0.5) * 20)
          : 0,
      lastSeenAt:
        cam.status === 'online' ? new Date().toISOString() : cam.lastSeenAt,
    }));
    return [..._cameras];
  },
};
