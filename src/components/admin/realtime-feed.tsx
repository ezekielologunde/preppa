import { AlertTriangle, Bell, ShoppingBag, Store, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { Admin } from './ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FeedEvent =
  | { type: 'order'; id: string; label: string }
  | { type: 'dispute'; id: string; label: string }
  | { type: 'application'; id: string; label: string };

const EVENT_ICON = {
  order: ShoppingBag,
  dispute: AlertTriangle,
  application: Store,
} as const;

const EVENT_COLOR = {
  order: Admin.brand,
  dispute: Admin.danger,
  application: Admin.warn,
} as const;

// ---------------------------------------------------------------------------
// Hook — subscribes to three postgres_changes channels
// ---------------------------------------------------------------------------

/**
 * Subscribes to real-time changes on orders, reports, and prepper_applications.
 * Returns the latest event (one at a time). Invalidates the relevant query
 * keys so stats + lists auto-refresh without a manual pull-to-refresh.
 */
export function useAdminRealtimeFeed(onEvent: (evt: FeedEvent) => void) {
  const qc = useQueryClient();
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    supabase.getChannels().filter((c) => c.topic === 'admin-feed').forEach((c) => supabase.removeChannel(c));
    const channel = supabase
      .channel('admin-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const row = payload.new as { id?: string; customer_id?: string };
          qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
          qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
          cb.current({ type: 'order', id: row.id ?? '', label: 'New order placed' });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports' },
        (payload) => {
          const row = payload.new as { id?: string };
          qc.invalidateQueries({ queryKey: ['admin', 'disputes'] });
          qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
          cb.current({ type: 'dispute', id: row.id ?? '', label: 'New dispute filed' });
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'prepper_profiles' },
        (payload) => {
          const row = payload.new as { id?: string; status?: string };
          if (row.status !== 'pending') return;
          qc.invalidateQueries({ queryKey: ['admin', 'preppers'] });
          qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
          cb.current({ type: 'application', id: row.id ?? '', label: 'New prepper application' });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}

// ---------------------------------------------------------------------------
// Banner — shown for ~5 s then auto-dismisses (or manual ×)
// ---------------------------------------------------------------------------

const AUTO_DISMISS_MS = 5000;

export function AdminFeedBanner({ event, onDismiss, onNavigate }: { event: FeedEvent | null; onDismiss: () => void; onNavigate?: (event: FeedEvent) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!event) return;
    feedback.tap();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [event, onDismiss]);

  if (!event) return null;

  const Icon = EVENT_ICON[event.type];
  const color = EVENT_COLOR[event.type];

  return (
    <MotiView
      from={{ opacity: 0, translateY: -12 }}
      animate={{ opacity: 1, translateY: 0 }}
      exit={{ opacity: 0, translateY: -12 }}
      transition={{ type: 'timing', duration: 220 }}
      style={{
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: Radius.sm,
        borderWidth: 1,
        borderColor: color + '44',
        backgroundColor: color + '14',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 10,
      }}>
      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: color + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Admin.text }}>{event.label}</Text>
        {event.id ? (
          <Text style={{ fontFamily: Font.body, fontSize: 11, color: Admin.textDim, marginTop: 1 }}>
            #{event.id.slice(-8)}
          </Text>
        ) : null}
      </View>
      {onNavigate ? (
        <PressableScale
          onPress={() => { onNavigate(event); onDismiss(); }}
          accessibilityRole="button"
          accessibilityLabel="Navigate to event"
          style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, backgroundColor: color + '22' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: color }}>Go →</Text>
        </PressableScale>
      ) : null}
      <PressableScale onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss notification">
        <X size={15} color={Admin.textDim} />
      </PressableScale>
    </MotiView>
  );
}

// ---------------------------------------------------------------------------
// Indicator dot — shown in the header when realtime is active
// ---------------------------------------------------------------------------

export function LiveDot() {
  const [dim, setDim] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setDim((d) => !d), 1200);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <MotiView
        animate={{ opacity: dim ? 0.35 : 1 }}
        transition={{ type: 'timing', duration: 600 }}
        style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: Admin.success }}
      />
      <Bell size={12} color={Admin.textDim} />
    </View>
  );
}
