/**
 * @file hooks/useAlertSimulator.ts
 * Periodically fires mock detections based on app settings.
 * Only active when simulateStreamEnabled = true.
 */

import { useEffect, useRef } from 'react';
import { useAlerts } from '@/contexts/AlertContext';
import type { AppSettings } from '@/types';

export function useAlertSimulator(settings: AppSettings) {
  const { simulateTrigger } = useAlerts();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (settings.simulateStreamEnabled) {
      // Jitter ±20% around the interval so detections feel organic
      const base = settings.simulateStreamIntervalMs;
      const fire = async () => {
        await simulateTrigger();
      };

      fire(); // Trigger immediately on enable
      intervalRef.current = setInterval(() => {
        const jitter = base * 0.2 * (Math.random() - 0.5);
        setTimeout(fire, Math.max(0, jitter));
      }, base);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [settings.simulateStreamEnabled, settings.simulateStreamIntervalMs, simulateTrigger]);
}
