/**
 * @file contexts/AuthContext.tsx
 * Authentication state and methods.
 * Provides: user, role, isAuthenticated, login(), demoLogin(), logout()
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react';
import { mockAuthService } from '@/services/mockAuthService';
import type { User, UserRole } from '@/types';

// ─────────────────────────────────────────────
// Context Shape
// ─────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (emailOrPhone: string, password: string) => Promise<void>;
  demoLogin: (role?: UserRole) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (emailOrPhone: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const u = await mockAuthService.login(emailOrPhone, password);
      setUser(u);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const demoLogin = useCallback(async (role: UserRole = 'operator') => {
    setIsLoading(true);
    setError(null);
    try {
      const u = await mockAuthService.demoLogin(role);
      setUser(u);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await mockAuthService.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        error,
        login,
        demoLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
