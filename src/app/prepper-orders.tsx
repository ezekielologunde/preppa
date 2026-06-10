import { useRouter } from 'expo-router';
import { ChevronLeft, QrCode, ShoppingBag, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette, Radius } from '@/constants/theme';
import { useRefundOrder } from '@/lib/queries/cart';
import { useAdvanceOrder, useCancelOrder, useOrdersRealtime, usePrepperOrders, useVerifyHandoff, type OrderSummary } from '@/lib/queries/orders';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';
import type { OrderStatus } from '@/types/database.types';

const ORANGE = Palette.brand;
const CARD = Palette.prepperCard;
const BG = Palette.prepperBg;
const money = (n: number) => `$${n.toFixed(2)}`;

// The next legal step a prepper takes, with the CTA label. null = terminal/no action.
const NEXT: Partial<Record<OrderStatus, { next: OrderStatus; cta: string }>> = {
  pending: { next: 'confirmed', cta: 'Confirm order' },
  confirmed: { next: 'preparing', cta: 'Start preparing' },
  preparing: { next: 'ready', cta: 'Mark ready' },
  ready: { next: 'completed', cta: 'Mark delivered' },
  out_for_delivery: { next: 'completed', cta: 'Mark delivered' },
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'New',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'On the way',
  completed: 'Delivered',
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
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#9ca3af', marginTop: 1 }}>
            {order.items.reduce((s, i) => s + i.quantity, 0)} item{order.items.length === 1 ? '' : 's'} · {money(order.total)}
          </Text>
        </View>
        <View style={{ paddingHorizontal: 11, height: 26, borderRadius: 999, backgroundColor: done ? '#252a34' : ORANGE + '26', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: done ? '#9ca3af' : ORANGE }}>{STATUS_LABEL[order.status]}</Text>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        {order.items.map((it) => (
          <View key={it.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13.5, color: '#d1d5db' }} numberOfLines={1}>{it.quantity}× {it.title}</Text>
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: '#9ca3af', fontVariant: ['tabular-nums'] }}>{money(it.total)}</Text>
          </View>
        ))}
      </View>

      {/* Fulfillment */}
      <View style={{ backgroundColor: '#1d2129', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: ORANGE, textTransform: 'capitalize' }}>{order.fulfillment === 'meetup' ? 'Meet up' : order.fulfillment}</Text>
        {order.fulfillmentNote ? <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 12.5, color: '#d1d5db' }} numberOfLines={2}>· {order.fulfillmentNote}</Text> : null}
      </View>

      {step ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {canCancel ? (
            <PressableScale onPress={onCancel} disabled={busy} accessibilityRole="button" accessibilityLabel="Decline order" style={{ height: 46, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, borderColor: '#3f4451', alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#9ca3af' }}>Decline</Text>
            </PressableScale>
          ) : null}
          <PressableScale onPress={() => (needsHandoff ? onVerify() : onAdvance(step.next))} disabled={busy} accessibilityRole="button" accessibilityLabel={needsHandoff ? 'Verify handoff and complete' : step.cta} style={{ flex: 1, height: 46, borderRadius: 14, backgroundColor: ORANGE, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
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
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const prepperId = prepper?.id;
  const { data: orders, isLoading } = usePrepperOrders(prepperId);
  useOrdersRealtime('prepper_id', prepperId);
  const advance = useAdvanceOrder();
  const cancel = useCancelOrder();
  const refund = useRefundOrder();
  const verify = useVerifyHandoff();
  const busyId = advance.isPending ? advance.variables?.orderId : cancel.isPending ? cancel.variables : undefined;
  const [actionErr, setActionErr] = useState<string | null>(null);
  const onErr = (e: unknown) => setActionErr(e instanceof Error ? e.message : 'Could not update the order. Try again.');

  // Handoff verification modal (pickup/meetup): cook keys the customer's PIN.
  const [verifyOrder, setVerifyOrder] = useState<OrderSummary | null>(null);
  const [pin, setPin] = useState('');
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  function openVerify(o: OrderSummary) { setVerifyOrder(o); setPin(''); setVerifyMsg(null); }
  function submitPin() {
    if (!verifyOrder || pin.replace(/\D/g, '').length !== 4) { setVerifyMsg('Enter the 4-digit code.'); return; }
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
          <PressableScale onPress={() => (router.canGoBack() ? router.back() : router.replace('/dashboard'))} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color="#fff" />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', letterSpacing: -0.6 }}>incoming orders</Text>
        </View>

        {actionErr ? (
          <PressableScale onPress={() => setActionErr(null)} accessibilityRole="button" accessibilityLabel="Dismiss error" style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: '#7f1d1d', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: '#fecaca' }}>{actionErr} (tap to dismiss)</Text>
          </PressableScale>
        ) : null}

        {!prepperId ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <ShoppingBag size={28} color="#5b6170" />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: '#9ca3af', textAlign: 'center' }}>This is your kitchen&apos;s order queue. Approved preppers see incoming orders here.</Text>
          </View>
        ) : isLoading ? (
          <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
        ) : !orders?.length ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={28} color="#5b6170" />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>No orders yet</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: '#9ca3af', textAlign: 'center' }}>New orders from customers will appear here in real time.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
            {orders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                busy={busyId === o.id}
                onAdvance={(next) => { setActionErr(null); advance.mutate({ orderId: o.id, next }, { onError: onErr }); }}
                onCancel={() => { setActionErr(null); cancel.mutate(o.id, { onSuccess: () => refund.mutate(o.id), onError: onErr }); }}
                onVerify={() => openVerify(o)}
              />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Verify handoff — cook keys the customer's pickup/meetup PIN */}
      <Modal visible={!!verifyOrder} transparent animationType="fade" onRequestClose={() => setVerifyOrder(null)}>
        <Pressable onPress={() => setVerifyOrder(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, backgroundColor: CARD, borderRadius: 22, padding: 22, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: ORANGE + '26', alignItems: 'center', justifyContent: 'center' }}>
                <QrCode size={22} color={ORANGE} />
              </View>
              <PressableScale onPress={() => setVerifyOrder(null)} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#252a34', alignItems: 'center', justifyContent: 'center' }}>
                <X size={17} color="#9ca3af" />
              </PressableScale>
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#fff', letterSpacing: -0.4 }}>Verify the handoff</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: '#9ca3af', lineHeight: 19 }}>
              Ask {verifyOrder?.customer ?? 'the customer'} for their 4-digit code, or scan their QR with your camera.
            </Text>
            <TextInput
              value={pin}
              onChangeText={(t) => { setPin(t.replace(/\D/g, '').slice(0, 4)); setVerifyMsg(null); }}
              placeholder="••••"
              placeholderTextColor="#4b5563"
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
              style={{ height: 64, borderRadius: 16, backgroundColor: '#1d2129', textAlign: 'center', fontSize: 30, letterSpacing: 16, fontFamily: Font.display, color: '#fff' }}
            />
            {verifyMsg ? <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: '#fca5a5', textAlign: 'center' }}>{verifyMsg}</Text> : null}
            <PressableScale onPress={submitPin} disabled={verify.isPending} accessibilityRole="button" accessibilityLabel="Confirm handoff" style={{ height: 52, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: verify.isPending ? 0.7 : 1 }}>
              {verify.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Confirm & complete</Text>}
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
