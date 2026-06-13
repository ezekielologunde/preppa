import { useRouter } from 'expo-router';
import { ChevronLeft, QrCode, ShoppingBag, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListSkeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette, Radius } from '@/constants/theme';
import { useRefundOrder } from '@/lib/queries/cart';
import { useAdvanceOrder, useCancelOrder, useOrdersRealtime, usePrepperOrders, useVerifyHandoff, type OrderSummary } from '@/lib/queries/orders';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useBreakpoint } from '@/lib/layout';
import { useAuth } from '@/providers/auth-provider';
import type { OrderStatus } from '@/types/database.types';

const ORANGE = Palette.brand;
const CARD = Palette.prepperCard;
const BG = Palette.prepperBg;
const money = (n: number) => `$${n.toFixed(2)}`;

// The next legal step a prepper takes, with the CTA label. null = terminal/no action.
const NEXT: Partial<Record<OrderStatus, { next: OrderStatus; cta: string }>> = {
  pending: { next: 'confirmed', cta: 'Confirm preorder' },
  confirmed: { next: 'preparing', cta: 'Start prepping' },
  preparing: { next: 'ready', cta: 'Mark ready' },
  ready: { next: 'completed', cta: 'Mark complete' },
  out_for_delivery: { next: 'completed', cta: 'Mark complete' },
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'New',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'On the way',
  completed: 'Complete',
  cancelled: 'Cancelled',
};

