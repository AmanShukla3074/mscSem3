/**
 * @file services/mockAlertService.ts
 * In-memory alert/detection event service.
 * Includes filtering, status updates, and a live-trigger generator.
 * Replace with real API calls when the FastAPI backend is ready.
 */

import { MOCK_ALERTS } from '@/constants/mockData';
import type {
  Alert,
  AlertFilters,
  AlertStatus,
  AnimalType,
  BoundingBox,
  CropDensity,
} from '@/types';

let _alerts: Alert[] = [...MOCK_ALERTS];

const delay = (ms = 120) => new Promise(res => setTimeout(res, ms));
const uid = () => `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// ─────────────────────────────────────────────
// Animals used for random simulation
// ─────────────────────────────────────────────
const ANIMAL_POOL: AnimalType[] = ['Nilgai', 'Fawn', 'Wild Boar', 'Rabbit', 'Fox'];
const DENSITY_POOL: CropDensity[] = ['Light', 'Medium', 'Heavy'];

export const mockAlertService = {
  /** Fetch all alerts, with optional filters */
  getAll: async (filters?: AlertFilters): Promise<Alert[]> => {
    await delay();
    let results = [..._alerts].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    if (filters) {
      if (filters.animalType && filters.animalType !== 'All') {
        results = results.filter(a => a.animalType === filters.animalType);
      }
      if (filters.cropDensity && filters.cropDensity !== 'All') {
        results = results.filter(a => a.cropDensity === filters.cropDensity);
      }
      if (filters.status && filters.status !== 'All') {
        results = results.filter(a => a.status === filters.status);
      }
      if (filters.minConfidence !== undefined) {
        results = results.filter(a => a.confidenceScore >= filters.minConfidence!);
      }
      if (filters.dateFrom) {
        const from = new Date(filters.dateFrom).getTime();
        results = results.filter(a => new Date(a.timestamp).getTime() >= from);
      }
      if (filters.dateTo) {
        const to = new Date(filters.dateTo).getTime();
        results = results.filter(a => new Date(a.timestamp).getTime() <= to);
      }
    }

    return results;
  },

  /** Get a single alert */
  getById: async (id: string): Promise<Alert | undefined> => {
    await delay(60);
    return _alerts.find(a => a.id === id);
  },

  /** Update alert status (acknowledge / resolve) */
  updateStatus: async (
    id: string,
    status: AlertStatus,
    resolutionNote?: string,
  ): Promise<Alert> => {
    await delay(100);
    const idx = _alerts.findIndex(a => a.id === id);
    if (idx === -1) throw new Error(`Alert ${id} not found`);
    const updated: Alert = { ..._alerts[idx]!, status, resolutionNote };
    _alerts = [..._alerts.slice(0, idx), updated, ..._alerts.slice(idx + 1)];
    return updated;
  },

  /** Count active (unacknowledged) alerts */
  getActiveCount: async (): Promise<number> => {
    await delay(50);
    return _alerts.filter(a => a.status === 'active').length;
  },

  /**
   * Simulate a new live detection from the YOLO model.
   * Used by the "Simulate Alert" dev button and the alert simulator hook.
   */
  simulateDetection: async (cameraId: string, cameraName: string): Promise<Alert> => {
    await delay(80);

    const animalType = ANIMAL_POOL[Math.floor(Math.random() * ANIMAL_POOL.length)]!;
    const cropDensity = DENSITY_POOL[Math.floor(Math.random() * DENSITY_POOL.length)]!;
    const confidenceScore = parseFloat((0.5 + Math.random() * 0.49).toFixed(3));
    const isCritical = confidenceScore > 0.75 || animalType === 'Nilgai' || animalType === 'Fawn';

    const boundingBox: BoundingBox = {
      x: parseFloat((0.1 + Math.random() * 0.5).toFixed(3)),
      y: parseFloat((0.1 + Math.random() * 0.4).toFixed(3)),
      width: parseFloat((0.15 + Math.random() * 0.35).toFixed(3)),
      height: parseFloat((0.2 + Math.random() * 0.4).toFixed(3)),
    };

    const alert: Alert = {
      id: uid(),
      cameraId,
      cameraName,
      timestamp: new Date().toISOString(),
      animalType,
      confidenceScore,
      cropDensity,
      snapshotUri: `mock://snapshot/${uid()}`,
      boundingBox,
      status: 'active',
      severity: isCritical ? 'critical' : 'warning',
    };

    _alerts = [alert, ..._alerts];
    return alert;
  },

  /** Reset to seed data (for testing) */
  reset: async (): Promise<void> => {
    _alerts = [...MOCK_ALERTS];
  },
};
