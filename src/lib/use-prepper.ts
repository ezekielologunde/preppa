import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export type Kitchen = {
  id: string;
  display_name: string;
  bio: string | null;
  health_score: number | null;
  vacation_mode: boolean;
  capacity: number | null;
  is_open: boolean;
};

export type PrepperProfile = {
  stripe_account_id: string | null;
  stripe_account_status: string | null;
};

export type UsePrepperResult = {
  kitchen: Kitchen | null;
  profile: PrepperProfile | null;
  loading: boolean;
  isPrepper: boolean;
  refresh: () => void;
};

function resolveOne<T>(val: T | T[] | null): T | null {
  if (!val) return null;
  return Array.isArray(val) ? (val[0] ?? null) : val;
}

export function usePrepper(redirectIfNone = false): UsePrepperResult {
  const { user } = useAuth();
  const router = useRouter();
  const [kitchen, setKitchen] = useState<Kitchen | null>(null);
  const [profile, setProfile] = useState<PrepperProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }

    const [kitchenRes, profileRes] = await Promise.all([
      supabase
        .from('kitchens')
        .select('id, display_name, bio, health_score, vacation_mode, capacity, is_open')
        .eq('owner_id', user.id)
        .single(),
      supabase
        .from('prepper_profiles')
        .select('stripe_account_id, stripe_account_status')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    setKitchen((kitchenRes.data as Kitchen | null) ?? null);
    setProfile(resolveOne(profileRes.data) as PrepperProfile | null);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading && redirectIfNone && !kitchen) {
      router.replace('/(tabs)' as never);
    }
  }, [loading, kitchen, redirectIfNone, router]);

  return { kitchen, profile, loading, isPrepper: !!kitchen, refresh: load };
}
