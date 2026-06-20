import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ChefHat, ChevronLeft, ChevronRight, CreditCard, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { PaymentRedirectOverlay } from '@/components/payment-redirect-overlay';
import { BottomActionBar } from '@/components/ui/bottom-action-bar';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useCustomPlan, type CustomPlanItem } from '@/lib/queries/custom-meal-plans';
import { useFeatureEnabled } from '@/lib/queries/feature-flags';
import { supabase } from '@/lib/supabase';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DAY_LABEL: Record<string, string> = {
  mon: 'Mondays', tue: 'Tuesdays', wed: 'Wednesdays', thu: 'Thursdays',
  fri: 'Fridays', sat: 'Saturdays', sun: 'Sundays',
};

type PrepperGroup = {
  prepperId: string;
  prepperName: string;
  prepperImageUrl: string | null;
  items: CustomPlanItem[];
  subtotal: number;
};

function groupByPrepper(items: CustomPlanItem[]): PrepperGroup[] {
  const map = new Map<string, PrepperGroup>();
  for (const item of items) {
    const p = item.meal?.prepper;
    if (!p) continue;
    if (!map.has(p.id)) {
      map.set(p.id, { prepperId: p.id, prepperName: p.display_name, prepperImageUrl: p.image_url, items: [], subtotal: 0 });
    }
    const g = map.get(p.id)!;
    g.items.push(item);
    g.subtotal += (item.meal?.base_price ?? 0) * item.qty;
  }
  return [...map.values()];
}

// ─── Drill-down modal ──────────────────────────────────────────────────────────

