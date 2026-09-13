/**
 * @file app/(auth)/_layout.tsx
 * Auth group layout.
 */
import { Stack } from 'expo-router';
import { IRColors } from '@/constants/theme';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: IRColors.bg } }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
