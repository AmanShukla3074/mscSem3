/**
 * @file components/ui/Badge.tsx
 * Status badges for cameras, alerts, and crop density.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IRColors, Radii, FontSizes, FontWeights, Spacing } from '@/constants/theme';

type BadgeVariant =
  | 'online'
  | 'offline'
  | 'connecting'
  | 'active'
  | 'acknowledged'
  | 'resolved'
  | 'critical'
  | 'warning'
  | 'info'
  | 'light'
  | 'medium'
  | 'heavy'
  | 'wifi'
  | 'lan'
  | 'rtsp';

interface BadgeProps {
  variant: BadgeVariant;
  label?: string;
  size?: 'sm' | 'md';
}

const VARIANT_STYLES: Record<BadgeVariant, { bg: string; text: string; dot?: string }> = {
  online:       { bg: IRColors.statusGreenDim, text: IRColors.statusGreen, dot: IRColors.statusGreen },
  offline:      { bg: '#1F1F23', text: IRColors.textMuted, dot: IRColors.statusGray },
  connecting:   { bg: '#1A2535', text: IRColors.infoBlu },
  active:       { bg: IRColors.alertRedDim, text: IRColors.alertRed, dot: IRColors.alertRed },
  acknowledged: { bg: IRColors.alertAmberDim, text: IRColors.alertAmber },
  resolved:     { bg: IRColors.statusGreenDim, text: IRColors.statusGreen },
  critical:     { bg: IRColors.alertRedDim, text: IRColors.alertRed },
  warning:      { bg: IRColors.alertAmberDim, text: IRColors.alertAmber },
  info:         { bg: IRColors.infoBluDim, text: IRColors.infoBlu },
  light:        { bg: '#1A2E1A', text: '#4ADE80' },
  medium:       { bg: IRColors.alertAmberDim, text: IRColors.alertAmber },
  heavy:        { bg: IRColors.alertRedDim, text: '#F87171' },
  wifi:         { bg: '#1C2535', text: '#60A5FA' },
  lan:          { bg: '#1C2535', text: '#818CF8' },
  rtsp:         { bg: '#1C2535', text: '#A78BFA' },
};

const DEFAULT_LABELS: Partial<Record<BadgeVariant, string>> = {
  online: 'ONLINE', offline: 'OFFLINE', connecting: 'CONNECTING',
  active: 'ACTIVE', acknowledged: 'ACK', resolved: 'RESOLVED',
  critical: 'CRITICAL', warning: 'WARNING', info: 'INFO',
  light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY',
  wifi: 'WiFi', lan: 'LAN', rtsp: 'RTSP',
};

export function Badge({ variant, label, size = 'sm' }: BadgeProps) {
  const style = VARIANT_STYLES[variant];
  const text = label ?? DEFAULT_LABELS[variant] ?? variant.toUpperCase();
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: style.bg, paddingHorizontal: isSmall ? Spacing.xs : Spacing.sm },
      ]}
    >
      {style.dot && (
        <View style={[styles.dot, { backgroundColor: style.dot }]} />
      )}
      <Text
        style={[
          styles.text,
          { color: style.text, fontSize: isSmall ? FontSizes.xs : FontSizes.sm },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    borderRadius: Radii.full,
    alignSelf: 'flex-start',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontWeight: FontWeights.semibold,
    letterSpacing: 0.5,
  },
});