function OrderCard({
  order,
  onAdvance,
  onCancel,
  onVerify,
  busy,
}: {
  order: OrderSummary;
  onAdvance: (next: OrderStatus) => void;
  onCancel: () => void;
  onVerify: () => void;
  busy: boolean;
}) {
  const step = NEXT[order.status];
  const needsHandoff = step?.next === 'completed' && (order.fulfillment === 'pickup' || order.fulfillment === 'meetup');
  const canCancel = order.status === 'pending' || order.status === 'confirmed';
  const done = order.status === 'completed' || order.status === 'cancelled';
  return (
    <View style={{ backgroundColor: CARD, borderRadius: 20, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }} numberOfLines={1}>{order.customer}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, marginTop: 1 }}>
            {order.items.reduce((s, i) => s + i.quantity, 0)} item{order.items.length === 1 ? '' : 's'} · {money(order.total)}
          </Text>
        </View>
        <View style={{ paddingHorizontal: 11, height: 26, borderRadius: Radius.pill, backgroundColor: done ? '#252a34' : ORANGE + '26', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: done ? Palette.textMuted : ORANGE }}>{STATUS_LABEL[order.status]}</Text>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        {order.items.map((it) => (
          <View key={it.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary }} numberOfLines={1}>{it.quantity}× {it.title}</Text>
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textMuted, fontVariant: ['tabular-nums'] }}>{money(it.total)}</Text>
          </View>
        ))}
      </View>

      {/* Fulfillment */}
      <View style={{ backgroundColor: '#1d2129', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: ORANGE, textTransform: 'capitalize' }}>{order.fulfillment === 'meetup' ? 'Meet up' : order.fulfillment}</Text>
        {order.fulfillmentNote ? <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 12.5, color: Palette.textMuted }} numberOfLines={2}>· {order.fulfillmentNote}</Text> : null}
      </View>

      {step ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {canCancel ? (
            <PressableScale onPress={onCancel} disabled={busy} accessibilityRole="button" accessibilityLabel="Decline preorder" style={{ height: 46, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, borderColor: '#3f4451', alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.textMuted }}>Decline</Text>
            </PressableScale>
          ) : null}
          <PressableScale onPress={() => { feedback.tap(); if (needsHandoff) onVerify(); else onAdvance(step.next); }} disabled={busy} accessibilityRole="button" accessibilityLabel={needsHandoff ? 'Verify handoff and complete' : step.cta} style={{ flex: 1, height: 46, borderRadius: Radius.pill, backgroundColor: ORANGE, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
            {busy ? <ActivityIndicator color="#fff" /> : (
              <>
                {needsHandoff ? <QrCode size={16} color="#fff" /> : null}
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>{needsHandoff ? 'Verify & complete' : step.cta}</Text>
              </>
            )}
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

export default function PrepperOrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isDesktop = useBreakpoint() === 'desktop';
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const prepperId = prepper?.id;
  const { data: orders, isLoading, refetch } = usePrepperOrders(prepperId);
  useOrdersRealtime('prepper_id', prepperId);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }
  const advance = useAdvanceOrder();
  const cancel = useCancelOrder();
  const refund = useRefundOrder();
  const verify = useVerifyHandoff();
  const busyId = advance.isPending ? advance.variables?.orderId : cancel.isPending ? cancel.variables : undefined;
  const [actionErr, setActionErr] = useState<string | null>(null);
  const onErr = (e: unknown) => setActionErr(e instanceof Error ? e.message : 'Could not update the preorder. Try again.');
  // Declining is destructive (refunds the customer) → confirm first.
  const [declineOrder, setDeclineOrder] = useState<OrderSummary | null>(null);
  function doDecline(o: OrderSummary) {
    setDeclineOrder(null);
    setActionErr(null);
    cancel.mutate(o.id, { onSuccess: () => refund.mutate(o.id), onError: onErr });
  }

  // Handoff verification modal (pickup/meetup): cook keys the customer's PIN.
  const [verifyOrder, setVerifyOrder] = useState<OrderSummary | null>(null);
  const [pin, setPin] = useState('');
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  function openVerify(o: OrderSummary) { setVerifyOrder(o); setPin(''); setVerifyMsg(null); }
  function submitPin() {
    if (!verifyOrder || pin.replace(/\D/g, '').length !== 3) { setVerifyMsg('Enter the 3-digit code.'); return; }
    setVerifyMsg(null);
    verify.mutate({ orderId: verifyOrder.id, pin }, {
      onSuccess: (r) => {
        if (r.ok && r.completed) { feedback.success(); setVerifyOrder(null); }
        else if (r.locked) { feedback.error(); setVerifyMsg(r.reason ?? 'Locked — ask for the QR code.'); }
        else { feedback.error(); setVerifyMsg(`${r.reason ?? 'Wrong code'}${typeof r.attempts_left === 'number' ? ` · ${r.attempts_left} tries left` : ''}`); setPin(''); }
      },
      onError: (e) => { feedback.error(); setVerifyMsg(e instanceof Error ? e.message : 'Could not verify.'); },
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); } }} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color="#fff" />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', letterSpacing: -0.6 }}>incoming preorders</Text>
        </View>

        {actionErr ? (
          <PressableScale onPress={() => { feedback.tap(); setActionErr(null); }} accessibilityRole="button" accessibilityLabel="Dismiss error" style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: '#7f1d1d', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: '#fecaca' }}>{actionErr} (tap to dismiss)</Text>
          </PressableScale>
        ) : null}

        {!prepperId ? (
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <ShoppingBag size={28} color="#5b6170" />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center' }}>This is your kitchen&apos;s preorder queue. Approved preppers see incoming preorders here.</Text>
          </MotiView>
        ) : isLoading ? (
          <ListSkeleton count={4} rowHeight={110} />
        ) : !orders?.length ? (
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={28} color="#5b6170" />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>No preorders yet</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center' }}>New preorders from customers will appear here in real time.</Text>
          </MotiView>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            <View style={isDesktop ? { flexDirection: 'row', flexWrap: 'wrap', gap: 14 } : { gap: 12 }}>
              {orders.map((o, i) => (
                <MotiView key={o.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: i * 45 }}
                  style={isDesktop ? { flex: 1, minWidth: 320, maxWidth: '48%' } : undefined}>
                  <OrderCard
                    order={o}
                    busy={busyId === o.id}
                    onAdvance={(next) => { setActionErr(null); advance.mutate({ orderId: o.id, next }, { onError: onErr }); }}
                    onCancel={() => { feedback.warning(); setDeclineOrder(o); }}
                    onVerify={() => openVerify(o)}
                  />
                </MotiView>
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Decline confirmation */}
      <Modal visible={!!declineOrder} transparent animationType="fade" onRequestClose={() => setDeclineOrder(null)}>
        <Pressable onPress={() => setDeclineOrder(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, backgroundColor: CARD, borderRadius: 22, padding: 22, gap: 14 }}>
            <View style={{ width: 50, height: 50, borderRadius: 15, backgroundColor: '#7f1d1d', alignItems: 'center', justifyContent: 'center' }}>
              <X size={24} color="#fca5a5" strokeWidth={2.6} />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#fff', letterSpacing: -0.4 }}>Decline this preorder?</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textMuted, lineHeight: 19 }}>
              {declineOrder ? `${declineOrder.customer}'s preorder (${money(declineOrder.total)}) will be cancelled and the customer refunded automatically.` : ''}
            </Text>
            <PressableScale onPress={() => { feedback.tap(); if (declineOrder) doDecline(declineOrder); }} accessibilityRole="button" accessibilityLabel="Yes, decline the preorder" style={{ height: 50, borderRadius: 14, backgroundColor: Palette.danger, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Yes, decline</Text>
            </PressableScale>
            <PressableScale onPress={() => { feedback.tap(); setDeclineOrder(null); }} accessibilityRole="button" accessibilityLabel="Keep the preorder" style={{ height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.textMuted }}>Keep the preorder</Text>
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Verify handoff — cook keys the customer's pickup/meetup PIN */}
      <Modal visible={!!verifyOrder} transparent animationType="fade" onRequestClose={() => setVerifyOrder(null)}>
        <Pressable onPress={() => setVerifyOrder(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, backgroundColor: CARD, borderRadius: 22, padding: 22, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: ORANGE + '26', alignItems: 'center', justifyContent: 'center' }}>
                <QrCode size={22} color={ORANGE} />
              </View>
              <PressableScale onPress={() => { feedback.tap(); setVerifyOrder(null); }} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#252a34', alignItems: 'center', justifyContent: 'center' }}>
                <X size={17} color={Palette.textMuted} />
              </PressableScale>
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#fff', letterSpacing: -0.4 }}>Verify the handoff</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textMuted, lineHeight: 19 }}>
              Ask {verifyOrder?.customer ?? 'the customer'} for their 3-digit code, or scan their QR with your camera.
            </Text>
            <TextInput
              value={pin}
              onChangeText={(t) => { setPin(t.replace(/\D/g, '').slice(0, 3)); setVerifyMsg(null); }}
              placeholder="•••"
              placeholderTextColor="#4b5563"
              keyboardType="number-pad"
              maxLength={3}
              autoFocus
              style={{ height: 64, borderRadius: 16, backgroundColor: '#1d2129', textAlign: 'center', fontSize: 30, letterSpacing: 16, fontFamily: Font.display, color: '#fff' }}
            />
            {verifyMsg ? <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: '#fca5a5', textAlign: 'center' }}>{verifyMsg}</Text> : null}
            <PressableScale onPress={() => { feedback.tap(); submitPin(); }} disabled={verify.isPending} accessibilityRole="button" accessibilityLabel="Confirm handoff" style={{ height: 52, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: verify.isPending ? 0.7 : 1 }}>
              {verify.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Confirm & complete</Text>}
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
