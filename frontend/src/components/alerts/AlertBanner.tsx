/**
 * @file components/alerts/AlertBanner.tsx
 * Flashing emergency banner shown at the top of the dashboard when an active alert exists.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { IRColors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import type { Alert } from '@/types';

interface AlertBannerProps {
  alert: Alert;
  onViewAlert: (alert: Alert) => void;
}

export function AlertBanner({ alert, onViewAlert }: AlertBannerProps) {
  const flashAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 0.3, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(flashAnim, { toValue: 1, duration: 400, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flashAnim]);

  return (
    <TouchableOpacity onPress={() => onViewAlert(alert)} activeOpacity={0.85}>
      <Animated.View style={[styles.banner, { opacity: flashAnim }]}>
        <View style={styles.iconWrap}>
          <AlertTriangle size={20} color="#FFF" />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>
            ⚠ WILDLIFE DETECTED — {alert.animalType.toUpperCase()}
          </Text>
          <Text style={styles.sub}>
            {alert.cameraName} · {(alert.confidenceScore * 100).toFixed(1)}% confidence · Tap to view
          </Text>
        </View>
        <Text style={styles.caret}>›</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: IRColors.alertRed,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    gap: Spacing.sm,
  },
  iconWrap: {
    backgroundColor: '#00000033',
    borderRadius: 20,
    padding: 4,
  },
  content: { flex: 1 },
  title: {
    color: '#FFF',
    fontWeight: FontWeights.bold,
    fontSize: FontSizes.sm,
    letterSpacing: 0.5,
  },
  sub: {
    color: '#FFD0D0',
    fontSize: FontSizes.xs,
    marginTop: 2,
  },
  caret: {
    color: '#FFF',
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
  },
});
