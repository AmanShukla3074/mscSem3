/**
 * @file app/(tabs)/alerts.tsx
 * Alert History & Audit Log with filters.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Filter, X } from 'lucide-react-native';
import { IRColors, FontSizes, FontWeights, Radii, Spacing } from '@/constants/theme';
import { AppHeader } from '@/components/layout/AppHeader';
import { AlertCard } from '@/components/alerts/AlertCard';
import { AlertDetailModal } from '@/components/alerts/AlertDetailModal';
import { useAlerts } from '@/contexts/AlertContext';
import type { Alert, AlertFilters, AnimalType, CropDensity, AlertStatus } from '@/types';

const ANIMAL_OPTIONS: Array<AnimalType | 'All'> = ['All', 'Nilgai', 'Fawn', 'Wild Boar', 'Rabbit', 'Fox', 'Unknown'];
const DENSITY_OPTIONS: Array<CropDensity | 'All'> = ['All', 'Light', 'Medium', 'Heavy'];
const STATUS_OPTIONS: Array<AlertStatus | 'All'> = ['All', 'active', 'acknowledged', 'resolved'];

export default function AlertsScreen() {
  const { alerts, loadAlerts, isLoading } = useAlerts();
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState<AlertFilters>({
    animalType: 'All',
    cropDensity: 'All',
    status: 'All',
  });

  // Reload when filters change
  useEffect(() => {
    loadAlerts(filters);
  }, [filters, loadAlerts]);

  const setFilter = useCallback(<K extends keyof AlertFilters>(key: K, val: AlertFilters[K]) => {
    setFilters(p => ({ ...p, [key]: val }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ animalType: 'All', cropDensity: 'All', status: 'All' });
  }, []);

  const hasActiveFilters =
    filters.animalType !== 'All' || filters.cropDensity !== 'All' || filters.status !== 'All';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader title="Alert History" subtitle="Detection audit log" />

      {/* Filter bar */}
      <View style={styles.filterBar}>
        <TouchableOpacity
          style={[styles.filterToggle, showFilters && styles.filterToggleActive]}
          onPress={() => setShowFilters(p => !p)}
        >
          <Filter size={14} color={showFilters ? IRColors.textPrimary : IRColors.textSecondary} />
          <Text style={[styles.filterToggleText, showFilters && { color: IRColors.textPrimary }]}>
            Filters {hasActiveFilters ? '●' : ''}
          </Text>
        </TouchableOpacity>
        <Text style={styles.countLabel}>{alerts.length} event{alerts.length !== 1 ? 's' : ''}</Text>
        {hasActiveFilters && (
          <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
            <X size={12} color={IRColors.alertAmber} />
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Expanded filter panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          <FilterRow
            label="Animal"
            options={ANIMAL_OPTIONS}
            selected={filters.animalType as string}
            onSelect={v => setFilter('animalType', v as any)}
          />
          <FilterRow
            label="Crop"
            options={DENSITY_OPTIONS}
            selected={filters.cropDensity as string}
            onSelect={v => setFilter('cropDensity', v as any)}
          />
          <FilterRow
            label="Status"
            options={STATUS_OPTIONS}
            selected={filters.status as string}
            onSelect={v => setFilter('status', v as any)}
          />
        </View>
      )}

      <FlatList
        data={alerts}
        keyExtractor={a => a.id}
        renderItem={({ item }) => (
          <AlertCard alert={item} onPress={a => setSelectedAlert(a)} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>No alerts match your filters</Text>
          </View>
        }
      />

      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </SafeAreaView>
  );
}

function FilterRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={filterStyles.row}>
      <Text style={filterStyles.label}>{label}</Text>
      <View style={filterStyles.pills}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[filterStyles.pill, selected === opt && filterStyles.pillActive]}
            onPress={() => onSelect(opt)}
          >
            <Text style={[filterStyles.pillText, selected === opt && filterStyles.pillTextActive]}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const filterStyles = StyleSheet.create({
  row: { gap: 4 },
  label: { color: IRColors.textMuted, fontSize: FontSizes.xs, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: FontWeights.semibold },
  pills: { flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radii.full,
    backgroundColor: IRColors.surfaceElevated,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
  },
  pillActive: { backgroundColor: IRColors.textPrimary, borderColor: IRColors.textPrimary },
  pillText: { color: IRColors.textSecondary, fontSize: FontSizes.xs, fontWeight: FontWeights.medium },
  pillTextActive: { color: IRColors.textInvert, fontWeight: FontWeights.bold },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: IRColors.bg },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: IRColors.surfaceBorder,
    gap: Spacing.sm,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radii.md,
    backgroundColor: IRColors.surfaceElevated,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
  },
  filterToggleActive: { borderColor: IRColors.textPrimary },
  filterToggleText: { color: IRColors.textSecondary, fontSize: FontSizes.xs, fontWeight: FontWeights.semibold },
  countLabel: { flex: 1, color: IRColors.textMuted, fontSize: FontSizes.sm },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  clearText: { color: IRColors.alertAmber, fontSize: FontSizes.xs, fontWeight: FontWeights.semibold },
  filterPanel: {
    backgroundColor: IRColors.surface,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: IRColors.surfaceBorder,
  },
  list: { padding: Spacing.base, paddingBottom: Spacing.xxxl },
  empty: { alignItems: 'center', paddingTop: Spacing.section, gap: Spacing.md },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: IRColors.textMuted, fontSize: FontSizes.base },
});
