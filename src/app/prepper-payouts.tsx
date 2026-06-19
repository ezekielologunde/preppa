import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { ArrowDownToLine, ChevronLeft, Wallet } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useBreakpoint } from '@/lib/layout';
import { usePayoutBalance, usePayoutHistory, useRequestPayout, type PayoutRequest } from '@/lib/queries/payouts';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const BG = Palette.prepperBg;
const CARD = Palette.prepperCard;
const MUTED = Palette.textMuted;
const MIN_PAYOUT = 50;
const BANK_KEY = (uid: string) => `preppa.bank.v1.${uid}`;

const money = (n: number) => `$${(n ?? 0).toFixed(2)}`;
const shortDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const STATUS_STYLES: Record<PayoutRequest['status'], { bg: string; text: string; label: string }> = {
  pending:    { bg: '#92400e22', text: '#fbbf24', label: 'pending' },
  processing: { bg: '#1e3a5f',  text: '#60a5fa', label: 'processing' },
  paid:       { bg: '#14532d22', text: '#4ade80', label: 'paid' },
  rejected:   { bg: '#7f1d1d22', text: '#f87171', label: 'rejected' },
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: CARD, borderRadius: 14, padding: 14 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: MUTED }}>{shortDate(item.createdAt)}</Text>
      </View>
      <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>{money(item.amount)}</Text>
      <StatusChip status={item.status} />
    </View>
  );
}

type SavedBank = { bankName: string; accountName: string; accountNumber: string };

type ModalFormProps = {
  available: number;
  prepperId: string;
  uid: string;
  onClose: () => void;
};

