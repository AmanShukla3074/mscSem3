/**
 * @file components/alerts/AlertCard.tsx
 * Alert history list item card.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IRColors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { Badge } from '@/components/ui/Badge';
import type { Alert } from '@/types';

interface AlertCardProps {
  alert: Alert;
  onPress: (alert: Alert) => void;
}

const ANIMAL_ICON: Record<string, string> = {
  Nilgai: '🦬', Fawn: '🦌', 'Wild Boar': '🐗', Rabbit: '🐇', Fox: '🦊', Unknown: '❓',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export function AlertCard({ alert, onPress }: AlertCardProps) {
  const accentColor =
    alert.severity === 'critical'
      ? IRColors.alertRed
      : alert.severity === 'warning'
        ? IRColors.alertAmber
        : IRColors.infoBlu;

  return (
    <TouchableOpacity onPress={() => onPress(alert)} activeOpacity={0.8}>
      <View style={[styles.card, { borderLeftColor: accentColor }]}>
        {/* Animal icon + name */}
        <View style={styles.iconCol}>
          <Text style={styles.animalIcon}>
            {ANIMAL_ICON[alert.animalType] ?? '❓'}
          </Text>
        </View>

        <View style={styles.main}>
          <View style={styles.row}>
            <Text style={styles.animalType}>{alert.animalType}</Text>
            <Text style={styles.time}>{formatTime(alert.timestamp)}</Text>
          </View>

          <Text style={styles.camera}>{alert.cameraName}</Text>

          <View style={styles.badges}>
            <Badge variant={alert.status} />
            <Badge variant={alert.cropDensity.toLowerCase() as any} label={`${alert.cropDensity} crop`} />
            <Text style={[styles.conf, { color: accentColor }]}>
              {(alert.confidenceScore * 100).toFixed(1)}%
            </Text>
          </View>
        </View>

        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IRColors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  iconCol: {
    width: 40,
    height: 40,
    backgroundColor: IRColors.surfaceElevated,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animalIcon: { fontSize: 22 },
  main: { flex: 1, gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  animalType: {
    color: IRColors.textPrimary,
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
  },
  time: {
    color: IRColors.textMuted,
    fontSize: FontSizes.xs,
  },
  camera: {
    color: IRColors.textSecondary,
    fontSize: FontSizes.sm,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  conf: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
  },
  chevron: {
    color: IRColors.textMuted,
    fontSize: FontSizes.lg,
  },
});
