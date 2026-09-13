/**
 * @file components/ui/SectionHeader.tsx
 * Labeled section divider with optional action button.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { IRColors, FontSizes, FontWeights, Spacing } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  subtitle?: string;
  style?: ViewStyle;
}

export function SectionHeader({ title, actionLabel, onAction, subtitle, style }: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  left: { flex: 1 },
  title: {
    color: IRColors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    letterSpacing: 0.2,
  },
  subtitle: {
    color: IRColors.textMuted,
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  action: {
    color: IRColors.infoBlu,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
});
