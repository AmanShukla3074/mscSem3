/**
 * @file contexts/AlertContext.tsx
 * Alert state, live detection events, and simulation controls.
 * Provides: alerts[], liveAlert, activeAlertCount, acknowledgeAlert(),
 *           dismissAlert(), resolveAlert(), simulateTrigger(), dismissLive()
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { mockAlertService } from '@/services/mockAlertService';
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

  const loadAlerts = useCallback(async (filters?: AlertFilters) => {
    setIsLoading(true);
    try {
      const data = await mockAlertService.getAll(filters);
      setAlerts(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load alerts');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const activeAlertCount = alerts.filter(a => a.status === 'active').length;

  const acknowledgeAlert = useCallback(async (id: string, note?: string) => {
    const updated = await mockAlertService.updateStatus(id, 'acknowledged', note);
    setAlerts(prev => prev.map(a => (a.id === id ? updated : a)));
    // If this is the live alert, dismiss the modal
    setLiveAlert(prev => (prev?.id === id ? null : prev));
  }, []);

  const dismissAlert = useCallback(async (id: string) => {
    const updated = await mockAlertService.updateStatus(id, 'resolved', 'Dismissed — False Alarm');
    setAlerts(prev => prev.map(a => (a.id === id ? updated : a)));
    setLiveAlert(prev => (prev?.id === id ? null : prev));
  }, []);

  const resolveAlert = useCallback(async (id: string, note?: string) => {
    const updated = await mockAlertService.updateStatus(id, 'resolved', note);
    setAlerts(prev => prev.map(a => (a.id === id ? updated : a)));
    setLiveAlert(prev => (prev?.id === id ? null : prev));
  }, []);

  const simulateTrigger = useCallback(async () => {
    // Pick a random online camera, fall back to first camera
    const onlineCams = cameras.filter(c => c.status === 'online');
    const cam = onlineCams.length > 0
      ? onlineCams[Math.floor(Math.random() * onlineCams.length)]!
      : cameras[0];

    if (!cam) return;

    const alert = await mockAlertService.simulateDetection(cam.id, cam.name);
    setAlerts(prev => [alert, ...prev]);
    setLiveAlert(alert);
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
