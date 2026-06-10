import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Bike, Check, ChevronLeft, Lock, MapPin, Minus, Plus, ShoppingBag, Store, Trash2, Heart } from 'lucide-react-native';
import { useState, type ComponentType } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette, Radius } from '@/constants/theme';
import { useCart, usePlaceOrder, useRemoveItems, useStripeCheckout, useUpdateCartItem } from '@/lib/queries/cart';
import { useFeatureEnabled } from '@/lib/queries/feature-flags';
import { useAuth } from '@/providers/auth-provider';
import type { FulfillmentType } from '@/types/database.types';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const DELIVERY_FEE = 3.99;
const money = (n: number) => `$${n.toFixed(2)}`;

type IconType = ComponentType<{ size?: number; color?: string }>;
const METHODS: { key: FulfillmentType; label: string; Icon: IconType; fee: string; eta: string }[] = [
  { key: 'delivery', label: 'Delivery', Icon: Bike, fee: money(DELIVERY_FEE), eta: '30–45 min' },
  { key: 'pickup', label: 'Pickup', Icon: Store, fee: 'Free', eta: 'ready ~20 min' },
  { key: 'meetup', label: 'Meet up', Icon: MapPin, fee: 'Free', eta: 'you pick a spot' },
];
const TIPS = [0, 1, 2, 5];

