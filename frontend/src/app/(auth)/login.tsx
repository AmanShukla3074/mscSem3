/**
 * @file app/(auth)/login.tsx
 * Login screen with email/password form, role selector, and demo bypass.
 */

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Eye, EyeOff, LogIn, Zap } from 'lucide-react-native';
import { IRColors, FontSizes, FontWeights, Radii, Spacing, Shadows } from '@/constants/theme';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types';

const ROLES: Array<{ id: UserRole; label: string; desc: string }> = [
  { id: 'operator', label: 'Farmer / Operator', desc: 'Drive harvester, monitor live feeds' },
  { id: 'admin', label: 'Admin', desc: 'System config, audit logs, camera CRUD' },
];

export default function LoginScreen() {
  const { login, demoLogin, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<UserRole>('operator');
  const [formError, setFormError] = useState<string | null>(null);

  const validate = (): boolean => {
    if (!email.trim()) { setFormError('Email or phone is required'); return false; }
    if (!password.trim()) { setFormError('Password is required'); return false; }
    setFormError(null);
    return true;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    try {
      await login(email, password);
      router.replace('/(tabs)');
    } catch {
      // error shown via context
    }
  };

  const handleDemo = async (demoRole: UserRole) => {
    await demoLogin(demoRole);
    router.replace('/(tabs)');
  };

  const displayError = formError ?? error;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo / Branding */}
          <View style={styles.brand}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>IR</Text>
            </View>
            <Text style={styles.appName}>AgriIR Guard</Text>
            <Text style={styles.tagline}>
              Edge-Deployed IR Wildlife Detection{'\n'}for Harvesting Safety
            </Text>
            <Text style={styles.conference}>IndoML 2026</Text>
          </View>

          {/* Form Card */}
          <View style={[styles.card, Shadows.card]}>
            <Text style={styles.cardTitle}>Sign In</Text>

            {/* Role selector */}
            <View style={styles.roleRow}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.roleCard, role === r.id && styles.roleCardActive]}
                  onPress={() => setRole(r.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.roleLabel, role === r.id && styles.roleLabelActive]}>
                    {r.label}
                  </Text>
                  <Text style={styles.roleDesc}>{r.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email / Phone</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={v => { setEmail(v); setFormError(null); }}
                placeholder="operator@farm.in"
                placeholderTextColor={IRColors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={v => { setPassword(v); setFormError(null); }}
                  placeholder="••••••••"
                  placeholderTextColor={IRColors.textMuted}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPw(p => !p)}
                >
                  {showPw
                    ? <EyeOff size={18} color={IRColors.textMuted} />
                    : <Eye size={18} color={IRColors.textMuted} />}
                </TouchableOpacity>
              </View>
            </View>

            {/* Error */}
            {displayError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{displayError}</Text>
              </View>
            )}

            {/* Sign in button */}
            <Button
              label="Sign In"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              onPress={handleLogin}
              icon={<LogIn size={18} color={IRColors.textInvert} />}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Demo bypass buttons */}
            <View style={styles.demoRow}>
              <TouchableOpacity
                style={[styles.demoBtn, { flex: 1 }]}
                onPress={() => handleDemo('operator')}
              >
                <Zap size={14} color={IRColors.alertAmber} />
                <Text style={styles.demoBtnText}>Demo Operator</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.demoBtn, { flex: 1 }]}
                onPress={() => handleDemo('admin')}
              >
                <Zap size={14} color={IRColors.alertAmber} />
                <Text style={styles.demoBtnText}>Demo Admin</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.hint}>
              Credentials: operator@farm.in / operator123 · admin@farm.in / admin123
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: IRColors.bg },
  scroll: {
    flexGrow: 1,
    padding: Spacing.base,
    gap: Spacing.xl,
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xl,
  },
  logoMark: {
    width: 64,
    height: 64,
    backgroundColor: IRColors.thermalHot,
    borderRadius: Radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#FFF',
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.heavy,
    letterSpacing: 2,
  },
  appName: {
    color: IRColors.textPrimary,
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.heavy,
    letterSpacing: 0.5,
  },
  tagline: {
    color: IRColors.textSecondary,
    fontSize: FontSizes.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  conference: {
    color: IRColors.alertAmber,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: IRColors.surface,
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    gap: Spacing.base,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
  },
  cardTitle: {
    color: IRColors.textPrimary,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
  },
  roleRow: { flexDirection: 'row', gap: Spacing.sm },
  roleCard: {
    flex: 1,
    backgroundColor: IRColors.surfaceElevated,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    borderWidth: 1.5,
    borderColor: IRColors.surfaceBorder,
    gap: 2,
  },
  roleCardActive: {
    borderColor: IRColors.textPrimary,
    backgroundColor: '#FFFFFF11',
  },
  roleLabel: {
    color: IRColors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  roleLabelActive: { color: IRColors.textPrimary },
  roleDesc: {
    color: IRColors.textMuted,
    fontSize: FontSizes.xs,
    lineHeight: 15,
  },
  fieldGroup: { gap: 6 },
  fieldLabel: {
    color: IRColors.textSecondary,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  input: {
    backgroundColor: IRColors.surfaceInput,
    borderWidth: 1,
    borderColor: IRColors.surfaceBorder,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    color: IRColors.textPrimary,
    fontSize: FontSizes.base,
  },
  passwordWrap: { position: 'relative' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: {
    position: 'absolute',
    right: Spacing.md,
    top: 0, bottom: 0,
    justifyContent: 'center',
  },
  errorBox: {
    backgroundColor: IRColors.alertRedDim,
    borderRadius: Radii.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: IRColors.alertRed,
  },
  errorText: {
    color: IRColors.alertRed,
    fontSize: FontSizes.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: IRColors.surfaceBorder },
  dividerText: { color: IRColors.textMuted, fontSize: FontSizes.xs },
  demoRow: { flexDirection: 'row', gap: Spacing.sm },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: IRColors.alertAmberDim,
    padding: Spacing.sm + 2,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: IRColors.alertAmber,
  },
  demoBtnText: {
    color: IRColors.alertAmber,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  hint: {
    color: IRColors.textMuted,
    fontSize: FontSizes.xs,
    textAlign: 'center',
    lineHeight: 17,
  },
});
