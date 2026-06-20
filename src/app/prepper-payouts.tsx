import { useRouter } from 'expo-router';
import { ArrowDownToLine, ChevronLeft, Lock, Wallet } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  Pressable,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PayoutSetupCard } from '@/components/payout-setup-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useBreakpoint } from '@/lib/layout';
import { usePayoutBalance, usePayoutHistory, useRequestPayout, type PayoutRequest } from '@/lib/queries/payouts';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useStripeConnect } from '@/lib/queries/stripe-connect';
import { useAuth } from '@/providers/auth-provider';

const ORANGE  = Palette.brand;
const CARD    = '#FFFFFF';
const BG      = '#F8F6F3';
const INK     = '#1A1714';
const MUTED   = '#78716C';
const BORDER  = '#EDE9E4';
const MIN_PAYOUT = 50;

const money = (n: number) => `$${(n ?? 0).toFixed(2)}`;
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const STATUS_STYLES: Record<PayoutRequest['status'], { bg: string; text: string; label: string }> = {
  pending:    { bg: '#FEF3C7', text: '#D97706', label: 'pending' },
  processing: { bg: '#EFF6FF', text: '#2563EB', label: 'processing' },
  paid:       { bg: '#DCFCE7', text: '#16A34A', label: 'paid' },
  rejected:   { bg: Palette.danger + '15', text: Palette.danger, label: 'rejected' },
};

function StatusChip({ status }: { status: PayoutRequest['status'] }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: s.text }}>{s.label}</Text>
    </View>
  );
}

function HistoryRow({ item }: { item: PayoutRequest }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD, borderRadius: 14, padding: 14, shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: MUTED }}>{shortDate(item.createdAt)}</Text>
      </View>
      <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>{money(item.amount)}</Text>
      <StatusChip status={item.status} />
    </View>
  );
}

type ModalProps = {
  available: number;
  prepperId: string;
  stripeActive: boolean;
  onClose: () => void;
};