function RequestModal({ available, prepperId, uid, onClose }: ModalFormProps) {
  const [amount, setAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [savedBank, setSavedBank] = useState<SavedBank | null>(null);
  const requestPayout = useRequestPayout(prepperId);

  useEffect(() => {
    AsyncStorage.getItem(BANK_KEY(uid)).then((saved) => {
      if (saved) {
        const parsed: SavedBank = JSON.parse(saved);
        setSavedBank(parsed);
        setBankName(parsed.bankName);
        setAccountName(parsed.accountName);
        setAccountNumber(parsed.accountNumber);
      }
    }).catch(() => {});
  }, [uid]);

  function clearSavedBank() {
    setSavedBank(null);
    setBankName('');
    setAccountName('');
    setAccountNumber('');
    AsyncStorage.removeItem(BANK_KEY(uid)).catch(() => {});
  }

  const parsedAmount = parseFloat(amount);
  const valid =
    !isNaN(parsedAmount) &&
    parsedAmount >= MIN_PAYOUT &&
    parsedAmount <= available &&
    bankName.trim().length > 0 &&
    accountNumber.trim().length > 0 &&
    accountName.trim().length > 0;

  async function handleSubmit() {
    if (!valid) return;
    feedback.tap();
    try {
      await requestPayout.mutateAsync({ amount: parsedAmount, bankName: bankName.trim(), accountNumber: accountNumber.trim(), accountName: accountName.trim() });
      await AsyncStorage.setItem(BANK_KEY(uid), JSON.stringify({ bankName: bankName.trim(), accountName: accountName.trim(), accountNumber: accountNumber.trim() }));
      feedback.success();
      onClose();
    } catch {
      feedback.error();
    }
  }

  const inputStyle = {
    backgroundColor: '#0d1117',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffffff18',
    color: '#fff' as const,
    fontFamily: Font.body,
    fontSize: 15,
    padding: 14,
    marginBottom: 10,
  };
  const labelStyle = { fontFamily: Font.medium, fontSize: 12.5, color: MUTED, marginBottom: 5 };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
        <MotiView
          from={{ translateY: 40, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ type: 'timing', duration: 260 }}
          style={{ backgroundColor: Palette.prepperBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#ffffff30', alignSelf: 'center', marginBottom: 20 }} />
          <Text style={{ fontFamily: Font.display, fontSize: 22, color: '#fff', letterSpacing: -0.5, marginBottom: 6 }}>request payout</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED, marginBottom: 20 }}>
            available: {money(available)} · min {money(MIN_PAYOUT)}
          </Text>

          {savedBank && (
            <View style={{ backgroundColor: '#0d1117', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: MUTED }}>
                Saved account: {savedBank.bankName} — ****{savedBank.accountNumber.slice(-4)}
              </Text>
              <Pressable onPress={clearSavedBank} style={{ marginTop: 4 }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 12, color: ORANGE }}>Change account</Text>
              </Pressable>
            </View>
          )}

          <Text style={labelStyle}>Amount</Text>
          <TextInput
            style={inputStyle}
            placeholder={`$${MIN_PAYOUT}.00`}
            placeholderTextColor="#ffffff30"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            accessibilityLabel="Payout amount"
          />

          <Text style={labelStyle}>Bank name</Text>
          <TextInput
            style={inputStyle}
            placeholder="e.g. Chase, Bank of America"
            placeholderTextColor="#ffffff30"
            value={bankName}
            onChangeText={setBankName}
            accessibilityLabel="Bank name"
          />

          <Text style={labelStyle}>Account number</Text>
          <TextInput
            style={inputStyle}
            placeholder="Account number"
            placeholderTextColor="#ffffff30"
            keyboardType="number-pad"
            value={accountNumber}
            onChangeText={setAccountNumber}
            accessibilityLabel="Account number"
          />

          <Text style={labelStyle}>Account name</Text>
          <TextInput
            style={{ ...inputStyle, marginBottom: 24 }}
            placeholder="Name on account"
            placeholderTextColor="#ffffff30"
            value={accountName}
            onChangeText={setAccountName}
            accessibilityLabel="Account name"
          />

          <PressableScale
            onPress={handleSubmit}
            disabled={!valid || requestPayout.isPending}
            accessibilityRole="button"
            accessibilityLabel="Submit payout request"
            style={{
              backgroundColor: valid ? ORANGE : '#ffffff18',
              borderRadius: Radius.pill,
              height: 52,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 16, color: valid ? '#fff' : '#ffffff40' }}>
              {requestPayout.isPending ? 'submitting...' : 'submit request'}
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

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color="#fff" />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', letterSpacing: -0.6, flex: 1 }}>payouts</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
          contentContainerStyle={{ paddingBottom: 48 }}>
          <View style={[{ padding: 20, gap: 16 }, isDesktop ? { maxWidth: 800, alignSelf: 'center', width: '100%' } : null]}>

            {/* Balance card */}
            <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
              <View style={{ backgroundColor: CARD, borderRadius: 20, padding: 24, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Wallet size={16} color={MUTED} />
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }}>Available balance</Text>
                </View>
                {isLoading ? (
                  <Skeleton width={160} height={44} radius={10} style={{ backgroundColor: '#ffffff18' }} />
                ) : (
                  <Text style={{ fontFamily: Font.display, fontSize: 36, color: ORANGE, letterSpacing: -1 }}>{money(available)}</Text>
                )}
                <Text style={{ fontFamily: Font.body, fontSize: 11, color: MUTED }}>after 15% platform fee</Text>
                {balance?.pending != null && balance.pending > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED }}>Settling soon:</Text>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#60a5fa' }}>{money(balance.pending)}</Text>
                  </View>
                )}
                <PressableScale
                  onPress={() => { feedback.tap(); setModalOpen(true); }}
                  disabled={available < MIN_PAYOUT || !prepperId}
                  accessibilityRole="button"
                  accessibilityLabel="Request payout"
                  style={{
                    marginTop: 8,
                    backgroundColor: available >= MIN_PAYOUT ? ORANGE : '#ffffff18',
                    borderRadius: Radius.pill,
                    height: 50,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}>
                  <ArrowDownToLine size={17} color={available >= MIN_PAYOUT ? '#fff' : '#ffffff40'} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: available >= MIN_PAYOUT ? '#fff' : '#ffffff40' }}>
                    Request payout
                  </Text>
                </PressableScale>
                {available < MIN_PAYOUT && (
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 8 }}>
                    Need {money(MIN_PAYOUT - available)} more to reach the $50 minimum
                  </Text>
                )}
              </View>
            </MotiView>

            {/* Info note */}
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: MUTED, textAlign: 'center' }}>
              Minimum payout: {money(MIN_PAYOUT)}  ·  Processed within 3–5 business days
            </Text>

            {/* History header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: '#ffffff14' }} />
              <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>Payout history</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: '#ffffff14' }} />
            </View>

            {/* History list */}
            {isLoading ? (
              <View style={{ gap: 10 }}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} width="100%" height={56} radius={14} style={{ backgroundColor: '#ffffff18' }} />
                ))}
              </View>
            ) : history.length === 0 ? (
              <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
                style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
                <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowDownToLine size={22} color={MUTED} />
                </View>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>No payouts yet</Text>
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

      {modalOpen && prepperId && user ? (
        <RequestModal
          available={available}
          prepperId={prepperId}
          uid={user.id}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </View>
  );
}
