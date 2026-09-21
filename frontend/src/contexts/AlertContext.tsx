/**
 * @file contexts/AlertContext.tsx
 * Alert state, live detection events, and simulation controls.
 * Connected to real FastAPI backend via alertApiService.
 * Opens an SSE connection for real-time alert push from /api/alerts/stream.
 *
 * Provides: alerts[], liveAlert, activeAlertCount, acknowledgeAlert(),
 *           dismissAlert(), resolveAlert(), simulateTrigger(), dismissLive()
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { alertApiService } from '@/services/apiClient';
import { getAlertSseUrl, getBaseUrl } from '@/services/api';
import { useCameras } from '@/contexts/CameraContext';
import type { Alert, AlertFilters } from '@/types';

// ─────────────────────────────────────────────
// Context Shape
// ─────────────────────────────────────────────

interface AlertContextValue {
  alerts: Alert[];
  liveAlert: Alert | null;
  activeAlertCount: number;
  isLoading: boolean;
  error: string | null;
  acknowledgeAlert: (id: string, note?: string) => Promise<void>;
  dismissAlert: (id: string) => Promise<void>;
  resolveAlert: (id: string, note?: string) => Promise<void>;
  /** Manually trigger a simulated detection — used by the dev header button */
  simulateTrigger: () => Promise<void>;
  /** Dismiss the live modal without changing alert status */
  dismissLive: () => void;
  /** Reload alerts (with optional filters) */
  loadAlerts: (filters?: AlertFilters) => Promise<void>;
}

const AlertContext = createContext<AlertContextValue | null>(null);

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const { cameras } = useCameras();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [liveAlert, setLiveAlert] = useState<Alert | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  const loadAlerts = useCallback(async (filters?: AlertFilters) => {
    setIsLoading(true);
    try {
      const data = await alertApiService.getAll(filters);
      setAlerts(data);
      setError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load alerts';
      setError(msg);
      console.warn('[AlertContext] loadAlerts error:', msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // ── SSE connection for real-time alert push ──
  useEffect(() => {
    const sseUrl = getAlertSseUrl();

    const connect = () => {
      try {
        const es = new EventSource(sseUrl);

        es.addEventListener('alert', (event: MessageEvent) => {
          try {
            const raw = JSON.parse(event.data);
            // Normalize the incoming raw alert
            const snapshotUri = raw.snapshot_uri ?? raw.snapshotUri ?? '';
            const resolvedSnapshot = snapshotUri.startsWith('/api/')
              ? `${getBaseUrl()}${snapshotUri}`
              : snapshotUri;

            const newAlert: Alert = {
              id: raw.id,
              cameraId: raw.camera_id ?? raw.cameraId,
              cameraName: raw.camera_name ?? raw.cameraName ?? '',
              timestamp: raw.timestamp,
              animalType: raw.animal_type ?? raw.animalType,
              confidenceScore: raw.confidence_score ?? raw.confidenceScore ?? 0,
              cropDensity: raw.crop_density ?? raw.cropDensity ?? 'Medium',
              snapshotUri: resolvedSnapshot,
              boundingBox: {
                x: raw.bounding_box?.x ?? raw.boundingBox?.x ?? 0.3,
                y: raw.bounding_box?.y ?? raw.boundingBox?.y ?? 0.2,
                width: raw.bounding_box?.width ?? raw.boundingBox?.width ?? 0.2,
                height: raw.bounding_box?.height ?? raw.boundingBox?.height ?? 0.3,
              },
              status: raw.status ?? 'active',
              severity: raw.severity ?? 'critical',
              resolutionNote: raw.resolution_note ?? raw.resolutionNote,
            };

            setAlerts(prev => [newAlert, ...prev.filter(a => a.id !== newAlert.id)]);
            setLiveAlert(newAlert);
          } catch (err) {
            console.warn('[AlertContext] SSE parse error:', err);
          }
        });

        es.onerror = () => {
          es.close();
          // Reconnect after 5s
          setTimeout(connect, 5000);
        };

        sseRef.current = es;
      } catch {
        // EventSource not available (e.g. old RN) — fall back to polling
        console.warn('[AlertContext] SSE not available, using polling fallback');
      }
    };

    connect();

    return () => {
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeAlertCount = alerts.filter(a => a.status === 'active').length;

  const acknowledgeAlert = useCallback(async (id: string, note?: string) => {
    const updated = await alertApiService.updateStatus(id, 'acknowledged', note);
    setAlerts(prev => prev.map(a => (a.id === id ? updated : a)));
    setLiveAlert(prev => (prev?.id === id ? null : prev));
  }, []);

  const dismissAlert = useCallback(async (id: string) => {
    const updated = await alertApiService.updateStatus(id, 'resolved', 'Dismissed — False Alarm');
    setAlerts(prev => prev.map(a => (a.id === id ? updated : a)));
    setLiveAlert(prev => (prev?.id === id ? null : prev));
  }, []);

  const resolveAlert = useCallback(async (id: string, note?: string) => {
    const updated = await alertApiService.updateStatus(id, 'resolved', note);
    setAlerts(prev => prev.map(a => (a.id === id ? updated : a)));
    setLiveAlert(prev => (prev?.id === id ? null : prev));
  }, []);

  const simulateTrigger = useCallback(async () => {
    // Pick a random online camera; fallback to first
    const onlineCams = cameras.filter(c => c.status === 'online');
    const cam = onlineCams.length > 0
      ? onlineCams[Math.floor(Math.random() * onlineCams.length)]!
      : cameras[0];

    if (!cam) return;

    try {
      const alert = await alertApiService.simulateDetection(cam.id, cam.name);
      // SSE will also push this; add optimistically for instant feedback
      setAlerts(prev => [alert, ...prev.filter(a => a.id !== alert.id)]);
      setLiveAlert(alert);
    } catch (e) {
      console.warn('[AlertContext] simulate error:', e);
    }
  }, [cameras]);

  const dismissLive = useCallback(() => {
    setLiveAlert(null);
  }, []);

  return (
    <AlertContext.Provider
      value={{
        alerts,
        liveAlert,
        activeAlertCount,
        isLoading,
        error,
        acknowledgeAlert,
        dismissAlert,
        resolveAlert,
        simulateTrigger,
        dismissLive,
        loadAlerts,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useAlerts(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlerts must be used within <AlertProvider>');
  return ctx;
}
