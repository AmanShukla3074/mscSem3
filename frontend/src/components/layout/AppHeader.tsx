/**
 * @file components/layout/AppHeader.tsx
 * Shared app header with branding, alert count badge, and simulate-alert dev button.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bell, Zap } from 'lucide-react-native';
import { IRColors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useAlerts } from '@/contexts/AlertContext';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showSimulateButton?: boolean;
}

export function AppHeader({ title, subtitle, showSimulateButton = false }: AppHeaderProps) {
  const { activeAlertCount, simulateTrigger } = useAlerts();

  return (
    <View style={styles.header}>
      <View style={styles.branding}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>FR</Text>
        </View>
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      <View style={styles.actions}>
        {/* Alert bell with count badge */}
        <View style={styles.bellWrap}>
          <Bell size={22} color={activeAlertCount > 0 ? IRColors.alertRed : IRColors.textSecondary} />
          {activeAlertCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeAlertCount}</Text>
            </View>
          )}
        </View>

        {/* Dev: Simulate alert trigger button */}
        {showSimulateButton && (
          <TouchableOpacity style={styles.simButton} onPress={simulateTrigger} activeOpacity={0.7}>
            <Zap size={14} color={IRColors.alertAmber} />
            <Text style={styles.simText}>SIM</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: IRColors.bg,
    borderBottomWidth: 1,
    borderBottomColor: IRColors.surfaceBorder,
  },
  branding: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoMark: {
    width: 36,
    height: 36,
    backgroundColor: IRColors.thermalHot,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFF',
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.heavy,
    letterSpacing: 1,
  },
  title: {
    color: IRColors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    lineHeight: FontSizes.md * 1.2,
  },
  subtitle: {
    color: IRColors.textMuted,
    fontSize: FontSizes.xs,
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  bellWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: IRColors.alertRed,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: IRColors.bg,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: FontWeights.bold,
  },
  simButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: IRColors.alertAmberDim,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: IRColors.alertAmber,
  },
  simText: {
    color: IRColors.alertAmber,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    letterSpacing: 0.5,
  },
});