export default function CartScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: cart, isLoading } = useCart(user?.id);
  const updateItem = useUpdateCartItem(user?.id);
  const removeItems = useRemoveItems(user?.id);
  const placeOrder = usePlaceOrder();
  const checkoutStripe = useStripeCheckout();
  const paymentsOn = useFeatureEnabled('payments');
  const { canceled } = useLocalSearchParams<{ canceled?: string }>();
  const [placed, setPlaced] = useState(false);
  const [err, setErr] = useState<string | null>(canceled ? 'Payment canceled — your cart is still here.' : null);
  const [method, setMethod] = useState<FulfillmentType>('delivery');
  const [note, setNote] = useState('');
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState(false);
  const busy = placeOrder.isPending || checkoutStripe.isPending;

  const prepper = cart?.items[0]?.prepper ?? 'the prepper';

  // One order = one kitchen. Detect (and let the user resolve) a mixed-prepper cart.
  const kitchens = (() => {
    const seen = new Map<string, { id: string; name: string }>();
    for (const it of cart?.items ?? []) {
      const key = it.prepperId ?? it.prepper;
      if (!seen.has(key)) seen.set(key, { id: key, name: it.prepper });
    }
    return [...seen.values()];
  })();
  const mixed = kitchens.length > 1;

  function keepOnly(keepKey: string) {
    const drop = (cart?.items ?? []).filter((it) => (it.prepperId ?? it.prepper) !== keepKey).map((it) => it.id);
    removeItems.mutate(drop);
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function startPayment(orderId: string) {
    try {
      const url = await checkoutStripe.mutateAsync(orderId);
      if (Platform.OS === 'web') {
        window.location.assign(url);
      } else {
        await WebBrowser.openBrowserAsync(url);
        router.replace('/orders');
      }
    } catch (e) {
      // Order exists but payment didn't start — let them retry from Orders.
      feedback.error();
      setErr((e instanceof Error ? e.message : 'Could not start payment.') + ' Your order is saved — pay it from Orders.');
    }
  }

  function checkout() {
    if (busy) return; // guard against a double-tap creating two orders
    if (!user) return router.push('/auth?mode=signin');
    if (mixed) { feedback.warning(); return setErr('Pick one kitchen to order from above.'); }
    if (method === 'delivery' && note.trim().length < 5) { feedback.warning(); return setErr('Add a delivery address.'); }
    if (method === 'meetup' && note.trim().length < 3) { feedback.warning(); return setErr('Where should you meet?'); }
    setErr(null);
    placeOrder.mutate(
      { userId: user.id, fulfillment: method, note: note.trim() || null, tip },
      {
        onSuccess: (orderId) => {
          if (paymentsOn) startPayment(orderId);
          else setPlaced(true);
        },
        onError: (e) => { feedback.error(); setErr(e instanceof Error ? e.message : 'Could not place order.'); },
      },
    );
  }

  const subtotal = cart?.subtotal ?? 0;
  const deliveryFee = method === 'delivery' ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee + tip;

  const noteConfig: Record<FulfillmentType, { label: string; placeholder: string } | null> = {
    delivery: { label: 'Delivery address', placeholder: 'Street, apt, city' },
    meetup: { label: 'Where & when to meet', placeholder: 'e.g. Park gate, today 6pm' },
    pickup: { label: 'Pickup note (optional)', placeholder: 'Any pickup details?' },
  };

  // Order-placed confirmation
  if (placed) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: Palette.success + '1F', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={36} color={Palette.success} strokeWidth={3} />
          </View>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, textAlign: 'center' }}>Order placed!</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 300 }}>
            Your order is in. The prepper will confirm shortly — track it in your orders.
          </Text>
          <PressableScale onPress={() => router.replace('/orders')} accessibilityRole="button" accessibilityLabel="Track your order" style={{ marginTop: 6, paddingHorizontal: 24, height: 52, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Track your order</Text>
          </PressableScale>
          <PressableScale onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Back to home" style={{ paddingHorizontal: 24, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.textSecondary }}>Back to home</Text>
          </PressableScale>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F7F8' }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>your cart</Text>
        </View>

        {!user ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <ShoppingBag size={28} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Sign in to start an order.</Text>
            <PressableScale onPress={() => router.push('/auth?mode=signin')} accessibilityRole="button" accessibilityLabel="Sign in" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Sign in</Text>
            </PressableScale>
          </View>
        ) : isLoading ? (
          <ListSkeleton count={3} />
        ) : !cart?.items.length ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={28} color={Palette.textMuted} />
            </View>
            {canceled ? (
              <>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>Payment canceled</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 300 }}>Your order is saved. You can finish paying for it any time in your orders.</Text>
                <PressableScale onPress={() => router.replace('/orders')} accessibilityRole="button" accessibilityLabel="Go to orders" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Go to orders</Text>
                </PressableScale>
                <PressableScale onPress={() => router.replace('/explore')} accessibilityRole="button" accessibilityLabel="Browse meals" style={{ paddingHorizontal: 22, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.textSecondary }}>Browse meals</Text>
                </PressableScale>
              </>
            ) : (
              <>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>Your cart is empty</Text>
                <PressableScale onPress={() => router.replace('/explore')} accessibilityRole="button" accessibilityLabel="Browse meals" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Browse meals</Text>
                </PressableScale>
              </>
            )}
          </View>
        ) : (
          <>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 20 }}>
              {mixed ? (
                <View style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.md, padding: 14, gap: 10 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: Palette.brandPressed }}>Items from {kitchens.length} kitchens</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, lineHeight: 19, color: Palette.brandPressed }}>You can order from one kitchen at a time. Keep one to check out — the other items will be removed.</Text>
                  <View style={{ gap: 8, marginTop: 2 }}>
                    {kitchens.map((k) => (
                      <PressableScale key={k.id} onPress={() => keepOnly(k.id)} disabled={removeItems.isPending} accessibilityRole="button" accessibilityLabel={`Keep only ${k.name}`}
                        style={{ height: 44, borderRadius: Radius.sm, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: removeItems.isPending ? 0.6 : 1 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>Keep {k.name}</Text>
                      </PressableScale>
                    ))}
                  </View>
                </View>
              ) : null}
              {cart.items.map((it) => (
                <View key={it.id} style={{ backgroundColor: '#fff', borderRadius: Radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {it.image ? <Image source={it.image} style={{ width: 64, height: 64, borderRadius: 12 }} contentFit="cover" /> : <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: Palette.canvas }} />}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }} numberOfLines={1}>{it.title}</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1 }}>by {it.prepper}</Text>
                    <Text style={{ fontFamily: Font.display, fontSize: 16, color: ORANGE, marginTop: 4 }}>{money(it.price_snapshot)}</Text>
                  </View>
                  {/* Qty stepper */}
                  <View style={{ alignItems: 'center', gap: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Palette.canvas, borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 4 }}>
                      <PressableScale onPress={() => updateItem.mutate({ itemId: it.id, quantity: it.quantity - 1 })} accessibilityRole="button" accessibilityLabel="Decrease quantity" hitSlop={8} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                        {it.quantity <= 1 ? <Trash2 size={14} color="#ef4444" /> : <Minus size={14} color={INK} />}
                      </PressableScale>
                      <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK, minWidth: 18, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{it.quantity}</Text>
                      <PressableScale onPress={() => updateItem.mutate({ itemId: it.id, quantity: it.quantity + 1 })} accessibilityRole="button" accessibilityLabel="Increase quantity" hitSlop={8} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                        <Plus size={14} color="#fff" />
                      </PressableScale>
                    </View>
                  </View>
                </View>
              ))}

              {/* Fulfillment method */}
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK, marginTop: 8 }}>How do you want it?</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {METHODS.map((m) => {
                  const on = method === m.key;
                  return (
                    <PressableScale
                      key={m.key}
                      onPress={() => { feedback.tap(); setMethod(m.key); setErr(null); }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${m.label}, ${m.fee}, ${m.eta}`}
                      style={{ flex: 1, backgroundColor: on ? Palette.brandTint : '#fff', borderWidth: 1.5, borderColor: on ? ORANGE : Palette.border, borderRadius: Radius.md, paddingTop: 16, paddingBottom: 12, alignItems: 'center', gap: 7, overflow: 'hidden' }}>
                      {on ? (
                        <View style={{ position: 'absolute', top: 7, right: 7, width: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={11} color="#fff" strokeWidth={3.5} />
                        </View>
                      ) : null}
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: on ? ORANGE : Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                        <m.Icon size={20} color={on ? '#fff' : Palette.textSecondary} />
                      </View>
                      <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: on ? Palette.brandPressed : INK }}>{m.label}</Text>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: m.fee === 'Free' ? Palette.success : on ? Palette.brandPressed : Palette.textSecondary }}>{m.fee}</Text>
                      <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: Palette.textMuted, textAlign: 'center' }} numberOfLines={1}>{m.eta}</Text>
                    </PressableScale>
                  );
                })}
              </View>

              {/* Contextual detail */}
              {method === 'pickup' ? (
                <View style={{ backgroundColor: '#fff', borderRadius: Radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Store size={16} color={ORANGE} />
                  <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Pick up from {prepper}. They’ll share the spot when they confirm.</Text>
                </View>
              ) : null}
              {noteConfig[method] ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>{noteConfig[method]!.label}</Text>
                  <TextInput
                    value={note}
                    onChangeText={(t) => { setNote(t); setErr(null); }}
                    placeholder={noteConfig[method]!.placeholder}
                    placeholderTextColor={Palette.textMuted}
                    style={{ minHeight: 48, backgroundColor: '#fff', borderRadius: Radius.md, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Font.body, fontSize: 15, color: INK }}
                  />
                </View>
              ) : null}

              {/* Tip */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }}>
                <Heart size={16} color={ORANGE} fill={ORANGE} />
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>Add a tip</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>· 100% goes to {prepper}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {TIPS.map((t) => {
                  const on = !customTip && tip === t;
                  return (
                    <PressableScale
                      key={t}
                      onPress={() => { feedback.tap(); setCustomTip(false); setTip(t); }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={t === 0 ? 'No tip' : `Tip ${money(t)}`}
                      style={{ flex: 1, height: 46, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: on ? ORANGE : Palette.border, backgroundColor: on ? ORANGE : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: on ? '#fff' : INK }}>{t === 0 ? 'None' : money(t)}</Text>
                    </PressableScale>
                  );
                })}
                <PressableScale
                  onPress={() => { feedback.tap(); setCustomTip(true); setTip(0); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: customTip }}
                  accessibilityLabel="Custom tip"
                  style={{ flex: 1, height: 46, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: customTip ? ORANGE : Palette.border, backgroundColor: customTip ? Palette.brandTint : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: customTip ? Palette.brandPressed : INK }}>Custom</Text>
                </PressableScale>
              </View>
              {customTip ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: Radius.md, borderWidth: 1.5, borderColor: ORANGE, paddingHorizontal: 14, height: 50, gap: 6 }}>
                  <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK }}>$</Text>
                  <TextInput
                    value={tip ? String(tip) : ''}
                    onChangeText={(t) => { const n = Number(t.replace(/[^0-9.]/g, '')); setTip(Number.isFinite(n) ? Math.min(n, 200) : 0); }}
                    placeholder="0"
                    placeholderTextColor={Palette.textMuted}
                    keyboardType="decimal-pad"
                    autoFocus
                    accessibilityLabel="Custom tip amount"
                    style={{ flex: 1, fontFamily: Font.display, fontSize: 20, color: INK }}
                  />
                </View>
              ) : null}

              {err ? <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: '#ef4444', textAlign: 'center' }}>{err}</Text> : null}
            </ScrollView>

            {/* Summary + checkout */}
            <SafeAreaView edges={['bottom']} style={{ backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingHorizontal: 20, paddingTop: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Subtotal</Text>
                <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK, fontVariant: ['tabular-nums'] }}>{money(subtotal)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>{method === 'delivery' ? 'Delivery fee' : 'Pickup / meet up'}</Text>
                <Text style={{ fontFamily: Font.medium, fontSize: 13, color: deliveryFee ? INK : Palette.success, fontVariant: ['tabular-nums'] }}>{deliveryFee ? money(deliveryFee) : 'Free'}</Text>
              </View>
              {tip > 0 ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Tip</Text>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK, fontVariant: ['tabular-nums'] }}>{money(tip)}</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, marginBottom: 14 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>Total</Text>
                <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, fontVariant: ['tabular-nums'] }}>{money(total)}</Text>
              </View>
              <PressableScale onPress={checkout} disabled={busy || mixed} accessibilityRole="button" accessibilityLabel={paymentsOn ? 'Pay and place order' : 'Place order'}
                style={{ height: 54, borderRadius: 16, backgroundColor: mixed ? Palette.textMuted : ORANGE, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.7 : 1 }}>
                {busy ? <ActivityIndicator color="#fff" /> : (
                  <>
                    {paymentsOn && !mixed ? <Lock size={16} color="#fff" /> : null}
                    <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
                      {mixed ? 'Pick one kitchen above' : paymentsOn ? `Pay · ${money(total)}` : `Place order · ${money(total)}`}
                    </Text>
                  </>
                )}
              </PressableScale>
              <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textMuted, textAlign: 'center', marginTop: 8 }}>
                {paymentsOn ? 'Secure card payment via Stripe. Auto-refunded if your order is declined.' : 'Payment is collected when the prepper confirms.'}
              </Text>
            </SafeAreaView>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
