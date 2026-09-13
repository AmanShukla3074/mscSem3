/**
 * @file app/(tabs)/settings.tsx
 * Settings & Edge Pipeline Diagnostics screen.
 */

import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Server, Cpu, BellRing, RefreshCw, LogOut, Info } from 'lucide-react-native';
import { router } from 'expo-router';
import { IRColors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useAlerts } from '@/contexts/AlertContext';
import { mockAlertService } from '@/services/mockAlertService';

export default function SettingsScreen() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { user, logout } = useAuth();
  const { simulateTrigger, loadAlerts } = useAlerts();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const handleResetAlerts = async () => {
    await mockAlertService.reset();
    await loadAlerts();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader title="Settings" subtitle="Edge pipeline & app config" />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* User Info */}
        {user && (
          <View style={styles.userCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user.name}</Text>
              <Text style={styles.userEmail}>{user.email}</Text>
              <Text style={styles.userRole}>{user.role.toUpperCase()}</Text>
            </View>
            <Button label="Sign Out" variant="ghost" size="sm" onPress={handleLogout}
              icon={<LogOut size={14} color={IRColors.textMuted} />} />
          </View>
        )}

        {/* Backend Config */}
        <SectionHeader title="Backend API" />
        <View style={styles.card}>
          <SettingRow icon={<Server size={16} color={IRColors.textSecondary} />} label="API Base URL">
            <TextInput
              style={styles.urlInput}
              value={settings.apiBaseUrl}
              onChangeText={v => updateSettings({ apiBaseUrl: v })}
              placeholder="http://10.0.2.2:8000"
              placeholderTextColor={IRColors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </SettingRow>
          <Text style={styles.hint}>
            Android emulator: 10.0.2.2 maps to host localhost.{'\n'}
            iOS simulator: use localhost directly.{'\n'}
            Real device: use your machine's LAN IP.
          </Text>
        </View>

        {/* Edge Model Config */}
        <SectionHeader title="Edge Model" style={{ marginTop: Spacing.base }} />
        <View style={styles.card}>
          <SettingRow
            icon={<Cpu size={16} color={IRColors.textSecondary} />}
            label={`Confidence Threshold: ${(settings.confidenceThreshold * 100).toFixed(0)}%`}
          >
            <View style={styles.sliderRow}>
              <Text style={styles.sliderMin}>50%</Text>
              <Slider
                style={styles.slider}
                minimumValue={0.5}
                maximumValue={0.99}
                step={0.01}
                value={settings.confidenceThreshold}
                onSlidingComplete={v => updateSettings({ confidenceThreshold: v })}
                minimumTrackTintColor={IRColors.alertAmber}
                maximumTrackTintColor={IRColors.surfaceBorder}
                thumbTintColor={IRColors.alertAmber}
              />
              <Text style={styles.sliderMax}>99%</Text>
            </View>
          </SettingRow>
          <View style={styles.thresholdInfo}>
            <Text style={styles.thresholdLabel}>
              {settings.confidenceThreshold >= 0.85
                ? '🔴 HIGH — fewer alerts, may miss detections'
                : settings.confidenceThreshold >= 0.65
                  ? '🟡 MEDIUM — balanced precision/recall'
                  : '🟢 LOW — more alerts, fewer missed animals'}
            </Text>
          </View>
        </View>

        {/* Simulation */}
        <SectionHeader title="Inference Simulation" subtitle="Dev/demo controls" style={{ marginTop: Spacing.base }} />
        <View style={styles.card}>
          <SettingRow
            icon={<RefreshCw size={16} color={IRColors.textSecondary} />}
            label="Auto-Simulate Stream"
            value={
              <Switch
                value={settings.simulateStreamEnabled}
                onValueChange={v => updateSettings({ simulateStreamEnabled: v })}
                trackColor={{ false: IRColors.surfaceBorder, true: IRColors.alertAmberDim }}
                thumbColor={settings.simulateStreamEnabled ? IRColors.alertAmber : IRColors.textMuted}
              />
            }
          />
          {settings.simulateStreamEnabled && (
            <SettingRow
              icon={<Info size={16} color={IRColors.textSecondary} />}
              label={`Interval: ${(settings.simulateStreamIntervalMs / 1000).toFixed(0)}s`}
            >
              <View style={styles.sliderRow}>
                <Text style={styles.sliderMin}>2s</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={2000}
                  maximumValue={30000}
                  step={1000}
                  value={settings.simulateStreamIntervalMs}
                  onSlidingComplete={v => updateSettings({ simulateStreamIntervalMs: v })}
                  minimumTrackTintColor={IRColors.infoBlu}
                  maximumTrackTintColor={IRColors.surfaceBorder}
                  thumbTintColor={IRColors.infoBlu}
                />
                <Text style={styles.sliderMax}>30s</Text>
              </View>
            </SettingRow>
          )}
          <Button
            label="Trigger Single Alert Now"
            variant="amber"
            size="sm"
            onPress={simulateTrigger}
            style={{ marginTop: Spacing.xs }}
          />
        </View>

        {/* Notifications */}
        <SectionHeader title="Notifications" style={{ marginTop: Spacing.base }} />
        <View style={styles.card}>
          <SettingRow
            icon={<BellRing size={16} color={IRColors.textSecondary} />}
            label="Audio Alerts"
            value={
              <Switch
                value={settings.audioAlertsEnabled}
                onValueChange={v => updateSettings({ audioAlertsEnabled: v })}
                trackColor={{ false: IRColors.surfaceBorder, true: IRColors.statusGreenDim }}
                thumbColor={settings.audioAlertsEnabled ? IRColors.statusGreen : IRColors.textMuted}
              />
            }
          />
        </View>

        {/* Dev utilities */}
        <SectionHeader title="Developer Utilities" style={{ marginTop: Spacing.base }} />
        <View style={styles.card}>
          <Button
            label="Reset Alert History to Seed Data"
            variant="secondary"
            size="sm"
            onPress={handleResetAlerts}
            fullWidth
          />
          <Button
            label="Reset All Settings to Defaults"
            variant="secondary"
            size="sm"
            onPress={resetSettings}
            fullWidth
            style={{ marginTop: Spacing.sm }}
          />
        </View>

        {/* Version info */}
        <View style={styles.versionBlock}>
          <Text style={styles.versionText}>AgriIR Guard · v0.1.0-dev</Text>
          <Text style={styles.versionText}>IndoML 2026 · MSc Sem 3 Research Project</Text>
          <Text style={styles.versionText}>Edge YOLO Model: Training Phase — Mock API Active</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  icon,
  label,
  value,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <View style={rowStyles.container}>
      <View style={rowStyles.labelRow}>
        {icon}
        <Text style={rowStyles.label}>{label}</Text>
        {value && <View style={{ marginLeft: 'auto' }}>{value}</View>}
      </View>
      {children && <View style={rowStyles.childWrap}>{children}</View>}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: { gap: 4, paddingVertical: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { color: IRColors.textPrimary, fontSize: FontSizes.sm, fontWeight: FontWeights.medium, flex: 1 },
  childWrap: { paddingLeft: 24 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: IRColors.bg },
  scroll: { flex: 1 },
  content: { padding: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.sm },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: IRColors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radii.full,
    backgroundColor: IRColors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: IRColors.textPrimary, fontSize: FontSizes.xl, fontWeight: FontWeights.bold },
  userName: { color: IRColors.textPrimary, fontSize: FontSizes.base, fontWeight: FontWeights.semibold },
  userEmail: { color: IRColors.textSecondary, fontSize: FontSizes.sm },
  userRole: { color: IRColors.alertAmber, fontSize: FontSizes.xs, fontWeight: FontWeights.bold, letterSpacing: 1, marginTop: 2 },
  card: {
    backgroundColor: IRColors.surface,
    borderRadius: Radii.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
    gap: Spacing.md,
  },
  urlInput: {
    backgroundColor: IRColors.surfaceInput,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    color: IRColors.textPrimary,
    fontSize: FontSizes.sm,
    fontFamily: 'monospace',
    marginTop: Spacing.xs,
  },
  hint: {
    color: IRColors.textMuted,
    fontSize: FontSizes.xs,
    lineHeight: 17,
    backgroundColor: IRColors.surfaceElevated,
    borderRadius: Radii.md,
    padding: Spacing.sm,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 4,
  },
  slider: { flex: 1, height: 36 },
  sliderMin: { color: IRColors.textMuted, fontSize: FontSizes.xs, width: 28, textAlign: 'center' },
  sliderMax: { color: IRColors.textMuted, fontSize: FontSizes.xs, width: 28, textAlign: 'center' },
  thresholdInfo: {
    backgroundColor: IRColors.surfaceElevated,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    marginTop: -Spacing.xs,
  },
  thresholdLabel: { color: IRColors.textSecondary, fontSize: FontSizes.xs, lineHeight: 16 },
  versionBlock: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xl,
  },
  versionText: { color: IRColors.textMuted, fontSize: FontSizes.xs, textAlign: 'center' },
});
