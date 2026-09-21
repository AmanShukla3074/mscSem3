/**
 * @file components/cameras/LiveFeedImage.tsx
 * Live camera feed component.
 * - Web: uses a native <img> tag connected to the MJPEG /stream endpoint.
 *   The browser handles the continuous multipart stream with zero JS re-render
 *   overhead, eliminating flicker from repeated state-driven re-fetching.
 * - Native (iOS/Android): polls GET /api/cameras/{id}/snapshot at the given
 *   interval as MJPEG streams are not reliably supported by Expo Image.
 * Falls back to IRFeedPlaceholder on error or when offline.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { getSnapshotUrl, getStreamUrl } from '@/services/api';
import { IRFeedPlaceholder } from '@/components/ui/IRFeedPlaceholder';
import { IRColors, FontSizes, FontWeights } from '@/constants/theme';
import type { BoundingBox } from '@/types';

interface LiveFeedImageProps {
  cameraId: string;
  cameraName: string;
  isOnline: boolean;
  style?: ViewStyle;
  showDetection?: boolean;
  boundingBox?: BoundingBox;
  /** Snapshot poll interval in ms (default 1000) */
  pollIntervalMs?: number;
}

export function LiveFeedImage({
  cameraId,
  cameraName,
  isOnline,
  style,
  showDetection,
  boundingBox,
  pollIntervalMs = 1000,
}: LiveFeedImageProps) {
  const [snapshotKey, setSnapshotKey] = useState(0);
  const [hasFailed, setHasFailed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  // Pulse animation for active detections
  useEffect(() => {
    if (!showDetection) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [showDetection, pulse]);

  // Snapshot polling — only used on native (iOS/Android).
  // On web the MJPEG <img> stream handles updates natively without any JS polling.
  useEffect(() => {
    if (Platform.OS === 'web') return;  // MJPEG stream on web — no polling needed
    if (!isOnline) return;

    setHasFailed(false);

    intervalRef.current = setInterval(() => {
      setSnapshotKey(k => k + 1);
    }, pollIntervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOnline, pollIntervalMs, cameraId]);

  // If offline or repeated failures, show placeholder
  if (!isOnline || hasFailed) {
    return (
      <IRFeedPlaceholder
        cameraName={cameraName}
        isOnline={false}
        style={style}
        showDetection={showDetection}
        boundingBox={boundingBox}
      />
    );
  }

  // ── Web: native MJPEG stream via <img> ───────────────────────────────────
  // The browser speaks multipart/x-mixed-replace natively — zero JS polling,
  // zero React re-renders, no flickering.
  if (Platform.OS === 'web') {
    const streamUrl = getStreamUrl(cameraId);
    return (
      <View style={[styles.container, style]}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={streamUrl}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onError={() => setHasFailed(true)}
          onLoad={() => setHasFailed(false)}
          alt={`${cameraName} live feed`}
        />

        {/* Bounding box overlay */}
        {showDetection && boundingBox && (
          <Animated.View
            style={[
              styles.bbox,
              {
                left: `${boundingBox.x * 100}%` as any,
                top: `${boundingBox.y * 100}%` as any,
                width: `${boundingBox.width * 100}%` as any,
                height: `${boundingBox.height * 100}%` as any,
                opacity: pulse,
              },
            ]}
          />
        )}

        {/* LIVE IR badge */}
        <View style={styles.labelRow}>
          <View style={styles.recDot} />
          <Text style={styles.labelText}>LIVE IR</Text>
        </View>
      </View>
    );
  }

  // ── Native: cache-busted snapshot polling ────────────────────────────────
  const snapshotUrl = `${getSnapshotUrl(cameraId)}?t=${snapshotKey}`;

  return (
    <View style={[styles.container, style]}>
      <Image
        source={{ uri: snapshotUrl }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={100}
        cachePolicy="no-cache"
        onError={() => setHasFailed(true)}
        onLoad={() => setHasFailed(false)}
      />

      {/* Bounding box overlay */}
      {showDetection && boundingBox && (
        <Animated.View
          style={[
            styles.bbox,
            {
              left: `${boundingBox.x * 100}%` as any,
              top: `${boundingBox.y * 100}%` as any,
              width: `${boundingBox.width * 100}%` as any,
              height: `${boundingBox.height * 100}%` as any,
              opacity: pulse,
            },
          ]}
        />
      )}

      {/* LIVE IR badge */}
      <View style={styles.labelRow}>
        <View style={styles.recDot} />
        <Text style={styles.labelText}>LIVE IR</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    aspectRatio: 16 / 9,
    backgroundColor: IRColors.thermalColdest,
    borderRadius: 8,
    overflow: 'hidden',
  },
  bbox: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: IRColors.alertRed,
  },
  labelRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00000066',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IRColors.alertRed,
  },
  labelText: {
    color: '#FFF',
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    letterSpacing: 1,
  },
});
