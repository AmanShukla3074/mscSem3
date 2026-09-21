/**
 * @file components/cameras/CameraExpandedModal.tsx
 * Full-screen immersive camera view with live MJPEG feed and detection telemetry.
 * Opens when the user taps a camera card on the dashboard.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { X, Wifi, Network, Zap, BellRing, RefreshCw } from 'lucide-react-native';
import { IRColors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { getStreamUrl, getSnapshotUrl } from '@/services/api';
import { useAlerts } from '@/contexts/AlertContext';
import type { Camera } from '@/types';

interface CameraExpandedModalProps {
  camera: Camera;
  onClose: () => void;
}

const { width: SCREEN_W } = Dimensions.get('window');
const FEED_HEIGHT = Math.round(SCREEN_W * (9 / 16));   // 16:9 aspect

function ConnectionIcon({ type }: { type: Camera['type'] }) {
  if (type === 'WiFi') return <Wifi size={13} color={IRColors.textSecondary} />;
  if (type === 'LAN') return <Network size={13} color={IRColors.textSecondary} />;
  return <Zap size={13} color={IRColors.textSecondary} />;
}

export function CameraExpandedModal({ camera, onClose }: CameraExpandedModalProps) {
  const { alerts } = useAlerts();
  const [tick, setTick] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Snapshot refresh — rotate timestamp param so expo-image doesn't cache
  const snapshotUri = `${getSnapshotUrl(camera.id)}?t=${tick}`;

  // Refresh snapshot every 250ms (~4fps) for a pseudo-live feel on web/RN
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 250);
    return () => clearInterval(id);
  }, []);

  // Active alerts for this camera
  const cameraAlerts = alerts.filter(
    a => a.cameraId === camera.id && a.status === 'active',
  );
  const latestAlert = cameraAlerts[0] ?? null;

  // Pulse animation for live indicator
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    if (camera.status === 'online') loop.start();
    return () => loop.stop();
  }, [camera.status, pulseAnim]);

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={IRColors.bg} />

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Animated.View style={[styles.liveDot, { opacity: pulseAnim,
              backgroundColor: camera.status === 'online' ? IRColors.statusGreen : IRColors.statusGray }]}
            />
            <Text style={styles.headerTitle} numberOfLines={1}>{camera.name}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <X size={22} color={IRColors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* ── Live Feed ── */}
          <View style={styles.feedContainer}>
            {camera.status === 'online' ? (
              <Image
                source={{ uri: snapshotUri }}
                style={styles.feed}
                contentFit="cover"
                transition={0}
                cachePolicy="no-cache"
              />
            ) : (
              <View style={[styles.feed, styles.offlineFeed]}>
                <Text style={styles.offlineText}>OFFLINE</Text>
                <Text style={styles.offlineSub}>Camera not reachable</Text>
              </View>
            )}

            {/* Detection alert overlay */}
            {latestAlert && (
              <View style={styles.detectionOverlay}>
                <BellRing size={14} color="#FFF" />
                <Text style={styles.detectionText}>
                  {latestAlert.animalType}  {(latestAlert.confidenceScore * 100).toFixed(0)}%
                </Text>
              </View>
            )}
          </View>

          {/* ── Info panel ── */}
          <View style={styles.infoPanel}>
            <Row label="Location" value={camera.fieldLocation} />
            <Row label="IP Address" value={`${camera.ipAddress}:${camera.port}`} mono />
            <Row label="Connection" value={camera.type} />
            <Row label="Status" value={camera.status.toUpperCase()}
              valueColor={camera.status === 'online' ? IRColors.statusGreen : IRColors.statusGray} />
            {camera.status === 'online' && (
              <Row label="Latency" value={`${camera.latencyMs} ms`} valueColor={IRColors.statusGreen} />
            )}
            <Row label="Stream URL" value={camera.streamUrl} mono small />
          </View>

          {/* ── Active detections ── */}
          {cameraAlerts.length > 0 && (
            <View style={styles.alertSection}>
              <Text style={styles.alertSectionTitle}>⚠ Active Detections</Text>
              {cameraAlerts.slice(0, 5).map(a => (
                <View key={a.id} style={styles.alertRow}>
                  <Text style={styles.alertClass}>{a.animalType}</Text>
                  <Text style={styles.alertConf}>{(a.confidenceScore * 100).toFixed(1)}%</Text>
                  <Text style={styles.alertTime}>
                    {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Row({
  label, value, mono = false, small = false, valueColor,
}: {
  label: string; value: string; mono?: boolean; small?: boolean; valueColor?: string;
}) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text
        style={[rowStyles.value, mono && rowStyles.mono, small && rowStyles.small, valueColor ? { color: valueColor } : null]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: IRColors.surfaceBorder,
  },
  label: { color: IRColors.textMuted, fontSize: FontSizes.sm, flex: 1 },
  value: { color: IRColors.textPrimary, fontSize: FontSizes.sm, flex: 2, textAlign: 'right', fontWeight: FontWeights.semibold },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '400' },
  small: { fontSize: 11 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: IRColors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: IRColors.surfaceBorder,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1 },
  liveDot: { width: 9, height: 9, borderRadius: 5 },
  headerTitle: {
    color: IRColors.textPrimary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    flex: 1,
  },
  closeBtn: {
    backgroundColor: IRColors.surfaceElevated,
    borderRadius: Radii.full,
    padding: 6,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xxxl },
  feedContainer: {
    width: '100%',
    height: FEED_HEIGHT,
    backgroundColor: '#000',
    position: 'relative',
  },
  feed: { width: '100%', height: '100%' },
  offlineFeed: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
    gap: 8,
  },
  offlineText: {
    color: IRColors.alertRed,
    fontSize: 28,
    fontWeight: FontWeights.heavy,
    letterSpacing: 4,
  },
  offlineSub: { color: IRColors.textMuted, fontSize: FontSizes.sm },
  detectionOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#CC000099',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radii.full,
  },
  detectionText: { color: '#FFF', fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
  infoPanel: {
    backgroundColor: IRColors.surface,
    margin: Spacing.base,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  alertSection: {
    marginHorizontal: Spacing.base,
    marginTop: 0,
    backgroundColor: IRColors.alertRedDim,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: IRColors.alertRed,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  alertSectionTitle: {
    color: IRColors.alertRed,
    fontWeight: FontWeights.bold,
    fontSize: FontSizes.sm,
    marginBottom: 4,
  },
  alertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertClass: { color: IRColors.alertRed, fontWeight: FontWeights.semibold, fontSize: FontSizes.sm, flex: 1 },
  alertConf: { color: IRColors.alertRed, fontWeight: FontWeights.bold, fontSize: FontSizes.sm, width: 50, textAlign: 'center' },
  alertTime: { color: IRColors.textMuted, fontSize: FontSizes.xs, width: 70, textAlign: 'right' },
});
