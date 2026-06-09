import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

/** Which app the user is currently in. Customer and Prepper are two distinct navigators. */
export type ActiveRole = 'customer' | 'prepper';
const ROLE_KEY = 'preppa.activeRole.v1';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  activeRole: ActiveRole;
  setActiveRole: (role: ActiveRole) => void;
  /** Granted roles from user_roles (customer/prepper/admin/…). */
  roles: string[];
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  /** Passwordless: email a 6-digit code (creates the account if new). */
  sendCode: (email: string, fullName?: string) => Promise<{ error: string | null }>;
  /** Verify the 6-digit code and start a session. */
  verifyCode: (email: string, token: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRoleState] = useState<ActiveRole>('customer');
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    AsyncStorage.getItem(ROLE_KEY)
      .then((v) => v === 'prepper' && setActiveRoleState('prepper'))
      .catch(() => {});
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load granted roles whenever the signed-in user changes (drives admin access).
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!userId) {
      setRoles([]);
      return;
    }
    let cancelled = false;
    supabase
      .from('user_roles')
      .select('roles(key)')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []) as unknown as { roles: { key: string } | { key: string }[] | null }[];
        const keys = rows
          .flatMap((r) => (Array.isArray(r.roles) ? r.roles : r.roles ? [r.roles] : []))
          .map((role) => role.key)
          .filter((k): k is string => !!k);
        setRoles(keys);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function setActiveRole(role: ActiveRole) {
    setActiveRoleState(role);
    AsyncStorage.setItem(ROLE_KEY, role).catch(() => {});
  }

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      activeRole,
      setActiveRole,
      roles,
      isAdmin: roles.includes('admin'),
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      async signUp(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        // If email confirmation is on, there's a user but no active session yet.
        const needsConfirmation = !error && !!data.user && !data.session;
        return { error: error?.message ?? null, needsConfirmation };
      },
      async sendCode(email, fullName) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true, data: fullName ? { full_name: fullName } : undefined },
        });
        return { error: error?.message ?? null };
      },
      async verifyCode(email, token) {
        const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
        return { error: error?.message ?? null };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, loading, activeRole, roles],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