function RequestModal({ available, prepperId, stripeActive, onClose }: ModalProps) {
  const [amount, setAmount] = useState('');
  const requestPayout = useRequestPayout(prepperId);

  const parsedAmount = parseFloat(amount);
  const amountOk = !isNaN(parsedAmount) && parsedAmount >= MIN_PAYOUT && parsedAmount <= available;

  async function handleSubmit() {
    if (!amountOk) return;
    feedback.tap();
    try {
      await requestPayout.mutateAsync({
        amount: parsedAmount,
        bankName: 'stripe_connect',
        accountNumber: 'stripe_connect',
        accountName: 'stripe_connect',
      });
      feedback.success();
      onClose();
    } catch {
      feedback.error();
    }
  }

  const sheetStyle = {
    backgroundColor: CARD,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  } as const;

  const inputStyle = {
    backgroundColor: '#F8F6F3',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    color: INK as const,
    fontFamily: Font.body,
    fontSize: 15,
    padding: 14,
    marginBottom: 24,
  };

  if (!stripeActive) {
    return (
      <Modal transparent animationType="slide" onRequestClose={onClose}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" style={{ flex: 1, backgroundColor: 'rgba(26,23,20,0.5)' }} />
        <MotiView
          from={{ translateY: 40, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ type: 'timing', duration: 260 }}
          style={sheetStyle}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: BORDER, alignSelf: 'center', marginBottom: 24 }} />
          <View style={{ alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#F0EDEA', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={28} color={MUTED} />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5, textAlign: 'center' }}>
              bank not connected
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 21, maxWidth: 280 }}>
              Connect your bank via Stripe to receive payouts directly. It only takes a few minutes.
            </Text>
          </View>
          <PressableScale
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Set up bank account"
            style={{ backgroundColor: ORANGE, borderRadius: Radius.pill, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 16, color: '#fff' }}>set up bank account</Text>
          </PressableScale>
          <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss"
            style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 14, color: MUTED }}>maybe later</Text>
          </PressableScale>
        </MotiView>
      </Modal>
    );
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" style={{ flex: 1, backgroundColor: 'rgba(26,23,20,0.5)' }} />
        <MotiView
          from={{ translateY: 40, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ type: 'timing', duration: 260 }}
          style={sheetStyle}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: BORDER, alignSelf: 'center', marginBottom: 20 }} />
          <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5, marginBottom: 6 }}>request payout</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED, marginBottom: 20 }}>
            available: {money(available)} · min {money(MIN_PAYOUT)}
          </Text>

          <View style={{ backgroundColor: '#F8F6F3', borderRadius: 10, padding: 12, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.success }}>✓</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED, flex: 1 }}>
              Deposited to your Stripe-linked bank · 3–5 business days
            </Text>
          </View>

          <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: MUTED, marginBottom: 5 }}>Amount</Text>
          <TextInput
            style={inputStyle}
            placeholder={`$${MIN_PAYOUT}.00 minimum`}
            placeholderTextColor={MUTED}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            accessibilityLabel="Payout amount"
          />

          {parsedAmount > 0 && amountOk && (
            <View style={{ backgroundColor: '#F8F6F3', borderRadius: 10, padding: 12, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }}>You receive</Text>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: INK }}>{money(parsedAmount)}</Text>
            </View>
          )}

          <PressableScale
            onPress={handleSubmit}
            disabled={!amountOk || requestPayout.isPending}
            accessibilityRole="button"
            accessibilityLabel="Submit payout request"
            style={{
              backgroundColor: amountOk ? ORANGE : '#EDE9E4',
              borderRadius: Radius.pill,
              height: 52,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 16, color: amountOk ? '#fff' : Palette.textMuted }}>
              {requestPayout.isPending ? 'submitting…' : 'submit request'}
            </Text>
          </PressableScale>
        </MotiView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function PrepperPayoutsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: application } = useMyPrepperApplication(user?.id);
  const prepperId = application?.id ?? null;
  const isDesktop = useBreakpoint() === 'desktop';
  const { data: stripeConnect } = useStripeConnect();
  const stripeActive = stripeConnect?.stripe_account_status === 'active';

  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = usePayoutBalance(prepperId);
  const { data: history = [], isLoading: historyLoading, refetch: refetchHistory } = usePayoutHistory(prepperId);

  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const isLoading = balanceLoading || historyLoading;

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchBalance(), refetchHistory()]);
    setRefreshing(false);
  }

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); }
  }

  const available = balance?.available ?? 0;
  const progressPct = Math.min(100, (available / MIN_PAYOUT) * 100);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6, flex: 1 }}>payouts</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
          contentContainerStyle={{ paddingBottom: 48 }}>
          <View style={[{ padding: 20, gap: 16 }, isDesktop ? { maxWidth: 800, alignSelf: 'center', width: '100%' } : null]}>

            {/* Stripe Connect payout setup */}
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
              <PayoutSetupCard />
            </MotiView>

            {/* Balance card */}
            <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 60 }}>
              <View style={{ backgroundColor: CARD, borderRadius: 20, padding: 24, gap: 8, shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Wallet size={16} color={MUTED} />
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }}>Available balance</Text>
                </View>

                {isLoading ? (
                  <Skeleton width={160} height={44} radius={10} />
                ) : (
                  <Text style={{ fontFamily: Font.display, fontSize: 36, color: ORANGE, letterSpacing: -1 }}>{money(available)}</Text>
                )}

                <Text style={{ fontFamily: Font.body, fontSize: 11, color: MUTED }}>after 15% platform fee · 3–5 business days to bank</Text>

                {balance?.pending != null && balance.pending > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED }}>Settling soon:</Text>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#2563EB' }}>{money(balance.pending)}</Text>
                  </View>
                )}

                {/* Progress bar when below minimum */}
                {!isLoading && available < MIN_PAYOUT && (
                  <View style={{ marginTop: 6, gap: 6 }}>
                    <View style={{ height: 5, backgroundColor: BORDER, borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{ height: 5, width: `${progressPct}%`, backgroundColor: ORANGE, borderRadius: 3 }} />
                    </View>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED }}>
                      {money(available)} of {money(MIN_PAYOUT)} minimum · need {money(MIN_PAYOUT - available)} more
                    </Text>
                  </View>
                )}

                <PressableScale
                  onPress={() => { feedback.tap(); setModalOpen(true); }}
                  disabled={available < MIN_PAYOUT || !prepperId}
                  accessibilityRole="button"
                  accessibilityLabel="Request payout"
                  style={{
                    marginTop: 8,
                    backgroundColor: available >= MIN_PAYOUT ? ORANGE : '#EDE9E4',
                    borderRadius: Radius.pill,
                    height: 50,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}>
                  <ArrowDownToLine size={17} color={available >= MIN_PAYOUT ? '#fff' : Palette.textMuted} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: available >= MIN_PAYOUT ? '#fff' : Palette.textMuted }}>
                    Request payout
                  </Text>
                </PressableScale>
              </View>
            </MotiView>

            {/* Payout history header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
              <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>Payout history</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
            </View>

            {/* History list */}
            {isLoading ? (
              <View style={{ gap: 10 }}>
                {[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={56} radius={14} />)}
              </View>
            ) : history.length === 0 ? (
              <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
                style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
                <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
                  <ArrowDownToLine size={22} color={MUTED} />
                </View>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>No payouts yet</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 19 }}>
                  Request your first payout once you've reached {money(MIN_PAYOUT)}
                </Text>
              </MotiView>
            ) : (
              <View style={{ gap: 10 }}>
                {history.map((item, i) => (
                  <MotiView key={item.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 40 }}>
                    <HistoryRow item={item} />
                  </MotiView>
                ))}
              </View>
            )}

          </View>
        </ScrollView>
      </SafeAreaView>

      {modalOpen && prepperId ? (
        <RequestModal
          available={available}
          prepperId={prepperId}
          stripeActive={stripeActive}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </View>
  );
}
