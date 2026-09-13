/**
 * @file components/ui/Card.tsx
 * Surface card with optional press state and border accent.
 */

import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { IRColors, Radii, Shadows, Spacing } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  accent?: string; // Left border accent color
  elevated?: boolean;
}

export function Card({ children, onPress, style, accent, elevated }: CardProps) {
  const bg = elevated ? IRColors.surfaceElevated : IRColors.surface;

  const inner = (
    <View
      style={[
        styles.card,
        { backgroundColor: bg },
        accent ? { borderLeftWidth: 3, borderLeftColor: accent } : {},
        elevated ? Shadows.card : {},
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
    overflow: 'hidden',
  },
});
