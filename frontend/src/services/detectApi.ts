/**
 * @file services/detectApi.ts
 * API helpers for the ONNX animal detection endpoints.
 */

import { getBaseUrl } from './api';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface DetectionBox {
  class_id:    number;
  class_name:  string;
  display_name: string;
  confidence:  number;
  bbox_norm: { x: number; y: number; width: number; height: number };
  bbox_abs:  { x1: number; y1: number; x2: number; y2: number };
}

export interface DetectResult {
  success:      boolean;
  image_width:  number;
  image_height: number;
  detections:   DetectionBox[];
  count:        number;
  inference_ms: number;
  annotated_jpeg_b64: string;
}

export interface ModelStatus {
  ready:      boolean;
  model_path: string;
  load_error: string | null;
  classes:    Record<string, string>;
}

export interface DatasetListing {
  split:             string;
  total:             number;
  offset:            number;
  limit:             number;
  animal_filter:     string | null;
  files:             string[];
  available_animals: string[];
}

export interface DatasetSample {
  split:     string;
  filename:  string;
  width:     number;
  height:    number;
  jpeg_b64:  string;
  label_txt: string | null;
}

// ─────────────────────────────────────────────
// API calls
// ─────────────────────────────────────────────

/** Check ONNX model readiness */
export async function getModelStatus(): Promise<ModelStatus> {
  const res = await fetch(`${getBaseUrl()}/api/detect/status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Upload an image blob and run YOLO detection */
export async function detectImage(
  file: Blob,
  filename: string,
  confThreshold: number = 0.25,
): Promise<DetectResult> {
  const form = new FormData();
  form.append('file', file, filename);
  form.append('conf_threshold', String(confThreshold));
  const res = await fetch(`${getBaseUrl()}/api/detect/image`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Detection failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** List dataset images for a split */
export async function listDatasetImages(
  split: 'train' | 'val' | 'test',
  animal?: string,
  limit = 30,
  offset = 0,
): Promise<DatasetListing> {
  const params = new URLSearchParams({ split, limit: String(limit), offset: String(offset) });
  if (animal && animal !== 'all') params.set('animal', animal);
  const res = await fetch(`${getBaseUrl()}/api/detect/dataset?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Get a single dataset sample image as base64 JPEG */
export async function getDatasetSample(
  split: 'train' | 'val' | 'test',
  options?: { animal?: string; filename?: string },
): Promise<DatasetSample> {
  const params = new URLSearchParams({ split });
  if (options?.filename) params.set('filename', options.filename);
  else if (options?.animal && options.animal !== 'all') params.set('animal', options.animal);
  const res = await fetch(`${getBaseUrl()}/api/detect/dataset/sample?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

