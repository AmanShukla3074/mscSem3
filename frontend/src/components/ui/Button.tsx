/**
 * @file components/ui/Button.tsx
 * Reusable button with primary, secondary, danger, and ghost variants.
 */

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { IRColors, Radii, FontSizes, FontWeights, Spacing } from '@/constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'amber';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  fullWidth?: boolean;
}

const VARIANT: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
  primary:   { bg: IRColors.textPrimary,  text: IRColors.textInvert },
  secondary: { bg: IRColors.surfaceElevated, text: IRColors.textPrimary, border: IRColors.surfaceBorder },
  danger:    { bg: IRColors.alertRed,     text: '#FFF' },
  ghost:     { bg: 'transparent',         text: IRColors.textSecondary },
  amber:     { bg: IRColors.alertAmber,   text: IRColors.textInvert },
};

const SIZE: Record<ButtonSize, { px: number; py: number; fontSize: number; radius: number }> = {
  sm: { px: Spacing.md, py: Spacing.xs + 2, fontSize: FontSizes.sm, radius: Radii.md },
  md: { px: Spacing.base, py: Spacing.sm + 2, fontSize: FontSizes.base, radius: Radii.lg },
  lg: { px: Spacing.xl, py: Spacing.md, fontSize: FontSizes.md, radius: Radii.lg },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  fullWidth = false,
}: ButtonProps) {
  const v = VARIANT[variant];
  const s = SIZE[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      disabled={isDisabled}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          borderColor: v.border ?? 'transparent',
          borderWidth: v.border ? 1 : 0,
          paddingHorizontal: s.px,
          paddingVertical: s.py,
          borderRadius: s.radius,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <View style={styles.inner}>
          {icon && iconPosition === 'left' && <View style={styles.iconL}>{icon}</View>}
          <Text style={[styles.label, { color: v.text, fontSize: s.fontSize }]}>
            {label}
          </Text>
          {icon && iconPosition === 'right' && <View style={styles.iconR}>{icon}</View>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontWeight: FontWeights.semibold,
    letterSpacing: 0.2,
  },
  iconL: { marginRight: Spacing.xs },
  iconR: { marginLeft: Spacing.xs },
});
