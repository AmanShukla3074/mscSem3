/**
 * @file components/alerts/LiveAlertModal.tsx
 * High-visibility full-screen operator alert modal.
 * Shown immediately when a new wildlife detection is received.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AlertTriangle, Camera, CheckCircle, XCircle } from 'lucide-react-native';
import { IRColors, FontSizes, FontWeights, Radii, Spacing, Shadows } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfidenceMeter } from '@/components/ui/ConfidenceMeter';
import { IRFeedPlaceholder } from '@/components/ui/IRFeedPlaceholder';
import { useAlerts } from '@/contexts/AlertContext';
import type { Alert } from '@/types';

interface LiveAlertModalProps {
  alert: Alert;
}

const ANIMAL_ICON: Record<string, string> = {
  Nilgai: '🦬', Fawn: '🦌', 'Wild Boar': '🐗', Rabbit: '🐇', Fox: '🦊', Unknown: '❓',
};

export function LiveAlertModal({ alert }: LiveAlertModalProps) {
  const { acknowledgeAlert, dismissAlert, dismissLive } = useAlerts();
  const slideAnim = useRef(new Animated.Value(100)).current;
  const flashBg = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide up entry
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();

    // Flash background 3× then hold
    Animated.sequence([
      ...Array(3).fill(null).flatMap(() => [
        Animated.timing(flashBg, { toValue: 1, duration: 150, useNativeDriver: false }),
        Animated.timing(flashBg, { toValue: 0, duration: 150, useNativeDriver: false }),
      ]),
    ]).start();
  }, [slideAnim, flashBg]);

  const bgColor = flashBg.interpolate({
    inputRange: [0, 1],
    outputRange: ['#000000EE', '#5E0000EE'],
  });

  const handleAcknowledge = async () => {
    await acknowledgeAlert(alert.id, 'Operator acknowledged — slowing harvester');
  };

  const handleDismiss = async () => {
    await dismissAlert(alert.id);
  };

  const ts = new Date(alert.timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismissLive}
    >
      <Animated.View style={[styles.backdrop, { backgroundColor: bgColor }]}>
        <SafeAreaView style={styles.safe}>
          <Animated.View
            style={[styles.card, Shadows.modal, { transform: [{ translateY: slideAnim }] }]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <AlertTriangle size={28} color={IRColors.alertRed} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>WILDLIFE DETECTED</Text>
                <Text style={styles.headerSub}>Emergency alert · {ts}</Text>
              </View>
              <Badge variant="active" label="ACTIVE" size="md" />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
              {/* IR Snapshot with bbox */}
              <View style={styles.snapshotSection}>
                <IRFeedPlaceholder
                  cameraName={alert.cameraName}
                  isOnline
                  showDetection
                  boundingBox={alert.boundingBox}
                  style={styles.snapshot}
                />
                <View style={styles.snapshotLabel}>
                  <Camera size={12} color={IRColors.textMuted} />
                  <Text style={styles.snapshotLabelText}>{alert.cameraName} · IR thermal</Text>
                </View>
              </View>

              {/* Detection Details */}
              <View style={styles.detailsCard}>
                <View style={styles.animalRow}>
                  <Text style={styles.animalEmoji}>{ANIMAL_ICON[alert.animalType] ?? '❓'}</Text>
                  <View>
                    <Text style={styles.animalName}>{alert.animalType}</Text>
                    <Text style={styles.detectionLabel}>Target Species</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <ConfidenceMeter score={alert.confidenceScore} height={8} />
                <Text style={styles.confNote}>
                  SIoU Bounding Box · YOLO Edge Model
                </Text>

                <View style={styles.divider} />

                <View style={styles.metaGrid}>
                  <MetaItem label="Crop Occlusion">
                    <Badge variant={alert.cropDensity.toLowerCase() as any} label={alert.cropDensity} size="md" />
                  </MetaItem>
                  <MetaItem label="Severity">
                    <Badge variant={alert.severity} size="md" />
                  </MetaItem>
                  <MetaItem label="Camera Source">
                    <Text style={styles.metaValue}>{alert.cameraName}</Text>
                  </MetaItem>
                  <MetaItem label="Field Location">
                    <Text style={styles.metaValue}>See camera details</Text>
                  </MetaItem>
                </View>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <Button
                label="⚠ Acknowledge / Slow Down"
                variant="amber"
                size="lg"
                fullWidth
                onPress={handleAcknowledge}
                icon={<CheckCircle size={18} color={IRColors.textInvert} />}
              />
              <Button
                label="Dismiss — False Alarm"
                variant="secondary"
                size="md"
                fullWidth
                onPress={handleDismiss}
                icon={<XCircle size={16} color={IRColors.textSecondary} />}
              />
            </View>
          </Animated.View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={metaStyles.item}>
      <Text style={metaStyles.label}>{label}</Text>
      {children}
    </View>
  );
}

const metaStyles = StyleSheet.create({
  item: { gap: 4, flex: 1, minWidth: '45%' },
  label: { color: IRColors.textMuted, fontSize: FontSizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  safe: { flex: 1, justifyContent: 'flex-end' },
  card: {
    backgroundColor: IRColors.surfaceElevated,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    maxHeight: '95%',
    overflow: 'hidden',
    borderTopWidth: 3,
    borderTopColor: IRColors.alertRed,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.base,
    backgroundColor: IRColors.alertRedDim,
    borderBottomWidth: 1,
    borderBottomColor: IRColors.surfaceBorder,
  },
  headerIcon: {
    backgroundColor: '#00000033',
    borderRadius: Radii.md,
    padding: Spacing.xs,
  },
  headerText: { flex: 1 },
  headerTitle: {
    color: IRColors.alertRed,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.heavy,
    letterSpacing: 1,
  },
  headerSub: {
    color: IRColors.textSecondary,
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  scroll: { flexShrink: 1 },
  snapshotSection: {
    padding: Spacing.base,
    gap: Spacing.xs,
  },
  snapshot: {
    borderRadius: Radii.lg,
    borderWidth: 2,
    borderColor: IRColors.alertRed,
  },
  snapshotLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  snapshotLabelText: {
    color: IRColors.textMuted,
    fontSize: FontSizes.xs,
  },
  detailsCard: {
    margin: Spacing.base,
    marginTop: 0,
    backgroundColor: IRColors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  animalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  animalEmoji: { fontSize: 40 },
  animalName: {
    color: IRColors.textPrimary,
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.heavy,
  },
  detectionLabel: {
    color: IRColors.textMuted,
    fontSize: FontSizes.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: IRColors.surfaceBorder,
  },
  confNote: {
    color: IRColors.textMuted,
    fontSize: FontSizes.xs,
    marginTop: -Spacing.xs,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  metaValue: {
    color: IRColors.textPrimary,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  actions: {
    padding: Spacing.base,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: IRColors.surfaceBorder,
    backgroundColor: IRColors.surfaceElevated,
  },
});
