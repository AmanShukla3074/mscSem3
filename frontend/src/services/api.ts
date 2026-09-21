/**
 * @file services/api.ts
 * Base API client — configurable base URL loaded from AsyncStorage settings.
 * All real API calls route through this module.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────
// Base URL configuration
// ─────────────────────────────────────────────

/**
 * Default backend URL.
 * - Browser / web mode (expo start --web): http://localhost:8000
 * - Physical Android/iOS device on same WiFi: change in Settings tab to http://10.24.158.124:8000
 */
export const DEFAULT_API_URL = 'http://localhost:8000';

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
  _baseUrl = url.replace(/\/$/, ''); // strip trailing slash
}

export function getBaseUrl(): string {
  return _baseUrl;
}

// ─────────────────────────────────────────────
// URL helpers for media endpoints
// ─────────────────────────────────────────────

/** Returns the snapshot URL for a camera (1-second polling fallback for live feed) */
export function getSnapshotUrl(cameraId: string): string {
  return `${_baseUrl}/api/cameras/${cameraId}/snapshot`;
}

/** Returns the MJPEG stream URL for a camera */
export function getStreamUrl(cameraId: string): string {
  return `${_baseUrl}/api/cameras/${cameraId}/stream`;
}

/** Returns the annotated snapshot URL for a specific alert */
export function getAlertSnapshotUrl(alertId: string): string {
  return `${_baseUrl}/api/alerts/${alertId}/snapshot`;
}

/** Returns the SSE stream URL for real-time alerts */
export function getAlertSseUrl(): string {
  return `${_baseUrl}/api/alerts/stream`;
}

// ─────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${_baseUrl}${path}`;

  // Abort after 10 s so a missing backend fails fast instead of hanging
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timer);
    // Network errors (backend down / CORS / no route) → friendly message
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    throw new Error(
      isAbort ? `Backend not reachable (timeout): ${url}` : `Backend not reachable: ${url}`,
    );
  }
  clearTimeout(timer);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} failed (${res.status}): ${text}`);
  }
  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
