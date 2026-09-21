/**
 * @file hooks/useSettings.ts
 * AsyncStorage-backed app settings with defaults.
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setBaseUrl } from '@/services/api';
import type { AppSettings } from '@/types';

const SETTINGS_KEY = '@ir_app_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  apiBaseUrl: 'http://10.24.158.124:8000',
  confidenceThreshold: 0.50,
  simulateStreamIntervalMs: 5000,
  simulateStreamEnabled: false,
  audioAlertsEnabled: true,
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then(raw => {
        if (raw) {
          const parsed: AppSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
          setSettings(parsed);
          setBaseUrl(parsed.apiBaseUrl);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoaded(true));
  }, []);

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (patch.apiBaseUrl) setBaseUrl(patch.apiBaseUrl);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }, [settings]);

  const resetSettings = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);
    setBaseUrl(DEFAULT_SETTINGS.apiBaseUrl);
    await AsyncStorage.removeItem(SETTINGS_KEY);
  }, []);

  return { settings, isLoaded, updateSettings, resetSettings };
}
