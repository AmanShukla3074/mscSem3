/**
 * @file components/cameras/CameraFormModal.tsx
 * Add / Edit camera modal with form validation.
 */

import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { IRColors, FontSizes, FontWeights, Radii, Spacing, Shadows } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { useCameras } from '@/contexts/CameraContext';
import type { Camera, ConnectionType, CropDensity } from '@/types';
import type { CameraPayload } from '@/services/apiClient';

interface CameraFormModalProps {
  camera?: Camera; // If provided, edit mode
  onClose: () => void;
}

const CONNECTION_TYPES: ConnectionType[] = ['WiFi', 'LAN', 'RTSP'];
const CROP_DENSITIES: CropDensity[] = ['Light', 'Medium', 'Heavy'];

const EMPTY: CameraPayload = {
  name: '',
  type: 'WiFi',
  streamUrl: '',
  ipAddress: '',
  port: 554,
  fieldLocation: '',
  cropDensity: 'Medium',
};

export function CameraFormModal({ camera, onClose }: CameraFormModalProps) {
  const { addCamera, updateCamera, testConnection } = useCameras();
  const isEdit = !!camera;

  const [form, setForm] = useState<CameraPayload>(
    camera
      ? {
          name: camera.name,
          type: camera.type,
          streamUrl: camera.streamUrl,
          ipAddress: camera.ipAddress,
          port: camera.port,
          fieldLocation: camera.fieldLocation,
          cropDensity: camera.cropDensity,
        }
      : { ...EMPTY },
  );
  const [errors, setErrors] = useState<Partial<Record<keyof CameraPayload | 'port', string>>>({});
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; latencyMs: number } | null>(null);

  function set<K extends keyof CameraPayload>(key: K, value: CameraPayload[K]) {
    setForm(p => ({ ...p, [key]: value }));
    setErrors(p => ({ ...p, [key]: undefined }));
    setPingResult(null);
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = 'Camera name is required';
    if (!form.ipAddress.trim()) e.ipAddress = 'IP address is required';
    if (!form.streamUrl.trim()) e.streamUrl = 'Stream URL is required';
    if (!form.fieldLocation.trim()) e.fieldLocation = 'Field location is required';
    if (isNaN(form.port) || form.port < 1 || form.port > 65535)
      e.port = 'Port must be 1–65535';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit && camera) {
        await updateCamera(camera.id, form);
      } else {
        await addCamera(form);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handlePing = async () => {
    if (!camera) return;
    setPinging(true);
    setPingResult(null);
    try {
      const result = await testConnection(camera.id);
      // Treat an explicit offline response as a "failed" ping
      setPingResult(result);
    } catch (err: unknown) {
      // Network error, timeout, or AbortError — show "Camera Offline" badge
      // instead of propagating an unhandled rejection to the error boundary.
      console.warn('[handlePing] ping failed:', err instanceof Error ? err.message : err);
      setPingResult({ success: false, latencyMs: 0 });
    } finally {
      setPinging(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.backdrop}>
          <SafeAreaView style={styles.safe}>
            <View style={[styles.sheet, Shadows.modal]}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>{isEdit ? 'Edit Camera' : 'Add Camera'}</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={20} color={IRColors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                <FormField label="Camera Name" error={errors.name}>
                  <TextInput
                    style={styles.input}
                    value={form.name}
                    onChangeText={v => set('name', v)}
                    placeholder="e.g. Front Left IR"
                    placeholderTextColor={IRColors.textMuted}
                  />
                </FormField>

                <FormField label="IP Address" error={errors.ipAddress}>
                  <TextInput
                    style={styles.input}
                    value={form.ipAddress}
                    onChangeText={v => set('ipAddress', v)}
                    placeholder="e.g. 192.168.1.101"
                    placeholderTextColor={IRColors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </FormField>

                <FormField label="Port" error={errors.port}>
                  <TextInput
                    style={styles.input}
                    value={String(form.port)}
                    onChangeText={v => set('port', parseInt(v) || 554)}
                    placeholder="554"
                    placeholderTextColor={IRColors.textMuted}
                    keyboardType="number-pad"
                  />
                </FormField>

                <FormField label="Stream URL (RTSP / HTTP)" error={errors.streamUrl}>
                  <TextInput
                    style={styles.input}
                    value={form.streamUrl}
                    onChangeText={v => set('streamUrl', v)}
                    placeholder="rtsp://192.168.1.101:554/stream1"
                    placeholderTextColor={IRColors.textMuted}
                    autoCapitalize="none"
                  />
                </FormField>

                <FormField label="Connection Type">
                  <View style={styles.pillRow}>
                    {CONNECTION_TYPES.map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.pill, form.type === t && styles.pillActive]}
                        onPress={() => set('type', t)}
                      >
                        <Text style={[styles.pillText, form.type === t && styles.pillTextActive]}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </FormField>

                <FormField label="Field Location" error={errors.fieldLocation}>
                  <TextInput
                    style={styles.input}
                    value={form.fieldLocation}
                    onChangeText={v => set('fieldLocation', v)}
                    placeholder="e.g. Field A — North Quadrant"
                    placeholderTextColor={IRColors.textMuted}
                  />
                </FormField>

                <FormField label="Crop Density Profile">
                  <View style={styles.pillRow}>
                    {CROP_DENSITIES.map(d => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.pill, form.cropDensity === d && styles.pillActive]}
                        onPress={() => set('cropDensity', d)}
                      >
                        <Text style={[styles.pillText, form.cropDensity === d && styles.pillTextActive]}>
                          {d}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </FormField>

                {/* Ping result */}
                {pingResult !== null && (
                  <View style={[styles.pingResult, { borderColor: pingResult.success ? IRColors.statusGreen : IRColors.alertRed }]}>
                    <Text style={{ color: pingResult.success ? IRColors.statusGreen : IRColors.alertRed, fontWeight: FontWeights.semibold, fontSize: FontSizes.sm }}>
                      {pingResult.success
                        ? `✓ Connected — ${pingResult.latencyMs}ms`
                        : '✗ Camera Offline — stream unavailable'}
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Footer */}
              <View style={styles.footer}>
                {isEdit && (
                  <Button
                    label={pinging ? 'Pinging...' : 'Test Connection'}
                    variant="secondary"
                    size="md"
                    loading={pinging}
                    onPress={handlePing}
                    fullWidth
                  />
                )}
                <Button
                  label={saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Camera'}
                  variant="primary"
                  size="md"
                  loading={saving}
                  onPress={handleSave}
                  fullWidth
                />
              </View>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function FormField({
  label, children, error,
}: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      {children}
      {error && <Text style={fieldStyles.error}>{error}</Text>}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: { marginBottom: Spacing.md },
  label: {
    color: IRColors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    marginBottom: Spacing.xs,
    letterSpacing: 0.3,
  },
  error: {
    color: IRColors.alertRed,
    fontSize: FontSizes.xs,
    marginTop: 4,
  },
});

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'flex-end' },
  safe: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: IRColors.surfaceElevated,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderTopColor: IRColors.surfaceBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: IRColors.surfaceBorder,
  },
  title: {
    color: IRColors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  closeBtn: {
    backgroundColor: IRColors.surface,
    borderRadius: Radii.full,
    padding: Spacing.xs,
  },
  body: { padding: Spacing.base },
  input: {
    backgroundColor: IRColors.surfaceInput,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    color: IRColors.textPrimary,
    fontSize: FontSizes.base,
  },
  pillRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radii.full,
    backgroundColor: IRColors.surface,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
  },
  pillActive: {
    backgroundColor: IRColors.textPrimary,
    borderColor: IRColors.textPrimary,
  },
  pillText: {
    color: IRColors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  pillTextActive: {
    color: IRColors.textInvert,
    fontWeight: FontWeights.bold,
  },
  pingResult: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  footer: {
    padding: Spacing.base,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: IRColors.surfaceBorder,
  },
});