function DrillDownModal({ item, deliveryDay, paymentsOn, onPay, paying, onClose }: {
  item: CustomPlanItem | null;
  deliveryDay: string;
  paymentsOn: boolean;
  onPay: () => void;
  paying: boolean;
  onClose: () => void;
}) {
  if (!item?.meal) return null;
  const { meal, qty } = item;
  const img = meal.images?.[0]?.url;
  const prepper = meal.prepper;
  const total = meal.base_price * qty;

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <BlurView intensity={18} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Pressable onPress={(e) => e.stopPropagation()} accessible={false}
          style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 40, gap: 16, width: '100%', maxWidth: 480, alignSelf: 'center' }}>

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.5, flex: 1 }} numberOfLines={2}>{meal.title}</Text>
            <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center', marginLeft: 10 }}>
              <X size={17} color={INK} />
            </PressableScale>
          </View>

          {img ? (
            <Image source={{ uri: img }} style={{ width: '100%', height: 180, borderRadius: 18 }} contentFit="cover" transition={200} />
          ) : (
            <View style={{ height: 110, borderRadius: 18, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
              <ChefHat size={28} color={Palette.textSecondary} />
            </View>
          )}

          {prepper && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Palette.canvas, borderRadius: 16, padding: 12 }}>
              <Avatar name={prepper.display_name} url={prepper.image_url} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{prepper.display_name}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>Delivered {DAY_LABEL[deliveryDay] ?? deliveryDay}</Text>
              </View>
            </View>
          )}

          <View style={{ backgroundColor: Palette.canvas, borderRadius: 16, padding: 14, gap: 10 }}>
            {[
              { label: 'Price per serving', value: money(meal.base_price) },
              { label: 'Quantity', value: `×${qty}` },
              { label: 'Your total / cycle', value: money(total), accent: true },
            ].map(({ label, value, accent }) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary }}>{label}</Text>
                <Text style={{ fontFamily: accent ? Font.heading : Font.semibold, fontSize: accent ? 15 : 13.5, color: accent ? ORANGE : INK }}>{value}</Text>
              </View>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel="Done"
              style={{ flex: 1, height: 50, borderRadius: Radius.pill, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Palette.border }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>Done</Text>
            </PressableScale>
            {paymentsOn && (
              <PressableScale onPress={onPay} disabled={paying}
                accessibilityRole="button" accessibilityLabel="Pay for this meal"
                style={{ flex: 1, height: 50, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: paying ? 0.7 : 1 }}>
                {paying ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>Pay {money(total)}</Text>
                )}
              </PressableScale>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Chef group section ────────────────────────────────────────────────────────

function ChefSection({ group, deliveryDay, onItemPress, onPayChef, paying, paymentsOn, isPaused }: {
  group: PrepperGroup;
  deliveryDay: string;
  onItemPress: (item: CustomPlanItem) => void;
  onPayChef: () => void;
  paying: boolean;
  paymentsOn: boolean;
  isPaused: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={group.prepperName} url={group.prepperImageUrl} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>{group.prepperName}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>
            {group.items.length} meal{group.items.length !== 1 ? 's' : ''} · {money(group.subtotal)}/cycle
          </Text>
        </View>
        {(paymentsOn || isPaused) && (
          <PressableScale onPress={() => { feedback.tap(); onPayChef(); }} disabled={paying}
            accessibilityRole="button" accessibilityLabel={`Pay ${group.prepperName}`}
            style={{ paddingHorizontal: 12, height: 34, borderRadius: Radius.pill, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: ORANGE + '40' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: ORANGE }}>
              {isPaused ? 'Resume' : 'Pay chef'}
            </Text>
          </PressableScale>
        )}
      </View>

      {group.items.map((item) => {
        const meal = item.meal;
        if (!meal) return null;
        const img = meal.images?.[0]?.url;
        return (
          <PressableScale key={item.id} onPress={() => { feedback.tap(); onItemPress(item); }}
            accessibilityRole="button" accessibilityLabel={`View ${meal.title}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Palette.surface, borderRadius: 16, padding: 12 }}>
            {img
              ? <Image source={{ uri: img }} style={{ width: 62, height: 62, borderRadius: 12 }} contentFit="cover" transition={200} />
              : <View style={{ width: 62, height: 62, borderRadius: 12, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}><ChefHat size={20} color={Palette.textSecondary} /></View>
            }
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }} numberOfLines={1}>{meal.title}</Text>
              {item.qty > 1 && <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>×{item.qty} servings</Text>}
              <Text style={{ fontFamily: Font.heading, fontSize: 13, color: ORANGE, marginTop: 2 }}>{money(meal.base_price * item.qty)}/cycle</Text>
            </View>
            <ChevronRight size={16} color={Palette.textSecondary} />
          </PressableScale>
        );
      })}
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function CustomPlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const paymentsOn = useFeatureEnabled('payments');
  const { data: plan, isLoading, isError, refetch } = useCustomPlan(id);
  const [refreshing, setRefreshing] = useState(false);
  const [drillItem, setDrillItem] = useState<CustomPlanItem | null>(null);
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);

  const groups = useMemo(() => groupByPrepper(plan?.items ?? []), [plan?.items]);
  const planTotal = groups.reduce((s, g) => s + g.subtotal, 0);
  const isPaused = plan?.status === 'paused';

  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  async function triggerPayment() {
    if (!plan || paying) return;
    feedback.tap();
    setPaying(true);
    setPayErr(null);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-subscribe', {
        body: { type: 'custom_plan', planId: plan.id },
      });
      if (error || !data?.url) throw new Error(error?.message ?? 'Checkout failed');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = data.url;
      } else {
        await WebBrowser.openBrowserAsync(data.url);
      }
    } catch {
      feedback.error();
      setPayErr('Could not process payment. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  function goBack() { feedback.tap(); if (router.canGoBack()) router.back(); else router.replace('/meal-plans'); }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
            <Skeleton width={40} height={40} radius={20} />
            <Skeleton width={160} height={22} radius={8} />
          </View>
          <View style={{ padding: 20, gap: 16 }}>
            <Skeleton width="100%" height={96} radius={16} />
            <Skeleton width="100%" height={130} radius={16} />
            <Skeleton width="100%" height={130} radius={16} />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const backBtn = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
      <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
        <ChevronLeft size={22} color={INK} />
      </PressableScale>
    </View>
  );

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          {backBtn}
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <ChefHat size={28} color={Palette.textSecondary} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>couldn't load plan</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>
              Check your connection and try again.
            </Text>
            <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading plan"
              style={{ marginTop: 6, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>retry</Text>
            </PressableScale>
          </MotiView>
        </SafeAreaView>
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          {backBtn}
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 300 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <ChefHat size={28} color={ORANGE} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>setting up your plan…</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>
              This usually takes a moment. Tap below if it doesn't appear.
            </Text>
            <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Refresh plan"
              style={{ marginTop: 6, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>refresh</Text>
            </PressableScale>
          </MotiView>
        </SafeAreaView>
      </View>
    );
  }

  const nextDate = plan.next_billing_at
    ? new Date(plan.next_billing_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : null;
  const showPayCta = paymentsOn || isPaused;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5 }} numberOfLines={1}>{plan.name}</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary }}>
              {plan.frequency} · {DAY_LABEL[plan.delivery_day] ?? plan.delivery_day}
            </Text>
          </View>
          <View style={{
            backgroundColor: isPaused ? Palette.amber + '26' : Palette.success + '1A',
            borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4,
          }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: isPaused ? Palette.amber : Palette.success, textTransform: 'capitalize' }}>
              {plan.status}
            </Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
          contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: showPayCta ? 140 : 40 }}>

          {/* Plan summary */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
            <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 16, gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary }}>Total / cycle</Text>
                <Text style={{ fontFamily: Font.display, fontSize: 22, color: ORANGE, letterSpacing: -0.4 }}>{money(planTotal)}</Text>
              </View>
              {nextDate && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary }}>Next billing</Text>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: INK }}>{nextDate}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary }}>Kitchens</Text>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: INK }}>{groups.length}</Text>
              </View>
            </View>
          </MotiView>

          {/* Chef groups */}
          {groups.map((group, i) => (
            <MotiView key={group.prepperId} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 60 + i * 50 }}>
              <ChefSection
                group={group}
                deliveryDay={plan.delivery_day}
                onItemPress={setDrillItem}
                onPayChef={triggerPayment}
                paying={paying}
                paymentsOn={paymentsOn}
                isPaused={isPaused}
              />
            </MotiView>
          ))}

          {groups.length === 0 && (
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 32 }}>
              <ChefHat size={28} color={Palette.textSecondary} />
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center' }}>
                No meals in this plan yet.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Sticky pay CTA */}
        {showPayCta && (
          <BottomActionBar>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>
                {isPaused ? 'Resume your plan' : 'Full subscription'}
              </Text>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>{money(planTotal)}/{plan.frequency}</Text>
            </View>
            {payErr ? (
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.danger, textAlign: 'center' }}>{payErr}</Text>
            ) : null}
            <Button
              title={isPaused ? 'Pay to resume' : 'Pay full subscription'}
              Icon={CreditCard}
              variant="ink"
              loading={paying}
              onPress={triggerPayment}
              accessibilityLabel="Pay full subscription"
            />
          </BottomActionBar>
        )}
      </SafeAreaView>

      <DrillDownModal
        item={drillItem}
        deliveryDay={plan.delivery_day}
        paymentsOn={paymentsOn}
        onPay={triggerPayment}
        paying={paying}
        onClose={() => setDrillItem(null)}
      />
      <PaymentRedirectOverlay visible={paying} />
    </View>
  );
}
