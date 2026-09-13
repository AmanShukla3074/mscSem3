/**
 * @file components/ui/ConfidenceMeter.tsx
 * Horizontal confidence score bar with color-coded fill.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IRColors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';

interface ConfidenceMeterProps {
  score: number; // 0–1
  showLabel?: boolean;
  height?: number;
}

function getColor(score: number): string {
  if (score >= 0.85) return IRColors.alertRed;
  if (score >= 0.65) return IRColors.alertAmber;
  return IRColors.statusGreen;
}

export function ConfidenceMeter({ score, showLabel = true, height = 6 }: ConfidenceMeterProps) {
  const pct = Math.min(1, Math.max(0, score));
  const color = getColor(pct);
  const label = `${(pct * 100).toFixed(1)}%`;

  return (
    <View style={styles.container}>
      {showLabel && (
        <View style={styles.header}>
          <Text style={styles.labelText}>Confidence</Text>
          <Text style={[styles.valueText, { color }]}>{label}</Text>
        </View>
      )}
      <View style={[styles.track, { height }]}>
        <View
          style={[
            styles.fill,
            { width: `${pct * 100}%`, backgroundColor: color, height },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 4 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelText: {
    color: IRColors.textSecondary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  valueText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
  },
  track: {
    backgroundColor: IRColors.surfaceBorder,
    borderRadius: Radii.full,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: Radii.full,
  },
});
