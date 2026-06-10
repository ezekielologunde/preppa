import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { CalendarCheck, Check, ChefHat, ChevronLeft, Minus, Plus, RefreshCw, Users, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { featuredMealPlans, type MealPlanCard } from '@/constants/mock';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import {
  nextDeliveryDate,
  useMealPlans,
  useMySubscriptions,
  useSkipDelivery,
  useSubscribeToPlan,
  useUpdateSubscription,
  type DeliveryDay,
  type MealPlan,
} from '@/lib/queries/meal-plans';
import { useAuth } from '@/providers/auth-provider';

const DAYS: { key: DeliveryDay; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];
const DAY_LABEL: Record<DeliveryDay, string> = { mon: 'Mondays', tue: 'Tuesdays', wed: 'Wednesdays', thu: 'Thursdays', fri: 'Fridays', sat: 'Saturdays', sun: 'Sundays' };

const ORANGE = Palette.brand;
const INK = Palette.ink;
const money = (n: number) => `$${n.toLocaleString('en-US')}`;

function Meta({ Icon, text }: { Icon: typeof Users; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon size={13} color={Palette.textMuted} />
      <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>{text}</Text>
    </View>
  );
}

function LivePlanCard({ plan, onSubscribe, busy, subscribed }: { plan: MealPlan; onSubscribe: () => void; busy: boolean; subscribed: boolean }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
      {plan.image_url ? <Image source={plan.image_url} style={{ width: '100%', height: 140 }} contentFit="cover" transition={200} /> : null}
      <View style={{ padding: 16 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>{plan.name}</Text>
        <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 2 }}>by {plan.prepper}</Text>
        <View style={{ flexDirection: 'row', gap: 14, marginTop: 10 }}>
          <Meta Icon={RefreshCw} text={plan.frequency} />
          <Meta Icon={CalendarCheck} text={`${plan.meals_per_cycle} meals`} />
          <Meta Icon={Users} text={`serves ${plan.serves}`} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: INK }}>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: ORANGE }}>{money(plan.price)}</Text> /{plan.frequency}
          </Text>
          <PressableScale onPress={onSubscribe} disabled={busy || subscribed} accessibilityRole="button" accessibilityLabel={`Subscribe to ${plan.name}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, height: 44, borderRadius: Radius.sm, backgroundColor: subscribed ? Palette.success : ORANGE, opacity: busy ? 0.7 : 1 }}>
            {subscribed ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>{subscribed ? 'Subscribed' : 'Subscribe'}</Text>
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

function FeaturedCard({ plan }: { plan: MealPlanCard }) {
  return (
    <View style={{ width: 230, backgroundColor: '#fff', borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
      <Image source={plan.image} style={{ width: '100%', height: 120 }} contentFit="cover" transition={200} />
      <View style={{ padding: 14 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }} numberOfLines={1}>{plan.name}</Text>
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }}>by {plan.prepper}</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <Meta Icon={CalendarCheck} text={`${plan.mealsPerCycle} meals`} />
          <Meta Icon={Users} text={`serves ${plan.serves}`} />
        </View>
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: INK, marginTop: 8 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 17, color: ORANGE }}>{money(plan.price)}</Text> /{plan.frequency}
        </Text>
      </View>
    </View>
  );
}

export default function MealPlansScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: livePlans, isLoading } = useMealPlans();
  const { data: subs } = useMySubscriptions(user?.id);
  const subscribe = useSubscribeToPlan();
  const updateSub = useUpdateSubscription(user?.id);
  const skipDelivery = useSkipDelivery(user?.id);

  // Subscribe sheet state — servings + delivery-day schedule for the chosen plan.
  const [sheetPlan, setSheetPlan] = useState<MealPlan | null>(null);
  const [qty, setQty] = useState(1);
  const [day, setDay] = useState<DeliveryDay>('mon');

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function onSubscribe(plan: MealPlan) {
    if (!user) return router.push('/auth?mode=signup');
    setQty(1);
    setDay('mon');
    setSheetPlan(plan);
  }

  function confirmSubscribe() {
    if (!user || !sheetPlan) return;
    subscribe.mutate(
      { userId: user.id, planId: sheetPlan.id, prepperId: sheetPlan.prepper_id, planName: sheetPlan.name, frequency: sheetPlan.frequency, qty, deliveryDay: day },
      {
        onSuccess: () => {
          feedback.success();
          setSheetPlan(null);
        },
        onError: () => feedback.error(),
      },
    );
  }

  const subscribedPlanNames = new Set((subs ?? []).filter((s) => s.status !== 'cancelled').map((s) => s.plan_name));

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F7F8' }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>meal plans</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>weekly, monthly & family — delivered on repeat</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 12 : 6, paddingBottom: 130 }}>
          {/* My subscriptions */}
          {subs && subs.length > 0 ? (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.5, paddingHorizontal: 20, marginBottom: 12 }}>your plans</Text>
              <View style={{ paddingHorizontal: 20, gap: 10 }}>
                {subs.filter((s) => s.status !== 'cancelled').map((s) => (
                  <View key={s.id} style={{ backgroundColor: '#fff', borderRadius: Radius.md, padding: 14, gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                        <RefreshCw size={18} color={ORANGE} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>{s.plan_name}</Text>
                        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>
                          {s.prepper?.display_name ?? ''} · {s.frequency}
                          {s.qty > 1 ? ` · ×${s.qty} servings` : ''}
                          {s.delivery_day ? ` · ${DAY_LABEL[s.delivery_day]}` : ''}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: s.status === 'active' ? '#DCFCE7' : '#FEF3C7', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: s.status === 'active' ? Palette.success : '#b45309', textTransform: 'capitalize' }}>{s.status}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {s.status === 'active' ? (
                        <PressableScale
                          onPress={() => skipDelivery.mutate(s.id, { onSuccess: (r) => (r.ok ? feedback.success() : feedback.warning()) })}
                          disabled={skipDelivery.isPending}
                          accessibilityRole="button"
                          accessibilityLabel="Skip next delivery"
                          style={{ flex: 1, height: 38, borderRadius: Radius.sm, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.brandPressed }}>Skip next</Text>
                        </PressableScale>
                      ) : null}
                      <PressableScale
                        onPress={() => updateSub.mutate({ id: s.id, status: s.status === 'active' ? 'paused' : 'active' })}
                        disabled={updateSub.isPending}
                        accessibilityRole="button"
                        accessibilityLabel={s.status === 'active' ? 'Pause plan' : 'Resume plan'}
                        style={{ flex: 1, height: 38, borderRadius: Radius.sm, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: INK }}>{s.status === 'active' ? 'Pause' : 'Resume'}</Text>
                      </PressableScale>
                      <PressableScale
                        onPress={() => { feedback.warning(); updateSub.mutate({ id: s.id, status: 'cancelled' }); }}
                        disabled={updateSub.isPending}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel plan"
                        style={{ flex: 1, height: 38, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#ef4444' }}>Cancel</Text>
                      </PressableScale>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Available (live) plans */}
          <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.5, paddingHorizontal: 20, marginTop: 16, marginBottom: 12 }}>available plans</Text>
          {isLoading ? (
            <ActivityIndicator color={ORANGE} style={{ marginVertical: 16 }} />
          ) : livePlans && livePlans.length > 0 ? (
            <View style={{ paddingHorizontal: 20, gap: 14 }}>
              {livePlans.map((p) => (
                <LivePlanCard key={p.id} plan={p} busy={subscribe.isPending} subscribed={subscribedPlanNames.has(p.name)} onSubscribe={() => onSubscribe(p)} />
              ))}
            </View>
          ) : (
            <View style={{ marginHorizontal: 20, backgroundColor: '#fff', borderRadius: Radius.md, padding: 20, alignItems: 'center', gap: 8 }}>
              <ChefHat size={26} color={Palette.textMuted} />
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, textAlign: 'center', lineHeight: 19 }}>
                No live plans in your area yet. Browse the featured plans below — or follow your favourite preppers to hear when they launch one.
              </Text>
            </View>
          )}

          {/* Featured showcase (illustrative) */}
          <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.5, paddingHorizontal: 20, marginTop: 28, marginBottom: 12 }}>featured plans</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
            {featuredMealPlans.map((p) => <FeaturedCard key={p.id} plan={p} />)}
          </ScrollView>
        </ScrollView>
      </SafeAreaView>

      {/* Subscribe sheet — servings + delivery-day schedule */}
      <Modal visible={!!sheetPlan} transparent animationType="slide" onRequestClose={() => setSheetPlan(null)}>
        <Pressable onPress={() => setSheetPlan(null)} style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.5)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 34, gap: 16, alignSelf: 'center', width: '100%', maxWidth: 480 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 21, color: INK, letterSpacing: -0.4 }}>{sheetPlan?.name}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 2 }}>
                  by {sheetPlan?.prepper} · {sheetPlan?.meals_per_cycle} meals / {sheetPlan?.frequency}
                </Text>
              </View>
              <PressableScale onPress={() => setSheetPlan(null)} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={INK} />
              </PressableScale>
            </View>

            {/* Servings */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK }}>Servings of each meal</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <PressableScale onPress={() => setQty((q) => Math.max(1, q - 1))} accessibilityRole="button" accessibilityLabel="Fewer servings" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                  <Minus size={17} color={INK} />
                </PressableScale>
                <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, minWidth: 32, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{qty}</Text>
                <PressableScale onPress={() => setQty((q) => Math.min(6, q + 1))} accessibilityRole="button" accessibilityLabel="More servings" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={17} color="#fff" />
                </PressableScale>
                <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary }}>
                  {qty === 1 ? 'Just for you' : `Feeds ${qty} people per meal`}
                </Text>
              </View>
            </View>

            {/* Delivery day */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK }}>Delivery day</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {DAYS.map((d) => {
                  const on = day === d.key;
                  return (
                    <PressableScale key={d.key} onPress={() => setDay(d.key)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={d.label}
                      style={{ flex: 1, height: 40, borderRadius: 12, backgroundColor: on ? ORANGE : Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: on ? '#fff' : INK }}>{d.label}</Text>
                    </PressableScale>
                  );
                })}
              </View>
              <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary }}>
                First delivery {nextDeliveryDate(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} · renews {sheetPlan?.frequency}
              </Text>
            </View>

            {/* Confirm */}
            <PressableScale
              onPress={confirmSubscribe}
              disabled={subscribe.isPending}
              accessibilityRole="button"
              accessibilityLabel="Start plan"
              style={{ height: 54, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: subscribe.isPending ? 0.7 : 1 }}>
              {subscribe.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
                  Start plan · {money((sheetPlan?.price ?? 0) * qty)}/{sheetPlan?.frequency}
                </Text>
              )}
            </PressableScale>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
