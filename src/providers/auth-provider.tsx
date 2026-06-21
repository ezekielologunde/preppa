import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

const SESSION_START_KEY = 'preppa.sessionStart.v1';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  sendCode: (email: string) => Promise<{ error: string | null }>;
  verifyCode: (email: string, token: string, type?: 'email' | 'signup' | 'recovery') => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function boot() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const raw = await AsyncStorage.getItem(SESSION_START_KEY);
        const start = raw ? parseInt(raw, 10) : null;
        if (!start || Date.now() - start > SESSION_TTL_MS) {
          await supabase.auth.signOut();
          await AsyncStorage.removeItem(SESSION_START_KEY);
          setSession(null);
          setLoading(false);
          return;
        }
      }
      setSession(data.session);
      setLoading(false);
    }
    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'SIGNED_IN') {
        AsyncStorage.getItem(SESSION_START_KEY).then((existing) => {
          if (!existing) AsyncStorage.setItem(SESSION_START_KEY, String(Date.now())).catch(() => {});
        }).catch(() => {});
      }
      if (event === 'SIGNED_OUT') {
        AsyncStorage.removeItem(SESSION_START_KEY).catch(() => {});
      }
      setSession(next);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      async signUp(email, password, fullName) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: fullName ? { full_name: fullName } : undefined },
        });
        const needsConfirmation = !error && !!data.user && !data.session;
        return { error: error?.message ?? null, needsConfirmation };
      },
      async sendCode(email) {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        return { error: error?.message ?? null };
      },
      async verifyCode(email, token, type = 'email') {
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
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
