/**
 * @file services/api.ts
 * Base API client — configurable base URL loaded from AsyncStorage settings.
 * All real API calls should go through this module.
 * Swap mock service implementations for these real calls when the FastAPI
 * backend is ready, without changing any Context or UI code.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Default URLs: Android emulator uses 10.0.2.2 to reach host localhost
const DEFAULT_API_URL = 'http://10.0.2.2:8000';
const SETTINGS_KEY = '@ir_app_settings';

let _baseUrl = DEFAULT_API_URL;

/** Load the saved API URL from AsyncStorage */
export async function loadBaseUrl(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.apiBaseUrl) {
        _baseUrl = parsed.apiBaseUrl;
      }
    }
  } catch {
    // Use default if storage fails
  }
  return _baseUrl;
}

/** Update the in-memory base URL */
export function setBaseUrl(url: string) {
  _baseUrl = url;
}

export function getBaseUrl(): string {
  return _baseUrl;
}

// ─────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${_baseUrl}/api/v1${path}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
