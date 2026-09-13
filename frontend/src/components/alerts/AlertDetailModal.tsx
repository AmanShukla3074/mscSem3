/**
 * @file components/alerts/AlertDetailModal.tsx
 * Full detail view modal for a historical alert from the audit log.
 */

import React from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { X, Camera, Clock, MapPin } from 'lucide-react-native';
import { IRColors, FontSizes, FontWeights, Radii, Spacing, Shadows } from '@/constants/theme';
import { Badge } from '@/components/ui/Badge';
import { ConfidenceMeter } from '@/components/ui/ConfidenceMeter';
import { IRFeedPlaceholder } from '@/components/ui/IRFeedPlaceholder';
import { Button } from '@/components/ui/Button';
import { useAlerts } from '@/contexts/AlertContext';
import type { Alert } from '@/types';

interface AlertDetailModalProps {
  alert: Alert;
  onClose: () => void;
}

const ANIMAL_ICON: Record<string, string> = {
  Nilgai: '🦬', Fawn: '🦌', 'Wild Boar': '🐗', Rabbit: '🐇', Fox: '🦊', Unknown: '❓',
};

export function AlertDetailModal({ alert, onClose }: AlertDetailModalProps) {
  const { resolveAlert } = useAlerts();

  const ts = new Date(alert.timestamp).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const handleResolve = async () => {
    await resolveAlert(alert.id, 'Manually resolved from audit log');
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safe}>
          <View style={[styles.sheet, Shadows.modal]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Alert Detail</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={IRColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* IR Snapshot */}
              <View style={styles.section}>
                <IRFeedPlaceholder
                  cameraName={alert.cameraName}
                  isOnline
                  showDetection
                  boundingBox={alert.boundingBox}
                  style={styles.snapshot}
                />
                <View style={styles.snapMeta}>
                  <Camera size={11} color={IRColors.textMuted} />
                  <Text style={styles.snapMetaText}>
                    {alert.cameraName} · Thermal IR snapshot
                  </Text>
                </View>
              </View>

              {/* Core Info */}
              <View style={styles.section}>
                <View style={styles.animalRow}>
                  <Text style={styles.animalEmoji}>{ANIMAL_ICON[alert.animalType] ?? '❓'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.animalName}>{alert.animalType}</Text>
                    <View style={styles.badgeRow}>
                      <Badge variant={alert.status} size="md" />
                      <Badge variant={alert.severity} size="md" />
                    </View>
                  </View>
                </View>

                <ConfidenceMeter score={alert.confidenceScore} height={8} />

                <View style={styles.metaRows}>
                  <MetaRow icon={<Clock size={13} color={IRColors.textMuted} />} label={ts} />
                  <MetaRow icon={<Camera size={13} color={IRColors.textMuted} />} label={alert.cameraName} />
                  <MetaRow
                    icon={<MapPin size={13} color={IRColors.textMuted} />}
                    label={`Crop density: ${alert.cropDensity}`}
                  />
                </View>
              </View>

              {/* Bounding Box Info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Bounding Box (Normalised)</Text>
                <View style={styles.bboxGrid}>
                  {(['x', 'y', 'width', 'height'] as const).map(k => (
                    <View key={k} style={styles.bboxItem}>
                      <Text style={styles.bboxKey}>{k.toUpperCase()}</Text>
                      <Text style={styles.bboxVal}>{alert.boundingBox[k].toFixed(3)}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Resolution Notes */}
              {alert.resolutionNote && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Resolution Note</Text>
                  <View style={styles.noteBox}>
                    <Text style={styles.noteText}>{alert.resolutionNote}</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            {alert.status === 'active' && (
              <View style={styles.footer}>
                <Button
                  label="Mark as Resolved"
                  variant="secondary"
                  size="md"
                  fullWidth
                  onPress={handleResolve}
                />
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function MetaRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={metaRowStyles.row}>
      {icon}
      <Text style={metaRowStyles.label}>{label}</Text>
    </View>
  );
}
const metaRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  label: { color: IRColors.textSecondary, fontSize: FontSizes.sm },
});

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000BB', justifyContent: 'flex-end' },
  safe: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: IRColors.surfaceElevated,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: IRColors.surfaceBorder,
  },
  headerTitle: {
    color: IRColors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
  },
  closeBtn: {
    backgroundColor: IRColors.surface,
    borderRadius: Radii.full,
    padding: Spacing.xs,
  },
  section: {
    padding: Spacing.base,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: IRColors.surfaceBorder,
  },
  snapshot: { borderRadius: Radii.lg },
  snapMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  snapMetaText: { color: IRColors.textMuted, fontSize: FontSizes.xs },
  animalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  animalEmoji: { fontSize: 44 },
  animalName: { color: IRColors.textPrimary, fontSize: FontSizes.xl, fontWeight: FontWeights.heavy, marginBottom: 4 },
  badgeRow: { flexDirection: 'row', gap: Spacing.xs },
  metaRows: { gap: Spacing.xs },
  sectionTitle: {
    color: IRColors.textSecondary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  bboxGrid: { flexDirection: 'row', gap: Spacing.sm },
  bboxItem: {
    flex: 1,
    backgroundColor: IRColors.surface,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  bboxKey: { color: IRColors.textMuted, fontSize: FontSizes.xs, letterSpacing: 0.5 },
  bboxVal: { color: IRColors.textPrimary, fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
  noteBox: {
    backgroundColor: IRColors.surface,
    borderRadius: Radii.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: IRColors.statusGreen,
  },
  noteText: { color: IRColors.textSecondary, fontSize: FontSizes.sm, lineHeight: 20 },
  footer: {
    padding: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: IRColors.surfaceBorder,
  },
});
