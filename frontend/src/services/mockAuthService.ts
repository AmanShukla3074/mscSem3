/**
 * @file services/mockAuthService.ts
 * Mock authentication service.
 * Swap the implementation of these functions for real API calls later.
 */

import type { User, UserRole } from '@/types';

/** Hardcoded mock credentials for demo */
const MOCK_USERS: Array<User & { password: string }> = [
  {
    id: 'user-001',
    name: 'Rajesh Kumar',
    email: 'operator@farm.in',
    password: 'operator123',
    role: 'operator',
    operatorId: 'OP-2024-011',
  },
  {
    id: 'user-002',
    name: 'Admin Singh',
    email: 'admin@farm.in',
    password: 'admin123',
    role: 'admin',
  },
];

/** Simulated network delay */
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const mockAuthService = {
  /**
   * Attempt login with email and password.
   * Returns the User if successful, throws on failure.
   */
  login: async (
    emailOrPhone: string,
    password: string,
  ): Promise<User> => {
    await delay(600); // Simulate network round-trip

    const found = MOCK_USERS.find(
      u =>
        u.email.toLowerCase() === emailOrPhone.toLowerCase() &&
        u.password === password,
    );

    if (!found) {
      throw new Error('Invalid credentials. Please check your email and password.');
    }

    const { password: _pw, ...user } = found;
    return user;
  },

  /**
   * Demo bypass — returns a default operator user without credentials.
   */
  demoLogin: async (role: UserRole = 'operator'): Promise<User> => {
    await delay(300);
    return {
      id: `demo-${Date.now()}`,
      name: role === 'admin' ? 'Demo Admin' : 'Demo Operator',
      email: `demo.${role}@ir-harvest.local`,
      role,
      operatorId: role === 'operator' ? 'DEMO-OP-001' : undefined,
    };
  },

  logout: async (): Promise<void> => {
    await delay(100);
  },
};
