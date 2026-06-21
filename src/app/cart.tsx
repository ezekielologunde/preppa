import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Bike, CalendarClock, Check, ChevronLeft, MapPin, ShoppingBag, Store } from 'lucide-react-native';
import { MotiView } from 'moti';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartPlacedScreen } from '@/components/cart/cart-placed-screen';
import { CartSummary } from '@/components/cart/cart-summary';
import { DiscountInputs } from '@/components/cart/discount-inputs';
import { GroupedKitchenSection } from '@/components/cart/grouped-kitchen-section';
import { TipSelector } from '@/components/cart/tip-selector';
import { DeliveryAddressPicker } from '@/components/delivery-address-picker';
import { SchedulePickerModal, SCHEDULE_DATES } from '@/components/schedule-picker-modal';
import { PressableScale } from '@/components/ui/pressable-scale';
import { StripeEmbeddedSheet } from '@/components/stripe-embedded';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { BP } from '@/lib/layout';
import { Palette, Radius } from '@/constants/theme';
import { useCart, useEmbeddedCheckout, usePlaceOrder, usePlaceMultipleOrders, useStripeCheckout, type EmbeddedPay } from '@/lib/queries/cart';
import { useFeatureEnabled } from '@/lib/queries/feature-flags';
import { validatePromoCode, computeDiscount, type PromoResult } from '@/lib/queries/promos';
import { useValidateGiftCard, type GiftCard } from '@/lib/queries/gift-cards';
import { useAuth } from '@/providers/auth-provider';
import type { FulfillmentType } from '@/types/database.types';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const DELIVERY_FEE_FALLBACK = 3.99;
const money = (n: number) => `$${n.toFixed(2)}`;

type IconType = ComponentType<{ size?: number; color?: string }>;
type Method = { key: FulfillmentType; label: string; Icon: IconType; fee: string; eta: string };

