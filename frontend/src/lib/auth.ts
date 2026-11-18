import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'ADMIN' | 'ORG_ADMIN' | 'TEACHER' | 'STUDENT' | 'PROCTOR';

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  role: Role;
  fullName: string | null;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  organizationId: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

interface AuthState {
  accessToken: string | null;
  user: SessionUser | null;
  /** False until the persisted session has been read back, so guards wait for it. */
  ready: boolean;
  setSession: (accessToken: string, user: SessionUser) => void;
  patchUser: (partial: Partial<SessionUser>) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      ready: false,
      setSession: (accessToken, user) => set({ accessToken, user }),
      patchUser: (partial) => set((state) => (state.user ? { user: { ...state.user, ...partial } } : {})),
      clear: () => set({ accessToken: null, user: null }),
    }),
    {
      name: 'mars-session',
      partialize: ({ accessToken, user }) => ({ accessToken, user }),
      // Runs on success and on corrupt storage alike, so the app never waits forever.
      // localStorage hydration is synchronous; defer until useAuth is assigned.
      onRehydrateStorage: () => () => queueMicrotask(() => useAuth.setState({ ready: true })),
    },
  ),
);

export const isStaffRole = (role: Role | undefined) => role === 'ADMIN' || role === 'ORG_ADMIN' || role === 'TEACHER';
export const isAdminRole = (role: Role | undefined) => role === 'ADMIN' || role === 'ORG_ADMIN';

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  ORG_ADMIN: 'Institute admin',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PROCTOR: 'Proctor',
};

export const ROLE_HOME: Record<Role, string> = {
  ADMIN: '/admin',
  ORG_ADMIN: '/admin',
  TEACHER: '/teach',
  STUDENT: '/home',
  PROCTOR: '/proctoring',
};
