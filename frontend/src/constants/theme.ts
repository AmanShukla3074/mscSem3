/**
 * @file constants/theme.ts
 * Design system for the IR Wildlife Detection app.
 * Industrial / harvester-operator palette — high contrast, minimal glare.
 * Safety Amber/Red strictly for alerts; Green for live status only.
 */

import { Platform } from 'react-native';

// ─────────────────────────────────────────────
// IR App Color Palette
// ─────────────────────────────────────────────

export const IRColors = {
  // Backgrounds
  bg: '#121212',           // Deep charcoal — primary background
  surface: '#1C1C1F',      // Card / panel surface
  surfaceElevated: '#242427', // Elevated card (modals, sheets)
  surfaceBorder: '#2E2E33',   // Dividers and border lines
  surfaceInput: '#1A1A1E',    // Text input background

  // Text
  textPrimary: '#F5F5F5',     // High-contrast primary text
  textSecondary: '#9CA3AF',   // Muted labels and metadata
  textMuted: '#6B7280',       // Placeholder / disabled
  textInvert: '#121212',      // Text on light/amber backgrounds

  // Accent — Alert / Safety
  alertRed: '#EF4444',        // Critical wildlife detection
  alertRedDim: '#7F1D1D',     // Alert card tint background
  alertAmber: '#F59E0B',      // Warning / medium confidence
  alertAmberDim: '#78350F',   // Amber tint background

  // Accent — Status
  statusGreen: '#10B981',     // Online / active
  statusGreenDim: '#064E3B',  // Online tint background
  statusGray: '#4B5563',      // Offline / inactive

  // IR Thermal Colormap tints (simulated in placeholder)
  thermalHot: '#FF6B35',      // Hot region (animal body)
  thermalMid: '#FFB347',      // Mid-range thermal
  thermalCold: '#2C3E8C',     // Cold background
  thermalColdest: '#0A0A2A',  // Coldest areas

  // Info / Neutral
  infoBlu: '#3B82F6',         // Non-critical info accent
  infoBluDim: '#1E3A5F',

  // Tab / nav
  tabActive: '#F5F5F5',
  tabInactive: '#4B5563',
} as const;

// ─────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    mono: 'monospace',
  },
  web: {
    sans: 'Inter, system-ui, sans-serif',
    serif: 'serif',
    mono: 'monospace',
  },
});

export const FontSizes = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  xxxl: 38,
} as const;

export const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

// ─────────────────────────────────────────────
// Spacing Scale
// ─────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  section: 64,
} as const;

// ─────────────────────────────────────────────
// Border Radius
// ─────────────────────────────────────────────

export const Radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

// ─────────────────────────────────────────────
// Shadows (Android elevation / iOS shadow)
// ─────────────────────────────────────────────

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
} as const;

// ─────────────────────────────────────────────
// Legacy Colors (kept for expo-router theme compat)
// ─────────────────────────────────────────────

export const Colors = {
  light: {
    text: '#121212',
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#F5F5F5',
    background: '#121212',
    backgroundElement: '#1C1C1F',
    backgroundSelected: '#2E2E33',
    textSecondary: '#9CA3AF',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 900;
