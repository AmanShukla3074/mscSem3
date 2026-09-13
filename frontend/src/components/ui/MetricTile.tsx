/**
 * @file components/ui/MetricTile.tsx
 * Dashboard stat tile: icon + big number + label.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IRColors, Radii, FontSizes, FontWeights, Spacing, Shadows } from '@/constants/theme';

interface MetricTileProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accentColor?: string;
  sublabel?: string;
}

export function MetricTile({ label, value, icon, accentColor, sublabel }: MetricTileProps) {
  const accent = accentColor ?? IRColors.textPrimary;
  return (
    <View style={[styles.tile, Shadows.card]}>
      {icon && <View style={[styles.iconWrap, { backgroundColor: `${accent}22` }]}>{icon}</View>}
      <Text style={[styles.value, { color: accent }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: IRColors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
    alignItems: 'flex-start',
    gap: 4,
    minWidth: 100,
  },
  iconWrap: {
    borderRadius: Radii.md,
    padding: Spacing.xs,
    marginBottom: 2,
  },
  value: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.heavy,
    lineHeight: FontSizes.xxl * 1.1,
  },
  label: {
    fontSize: FontSizes.xs,
    color: IRColors.textSecondary,
    fontWeight: FontWeights.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sublabel: {
    fontSize: FontSizes.xs,
    color: IRColors.textMuted,
    marginTop: 2,
  },
});
