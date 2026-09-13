/**
 * @file components/cameras/DeleteConfirmDialog.tsx
 * Confirmation modal before deleting a camera.
 */

import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { IRColors, FontSizes, FontWeights, Radii, Spacing, Shadows } from '@/constants/theme';
import { Button } from '@/components/ui/Button';

interface DeleteConfirmDialogProps {
  cameraName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({ cameraName, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.dialog, Shadows.modal]}>
          <View style={styles.iconWrap}>
            <Trash2 size={28} color={IRColors.alertRed} />
          </View>
          <Text style={styles.title}>Remove Camera?</Text>
          <Text style={styles.body}>
            <Text style={styles.boldName}>"{cameraName}"</Text>
            {' '}will be removed from the system. This action cannot be undone.
          </Text>
          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" size="md" fullWidth onPress={onCancel} />
            <Button label="Remove Camera" variant="danger" size="md" fullWidth onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000CC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  dialog: {
    backgroundColor: IRColors.surfaceElevated,
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
  },
  iconWrap: {
    backgroundColor: IRColors.alertRedDim,
    borderRadius: Radii.full,
    padding: Spacing.md,
  },
  title: {
    color: IRColors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    textAlign: 'center',
  },
  body: {
    color: IRColors.textSecondary,
    fontSize: FontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  boldName: {
    color: IRColors.textPrimary,
    fontWeight: FontWeights.semibold,
  },
  actions: {
    width: '100%',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
