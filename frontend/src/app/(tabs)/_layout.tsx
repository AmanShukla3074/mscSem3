/**
 * @file app/(tabs)/_layout.tsx
 * Tab bar layout for the main app.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Tabs } from 'expo-router';
import { LayoutDashboard, Camera, BellRing, Settings } from 'lucide-react-native';
import { IRColors, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { useAlerts } from '@/contexts/AlertContext';

function TabIcon({
  icon,
  focused,
  alertCount,
}: {
  icon: React.ReactNode;
  focused: boolean;
  alertCount?: number;
}) {
  return (
    <View style={tabStyles.iconWrap}>
      {icon}
      {alertCount && alertCount > 0 ? (
        <View style={tabStyles.badge}>
          <Text style={tabStyles.badgeText}>{alertCount > 9 ? '9+' : alertCount}</Text>
        </View>
      ) : null}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -4, right: -8,
    backgroundColor: IRColors.alertRed,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: IRColors.bg,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: FontWeights.bold },
});

export default function TabsLayout() {
  const { activeAlertCount } = useAlerts();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: IRColors.surface,
          borderTopColor: IRColors.surfaceBorder,
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: 8,
          height: 62,
        },
        tabBarActiveTintColor: IRColors.textPrimary,
        tabBarInactiveTintColor: IRColors.tabInactive,
        tabBarLabelStyle: {
          fontSize: FontSizes.xs,
          fontWeight: FontWeights.semibold,
          letterSpacing: 0.3,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              icon={<LayoutDashboard size={22} color={color} />}
              focused={focused}
              alertCount={activeAlertCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cameras"
        options={{
          title: 'Cameras',
          tabBarIcon: ({ color }) => (
            <TabIcon icon={<Camera size={22} color={color} />} focused={false} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              icon={<BellRing size={22} color={color} />}
              focused={focused}
              alertCount={activeAlertCount}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => (
            <TabIcon icon={<Settings size={22} color={color} />} focused={false} />
          ),
        }}
      />
    </Tabs>
  );
}