export default function CartScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: cart, isLoading, isError, refetch } = useCart(user?.id);
  const placeOrder = usePlaceOrder();
  const placeMultiple = usePlaceMultipleOrders();
  const checkoutStripe = useStripeCheckout();
  const embeddedCheckout = useEmbeddedCheckout();
  const [paySheet, setPaySheet] = useState<Extract<EmbeddedPay, { clientSecret: string }> | null>(null);
  const paymentsOn = useFeatureEnabled('payments');
  const { canceled } = useLocalSearchParams<{ canceled?: string }>();
  const [placed, setPlaced] = useState(false);
  const [err, setErr] = useState<string | null>(canceled ? 'Payment canceled — your cart is still here.' : null);
  const [method, setMethod] = useState<FulfillmentType | 'in_home'>('delivery');
  const [addressId, setAddressId] = useState<string | null>(null);
  const [multiProgress, setMultiProgress] = useState<{ done: number; total: number; current: string } | null>(null);

  // Persist + restore the last chosen fulfillment method per user
  const storageKey = user?.id ? `preppa:last_method:${user.id}` : null;
  const prepperId = cart?.items[0]?.prepperId ?? null;
  useEffect(() => {
    if (!cart || !storageKey) return;
    let active = true;
    AsyncStorage.getItem(storageKey).then((saved) => {
      if (!active) return;
      if (saved === 'delivery' && cart.delivers) { setMethod('delivery'); return; }
      if (saved === 'pickup' && cart.pickup) { setMethod('pickup'); return; }
      if (saved === 'meetup' || saved === 'in_home') { setMethod(saved as FulfillmentType | 'in_home'); return; }
      if (cart.delivers) setMethod('delivery');
      else if (cart.pickup) setMethod('pickup');
      else setMethod('meetup');
    });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepperId, storageKey]);

  function selectMethod(m: FulfillmentType | 'in_home') {
    setMethod(m);
    setErr(null);
    if (storageKey) AsyncStorage.setItem(storageKey, m).catch(() => {});
  }

  const [promoInput, setPromoInput] = useState('');
  const [promo, setPromo] = useState<PromoResult | null>(null);
  const [promoErr, setPromoErr] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const [giftInput, setGiftInput] = useState('');
  const [giftCard, setGiftCard] = useState<GiftCard | null>(null);
  const [giftErr, setGiftErr] = useState<string | null>(null);
  const validateGiftCard = useValidateGiftCard();

  const [note, setNote] = useState('');
  const [tip, setTip] = useState(2);
  const [customTip, setCustomTip] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<Date | null>(null);
  const [scheduleModal, setScheduleModal] = useState(false);
  const [pickDate, setPickDate] = useState(0);
  const [pickHour, setPickHour] = useState(12);
  const [pickMinute, setPickMinute] = useState(0);

  const [paymentPending, setPaymentPending] = useState(false);
  const [showCancelPayment, setShowCancelPayment] = useState(false);
  const busy = placeOrder.isPending || placeMultiple.isPending || checkoutStripe.isPending || embeddedCheckout.isPending;
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width >= BP.desktop;

  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  useEffect(() => {
    if (!paymentPending) return;
    const t = setTimeout(() => {
      setPaymentPending(false);
      setErr('Payment timed out — your preorder is saved. Complete payment from Orders.');
    }, 12000);
    return () => clearTimeout(t);
  }, [paymentPending]);

  useEffect(() => {
    if (!paymentPending) { setShowCancelPayment(false); return; }
    const t = setTimeout(() => setShowCancelPayment(true), 3000);
    return () => clearTimeout(t);
  }, [paymentPending]);

  // ⚠️ This fallback may not match the actual fee charged. Only show when cart.deliveryFee is confirmed.
  const deliveryFeeAmt = cart?.deliveryFee ?? DELIVERY_FEE_FALLBACK;

  // Group cart items by prepperId
  const kitchenGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; deliveryMinOrder: number; items: import('@/lib/queries/cart').CartItem[] }>();
    for (const it of cart?.items ?? []) {
      const key = it.prepperId ?? it.prepper;
      if (!map.has(key)) map.set(key, { id: key, name: it.prepper, deliveryMinOrder: it.deliveryMinOrder, items: [] });
      map.get(key)!.items.push(it);
    }
    return [...map.values()];
  }, [cart?.items]);

  const mixed = kitchenGroups.length > 1;
  const prepper = kitchenGroups[0]?.name ?? 'the prepper';

  const methods = useMemo<Method[]>(() => {
    const all: Method[] = [
      { key: 'delivery', label: 'Delivery', Icon: Bike, fee: cart?.deliveryFee !== undefined ? money(cart.deliveryFee) : '—', eta: 'drop-off scheduled' },
      { key: 'pickup', label: 'Pickup', Icon: Store, fee: 'Free', eta: 'pickup window' },
      { key: 'meetup', label: 'Meet up', Icon: MapPin, fee: 'Free', eta: 'you pick a spot' },
    ];
    return all.filter((m) =>
      m.key === 'meetup' ||
      (m.key === 'delivery' && (cart?.delivers ?? true)) ||
      (m.key === 'pickup' && (cart?.pickup ?? true))
    );
  }, [deliveryFeeAmt, cart?.delivers, cart?.pickup]);

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) { router.back(); } else { router.replace('/'); }
  }

  async function applyPromo() {
    if (!promoInput.trim()) return;
    setPromoErr(null);
    setPromoLoading(true);
    try {
      const result = await validatePromoCode(promoInput, subtotal);
      if (!result) {
        feedback.error();
        setPromoErr('Invalid or expired code.');
      } else {
        feedback.success();
        setPromo(result);
      }
    } finally {
      setPromoLoading(false);
    }
  }

  async function applyGiftCard() {
    if (!giftInput.trim()) return;
    setGiftErr(null);
    try {
      const card = await validateGiftCard.mutateAsync(giftInput);
      if (!card) {
        feedback.error();
        setGiftErr('Invalid or already redeemed gift card.');
      } else {
        feedback.success();
        setGiftCard(card);
      }
    } catch {
      feedback.error();
      setGiftErr('Could not validate gift card.');
    }
  }

  async function startPayment(orderId: string) {
    setPaymentPending(true);
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
      if ((e as { alreadyPaid?: boolean }).alreadyPaid) {
        feedback.success();
        router.replace('/orders');
        return;
      }
      feedback.error();
      setErr((e instanceof Error ? e.message : 'Could not start payment.') + ' Your preorder is saved — pay it from Preorders.');
    } finally {
      setPaymentPending(false);
    }
  }

  function checkout() {
    if (busy || !user) { if (!user) router.push('/auth?mode=signin'); return; }
    if (method === 'delivery' && !addressId) { feedback.warning(); return setErr('Select a delivery address.'); }
    if (method === 'meetup' && note.trim().length < 3) { feedback.warning(); return setErr('Where should you meet?'); }
    feedback.tap();
    setErr(null);
    const sched = scheduleEnabled && scheduledAt ? scheduledAt.toISOString() : null;

    if (mixed && (method as string) !== 'in_home') {
      // Multi-kitchen: place one sub-order per kitchen sequentially
      setMultiProgress({ done: 0, total: kitchenGroups.length, current: kitchenGroups[0]?.name ?? '' });
      placeMultiple.mutate(
        {
          userId: user.id,
          groups: kitchenGroups.map((g) => ({
            prepperId: g.id,
            prepperName: g.name,
            items: g.items,
            fulfillment: method as FulfillmentType,
            addressId: method === 'delivery' ? addressId : null,
            note: note.trim() || null,
            tip,
            scheduledAt: sched,
          })),
          onProgress: (done, total, kitchenName) =>
            setMultiProgress({ done, total, current: kitchenName }),
        },
        {
          onSuccess: async (results) => {
            setMultiProgress(null);
            if (paymentsOn && results.length > 0) {
              // Pay for the first order (Stripe creates separate sessions per order)
              await startPayment(results[0].orderId);
            } else {
              setPlaced(true);
            }
          },
          onError: (e) => {
            setMultiProgress(null);
            feedback.error();
            const msg = e instanceof Error ? e.message : 'Could not place all orders.';
            setErr(msg);
          },
        },
      );
    } else {
      // Single kitchen: original flow
      placeOrder.mutate(
        { userId: user.id, fulfillment: method as FulfillmentType, addressId: method === 'delivery' ? addressId : null, note: note.trim() || null, tip, scheduledAt: sched, giftCardCode: giftCard?.code ?? null, giftCardAmount: giftCardDiscount > 0 ? giftCardDiscount : 0 },
        {
          onSuccess: (orderId) => { if (paymentsOn) startPayment(orderId); else setPlaced(true); },
          onError: (e) => { feedback.error(); setErr(e instanceof Error ? e.message : 'Could not place preorder.'); },
        },
      );
    }
  }

  const hasUnavailable = (cart?.items ?? []).some((it) => !it.available);
  const subtotal = cart?.subtotal ?? 0;
  const deliveryFee = method === 'delivery' ? deliveryFeeAmt : 0;
  const deliveryMinOrder = cart?.deliveryMinOrder ?? 0;
  const minOrderWarn = !mixed && method === 'delivery' && deliveryMinOrder > 0 && subtotal < deliveryMinOrder
    ? `${prepper} requires a ${money(deliveryMinOrder)} minimum for delivery`
    : null;
  const discount = promo ? computeDiscount(promo, subtotal) : 0;
  const giftCardDiscount = giftCard ? Math.min(giftCard.balance, Math.max(0, subtotal + deliveryFee + tip - discount)) : 0;
  const total = Math.max(0, subtotal + deliveryFee + tip - discount - giftCardDiscount);
  const maxPrepTime = (cart?.items ?? []).reduce<number | null>((acc, it) => {
    if (it.prepTime == null) return acc;
    return acc == null ? it.prepTime : Math.max(acc, it.prepTime);
  }, null);
  const noteConfig: Record<FulfillmentType | 'in_home', { label: string; placeholder: string } | null> = {
    delivery: { label: 'Delivery instructions (optional)', placeholder: 'e.g. Leave at door, ring doorbell' },
    meetup: { label: 'Where & when to meet', placeholder: 'e.g. Park gate, today 6pm' },
    pickup: { label: 'Pickup note (optional)', placeholder: 'Any pickup details?' },
    in_home: null,
    home_cook: null,
  };

  function formatScheduled(d: Date) { return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function openSchedulePicker() {
    const base = scheduledAt ?? SCHEDULE_DATES[0];
    const idx = SCHEDULE_DATES.findIndex((d) => d.toDateString() === base.toDateString());
    setPickDate(idx < 0 ? 0 : idx); setPickHour(scheduledAt ? scheduledAt.getHours() : 12);
    setPickMinute(scheduledAt ? Math.round(scheduledAt.getMinutes() / 15) * 15 % 60 : 0);
    setScheduleModal(true);
  }
  function confirmSchedule() {
    const chosen = new Date(SCHEDULE_DATES[pickDate]);
    chosen.setHours(pickHour, pickMinute, 0, 0); setScheduledAt(chosen); setScheduleModal(false); feedback.success();
  }
  function clearSchedule() { setScheduleEnabled(false); setScheduledAt(null); }

  const paymentSheet = paySheet ? (
    <StripeEmbeddedSheet clientSecret={paySheet.clientSecret} pk={paySheet.pk} onClose={() => { setPaySheet(null); router.replace('/orders'); }} />
  ) : null;

  if (placed) {
    return <CartPlacedScreen onTrack={() => { feedback.tap(); router.replace('/orders'); }} onHome={() => { feedback.tap(); router.replace('/'); }} />;
  }

  // ─── Cart scroll content ──────────────────────────────────────────────────────
  const cartScrollInner = (
    <>
      {/* Grouped kitchen sections */}
      {kitchenGroups.map((group, gi) => {
        const itemsBefore = kitchenGroups.slice(0, gi).reduce((s, g) => s + g.items.length, 0);
        return (
          <GroupedKitchenSection
            key={group.id}
            kitchenName={group.name}
            items={group.items}
            userId={user!.id}
            startIndex={itemsBefore}
            mixed={mixed}
            deliveryMinOrder={group.deliveryMinOrder}
            method={method}
          />
        );
      })}

      <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK, marginTop: 4 }}>How do you want it?</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {methods.map((m) => {
          const on = method === m.key;
          return (
            <MotiView key={m.key} animate={{ backgroundColor: on ? Palette.brandTint : Palette.surface, borderColor: on ? ORANGE : Palette.border }} transition={{ type: 'timing', duration: 180 }} style={{ flex: 1, borderWidth: 1.5, borderRadius: Radius.md, overflow: 'hidden' }}>
              <PressableScale onPress={() => { feedback.tap(); selectMethod(m.key); }} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${m.label}, ${m.fee}, ${m.eta}`} style={{ flex: 1, paddingTop: 16, paddingBottom: 12, alignItems: 'center', gap: 7 }}>
                {on ? <View style={{ position: 'absolute', top: 7, right: 7, width: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}><Check size={11} color="#fff" strokeWidth={3.5} /></View> : null}
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: on ? ORANGE : Palette.chip, alignItems: 'center', justifyContent: 'center' }}><m.Icon size={20} color={on ? '#fff' : Palette.textSecondary} /></View>
                <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: on ? Palette.brandPressed : INK }}>{m.label}</Text>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: m.fee === 'Free' ? Palette.success : on ? Palette.brandPressed : Palette.textSecondary }}>{m.fee}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: Palette.textSecondary, textAlign: 'center' }} numberOfLines={1}>{m.eta}</Text>
              </PressableScale>
            </MotiView>
          );
        })}
      </View>

      {method === 'pickup' ? <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}><Store size={16} color={ORANGE} /><Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Pick up from {prepper}. They&apos;ll share the spot when they confirm.</Text></View> : null}
      {method === 'delivery' && user ? (
        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>Delivery address</Text>
          <DeliveryAddressPicker userId={user.id} selectedId={addressId} onSelect={(id) => { setAddressId(id); setErr(null); }} />
        </View>
      ) : null}
      {minOrderWarn ? (
        <View style={{ backgroundColor: Palette.amber + '18', borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10 }}>
          <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.amber }}>{minOrderWarn}</Text>
        </View>
      ) : null}
      {noteConfig[method] ? (
        <View style={{ gap: 6 }}>
          <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>{noteConfig[method]!.label}</Text>
          <TextInput value={note} onChangeText={(t) => { setNote(t); setErr(null); }} placeholder={noteConfig[method]!.placeholder} placeholderTextColor={Palette.textSecondary} maxLength={300} accessibilityLabel={noteConfig[method]!.label} style={{ minHeight: 48, backgroundColor: Palette.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: Font.body, fontSize: 15, color: INK }} />
          {method === 'meetup' && <Text style={{ fontSize: 12, color: Palette.textSecondary, marginTop: 4, fontFamily: Font.body }}>* Required for meetup orders</Text>}
        </View>
      ) : null}

      {/* Schedule for later */}
      <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, overflow: 'hidden' }}>
        <PressableScale
          onPress={() => { feedback.tap(); if (scheduleEnabled) { clearSchedule(); } else { setScheduleEnabled(true); openSchedulePicker(); } }}
          accessibilityRole="button"
          accessibilityLabel={scheduleEnabled ? 'Remove scheduled time' : 'Schedule this preorder for later'}
          style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: scheduleEnabled ? ORANGE : Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
            <CalendarClock size={20} color={scheduleEnabled ? '#fff' : Palette.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK }}>Schedule for later</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 2 }}>
              {scheduleEnabled && scheduledAt ? formatScheduled(scheduledAt) : 'Pick a date & time (up to 7 days ahead)'}
            </Text>
          </View>
          {scheduleEnabled ? <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}><Check size={11} color="#fff" strokeWidth={3.5} /></View> : null}
        </PressableScale>
        {scheduleEnabled && scheduledAt ? (
          <PressableScale onPress={() => { feedback.tap(); openSchedulePicker(); }} accessibilityRole="button" accessibilityLabel="Change scheduled time" style={{ marginHorizontal: 16, marginBottom: 14, height: 36, borderRadius: Radius.sm, borderWidth: 1, borderColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>Change time</Text>
          </PressableScale>
        ) : null}
      </View>

      <DiscountInputs
        promoInput={promoInput}
        setPromoInput={(t) => { setPromoInput(t); setPromoErr(null); }}
        promo={promo}
        promoErr={promoErr}
        promoLoading={promoLoading}
        onApplyPromo={applyPromo}
        onRemovePromo={() => { feedback.tap(); setPromo(null); setPromoInput(''); setPromoErr(null); }}
        giftInput={giftInput}
        setGiftInput={(t) => { setGiftInput(t); setGiftErr(null); }}
        giftCard={giftCard}
        giftCardDiscount={giftCardDiscount}
        giftErr={giftErr}
        giftCardPending={validateGiftCard.isPending}
        onApplyGiftCard={() => { void applyGiftCard(); }}
        onRemoveGiftCard={() => { feedback.tap(); setGiftCard(null); setGiftInput(''); setGiftErr(null); }}
      />

      <TipSelector tip={tip} setTip={setTip} customTip={customTip} setCustomTip={setCustomTip} prepper={prepper} />
      {err ? (
        <MotiView from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220 }}>
          <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.danger, textAlign: 'center' }}>{err}</Text>
        </MotiView>
      ) : null}
    </>
  );

  // ─── Order summary + CTA ──────────────────────────────────────────────────────
  const ctaLabel = (() => {
    if (method === 'in_home') return 'Request in-home prep';
    if (mixed) return `Pay ${kitchenGroups.length} kitchens`;
    return paymentsOn ? 'Pay securely' : 'Place preorder';
  })();

  const cartSummary = (
    <CartSummary
      subtotal={subtotal}
      method={method}
      deliveryFee={deliveryFee}
      tip={tip}
      maxPrepTime={maxPrepTime}
      total={total}
      discount={discount}
      giftCardDiscount={giftCardDiscount}
      multiProgress={multiProgress}
      kitchenGroups={kitchenGroups}
      mixed={mixed}
      busy={busy}
      hasUnavailable={hasUnavailable}
      paymentsOn={paymentsOn}
      ctaLabel={ctaLabel}
      onCheckout={checkout}
    />
  );

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
            <ShoppingBag size={28} color={Palette.textSecondary} />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Sign in to start a preorder.</Text>
            <PressableScale onPress={() => { feedback.tap(); router.push('/auth?mode=signin'); }} accessibilityRole="button" accessibilityLabel="Sign in" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Sign in</Text>
            </PressableScale>
          </View>
        ) : isLoading ? (
          <ListSkeleton count={3} />
        ) : isError ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}><ShoppingBag size={28} color={Palette.textSecondary} /></View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>Couldn't load your cart</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 }}>Check your connection and try again.</Text>
            <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading cart" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>retry</Text>
            </PressableScale>
          </MotiView>
        ) : !cart?.items.length ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}><ShoppingBag size={28} color={Palette.textSecondary} /></View>
            {canceled ? (
              <>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>Payment canceled</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 300 }}>Your preorder is saved. You can finish paying for it any time in your preorders.</Text>
                <PressableScale onPress={() => { feedback.tap(); router.replace('/orders'); }} accessibilityRole="button" accessibilityLabel="Go to preorders" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Go to preorders</Text></PressableScale>
                <PressableScale onPress={() => { feedback.tap(); router.replace('/'); }} accessibilityRole="button" accessibilityLabel="Browse meals" style={{ paddingHorizontal: 22, height: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.textSecondary }}>Browse meals</Text></PressableScale>
              </>
            ) : (
              <>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>Your cart is empty</Text>
                <PressableScale onPress={() => { feedback.tap(); router.replace('/'); }} accessibilityRole="button" accessibilityLabel="Browse meals" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Browse meals</Text></PressableScale>
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
      <SchedulePickerModal visible={scheduleModal} pickDate={pickDate} pickHour={pickHour} pickMinute={pickMinute} onDateChange={setPickDate} onHourChange={setPickHour} onMinuteChange={setPickMinute} onConfirm={confirmSchedule} onClose={() => setScheduleModal(false)} />
      <Modal visible={paymentPending} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' }}>
          <MotiView from={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 15 }} style={{ backgroundColor: '#1a1a1a', borderRadius: 20, padding: 32, alignItems: 'center', width: 260 }}>
            <MotiView from={{ scale: 1 }} animate={{ scale: 1.2 }} transition={{ type: 'timing', duration: 900, loop: true }} style={{ position: 'absolute', width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: Palette.brand + '40', top: 20 }} />
            <ActivityIndicator size="large" color={Palette.brand} style={{ marginBottom: 16 }} />
            <Text style={{ fontFamily: Font.heading, fontSize: 18, color: '#ffffff', marginBottom: 8, textAlign: 'center' }}>Taking you to payment</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: '#999999', textAlign: 'center' }}>Preppa secures your transaction</Text>
            {showCancelPayment && (
              <Pressable onPress={() => { setPaymentPending(false); router.push('/orders'); }}
                style={{ marginTop: 24 }}
                accessibilityRole="button" accessibilityLabel="Cancel payment">
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: Font.medium }}>
                  Cancel — your preorder is saved
                </Text>
              </Pressable>
            )}
          </MotiView>
        </View>
      </Modal>
    </View>
  );
}
