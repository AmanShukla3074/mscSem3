/**
 * @file app/(tabs)/detect.tsx
 * Three-section detection screen:
 *   1. Live Camera   — existing camera feeds (untouched pipeline)
 *   2. Thermal Detect — image upload → ONNX YOLO → annotated result + detection list
 *   3. Notifications  — isolated detection alert log
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  ScanLine,
  BellRing,
  Upload,
  ImageIcon,
  Trash2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  X,
} from 'lucide-react-native';
import { IRColors, FontSizes, FontWeights, Radii, Spacing, Shadows } from '@/constants/theme';
import { AppHeader } from '@/components/layout/AppHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Button } from '@/components/ui/Button';
import { CameraCard } from '@/components/cameras/CameraCard';
import { getBaseUrl } from '@/services/api';
import { useCameras } from '@/contexts/CameraContext';
import { useAlerts } from '@/contexts/AlertContext';
import type { Alert } from '@/types';

// ─────────────────────────────────────────────
// Local Types
// ─────────────────────────────────────────────

type ActiveSection = 'camera' | 'thermal' | 'notifications';

interface DetectionBox {
  class_id:     number;
  class_name:   string;
  display_name: string;
  confidence:   number;
  bbox_norm:    { x: number; y: number; width: number; height: number };
  bbox_abs:     { x1: number; y1: number; x2: number; y2: number };
}

interface DetectResult {
  success:            boolean;
  image_width:        number;
  image_height:       number;
  detections:         DetectionBox[];
  count:              number;
  inference_ms:       number;
  annotated_jpeg_b64: string;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const CLASS_COLORS: Record<string, string> = {
  nilgai: '#10B981',
  boar:   '#3B82F6',
  cow:    '#F59E0B',
};

const EMOJI: Record<string, string> = {
  nilgai: '🦌',
  boar:   '🐗',
  cow:    '🐄',
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: IRColors.alertRed,
  warning:  IRColors.alertAmber,
  info:     IRColors.infoBlu,
};

// ─────────────────────────────────────────────
// Root screen
// ─────────────────────────────────────────────

export default function DetectScreen() {
  const [section, setSection] = useState<ActiveSection>('thermal');

  // Notification badge count (unread)
  const { alerts, activeAlertCount, acknowledgeAlert, resolveAlert } = useAlerts();
  const [lastSeen, setLastSeen] = useState(0);
  const unread = alerts.length - lastSeen;

  const handleNotifTab = useCallback(() => {
    setSection('notifications');
    setLastSeen(alerts.length);
  }, [alerts.length]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader
        title="Detection Centre"
        subtitle="Camera · Thermal YOLO · Notifications"
      />

      {/* ── Section tab bar ──────────────────────────────────────────── */}
      <View style={styles.tabBar}>
        <SectionTab
          label="Live Camera"
          icon={<Camera size={14} color={section === 'camera' ? IRColors.textPrimary : IRColors.textSecondary} />}
          active={section === 'camera'}
          onPress={() => setSection('camera')}
        />
        <SectionTab
          label="Thermal Detect"
          icon={<ScanLine size={14} color={section === 'thermal' ? IRColors.textPrimary : IRColors.textSecondary} />}
          active={section === 'thermal'}
          onPress={() => setSection('thermal')}
        />
        <SectionTab
          label="Notifications"
          icon={<BellRing size={14} color={section === 'notifications' ? IRColors.alertRed : IRColors.textSecondary} />}
          active={section === 'notifications'}
          badge={unread > 0 ? unread : undefined}
          onPress={handleNotifTab}
        />
      </View>

      {/* ── Section content ──────────────────────────────────────────── */}
      {section === 'camera'        && <LiveCameraSection />}
      {section === 'thermal'       && <ThermalDetectSection />}
      {section === 'notifications' && (
        <NotificationsSection
          alerts={alerts}
          onAcknowledge={acknowledgeAlert}
          onResolve={resolveAlert}
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section Tab button
// ─────────────────────────────────────────────────────────────────────────────

function SectionTab({
  label, icon, active, badge, onPress,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.tabIconWrap}>
        {icon}
        {badge != null && badge > 0 && (
          <View style={styles.tabBadge}>
            <Text style={styles.tabBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Live Camera
// ─────────────────────────────────────────────────────────────────────────────

function LiveCameraSection() {
  const { cameras, isLoading, refresh } = useCameras();
  const { alerts } = useAlerts();

  const alertCamIds = new Set(
    alerts.filter(a => a.status === 'active').map(a => a.cameraId),
  );

  return (
    <ScrollView
      style={styles.sectionScroll}
      contentContainerStyle={styles.sectionContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionBadge}>
        <Camera size={13} color={IRColors.statusGreen} />
        <Text style={styles.sectionBadgeText}>
          Live IR Feeds · {cameras.filter(c => c.status === 'online').length}/{cameras.length} online
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={IRColors.statusGreen} style={{ marginTop: Spacing.xl }} />
      ) : cameras.length === 0 ? (
        <EmptyPlaceholder
          icon="📷"
          title="No cameras registered"
          sub='Add cameras from the "Cameras" tab to see live feeds here.'
        />
      ) : (
        <View style={styles.feedGrid}>
          {cameras.map(cam => (
            <View key={cam.id} style={styles.feedItem}>
              <CameraCard camera={cam} hasActiveAlert={alertCamIds.has(cam.id)} />
            </View>
          ))}
        </View>
      )}

      <Button
        label="Refresh"
        variant="secondary"
        size="sm"
        onPress={refresh}
        icon={<RefreshCw size={13} color={IRColors.textSecondary} />}
        style={{ marginTop: Spacing.md }}
      />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Thermal Detection
// ─────────────────────────────────────────────────────────────────────────────

function ThermalDetectSection() {
  const [pickedUri, setPickedUri]   = useState<string | null>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [result, setResult]         = useState<DetectResult | null>(null);
  const [detecting, setDetecting]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [confPct, setConfPct]       = useState(25); // integer 1-99

  // Web file picker
  const pickFile = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file: File = e.target.files?.[0];
      if (!file) return;
      setPickedFile(file);
      setPickedUri(URL.createObjectURL(file));
      setResult(null);
      setError(null);
    };
    input.click();
  }, []);

  const clearImage = useCallback(() => {
    setPickedUri(null);
    setPickedFile(null);
    setResult(null);
    setError(null);
  }, []);

  const runDetection = useCallback(async () => {
    if (!pickedFile && !pickedUri) return;
    setDetecting(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append('conf_threshold', String(confPct / 100));
      if (Platform.OS === 'web' && pickedFile) {
        form.append('file', pickedFile, pickedFile.name);
      } else if (pickedUri) {
        const resp = await fetch(pickedUri);
        const blob = await resp.blob();
        form.append('file', blob, 'upload.jpg');
      }
      const res = await fetch(`${getBaseUrl()}/api/detect/image`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`${res.status}: ${txt}`);
      }
      setResult(await res.json());
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setDetecting(false);
    }
  }, [pickedFile, pickedUri, confPct]);

  const annotatedUri = result?.annotated_jpeg_b64
    ? `data:image/jpeg;base64,${result.annotated_jpeg_b64}`
    : null;

  const CONF_STEPS = [15, 25, 35, 50, 65, 75];

  return (
    <ScrollView
      style={styles.sectionScroll}
      contentContainerStyle={styles.sectionContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Confidence threshold */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Confidence Threshold:{' '}
          <Text style={{ color: IRColors.alertAmber, fontWeight: FontWeights.bold }}>
            {confPct}%
          </Text>
        </Text>
        <View style={styles.pillRow}>
          {CONF_STEPS.map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.pill, confPct === s && styles.pillActive]}
              onPress={() => setConfPct(s)}
            >
              <Text style={[styles.pillText, confPct === s && styles.pillTextActive]}>{s}%</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Drop zone or image preview */}
      {!pickedUri ? (
        <TouchableOpacity style={styles.dropZone} onPress={pickFile} activeOpacity={0.75}>
          <ImageIcon size={44} color={IRColors.textMuted} />
          <Text style={styles.dropTitle}>Tap to select a thermal image</Text>
          <Text style={styles.dropSub}>JPEG · PNG · BMP — white-hot or regular</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.imageCard}>
          <Image
            source={{ uri: annotatedUri ?? pickedUri }}
            style={styles.previewImg}
            resizeMode="contain"
          />
          {/* Stats bar */}
          {result && (
            <View style={styles.statsRow}>
              <StatPill label="animals" value={String(result.count)} />
              <StatPill label="inference" value={`${result.inference_ms.toFixed(0)}ms`} />
              <StatPill label="resolution" value={`${result.image_width}×${result.image_height}`} />
            </View>
          )}
        </View>
      )}

      {/* Action buttons */}
      {pickedUri && (
        <View style={styles.actionRow}>
          <Button
            label="Clear"
            variant="secondary"
            size="sm"
            onPress={clearImage}
            icon={<Trash2 size={13} color={IRColors.textSecondary} />}
          />
          <Button
            label={detecting ? 'Detecting…' : 'Run Detection'}
            variant="primary"
            size="sm"
            onPress={runDetection}
            disabled={detecting}
            icon={<ScanLine size={13} color={detecting ? IRColors.textMuted : IRColors.textInvert} />}
          />
        </View>
      )}

      {/* Spinner */}
      {detecting && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={IRColors.statusGreen} size="small" />
          <Text style={styles.loadingText}>Running ONNX inference on thermal image…</Text>
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBox}>
          <AlertCircle size={16} color={IRColors.alertRed} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Detection list */}
      {result && result.detections.length > 0 && (
        <>
          <SectionHeader
            title="Detected Animals"
            subtitle={`${result.count} animal${result.count !== 1 ? 's' : ''} detected`}
          />
          {result.detections.map((det, i) => (
            <DetectionRow key={i} det={det} />
          ))}
        </>
      )}

      {result && result.detections.length === 0 && (
        <View style={styles.noneBox}>
          <CheckCircle size={20} color={IRColors.statusGreen} />
          <Text style={styles.noneText}>
            No animals detected above {confPct}% confidence
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — Notifications
// ─────────────────────────────────────────────────────────────────────────────

function NotificationsSection({
  alerts,
  onAcknowledge,
  onResolve,
}: {
  alerts: Alert[];
  onAcknowledge: (id: string) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
}) {
  const active   = alerts.filter(a => a.status === 'active');
  const past     = alerts.filter(a => a.status !== 'active');

  return (
    <ScrollView
      style={styles.sectionScroll}
      contentContainerStyle={styles.sectionContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionBadge}>
        <BellRing size={13} color={active.length > 0 ? IRColors.alertRed : IRColors.textSecondary} />
        <Text style={[styles.sectionBadgeText, active.length > 0 && { color: IRColors.alertRed }]}>
          {active.length > 0
            ? `${active.length} active alert${active.length !== 1 ? 's' : ''} — action required`
            : 'All clear — no active alerts'}
        </Text>
      </View>

      {/* Active alerts */}
      {active.length > 0 && (
        <>
          <SectionHeader title="Active Alerts" subtitle="Tap to acknowledge or resolve" />
          {active.map(a => (
            <NotifCard
              key={a.id}
              alert={a}
              onAcknowledge={() => onAcknowledge(a.id)}
              onResolve={() => onResolve(a.id)}
            />
          ))}
        </>
      )}

      {/* Past alerts */}
      {past.length > 0 && (
        <>
          <SectionHeader
            title="Alert History"
            subtitle={`${past.length} past event${past.length !== 1 ? 's' : ''}`}
            style={{ marginTop: Spacing.md }}
          />
          {past.map(a => (
            <NotifCard key={a.id} alert={a} readonly />
          ))}
        </>
      )}

      {alerts.length === 0 && (
        <EmptyPlaceholder
          icon="🔔"
          title="No alerts yet"
          sub="Detection events from all cameras will appear here in real-time."
        />
      )}
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function DetectionRow({ det }: { det: DetectionBox }) {
  const color   = CLASS_COLORS[det.class_name] ?? IRColors.textSecondary;
  const emoji   = EMOJI[det.class_name] ?? '🔍';
  const confPct = (det.confidence * 100).toFixed(1);

  return (
    <View style={[styles.detRow, { borderLeftColor: color }]}>
      <Text style={styles.detEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.detName, { color }]}>{det.display_name}</Text>
        <Text style={styles.detMeta}>
          conf: {confPct}% · bbox [{det.bbox_abs.x1},{det.bbox_abs.y1}→{det.bbox_abs.x2},{det.bbox_abs.y2}]
        </Text>
      </View>
      {/* Mini confidence bar */}
      <View style={[styles.confBar, { borderColor: color }]}>
        <View
          style={[
            styles.confFill,
            { width: `${Number(confPct)}%` as any, backgroundColor: color },
          ]}
        />
        <Text style={[styles.confBarLabel, { color }]}>{confPct}%</Text>
      </View>
    </View>
  );
}

function NotifCard({
  alert,
  readonly = false,
  onAcknowledge,
  onResolve,
}: {
  alert: Alert;
  readonly?: boolean;
  onAcknowledge?: () => void;
  onResolve?: () => void;
}) {
  const sevColor = SEVERITY_COLOR[alert.severity] ?? IRColors.textSecondary;
  const isActive = alert.status === 'active';

  return (
    <View
      style={[
        styles.notifCard,
        { borderLeftColor: sevColor },
        isActive && styles.notifCardActive,
      ]}
    >
      {/* Header row */}
      <View style={styles.notifHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.notifAnimal, { color: sevColor }]}>
            {alert.animalType}
            {'  '}
            <Text style={styles.notifConf}>
              {(alert.confidenceScore * 100).toFixed(1)}%
            </Text>
          </Text>
          <Text style={styles.notifCam}>{alert.cameraName} · {alert.cropDensity}</Text>
          <Text style={styles.notifTime}>
            {new Date(alert.timestamp).toLocaleString()}
          </Text>
        </View>
        <View style={[styles.statusPill, { borderColor: sevColor }]}>
          <Text style={[styles.statusText, { color: sevColor }]}>
            {alert.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Action buttons (active only) */}
      {!readonly && isActive && (
        <View style={styles.notifActions}>
          <Button
            label="Acknowledge"
            variant="amber"
            size="sm"
            onPress={onAcknowledge!}
            style={{ flex: 1 }}
          />
          <Button
            label="Resolve"
            variant="secondary"
            size="sm"
            onPress={onResolve!}
            style={{ flex: 1 }}
          />
        </View>
      )}

      {/* Resolution note */}
      {alert.resolutionNote && (
        <Text style={styles.notifNote}>Note: {alert.resolutionNote}</Text>
      )}
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyPlaceholder({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: IRColors.bg },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: IRColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: IRColors.surfaceBorder,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    gap: 3,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive:      { borderBottomColor: IRColors.textPrimary },
  tabIconWrap:    { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  tabLabel:       { color: IRColors.textSecondary, fontSize: FontSizes.xs, fontWeight: FontWeights.semibold },
  tabLabelActive: { color: IRColors.textPrimary },
  tabBadge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: IRColors.alertRed,
    borderRadius: 9, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2,
    borderWidth: 1.5, borderColor: IRColors.bg,
  },
  tabBadgeText: { color: '#FFF', fontSize: 9, fontWeight: FontWeights.bold },

  // Section scroll wrapper
  sectionScroll:  { flex: 1 },
  sectionContent: { padding: Spacing.base, paddingBottom: Spacing.xxxl, gap: Spacing.md },

  // Section header badge (coloured info strip)
  sectionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: IRColors.statusGreenDim,
    borderRadius: Radii.md, padding: Spacing.sm,
    borderWidth: 1, borderColor: IRColors.statusGreen,
  },
  sectionBadgeText: {
    color: IRColors.statusGreen, fontSize: FontSizes.xs,
    fontWeight: FontWeights.semibold, flex: 1,
  },

  // Camera section
  feedGrid: { flexDirection: 'column', gap: Spacing.sm },
  feedItem: { flex: 1 },

  // Card
  card: {
    backgroundColor: IRColors.surface, borderRadius: Radii.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: IRColors.surfaceBorder, gap: Spacing.sm,
  },
  cardTitle: { color: IRColors.textSecondary, fontSize: FontSizes.sm },

  // Pills
  pillRow:       { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  pill:          { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radii.full, backgroundColor: IRColors.surfaceElevated, borderWidth: 1, borderColor: IRColors.surfaceBorder },
  pillActive:    { backgroundColor: IRColors.alertAmber, borderColor: IRColors.alertAmber },
  pillText:      { color: IRColors.textSecondary, fontSize: FontSizes.xs, fontWeight: FontWeights.medium },
  pillTextActive:{ color: IRColors.textInvert, fontWeight: FontWeights.bold },

  // Drop zone
  dropZone: {
    backgroundColor: IRColors.surface, borderRadius: Radii.xl,
    borderWidth: 1.5, borderColor: IRColors.surfaceBorder,
    borderStyle: 'dashed' as any,
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xxxl, gap: Spacing.md, minHeight: 200,
  },
  dropTitle: { color: IRColors.textPrimary, fontSize: FontSizes.base, fontWeight: FontWeights.semibold },
  dropSub:   { color: IRColors.textMuted, fontSize: FontSizes.xs, textAlign: 'center' },

  // Image preview card
  imageCard: {
    backgroundColor: IRColors.surface, borderRadius: Radii.xl,
    borderWidth: 1, borderColor: IRColors.surfaceBorder,
    overflow: 'hidden', ...Shadows.card,
  },
  previewImg: { width: '100%', height: 300, backgroundColor: '#000' },

  // Stats bar
  statsRow: {
    flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md,
    borderTopWidth: 1, borderTopColor: IRColors.surfaceBorder,
  },
  statPill: {
    flex: 1, backgroundColor: IRColors.surfaceElevated,
    borderRadius: Radii.md, padding: Spacing.sm, alignItems: 'center', gap: 2,
  },
  statValue: { color: IRColors.textPrimary, fontSize: FontSizes.sm, fontWeight: FontWeights.bold },
  statLabel: { color: IRColors.textMuted, fontSize: FontSizes.xs },

  // Action row
  actionRow: { flexDirection: 'row', gap: Spacing.sm },

  // Feedback rows
  loadingRow: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'center',
    backgroundColor: IRColors.surface, borderRadius: Radii.md, padding: Spacing.md,
  },
  loadingText: { color: IRColors.textSecondary, fontSize: FontSizes.sm },
  errorBox: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start',
    backgroundColor: IRColors.alertRedDim, borderRadius: Radii.md,
    padding: Spacing.md, borderWidth: 1, borderColor: IRColors.alertRed,
  },
  errorText: { color: IRColors.alertRed, fontSize: FontSizes.sm, flex: 1 },
  noneBox: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'center',
    backgroundColor: IRColors.statusGreenDim, borderRadius: Radii.md,
    padding: Spacing.md, borderWidth: 1, borderColor: IRColors.statusGreen,
  },
  noneText: { color: IRColors.statusGreen, fontSize: FontSizes.sm, flex: 1 },

  // Detection row
  detRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: IRColors.surface, borderRadius: Radii.md,
    padding: Spacing.md, borderLeftWidth: 3,
    borderWidth: 1, borderColor: IRColors.surfaceBorder,
  },
  detEmoji: { fontSize: 22 },
  detName:  { fontSize: FontSizes.base, fontWeight: FontWeights.semibold },
  detMeta:  { color: IRColors.textMuted, fontSize: FontSizes.xs, fontFamily: 'monospace', marginTop: 2 },
  confBar: {
    width: 60, height: 24, borderRadius: Radii.full, borderWidth: 1,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: IRColors.surfaceElevated,
  },
  confFill:     { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: Radii.full, opacity: 0.25 },
  confBarLabel: { fontSize: 9, fontWeight: FontWeights.bold },

  // Notification cards
  notifCard: {
    backgroundColor: IRColors.surface, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: IRColors.surfaceBorder,
    borderLeftWidth: 4, padding: Spacing.md, gap: Spacing.sm,
  },
  notifCardActive: { borderColor: IRColors.alertRed, backgroundColor: IRColors.alertRedDim },
  notifHeader:  { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  notifAnimal:  { fontSize: FontSizes.base, fontWeight: FontWeights.bold },
  notifConf:    { color: IRColors.textSecondary, fontSize: FontSizes.sm, fontWeight: FontWeights.regular },
  notifCam:     { color: IRColors.textSecondary, fontSize: FontSizes.sm },
  notifTime:    { color: IRColors.textMuted, fontSize: FontSizes.xs },
  notifActions: { flexDirection: 'row', gap: Spacing.sm },
  notifNote:    { color: IRColors.textMuted, fontSize: FontSizes.xs, fontStyle: 'italic' },
  statusPill: {
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
    borderRadius: Radii.full, borderWidth: 1,
    backgroundColor: IRColors.surfaceElevated,
  },
  statusText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold },

  // Empty state
  emptyBox:  { alignItems: 'center', paddingTop: Spacing.section, gap: Spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyTitle:{ color: IRColors.textPrimary, fontSize: FontSizes.lg, fontWeight: FontWeights.semibold },
  emptySub:  { color: IRColors.textMuted, fontSize: FontSizes.sm, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
