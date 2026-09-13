/**
 * @file components/ui/IRFeedPlaceholder.tsx
 * Simulates a thermal IR camera feed with an animated colormap-style gradient.
 * In production, replace with an actual RTSP/MJPEG stream viewer.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { IRColors, FontSizes, FontWeights } from '@/constants/theme';

interface IRFeedPlaceholderProps {
  cameraName: string;
  isOnline: boolean;
  style?: ViewStyle;
  /** If true, show a simulated detected animal hotspot */
  showDetection?: boolean;
  /** Normalized 0–1 bounding box */
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export function IRFeedPlaceholder({
  cameraName,
  isOnline,
  style,
  showDetection,
  boundingBox,
}: IRFeedPlaceholderProps) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isOnline) return;

    // Slow shimmer to simulate IR noise / heat haze
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ]),
    );
    shimmerLoop.start();

    return () => shimmerLoop.stop();
  }, [isOnline, shimmer]);

  useEffect(() => {
    if (!showDetection) return;
    // Pulse the bounding box indicator
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [showDetection, pulse]);

  const shimmerOpacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.06, 0.14],
  });

  return (
    <View style={[styles.container, style]}>
      {/* Thermal background layers */}
      <View style={[StyleSheet.absoluteFill, styles.thermalBase]} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.thermalMid,
          { opacity: shimmerOpacity },
        ]}
      />
      <View style={[StyleSheet.absoluteFill, styles.thermalNoise]} />

      {/* Simulated warm hotspots (always rendered for realism) */}
      <View style={[styles.hotspot, { top: '20%', left: '15%', width: 40, height: 30, borderRadius: 20, opacity: 0.5 }]} />
      <View style={[styles.hotspot, { top: '55%', right: '20%', width: 25, height: 20, borderRadius: 12, opacity: 0.3 }]} />

      {/* Detection bounding box overlay */}
      {showDetection && boundingBox && (
        <Animated.View
          style={[
            styles.bbox,
            {
              left: `${boundingBox.x * 100}%`,
              top: `${boundingBox.y * 100}%`,
              width: `${boundingBox.width * 100}%`,
              height: `${boundingBox.height * 100}%`,
              borderColor: IRColors.alertRed,
              opacity: pulse,
            },
          ]}
        />
      )}

      {/* Offline overlay */}
      {!isOnline && (
        <View style={styles.offlineOverlay}>
          <Text style={styles.offlineIcon}>⚠</Text>
          <Text style={styles.offlineText}>NO SIGNAL</Text>
          <Text style={styles.offlineSubtext}>{cameraName}</Text>
        </View>
      )}

      {/* Camera label overlay */}
      {isOnline && (
        <View style={styles.labelRow}>
          <View style={styles.recDot} />
          <Text style={styles.labelText}>LIVE IR</Text>
        </View>
      )}

      {/* Scanline effect */}
      {isOnline && <View style={styles.scanline} pointerEvents="none" />}
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
  thermalBase: {
    backgroundColor: '#0A0A1E',
  },
  thermalMid: {
    backgroundColor: '#1A1A4A',
  },
  thermalNoise: {
    backgroundColor: 'transparent',
    // Visual texture via border (creates subtle grid feel)
    borderWidth: 0.5,
    borderColor: '#ffffff08',
  },
  hotspot: {
    position: 'absolute',
    backgroundColor: IRColors.thermalHot,
  },
  bbox: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  offlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000CC',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  offlineIcon: {
    fontSize: 28,
    color: IRColors.alertAmber,
  },
  offlineText: {
    color: IRColors.alertAmber,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.bold,
    letterSpacing: 2,
  },
  offlineSubtext: {
    color: IRColors.textMuted,
    fontSize: FontSizes.xs,
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
  scanline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Subtle scanline illusion
    borderTopWidth: 1,
    borderTopColor: '#ffffff04',
  },
});
