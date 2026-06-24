// install: npx expo install react-native-qrcode-svg react-native-svg
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, ShieldCheck } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow, Space, TouchTarget, Type } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { useEscrowTimer } from '@/hooks/use-escrow-timer';
import type { EscrowStatus } from '@/types/database.types';

// ── Types ────────────────────────────────────────────────────────────────────

type VerifyOrder = {
  id: string;
  is_verified: boolean;
  verified_at: string | null;
  escrow_status: EscrowStatus;
  auto_release_at: string | null;
  kitchen: { display_name: string } | { display_name: string }[] | null;
};

// ── Countdown card ────────────────────────────────────────────────────────────

function CountdownCard({ autoReleaseAt }: { autoReleaseAt: string | null }) {
  const { timeLeft, isExpired, isUrgent, progress } = useEscrowTimer(autoReleaseAt);
  const barColor = isUrgent ? Palette.danger : Palette.brand;
  const bg       = isUrgent ? Palette.dangerTint : Palette.brandTint;

  return (
    <View style={[cdStyles.card, { backgroundColor: bg }]}>
      <View style={cdStyles.header}>
        <Clock size={18} color={isUrgent ? Palette.danger : Palette.brand} strokeWidth={2} />
        <Text style={[cdStyles.title, isUrgent && { color: Palette.dangerDeep }]}>
          {isExpired ? 'dispute window closed' : 'dispute window open'}
        </Text>
      </View>
      <Text style={[cdStyles.countdown, isUrgent && { color: Palette.danger }]}>
        {timeLeft}
      </Text>
      <View style={cdStyles.barTrack}>
        <View style={[cdStyles.barFill, { width: `${progress * 100}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={cdStyles.sub}>
        {isExpired
          ? 'Funds were automatically released to your Prepper.'
          : 'Funds will be released to your Prepper when the timer expires. Raise a dispute before then if something went wrong.'}
      </Text>
    </View>
  );
}

const cdStyles = StyleSheet.create({
  card: {
    borderRadius: Radius.card, padding: Space.xl, marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Space.md, marginBottom: 12 },
  title: {
    fontFamily: Font.semibold, fontSize: Type.label,
    color: Palette.brandPressed, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  countdown: {
    fontFamily: Font.display, fontSize: 40, color: Palette.ink,
    letterSpacing: -1, marginBottom: Space.md,
  },
  barTrack: {
    height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.1)', marginBottom: 12,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  sub: {
    fontFamily: Font.body, fontSize: Type.label,
    color: Palette.inkSoft, lineHeight: 20,
  },
});

// ── Screen ───────────────────────────────────────────────────────────────────

export default function CustomerVerifyScreen() {
  const { id }    = useLocalSearchParams<{ id: string }>();
  const router    = useRouter();
  const { user }  = useAuth();

  const [order, setOrder]       = useState<VerifyOrder | null>(null);
  const [loading, setLoading]   = useState(true);
  const [disputing, setDisputing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fade = useCallback((to: number) => {
    Animated.timing(fadeAnim, { toValue: to, duration: 300, useNativeDriver: true }).start();
  }, [fadeAnim]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !user) { setLoading(false); return; }
    supabase
      .from('orders')
      .select('id, is_verified, verified_at, escrow_status, auto_release_at, kitchen:kitchens(display_name)')
      .eq('id', id)
      .eq('customer_id', user.id)
      .single()
      .then(({ data }) => {
        setOrder(data as VerifyOrder | null);
        setLoading(false);
        fade(1);
      });
  }, [id, user, fade]);

  // ── Realtime: prepper verifies → QR card swaps to countdown ───────────────
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`order-verify:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        payload => {
          setOrder(prev => prev ? { ...prev, ...(payload.new as Partial<VerifyOrder>) } : prev);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // ── Dispute ────────────────────────────────────────────────────────────────
  function confirmDispute() {
    Alert.alert(
      'Report an issue',
      'This will open a dispute and pause the automatic fund release. A member of our team will review your case. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open dispute',
          style: 'destructive',
          onPress: async () => {
            setDisputing(true);
            const { error } = await supabase.rpc('dispute_order', { p_order_id: id });
            setDisputing(false);
            if (error) {
              Alert.alert('Could not open dispute', error.message);
            } else {
              setOrder(prev => prev ? { ...prev, escrow_status: 'disputed' } : prev);
            }
          },
        },
      ],
    );
  }

  // ── Kitchen name ───────────────────────────────────────────────────────────
  const kitchenName = (() => {
    if (!order?.kitchen) return '';
    if (Array.isArray(order.kitchen)) return order.kitchen[0]?.display_name ?? '';
    return order.kitchen.display_name;
  })();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7} hitSlop={8}>
          <ArrowLeft size={20} color={Palette.ink} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>verify handoff</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center} />
      ) : !order ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>order not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.errorBtn} activeOpacity={0.85}>
            <Text style={styles.errorBtnText}>go back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.View style={[{ flex: 1 }, { opacity: fadeAnim }]}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* ── Terminal states ────────────────────────────────────── */}
            {order.escrow_status === 'released' && (
              <View style={styles.terminalCard}>
                <CheckCircle size={32} color={Palette.success} strokeWidth={1.6} />
                <Text style={styles.terminalTitle}>funds released</Text>
                <Text style={styles.terminalSub}>Payment has been released to your Prepper. Enjoy your meal!</Text>
              </View>
            )}

            {order.escrow_status === 'disputed' && (
              <View style={[styles.terminalCard, { backgroundColor: Palette.amberTint }]}>
                <AlertTriangle size={32} color={Palette.amberDeep} strokeWidth={1.6} />
                <Text style={[styles.terminalTitle, { color: Palette.amberDeep }]}>dispute open</Text>
                <Text style={[styles.terminalSub, { color: Palette.inkSoft }]}>
                  Our team is reviewing your case. We'll be in touch via email within 24 hours.
                </Text>
              </View>
            )}

            {order.escrow_status === 'refunded' && (
              <View style={styles.terminalCard}>
                <ShieldCheck size={32} color={Palette.brand} strokeWidth={1.6} />
                <Text style={styles.terminalTitle}>refunded</Text>
                <Text style={styles.terminalSub}>Your payment has been refunded. It may take 3–5 days to appear.</Text>
              </View>
            )}

            {/* ── Pre-verification: QR handoff card ──────────────────── */}
            {!order.is_verified && order.escrow_status !== 'released' && (
              <>
                <View style={styles.qrCard}>
                  <Text style={styles.qrTitle}>show this to your Prepper</Text>
                  <Text style={styles.qrSub}>
                    They'll scan this QR code to confirm delivery. Your 4-digit PIN was sent to you when your order was confirmed.
                  </Text>
                  <View style={styles.qrWrap}>
                    <QRCode
                      value={order.id}
                      size={200}
                      color={Palette.ink}
                      backgroundColor={Palette.surface}
                    />
                  </View>
                  <Text style={styles.orderIdText} numberOfLines={1} selectable>
                    {order.id}
                  </Text>
                </View>

                <View style={styles.pinHintCard}>
                  <View style={styles.pinHintIcon}>
                    <ShieldCheck size={18} color={Palette.brand} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pinHintTitle}>Prefer to share your PIN?</Text>
                    <Text style={styles.pinHintSub}>
                      Your Prepper can also enter the 4-digit PIN sent to your phone. Either method works.
                    </Text>
                  </View>
                </View>

                {kitchenName ? (
                  <Text style={styles.waitingText}>
                    waiting for {kitchenName} to confirm handoff…
                  </Text>
                ) : null}
              </>
            )}

            {/* ── Post-verification: countdown + dispute ─────────────── */}
            {order.is_verified && order.escrow_status === 'held' && (
              <>
                <View style={styles.verifiedBanner}>
                  <CheckCircle size={16} color={Palette.success} strokeWidth={2.5} />
                  <Text style={styles.verifiedText}>handoff confirmed</Text>
                </View>

                <CountdownCard autoReleaseAt={order.auto_release_at} />

                <TouchableOpacity
                  style={[styles.disputeBtn, disputing && styles.disputeBtnDisabled]}
                  onPress={confirmDispute}
                  activeOpacity={0.85}
                  disabled={disputing}
                  accessibilityRole="button"
                  accessibilityLabel="Report an issue with this order"
                >
                  <AlertTriangle size={16} color={Palette.danger} strokeWidth={2} />
                  <Text style={styles.disputeBtnText}>
                    {disputing ? 'opening dispute…' : 'something went wrong? report an issue'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.canvas },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Space.xl, paddingTop: 8, paddingBottom: 12,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 13,
    backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border,
    alignItems: 'center', justifyContent: 'center', ...Shadow.card,
  },
  headerTitle: {
    fontFamily: Font.display, fontSize: Type.body, color: Palette.ink, letterSpacing: -0.3,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xl },
  errorText: { fontFamily: Font.display, fontSize: Type.title, color: Palette.ink, marginBottom: 20 },
  errorBtn: {
    backgroundColor: Palette.brand, borderRadius: Radius.pill,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  errorBtnText: { fontFamily: Font.display, fontSize: Type.label, color: Palette.surface },

  scroll: { paddingHorizontal: Space.xl, paddingTop: 8 },

  // QR card
  qrCard: {
    backgroundColor: Palette.surface, borderRadius: Radius.card,
    padding: Space.xl, marginBottom: 12, alignItems: 'center', ...Shadow.card,
  },
  qrTitle: {
    fontFamily: Font.heading, fontSize: Type.title, color: Palette.ink, marginBottom: Space.sm, textAlign: 'center',
  },
  qrSub: {
    fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary,
    textAlign: 'center', lineHeight: 20, marginBottom: Space.xl,
  },
  qrWrap: {
    padding: 16, backgroundColor: Palette.surface,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Palette.border, marginBottom: 12,
  },
  orderIdText: {
    fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted, letterSpacing: 0.3,
  },

  // PIN hint
  pinHintCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Space.md,
    backgroundColor: Palette.brandTint, borderRadius: Radius.md,
    padding: Space.lg, marginBottom: 16,
  },
  pinHintIcon: {
    width: 36, height: 36, borderRadius: 11, backgroundColor: Palette.surface,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  pinHintTitle: {
    fontFamily: Font.semibold, fontSize: Type.label, color: Palette.ink, marginBottom: 2,
  },
  pinHintSub: {
    fontFamily: Font.body, fontSize: Type.micro, color: Palette.inkSoft, lineHeight: 18,
  },

  waitingText: {
    fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted,
    textAlign: 'center', marginBottom: 16,
  },

  // Post-verification
  verifiedBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.sm,
    backgroundColor: Palette.successTint, borderRadius: Radius.md,
    paddingVertical: Space.md, marginBottom: 12,
  },
  verifiedText: {
    fontFamily: Font.semibold, fontSize: Type.label, color: Palette.successDark,
  },

  // Dispute button
  disputeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Space.sm,
    minHeight: TouchTarget, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Palette.dangerBorder,
    backgroundColor: Palette.dangerTint, paddingHorizontal: Space.xl,
    marginBottom: 8,
  },
  disputeBtnDisabled: { opacity: 0.5 },
  disputeBtnText: {
    fontFamily: Font.semibold, fontSize: Type.label, color: Palette.danger,
  },

  // Terminal states
  terminalCard: {
    backgroundColor: Palette.surface, borderRadius: Radius.card,
    padding: Space.xl, marginBottom: 12, alignItems: 'center', gap: Space.md, ...Shadow.card,
  },
  terminalTitle: {
    fontFamily: Font.display, fontSize: Type.title, color: Palette.ink,
  },
  terminalSub: {
    fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },
});
