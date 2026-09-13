/**
 * @file app/(tabs)/cameras.tsx
 * Camera Management — list, add, edit, delete IR cameras.
 */

import React, { useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Pencil, Trash2, Wifi, Network, Zap } from 'lucide-react-native';
import { IRColors, FontSizes, FontWeights, Radii, Spacing, Shadows } from '@/constants/theme';
import { AppHeader } from '@/components/layout/AppHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CameraFormModal } from '@/components/cameras/CameraFormModal';
import { DeleteConfirmDialog } from '@/components/cameras/DeleteConfirmDialog';
import { useCameras } from '@/contexts/CameraContext';
import type { Camera } from '@/types';

export default function CamerasScreen() {
  const { cameras, deleteCamera, testConnection } = useCameras();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [deletingCamera, setDeletingCamera] = useState<Camera | null>(null);
  const [pingStates, setPingStates] = useState<Record<string, 'idle' | 'pinging' | 'ok' | 'fail'>>({});

  const handlePing = async (cam: Camera) => {
    setPingStates(p => ({ ...p, [cam.id]: 'pinging' }));
    const result = await testConnection(cam.id);
    setPingStates(p => ({ ...p, [cam.id]: result.success ? 'ok' : 'fail' }));
    setTimeout(() => setPingStates(p => ({ ...p, [cam.id]: 'idle' })), 3000);
  };

  const handleDelete = async () => {
    if (!deletingCamera) return;
    await deleteCamera(deletingCamera.id);
    setDeletingCamera(null);
  };

  const renderCamera = ({ item: cam }: { item: Camera }) => {
    const pingState = pingStates[cam.id] ?? 'idle';
    return (
      <View style={[styles.cameraRow, Shadows.card]}>
        {/* Status indicator */}
        <View style={[styles.statusBar, { backgroundColor: cam.status === 'online' ? IRColors.statusGreen : IRColors.statusGray }]} />

        <View style={styles.cameraInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.cameraName}>{cam.name}</Text>
            <Badge variant={cam.status} />
          </View>
          <Text style={styles.cameraIp}>{cam.ipAddress}:{cam.port}</Text>
          <Text style={styles.cameraLocation} numberOfLines={1}>{cam.fieldLocation}</Text>
          <View style={styles.tagsRow}>
            <Badge variant={cam.type.toLowerCase() as any} />
            <Badge variant={cam.cropDensity.toLowerCase() as any} label={cam.cropDensity} />
            {cam.status === 'online' && (
              <Text style={styles.latency}>{cam.latencyMs}ms</Text>
            )}
          </View>
          <Text style={styles.streamUrl} numberOfLines={1}>{cam.streamUrl}</Text>
        </View>

        {/* Actions column */}
        <View style={styles.actionCol}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => setEditingCamera(cam)}
          >
            <Pencil size={15} color={IRColors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={() => setDeletingCamera(cam)}
          >
            <Trash2 size={15} color={IRColors.alertRed} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.pingBtn,
              pingState === 'ok' && styles.pingBtnOk,
              pingState === 'fail' && styles.pingBtnFail,
            ]}
            onPress={() => handlePing(cam)}
            disabled={pingState === 'pinging'}
          >
            <Text style={[
              styles.pingText,
              pingState === 'ok' && styles.pingTextOk,
              pingState === 'fail' && styles.pingTextFail,
            ]}>
              {pingState === 'pinging' ? '...' : pingState === 'ok' ? '✓' : pingState === 'fail' ? '✗' : 'PING'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader title="IR Cameras" subtitle="Manage connected thermal units" />

      {/* Add camera FAB */}
      <View style={styles.fabRow}>
        <Text style={styles.countText}>{cameras.length} camera{cameras.length !== 1 ? 's' : ''} registered</Text>
        <Button
          label="Add Camera"
          variant="primary"
          size="sm"
          onPress={() => setShowAddModal(true)}
          icon={<Plus size={15} color={IRColors.textInvert} />}
        />
      </View>

      <FlatList
        data={cameras}
        keyExtractor={c => c.id}
        renderItem={renderCamera}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📷</Text>
            <Text style={styles.emptyText}>No cameras registered</Text>
            <Text style={styles.emptySubtext}>Tap "Add Camera" to connect your first IR unit</Text>
          </View>
        }
      />

      {showAddModal && (
        <CameraFormModal onClose={() => setShowAddModal(false)} />
      )}
      {editingCamera && (
        <CameraFormModal camera={editingCamera} onClose={() => setEditingCamera(null)} />
      )}
      {deletingCamera && (
        <DeleteConfirmDialog
          cameraName={deletingCamera.name}
          onConfirm={handleDelete}
          onCancel={() => setDeletingCamera(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: IRColors.bg },
  fabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: IRColors.surfaceBorder,
  },
  countText: { color: IRColors.textMuted, fontSize: FontSizes.sm },
  list: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  cameraRow: {
    flexDirection: 'row',
    backgroundColor: IRColors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
    overflow: 'hidden',
  },
  statusBar: { width: 4 },
  cameraInfo: { flex: 1, padding: Spacing.md, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.xs },
  cameraName: { color: IRColors.textPrimary, fontSize: FontSizes.base, fontWeight: FontWeights.semibold, flex: 1 },
  cameraIp: { color: IRColors.textSecondary, fontSize: FontSizes.sm, fontFamily: 'monospace' },
  cameraLocation: { color: IRColors.textMuted, fontSize: FontSizes.xs },
  tagsRow: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap', alignItems: 'center' },
  latency: { color: IRColors.statusGreen, fontSize: FontSizes.xs, fontWeight: FontWeights.semibold },
  streamUrl: { color: IRColors.textMuted, fontSize: 10, fontFamily: 'monospace' },
  actionCol: {
    padding: Spacing.sm,
    gap: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: IRColors.surfaceBorder,
  },
  actionBtn: {
    backgroundColor: IRColors.surfaceElevated,
    borderRadius: Radii.md,
    padding: Spacing.xs,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDanger: { backgroundColor: IRColors.alertRedDim },
  pingBtn: {
    backgroundColor: IRColors.surfaceBorder,
    borderRadius: Radii.md,
    paddingHorizontal: 4,
    paddingVertical: 3,
    width: 40,
    alignItems: 'center',
    marginTop: 2,
  },
  pingBtnOk: { backgroundColor: IRColors.statusGreenDim },
  pingBtnFail: { backgroundColor: IRColors.alertRedDim },
  pingText: { color: IRColors.textMuted, fontSize: 9, fontWeight: FontWeights.bold, letterSpacing: 0.5 },
  pingTextOk: { color: IRColors.statusGreen },
  pingTextFail: { color: IRColors.alertRed },
  emptyState: { alignItems: 'center', paddingTop: Spacing.section, gap: Spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: IRColors.textPrimary, fontSize: FontSizes.lg, fontWeight: FontWeights.semibold },
  emptySubtext: { color: IRColors.textMuted, fontSize: FontSizes.sm, textAlign: 'center', paddingHorizontal: Spacing.xl },
});
