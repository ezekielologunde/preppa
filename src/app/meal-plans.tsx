import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { CalendarCheck, Check, ChefHat, ChevronLeft, ChevronRight, Plus, RefreshCw, Users } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SubscribePlanSheet } from '@/components/subscribe-sheet';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { featuredMealPlans, type MealPlanCard } from '@/constants/mock';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useMyCustomPlans, useUpdateCustomPlan, type CustomMealPlan } from '@/lib/queries/custom-meal-plans';
import {
  useMealPlans,
  useMySubscriptions,
  useSkipDelivery,
  useUpdateSubscription,
  type DeliveryDay,
  type MealPlan,
} from '@/lib/queries/meal-plans';
import { useAuth } from '@/providers/auth-provider';

const DAY_LABEL: Record<DeliveryDay, string> = { mon: 'Mondays', tue: 'Tuesdays', wed: 'Wednesdays', thu: 'Thursdays', fri: 'Fridays', sat: 'Saturdays', sun: 'Sundays' };

const ORANGE = Palette.brand;
const INK = Palette.ink;
const money = (n: number) => `$${n.toLocaleString('en-US')}`;

function CustomPlanCard({ plan, onUpdate, busy }: { plan: CustomMealPlan; onUpdate: (status: 'active' | 'paused' | 'cancelled') => void; busy: boolean }) {
  const mealCount = plan.items.length;
  return (
    <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <ChefHat size={18} color={ORANGE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>{plan.name}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>
            {mealCount} {mealCount === 1 ? 'meal' : 'meals'} · {plan.frequency} · {DAY_LABEL[plan.delivery_day as DeliveryDay] ?? plan.delivery_day}
          </Text>
        </View>
        <View style={{ backgroundColor: plan.status === 'active' ? Palette.success + '1A' : Palette.amber + '26', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: plan.status === 'active' ? Palette.success : Palette.amber, textTransform: 'capitalize' }}>{plan.status}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <PressableScale onPress={() => onUpdate(plan.status === 'active' ? 'paused' : 'active')} disabled={busy}
          accessibilityRole="button" accessibilityLabel={plan.status === 'active' ? 'Pause plan' : 'Resume plan'}
          style={{ flex: 1, height: 38, borderRadius: Radius.sm, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: INK }}>{plan.status === 'active' ? 'Pause' : 'Resume'}</Text>
        </PressableScale>
        <PressableScale onPress={() => { feedback.warning(); onUpdate('cancelled'); }} disabled={busy}
          accessibilityRole="button" accessibilityLabel="Cancel plan"
          style={{ flex: 1, height: 38, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.danger }}>Cancel</Text>
        </PressableScale>
      </View>
    </View>
  );
}

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
    <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
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
    <View style={{ width: 230, backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
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
  const { data: livePlans, isLoading, refetch: refetchPlans } = useMealPlans();
  const { data: subs, refetch: refetchSubs } = useMySubscriptions(user?.id);
  const { data: customPlans, refetch: refetchCustom } = useMyCustomPlans(user?.id);
  const updateSub = useUpdateSubscription(user?.id);
  const updateCustomPlan = useUpdateCustomPlan(user?.id);
  const skipDelivery = useSkipDelivery(user?.id);

  // Subscribe sheet — the chosen plan (null = closed).
  const [sheetPlan, setSheetPlan] = useState<MealPlan | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await Promise.all([refetchPlans(), refetchSubs(), refetchCustom()]); setRefreshing(false); }

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) { router.back(); } else { router.replace('/'); }
  }

  function onSubscribe(plan: MealPlan) {
    if (!user) return router.push('/auth?mode=signup');
    setSheetPlan(plan);
  }

  const subscribedPlanNames = new Set((subs ?? []).filter((s) => s.status !== 'cancelled').map((s) => s.plan_name));

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>meal plans</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>weekly, monthly & family — prepped on repeat</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 12 : 6, paddingBottom: 32 }}>
          {/* Build your own plan CTA */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
            <PressableScale onPress={() => { feedback.tap(); router.push('/create-meal-plan'); }} accessibilityRole="button" accessibilityLabel="Build your own meal plan"
              style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: Palette.brandTint, borderRadius: Radius.md, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>Build your own plan</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary }}>Mix meals from any kitchen, charged on repeat</Text>
              </View>
              <ChevronRight size={18} color={ORANGE} />
            </PressableScale>
          </MotiView>

          {/* My custom plans */}
          {customPlans && customPlans.filter((p) => p.status !== 'cancelled').length > 0 ? (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.5, paddingHorizontal: 20, marginBottom: 12 }}>your custom plans</Text>
              <View style={{ paddingHorizontal: 20, gap: 10 }}>
                {customPlans.filter((p) => p.status !== 'cancelled').map((p, i) => (
                  <MotiView key={p.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: i * 45 }}>
                    <CustomPlanCard plan={p} busy={updateCustomPlan.isPending}
                      onUpdate={(status) => updateCustomPlan.mutate({ id: p.id, status })} />
                  </MotiView>
                ))}
              </View>
            </View>
          ) : null}

          {/* My subscriptions */}
          {subs && subs.length > 0 ? (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.5, paddingHorizontal: 20, marginBottom: 12 }}>your plans</Text>
              <View style={{ paddingHorizontal: 20, gap: 10 }}>
                {subs.filter((s) => s.status !== 'cancelled').map((s, i) => (
                  <MotiView key={s.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: i * 45 }}>
                  <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 14, gap: 10 }}>
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
                      <View style={{ backgroundColor: s.status === 'active' ? Palette.success + '1A' : Palette.amber + '26', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: s.status === 'active' ? Palette.success : Palette.amber, textTransform: 'capitalize' }}>{s.status}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {s.status === 'active' ? (
                        <PressableScale
                          onPress={() => { feedback.tap(); skipDelivery.mutate(s.id, { onSuccess: (r) => (r.ok ? feedback.success() : feedback.warning()) }); }}
                          disabled={skipDelivery.isPending}
                          accessibilityRole="button"
                          accessibilityLabel="Skip next batch"
                          style={{ flex: 1, height: 38, borderRadius: Radius.sm, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.brandPressed }}>Skip next</Text>
                        </PressableScale>
                      ) : null}
                      <PressableScale
                        onPress={() => { feedback.tap(); updateSub.mutate({ id: s.id, status: s.status === 'active' ? 'paused' : 'active' }); }}
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
                        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.danger }}>Cancel</Text>
                      </PressableScale>
                    </View>
                  </View>
                  </MotiView>
                ))}
              </View>
            </View>
          ) : null}

          {/* Available (live) plans */}
          <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.5, paddingHorizontal: 20, marginTop: 16, marginBottom: 12 }}>available plans</Text>
          {isLoading ? (
            <View style={{ paddingHorizontal: 20 }}><ListSkeleton count={3} rowHeight={80} /></View>
          ) : livePlans && livePlans.length > 0 ? (
            <View style={{ paddingHorizontal: 20, gap: 14 }}>
              {livePlans.map((p, i) => (
                <MotiView key={p.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: i * 45 }}>
                  <LivePlanCard plan={p} busy={false} subscribed={subscribedPlanNames.has(p.name)} onSubscribe={() => onSubscribe(p)} />
                </MotiView>
              ))}
            </View>
          ) : (
            <View style={{ marginHorizontal: 20, backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 20, alignItems: 'center', gap: 8 }}>
              <ChefHat size={26} color={Palette.textMuted} />
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, textAlign: 'center', lineHeight: 19 }}>
                No live plans in your area yet. Browse the featured plans below — or follow your favourite preppers to hear when they launch one.
              </Text>
            </View>
          )}

          {/* Featured showcase (illustrative) */}
          <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 80 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, paddingHorizontal: 20, marginTop: 20, marginBottom: 10 }}>featured plans</Text>
          </MotiView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
            {featuredMealPlans.map((p, i) => (
              <MotiView key={p.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 120 + i * 55 }}>
                <FeaturedCard plan={p} />
              </MotiView>
            ))}
          </ScrollView>
        </ScrollView>
      </SafeAreaView>

      {/* Subscribe sheet — servings + delivery-day schedule (shared component) */}
      {user ? <SubscribePlanSheet plan={sheetPlan} userId={user.id} onClose={() => setSheetPlan(null)} /> : null}
    </View>
  );
}
