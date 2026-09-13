/**
 * @file contexts/CameraContext.tsx
 * Camera CRUD state and operations.
 * Provides: cameras[], addCamera(), updateCamera(), deleteCamera(), testConnection(), refresh()
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { mockCameraService, type CameraPayload } from '@/services/mockCameraService';
import type { Camera } from '@/types';

// ─────────────────────────────────────────────
// Context Shape
// ─────────────────────────────────────────────

interface CameraContextValue {
  cameras: Camera[];
  isLoading: boolean;
  error: string | null;
  addCamera: (payload: CameraPayload) => Promise<Camera>;
  updateCamera: (id: string, payload: Partial<CameraPayload>) => Promise<Camera>;
  deleteCamera: (id: string) => Promise<void>;
  testConnection: (id: string) => Promise<{ success: boolean; latencyMs: number }>;
  refresh: () => Promise<void>;
}

const CameraContext = createContext<CameraContextValue | null>(null);

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

/** Refresh camera statuses every 5 seconds in mock mode */
const STATUS_POLL_INTERVAL_MS = 5000;

export function CameraProvider({ children }: { children: React.ReactNode }) {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await mockCameraService.getAll();
      setCameras(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load cameras');
    }
  }, []);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  // Periodic status refresh (simulates live latency updates)
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const refreshed = await mockCameraService.refreshStatuses();
        setCameras(refreshed);
      } catch {
        // Silent fail for background poll
      }
    }, STATUS_POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const addCamera = useCallback(async (payload: CameraPayload): Promise<Camera> => {
    const cam = await mockCameraService.create(payload);
    setCameras(prev => [...prev, cam]);
    return cam;
  }, []);

  const updateCamera = useCallback(
    async (id: string, payload: Partial<CameraPayload>): Promise<Camera> => {
      const updated = await mockCameraService.update(id, payload);
      setCameras(prev => prev.map(c => (c.id === id ? updated : c)));
      return updated;
    },
    [],
  );

  const deleteCamera = useCallback(async (id: string): Promise<void> => {
    await mockCameraService.delete(id);
    setCameras(prev => prev.filter(c => c.id !== id));
  }, []);

  const testConnection = useCallback(
    async (id: string): Promise<{ success: boolean; latencyMs: number }> => {
      const result = await mockCameraService.testConnection(id);
      // Reflect updated status in state
      if (result.success) {
        setCameras(prev =>
          prev.map(c =>
            c.id === id
              ? { ...c, status: 'online', latencyMs: result.latencyMs, lastSeenAt: new Date().toISOString() }
              : c,
          ),
        );
      }
      return result;
    },
    [],
  );

  return (
    <CameraContext.Provider
      value={{
        cameras,
        isLoading,
        error,
        addCamera,
        updateCamera,
        deleteCamera,
        testConnection,
        refresh: load,
      }}
    >
      {children}
    </CameraContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useCameras(): CameraContextValue {
  const ctx = useContext(CameraContext);
  if (!ctx) throw new Error('useCameras must be used within <CameraProvider>');
  return ctx;
}
