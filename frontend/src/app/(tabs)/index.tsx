/**
 * @file app/(tabs)/index.tsx
 * Harvester Dashboard — metric tiles, live IR feed grid, alert banner.
 */

import React, { useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, BellRing, Layers } from 'lucide-react-native';
import { IRColors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { AppHeader } from '@/components/layout/AppHeader';
import { MetricTile } from '@/components/ui/MetricTile';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { CameraCard } from '@/components/cameras/CameraCard';
import { AlertBanner } from '@/components/alerts/AlertBanner';
import { AlertDetailModal } from '@/components/alerts/AlertDetailModal';
import { useCameras } from '@/contexts/CameraContext';
import { useAlerts } from '@/contexts/AlertContext';
import type { Alert } from '@/types';

export default function DashboardScreen() {
  const { cameras, isLoading: camLoading, refresh: refreshCams } = useCameras();
  const { alerts, activeAlertCount } = useAlerts();
  const [selectedAlert, setSelectedAlert] = React.useState<Alert | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  // The most recent active alert for the banner
  const topActiveAlert = useMemo(
    () => alerts.find(a => a.status === 'active') ?? null,
    [alerts],
  );

  const onlineCamCount = cameras.filter(c => c.status === 'online').length;

  // Dominant crop density across online cameras
  const dominantDensity = useMemo(() => {
    const counts = { Heavy: 0, Medium: 0, Light: 0 };
    cameras.forEach(c => { counts[c.cropDensity]++; });
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A') as string;
  }, [cameras]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshCams();
    setRefreshing(false);
  };

  // Detect which cameras have an active alert
  const alertCameraIds = useMemo(
    () => new Set(alerts.filter(a => a.status === 'active').map(a => a.cameraId)),
    [alerts],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader
        title="AgriIR Guard"
        subtitle="Harvester Dashboard"
        showSimulateButton
      />

      {/* Active alert banner */}
      {topActiveAlert && (
        <AlertBanner
          alert={topActiveAlert}
          onViewAlert={a => setSelectedAlert(a)}
        />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={IRColors.textSecondary}
            colors={[IRColors.textPrimary]}
          />
        }
      >
        {/* Metric tiles */}
        <SectionHeader title="System Overview" subtitle="Live harvester status" />
        <View style={styles.metricsRow}>
          <MetricTile
            label="Cameras Online"
            value={`${onlineCamCount}/${cameras.length}`}
            accentColor={onlineCamCount > 0 ? IRColors.statusGreen : IRColors.statusGray}
            icon={<Camera size={16} color={onlineCamCount > 0 ? IRColors.statusGreen : IRColors.statusGray} />}
            sublabel="Forward-facing IR"
          />
          <MetricTile
            label="Active Alerts"
            value={activeAlertCount}
            accentColor={activeAlertCount > 0 ? IRColors.alertRed : IRColors.textPrimary}
            icon={<BellRing size={16} color={activeAlertCount > 0 ? IRColors.alertRed : IRColors.textSecondary} />}
            sublabel={activeAlertCount > 0 ? 'ACTION REQUIRED' : 'All clear'}
          />
          <MetricTile
            label="Crop Density"
            value={dominantDensity}
            accentColor={
              dominantDensity === 'Heavy'
                ? IRColors.alertRed
                : dominantDensity === 'Medium'
                  ? IRColors.alertAmber
                  : IRColors.statusGreen
            }
            icon={<Layers size={16} color={IRColors.textSecondary} />}
            sublabel="Field regime"
          />
        </View>

        {/* Live feed grid */}
        <SectionHeader
          title="Live IR Feeds"
          subtitle={`${cameras.length} cameras registered`}
          style={{ marginTop: Spacing.base }}
        />
        <View style={styles.feedGrid}>
          {cameras.map(cam => (
            <View key={cam.id} style={styles.feedItem}>
              <CameraCard
                camera={cam}
                hasActiveAlert={alertCameraIds.has(cam.id)}
              />
            </View>
          ))}
        </View>

        {/* Recent alerts preview */}
        {alerts.filter(a => a.status === 'active').length > 0 && (
          <View style={styles.activeAlertsSection}>
            <SectionHeader title="Active Detections" subtitle="Awaiting operator action" />
            {alerts.filter(a => a.status === 'active').map(a => (
              <View key={a.id} style={styles.activeAlertRow}>
                <Text style={styles.activeAlertAnimal}>
                  {a.animalType} — {a.cameraName}
                </Text>
                <Text style={styles.activeAlertConf}>
                  {(a.confidenceScore * 100).toFixed(1)}%
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Alert detail modal */}
      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: IRColors.bg },
  scroll: { flex: 1 },
  scrollContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.sm,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  feedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  feedItem: {
    flex: 1,
    minWidth: '45%',
  },
  activeAlertsSection: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  activeAlertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: IRColors.alertRedDim,
    borderRadius: 8,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: IRColors.alertRed,
  },
  activeAlertAnimal: {
    color: IRColors.alertRed,
    fontWeight: FontWeights.semibold,
    fontSize: FontSizes.sm,
  },
  activeAlertConf: {
    color: IRColors.alertRed,
    fontWeight: FontWeights.bold,
    fontSize: FontSizes.sm,
  },
});
