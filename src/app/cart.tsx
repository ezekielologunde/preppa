import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Bike, Check, ChefHat, ChevronLeft, ChevronRight, Clock, Lock, MapPin, Minus, Plus, ShoppingBag, Store, Trash2, Heart } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState, type ComponentType } from 'react';
import { ActivityIndicator, Platform, RefreshControl, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { StripeEmbeddedSheet } from '@/components/stripe-embedded';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { BP } from '@/lib/layout';
import { Palette, Radius } from '@/constants/theme';
import { useCart, useEmbeddedCheckout, usePlaceOrder, useRemoveItems, useStripeCheckout, useUpdateCartItem, type EmbeddedPay } from '@/lib/queries/cart';
import { useFeatureEnabled } from '@/lib/queries/feature-flags';
import { useAuth } from '@/providers/auth-provider';
import type { FulfillmentType } from '@/types/database.types';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const DELIVERY_FEE = 3.99;
const money = (n: number) => `$${n.toFixed(2)}`;

type IconType = ComponentType<{ size?: number; color?: string }>;
const METHODS: { key: FulfillmentType; label: string; Icon: IconType; fee: string; eta: string }[] = [
  { key: 'delivery', label: 'Delivery', Icon: Bike, fee: money(DELIVERY_FEE), eta: 'drop-off scheduled' },
  { key: 'pickup', label: 'Pickup', Icon: Store, fee: 'Free', eta: 'pickup window' },
  { key: 'meetup', label: 'Meet up', Icon: MapPin, fee: 'Free', eta: 'you pick a spot' },
];
const TIPS = [0, 1, 2, 5];

export default function CartScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: cart, isLoading, refetch } = useCart(user?.id);
  const updateItem = useUpdateCartItem(user?.id);
  const removeItems = useRemoveItems(user?.id);
  const placeOrder = usePlaceOrder();
  const checkoutStripe = useStripeCheckout();
  const embeddedCheckout = useEmbeddedCheckout();
  const [paySheet, setPaySheet] = useState<Extract<EmbeddedPay, { clientSecret: string }> | null>(null);
  const paymentsOn = useFeatureEnabled('payments');
  const { canceled } = useLocalSearchParams<{ canceled?: string }>();
  const [placed, setPlaced] = useState(false);
  const [err, setErr] = useState<string | null>(canceled ? 'Payment canceled — your cart is still here.' : null);
  const [method, setMethod] = useState<FulfillmentType | 'in_home'>('delivery');
  const [note, setNote] = useState('');
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState(false);
  const busy = placeOrder.isPending || checkoutStripe.isPending || embeddedCheckout.isPending;
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= BP.desktop;

  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  const prepper = cart?.items[0]?.prepper ?? 'the prepper';
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
    feedback.tap();
    const drop = (cart?.items ?? []).filter((it) => (it.prepperId ?? it.prepper) !== keepKey).map((it) => it.id);
    removeItems.mutate(drop, { onError: () => feedback.error() });
  }

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) { router.back(); } else { router.replace('/'); }
  }

  async function startPayment(orderId: string) {
    try {
      if (Platform.OS === 'web') {
        const r = await embeddedCheckout.mutateAsync(orderId);
        if ('clientSecret' in r) setPaySheet(r);
        else window.location.assign(r.url);
      } else {
        const url = await checkoutStripe.mutateAsync(orderId);
        await WebBrowser.openBrowserAsync(url);
        router.replace('/orders');
      }
    } catch (e) {
      feedback.error();
      setErr((e instanceof Error ? e.message : 'Could not start payment.') + ' Your preorder is saved — pay it from Preorders.');
    }
  }

  function checkout() {
    if (busy) return;
    if (!user) return router.push('/auth?mode=signin');
    if (mixed) { feedback.warning(); return setErr('Pick one kitchen to preorder from above.'); }
    if (method === 'in_home') { feedback.tap(); router.push('/experience-request?kind=private_chef'); return; }
    if (method === 'delivery' && note.trim().length < 5) { feedback.warning(); return setErr('Add a delivery address.'); }
    if (method === 'meetup' && note.trim().length < 3) { feedback.warning(); return setErr('Where should you meet?'); }
    feedback.tap();
    setErr(null);
    placeOrder.mutate(
      { userId: user.id, fulfillment: method, note: note.trim() || null, tip },
      {
        onSuccess: (orderId) => { if (paymentsOn) startPayment(orderId); else setPlaced(true); },
        onError: (e) => { feedback.error(); setErr(e instanceof Error ? e.message : 'Could not place preorder.'); },
      },
    );
  }

  const subtotal = cart?.subtotal ?? 0;
  const deliveryFee = method === 'delivery' ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee + tip;
  const maxPrepTime = (cart?.items ?? []).reduce<number | null>((acc, it) => {
    if (it.prepTime == null) return acc;
    return acc == null ? it.prepTime : Math.max(acc, it.prepTime);
  }, null);
  const noteConfig: Record<FulfillmentType | 'in_home', { label: string; placeholder: string } | null> = {
    delivery: { label: 'Delivery address', placeholder: 'Street, apt, city' },
    meetup: { label: 'Where & when to meet', placeholder: 'e.g. Park gate, today 6pm' },
    pickup: { label: 'Pickup note (optional)', placeholder: 'Any pickup details?' },
    in_home: null,
    home_cook: null, // booked via the separate home-cook flow, not cart checkout
  };

  const paymentSheet = paySheet ? (
    <StripeEmbeddedSheet clientSecret={paySheet.clientSecret} pk={paySheet.pk} onClose={() => { setPaySheet(null); router.replace('/orders'); }} />
  ) : null;

  if (placed) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.surface }}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <MotiView from={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 160 }}>
            <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: Palette.success + '1F', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={36} color={Palette.success} strokeWidth={3} />
            </View>
          </MotiView>
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, textAlign: 'center' }}>Preorder placed!</Text>
          </MotiView>
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
            <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 300 }}>Your preorder is in. The prepper will confirm shortly — track it in your preorders.</Text>
          </MotiView>
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
            <PressableScale onPress={() => { feedback.tap(); router.replace('/orders'); }} accessibilityRole="button" accessibilityLabel="Track your preorder" style={{ marginTop: 6, paddingHorizontal: 24, height: 52, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Track your preorder</Text>
            </PressableScale>
          </MotiView>
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 240, delay: 280 }}>
            <PressableScale onPress={() => { feedback.tap(); router.replace('/'); }} accessibilityRole="button" accessibilityLabel="Back to home" style={{ paddingHorizontal: 24, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.textSecondary }}>Back to home</Text>
            </PressableScale>
          </MotiView>
        </SafeAreaView>
      </View>
    );
  }

  // ─── Shared cart content ──────────────────────────────────────────────────────
  // Rendered inside a ScrollView in both mobile and desktop branches.

  const cartScrollInner = (
    <>
      {mixed ? (
        <View style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.md, padding: 14, gap: 10 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: Palette.brandPressed }}>Items from {kitchens.length} kitchens</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 13, lineHeight: 19, color: Palette.brandPressed }}>You can preorder from one kitchen at a time. Keep one to check out — the other items will be removed.</Text>
          <View style={{ gap: 8, marginTop: 2 }}>
            {kitchens.map((k) => (
              <PressableScale key={k.id} onPress={() => keepOnly(k.id)} disabled={removeItems.isPending} accessibilityRole="button" accessibilityLabel={`Keep only ${k.name}`} style={{ height: 44, borderRadius: Radius.sm, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', opacity: removeItems.isPending ? 0.6 : 1 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>Keep {k.name}</Text>
              </PressableScale>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
            <ChefHat size={18} color={ORANGE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.textSecondary }}>preordering from</Text>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>{prepper}</Text>
          </View>
        </View>
      )}

      {cart?.items.map((it, i) => (
        <MotiView key={it.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 260, delay: i * 50 }}>
          <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {it.image ? <Image source={it.image} style={{ width: 64, height: 64, borderRadius: 12 }} contentFit="cover" /> : <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: Palette.canvas }} />}
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }} numberOfLines={1}>{it.title}</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1 }}>by {it.prepper}</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 16, color: ORANGE, marginTop: 4 }}>{money(it.price_snapshot)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Palette.canvas, borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 4 }}>
              <PressableScale onPress={() => { feedback.tap(); updateItem.mutate({ itemId: it.id, quantity: it.quantity - 1 }, { onError: () => feedback.error() }); }} accessibilityRole="button" accessibilityLabel="Decrease quantity" hitSlop={8} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
                {it.quantity <= 1 ? <Trash2 size={14} color={Palette.danger} /> : <Minus size={14} color={INK} />}
              </PressableScale>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK, minWidth: 18, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{it.quantity}</Text>
              <PressableScale onPress={() => { feedback.tap(); updateItem.mutate({ itemId: it.id, quantity: it.quantity + 1 }, { onError: () => feedback.error() }); }} accessibilityRole="button" accessibilityLabel="Increase quantity" hitSlop={8} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={14} color="#fff" />
              </PressableScale>
            </View>
          </View>
        </MotiView>
      ))}

      <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK, marginTop: 8 }}>How do you want it?</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {METHODS.map((m) => {
          const on = method === m.key;
          return (
            <MotiView key={m.key} animate={{ backgroundColor: on ? Palette.brandTint : Palette.surface, borderColor: on ? ORANGE : Palette.border }} transition={{ type: 'timing', duration: 180 }} style={{ flex: 1, borderWidth: 1.5, borderRadius: Radius.md, overflow: 'hidden' }}>
              <PressableScale onPress={() => { feedback.tap(); setMethod(m.key); setErr(null); }} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${m.label}, ${m.fee}, ${m.eta}`} style={{ flex: 1, paddingTop: 16, paddingBottom: 12, alignItems: 'center', gap: 7 }}>
                {on ? <View style={{ position: 'absolute', top: 7, right: 7, width: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}><Check size={11} color="#fff" strokeWidth={3.5} /></View> : null}
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: on ? ORANGE : Palette.chip, alignItems: 'center', justifyContent: 'center' }}><m.Icon size={20} color={on ? '#fff' : Palette.textSecondary} /></View>
                <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: on ? Palette.brandPressed : INK }}>{m.label}</Text>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: m.fee === 'Free' ? Palette.success : on ? Palette.brandPressed : Palette.textSecondary }}>{m.fee}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: Palette.textMuted, textAlign: 'center' }} numberOfLines={1}>{m.eta}</Text>
              </PressableScale>
            </MotiView>
          );
        })}
      </View>

      <MotiView animate={{ backgroundColor: method === 'in_home' ? INK : Palette.surface, borderColor: method === 'in_home' ? INK : Palette.border }} transition={{ type: 'timing', duration: 200 }} style={{ borderWidth: 1.5, borderRadius: Radius.md, overflow: 'hidden' }}>
        <PressableScale onPress={() => { feedback.tap(); setMethod('in_home'); setErr(null); }} accessibilityRole="button" accessibilityState={{ selected: method === 'in_home' }} accessibilityLabel="Cooked in my kitchen — a prepper visits your home" style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {method === 'in_home' ? <View style={{ position: 'absolute', top: 10, right: 12, width: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}><Check size={11} color="#fff" strokeWidth={3.5} /></View> : null}
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: method === 'in_home' ? ORANGE : Palette.chip, alignItems: 'center', justifyContent: 'center' }}><ChefHat size={22} color={method === 'in_home' ? '#fff' : Palette.textSecondary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: method === 'in_home' ? '#fff' : INK }}>Cooked in my kitchen</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: method === 'in_home' ? Palette.textMuted : Palette.textSecondary, marginTop: 2 }}>A prepper comes to your home and cooks fresh · Request a quote</Text>
          </View>
        </PressableScale>
      </MotiView>

      {method === 'pickup' ? <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Store size={16} color={ORANGE} /><Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Pick up from {prepper}. They&apos;ll share the spot when they confirm.</Text></View> : null}
      {method === 'in_home' ? <View style={{ backgroundColor: Palette.canvas, borderRadius: Radius.md, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}><ChefHat size={15} color={Palette.textMuted} style={{ marginTop: 1 }} /><Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>You&apos;ll post a request and receive quotes from available preppers. Tapping below takes you to the request form.</Text></View> : null}
      {noteConfig[method] ? (
        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>{noteConfig[method]!.label}</Text>
          <TextInput value={note} onChangeText={(t) => { setNote(t); setErr(null); }} placeholder={noteConfig[method]!.placeholder} placeholderTextColor={Palette.textMuted} maxLength={300} style={{ minHeight: 48, backgroundColor: Palette.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Font.body, fontSize: 15, color: INK }} />
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }}>
        <Heart size={16} color={ORANGE} fill={ORANGE} />
        <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>Add a tip</Text>
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>· 100% goes to {prepper}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {TIPS.map((t) => {
          const on = !customTip && tip === t;
          return (
            <MotiView key={t} animate={{ backgroundColor: on ? ORANGE : Palette.surface, borderColor: on ? ORANGE : Palette.border }} transition={{ type: 'timing', duration: 180 }} style={{ flex: 1, borderRadius: Radius.pill, borderWidth: 1.5, overflow: 'hidden' }}>
              <PressableScale onPress={() => { feedback.tap(); setCustomTip(false); setTip(t); }} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={t === 0 ? 'No tip' : `Tip ${money(t)}`} style={{ height: 46, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: on ? '#fff' : INK }}>{t === 0 ? 'None' : money(t)}</Text>
              </PressableScale>
            </MotiView>
          );
        })}
        <MotiView animate={{ backgroundColor: customTip ? Palette.brandTint : Palette.surface, borderColor: customTip ? ORANGE : Palette.border }} transition={{ type: 'timing', duration: 180 }} style={{ flex: 1, borderRadius: Radius.pill, borderWidth: 1.5, overflow: 'hidden' }}>
          <PressableScale onPress={() => { feedback.tap(); setCustomTip(true); setTip(0); }} accessibilityRole="button" accessibilityState={{ selected: customTip }} accessibilityLabel="Custom tip" style={{ height: 46, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: customTip ? Palette.brandPressed : INK }}>Custom</Text>
          </PressableScale>
        </MotiView>
      </View>
      {customTip ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.surface, borderRadius: Radius.md, borderWidth: 1.5, borderColor: ORANGE, paddingHorizontal: 14, height: 50, gap: 6 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK }}>$</Text>
          <TextInput value={tip ? String(tip) : ''} onChangeText={(t) => { const n = Number(t.replace(/[^0-9.]/g, '')); setTip(Number.isFinite(n) ? Math.min(n, 200) : 0); }} placeholder="0" placeholderTextColor={Palette.textMuted} keyboardType="decimal-pad" autoFocus maxLength={6} accessibilityLabel="Custom tip amount" style={{ flex: 1, fontFamily: Font.display, fontSize: 20, color: INK }} />
        </View>
      ) : null}
      {err ? (
        <MotiView from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220 }}>
          <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.danger, textAlign: 'center' }}>{err}</Text>
        </MotiView>
      ) : null}
    </>
  );

  const cartSummary = (
    <>
      {/* Line items */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Subtotal</Text>
        <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK, fontVariant: ['tabular-nums'] }}>{money(subtotal)}</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>{method === 'delivery' ? 'Delivery fee' : method === 'in_home' ? 'In-home prep' : 'Pickup / meet up'}</Text>
        <Text style={{ fontFamily: Font.medium, fontSize: 13, color: method === 'in_home' ? Palette.textSecondary : deliveryFee ? INK : Palette.success, fontVariant: ['tabular-nums'] }}>{method === 'in_home' ? 'Quoted' : deliveryFee ? money(deliveryFee) : 'Free'}</Text>
      </View>
      {tip > 0 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Tip</Text>
          <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK, fontVariant: ['tabular-nums'] }}>{money(tip)}</Text>
        </View>
      ) : null}

      {maxPrepTime ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Est. prep time</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Clock size={13} color={Palette.textSecondary} />
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK }}>{Math.max(maxPrepTime - 5, 5)}–{maxPrepTime + 5} min</Text>
          </View>
        </View>
      ) : null}

      {/* Total — big and scannable */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderTopWidth: 1, borderTopColor: Palette.border, marginTop: 8, paddingTop: 14, marginBottom: 20 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.textSecondary }}>Total due</Text>
        <Text style={{ fontFamily: Font.display, fontSize: 28, color: INK, letterSpacing: -0.8, fontVariant: ['tabular-nums'] }}>{money(total)}</Text>
      </View>

      {/* CTA — spring in, orange glow, two-line layout prevents text overflow */}
      <MotiView from={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 16, stiffness: 200, delay: 80 }}>
        <PressableScale
          onPress={checkout}
          disabled={busy || mixed}
          accessibilityRole="button"
          accessibilityLabel={mixed ? 'Pick one kitchen to continue' : paymentsOn ? `Pay ${money(total)} securely` : `Place preorder for ${money(total)}`}
          style={{
            minHeight: 62, borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 20,
            backgroundColor: mixed ? Palette.chip : ORANGE,
            flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center',
            opacity: busy ? 0.72 : 1,
            ...(mixed ? {} : { shadowColor: ORANGE, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8 }),
          }}>
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : mixed ? (
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.textSecondary, textAlign: 'center' }}>Pick one kitchen above ↑</Text>
          ) : (
            <>
              {paymentsOn ? <Lock size={18} color="rgba(255,255,255,0.88)" /> : <ShoppingBag size={18} color="rgba(255,255,255,0.88)" />}
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 17, color: '#fff', letterSpacing: -0.2 }}>
                  {method === 'in_home' ? 'Request in-home prep' : paymentsOn ? 'Pay securely' : 'Place preorder'}
                </Text>
                {method !== 'in_home' ? (
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                    {money(total)}{paymentsOn ? ' · secured by Stripe' : ' · pay when confirmed'}
                  </Text>
                ) : null}
              </View>
              <ChevronRight size={20} color="rgba(255,255,255,0.55)" />
            </>
          )}
        </PressableScale>
      </MotiView>
      <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textMuted, textAlign: 'center', marginTop: 10 }}>
        {paymentsOn ? 'Auto-refunded if your preorder is declined.' : 'Payment collected when the prepper confirms.'}
      </Text>
    </>
  );

  // ─── Main return ──────────────────────────────────────────────────────────────

  const refreshCtrl = <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>your cart</Text>
        </View>

        {!user ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <ShoppingBag size={28} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Sign in to start a preorder.</Text>
            <PressableScale onPress={() => { feedback.tap(); router.push('/auth?mode=signin'); }} accessibilityRole="button" accessibilityLabel="Sign in" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Sign in</Text>
            </PressableScale>
          </View>
        ) : isLoading ? (
          <ListSkeleton count={3} />
        ) : !cart?.items.length ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}><ShoppingBag size={28} color={Palette.textMuted} /></View>
            {canceled ? (
              <>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>Payment canceled</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 300 }}>Your preorder is saved. You can finish paying for it any time in your preorders.</Text>
                <PressableScale onPress={() => { feedback.tap(); router.replace('/orders'); }} accessibilityRole="button" accessibilityLabel="Go to preorders" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Go to preorders</Text></PressableScale>
                <PressableScale onPress={() => { feedback.tap(); router.replace('/explore'); }} accessibilityRole="button" accessibilityLabel="Browse meals" style={{ paddingHorizontal: 22, height: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.textSecondary }}>Browse meals</Text></PressableScale>
              </>
            ) : (
              <>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>Your cart is empty</Text>
                <PressableScale onPress={() => { feedback.tap(); router.replace('/explore'); }} accessibilityRole="button" accessibilityLabel="Browse meals" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Browse meals</Text></PressableScale>
              </>
            )}
          </View>
        ) : isDesktop ? (
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} refreshControl={refreshCtrl} contentContainerStyle={{ padding: 24, gap: 12, paddingBottom: 24 }}>
              {cartScrollInner}
            </ScrollView>
            <View style={{ width: 340, backgroundColor: Palette.surface, borderLeftWidth: 1, borderLeftColor: Palette.border, padding: 24, paddingTop: 32 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 18, color: INK, marginBottom: 20, letterSpacing: -0.3 }}>Order summary</Text>
              {cartSummary}
            </View>
          </View>
        ) : (
          <>
            <ScrollView showsVerticalScrollIndicator={false} refreshControl={refreshCtrl} contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 20 }}>
              {cartScrollInner}
            </ScrollView>
            <SafeAreaView edges={['bottom']} style={{ backgroundColor: Palette.surface, borderTopWidth: 1, borderTopColor: Palette.chip, paddingHorizontal: 20, paddingTop: 14 }}>
              {cartSummary}
            </SafeAreaView>
          </>
        )}
      </SafeAreaView>
      {paymentSheet}
    </View>
  );
}
