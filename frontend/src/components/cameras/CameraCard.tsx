/**
 * @file components/cameras/CameraCard.tsx
 * Live feed card for a connected IR camera.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Wifi, Network, Zap } from 'lucide-react-native';
import { IRColors, FontSizes, FontWeights, Radii, Spacing, Shadows } from '@/constants/theme';
import { Badge } from '@/components/ui/Badge';
import { IRFeedPlaceholder } from '@/components/ui/IRFeedPlaceholder';
import { LiveFeedImage } from '@/components/cameras/LiveFeedImage';
import type { Camera } from '@/types';

interface CameraCardProps {
  camera: Camera;
  hasActiveAlert?: boolean;
}

function ConnectionIcon({ type }: { type: Camera['type'] }) {
  if (type === 'WiFi') return <Wifi size={12} color={IRColors.textMuted} />;
  if (type === 'LAN') return <Network size={12} color={IRColors.textMuted} />;
  return <Zap size={12} color={IRColors.textMuted} />;
}

function LatencyTag({ ms, status }: { ms: number; status: Camera['status'] }) {
  if (status !== 'online') return null;
  const color = ms < 50 ? IRColors.statusGreen : ms < 100 ? IRColors.alertAmber : IRColors.alertRed;
  const target = ms < 100 ? '<100ms ✓' : '≥100ms ⚠';
  return (
    <View style={[latencyStyles.tag, { borderColor: color }]}>
      <Text style={[latencyStyles.text, { color }]}>
        {ms}ms · {target}
      </Text>
    </View>
  );
}

const latencyStyles = StyleSheet.create({
  tag: {
    borderWidth: 1,
    borderRadius: Radii.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: { fontSize: FontSizes.xs, fontWeight: FontWeights.semibold },
});

export function CameraCard({ camera, hasActiveAlert }: CameraCardProps) {
  return (
    <View
      style={[
        styles.card,
        Shadows.card,
        hasActiveAlert && styles.alertBorder,
      ]}
    >
      {/* Feed — live snapshot polling when online, placeholder when offline */}
      {camera.status === 'online' ? (
        <LiveFeedImage
          cameraId={camera.id}
          cameraName={camera.name}
          isOnline
          showDetection={hasActiveAlert}
          style={styles.feed}
        />
      ) : (
        <IRFeedPlaceholder
          cameraName={camera.name}
          isOnline={false}
          showDetection={hasActiveAlert}
          style={styles.feed}
        />
      )}

      {/* Footer info */}
      <View style={styles.footer}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{camera.name}</Text>
          <Badge variant={camera.status} />
        </View>

        <Text style={styles.location} numberOfLines={1}>{camera.fieldLocation}</Text>

        <View style={styles.metaRow}>
          <View style={styles.connType}>
            <ConnectionIcon type={camera.type} />
            <Badge variant={camera.type.toLowerCase() as any} size="sm" />
          </View>
          <Badge variant={camera.cropDensity.toLowerCase() as any} label={`${camera.cropDensity}`} size="sm" />
          <LatencyTag ms={camera.latencyMs} status={camera.status} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: IRColors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
    overflow: 'hidden',
    flex: 1,
    minWidth: 200,
  },
  alertBorder: {
    borderColor: IRColors.alertRed,
    borderWidth: 2,
  },
  feed: {
    borderRadius: 0,
  },
  footer: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  name: {
    color: IRColors.textPrimary,
    fontSize: FontSizes.base,
    fontWeight: FontWeights.semibold,
    flex: 1,
  },
  location: {
    color: IRColors.textMuted,
    fontSize: FontSizes.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  connType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
