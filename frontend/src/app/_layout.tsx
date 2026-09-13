/**
 * @file app/_layout.tsx
 * Root layout — wraps all providers, mounts global LiveAlertModal.
 * Soft-bypass: in dev mode navigates directly to (tabs) without requiring login.
 * Login screen still exists at /(auth)/login for testing the full auth flow.
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CameraProvider } from '@/contexts/CameraContext';
import { AlertProvider } from '@/contexts/AlertContext';
import { LiveAlertModal } from '@/components/alerts/LiveAlertModal';
import { useAlerts } from '@/contexts/AlertContext';
import { IRColors } from '@/constants/theme';

/** Global live alert overlay — needs AlertContext */
function GlobalAlertOverlay() {
  const { liveAlert } = useAlerts();
  if (!liveAlert) return null;
  return <LiveAlertModal alert={liveAlert} />;
}

/**
 * Auto-logs in as demo operator on first mount (soft bypass).
 * Remove this component or set DEV_BYPASS = false to enforce auth.
 */
const DEV_BYPASS = true;

function DevBypass({ children }: { children: React.ReactNode }) {
  const { demoLogin, isAuthenticated } = useAuth();

  useEffect(() => {
    if (DEV_BYPASS && !isAuthenticated) {
      demoLogin('operator').then(() => {
        router.replace('/(tabs)');
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: IRColors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={IRColors.bg} />
        <AuthProvider>
          <DevBypass>
            <CameraProvider>
              <AlertProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: IRColors.bg },
                    animation: 'fade',
                  }}
                >
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="+not-found" />
                </Stack>
                <GlobalAlertOverlay />
              </AlertProvider>
            </CameraProvider>
          </DevBypass>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
