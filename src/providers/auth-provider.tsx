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
  /** Non-null when the just-signed-in account is blocked (deactivated / suspended). */
  statusBlock: 'deleted' | 'suspended' | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  /** Passwordless: email a 6-digit code (creates the account if new). */
  sendCode: (email: string, fullName?: string) => Promise<{ error: string | null }>;
  /** Verify a 6-digit code and start a session. `type` distinguishes sign-in / signup-confirm / recovery. */
  verifyCode: (
    email: string,
    token: string,
    type?: 'email' | 'signup' | 'recovery',
  ) => Promise<{ error: string | null }>;
  /** Email a 6-digit code to reset a forgotten password. */
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  /** Set a new password for the signed-in (or recovery) session. */
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  /** Self-service account deletion: soft-deletes server-side (status→deleted), then signs out. */
  requestAccountDeletion: (reason: string | null, note: string | null) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRoleState] = useState<ActiveRole>('customer');
  // Roles are stored with the user they were fetched for, so a signed-out (or
  // switched) user can never see a previous user's roles — no reset effect needed.
  const [rolesFor, setRolesFor] = useState<{ uid: string; keys: string[] } | null>(null);
  const [statusBlock, setStatusBlock] = useState<'deleted' | 'suspended' | null>(null);

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
    if (!userId) return;
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
        setRolesFor({ uid: userId, keys });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const roles = useMemo(
    () => (userId && rolesFor?.uid === userId ? rolesFor.keys : []),
    [userId, rolesFor],
  );

  // Enforce account status: a deactivated ('deleted') or suspended profile may not
  // use the app. Checked on every session load. Fail-OPEN on a fetch error so a
  // transient network blip can never lock a valid user out — only a *definitive*
  // non-active status boots the session.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('status')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        if (data.status === 'deleted' || data.status === 'suspended') {
          setStatusBlock(data.status);
          supabase.auth.signOut();
        }
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
      statusBlock,
      async signIn(email, password) {
        setStatusBlock(null); // fresh attempt clears any prior blocked-account notice
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
      async verifyCode(email, token, type = 'email') {
        setStatusBlock(null); // fresh attempt clears any prior blocked-account notice
        const { error } = await supabase.auth.verifyOtp({ email, token, type });
        return { error: error?.message ?? null };
      },
      async resetPassword(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        return { error: error?.message ?? null };
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password });
        return { error: error?.message ?? null };
      },
      async requestAccountDeletion(reason, note) {
        // Server-side soft-delete (status→deleted) + durable audit row. We then
        // sign out locally; the status gate keeps the account out everywhere else.
        const { error } = await supabase.rpc('request_account_deletion', {
          p_reason: reason,
          p_note: note,
        });
        if (error) return { error: error.message };
        await supabase.auth.signOut();
        return { error: null };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, loading, activeRole, roles, statusBlock],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
