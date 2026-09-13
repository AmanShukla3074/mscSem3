/**
 * @file app/+not-found.tsx
 * 404 route handler.
 */
import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { IRColors, FontSizes, FontWeights, Spacing } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found', headerShown: false }} />
      <View style={styles.container}>
        <Text style={styles.icon}>🚫</Text>
        <Text style={styles.title}>Screen Not Found</Text>
        <Link href="/(tabs)" style={styles.link}>
          <Text style={styles.linkText}>Return to Dashboard</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: IRColors.bg, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  icon: { fontSize: 48 },
  title: { color: IRColors.textPrimary, fontSize: FontSizes.lg, fontWeight: FontWeights.bold },
  link: { marginTop: Spacing.sm },
  linkText: { color: IRColors.infoBlu, fontSize: FontSizes.base },
});
