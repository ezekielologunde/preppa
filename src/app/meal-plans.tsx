import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertTriangle, CalendarCheck, Check, ChefHat, ChevronLeft, ChevronRight, Plus, RefreshCw, Users, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlanComparisonTable } from '@/components/plan-comparison-table';
import { SubscribePlanSheet } from '@/components/subscribe-sheet';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useMyCustomPlans, useUpdateCustomPlan, type CustomMealPlan } from '@/lib/queries/custom-meal-plans';
import {
  nextDeliveryDate,
  useMealPlans,
  useMyBillingHistory,
  useMySubscriptions,
  useSkipDelivery,
  useUpdateSubscription,
  type BillingRecord,
  type DeliveryDay,
  type MealPlan,
  type MySubscription,
} from '@/lib/queries/meal-plans';
import { useAuth } from '@/providers/auth-provider';

const DAY_LABEL: Record<DeliveryDay, string> = { mon: 'Mondays', tue: 'Tuesdays', wed: 'Wednesdays', thu: 'Thursdays', fri: 'Fridays', sat: 'Saturdays', sun: 'Sundays' };

const ORANGE = Palette.brand;
const INK = Palette.ink;
const money = (n: number) => `$${n.toLocaleString('en-US')}`;

function CustomPlanCard({ plan, onView, onUpdate, onCancel, busy }: { plan: CustomMealPlan; onView: () => void; onUpdate: (status: 'active' | 'paused' | 'cancelled') => void; onCancel: () => void; busy: boolean }) {
  const mealCount = plan.items.length;
  return (
    <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, overflow: 'hidden' }}>
      {/* Header row is the only pressable — avoids nested-Pressable pointer-capture on web */}
      <PressableScale onPress={onView} accessibilityRole="button" accessibilityLabel={`View ${plan.name}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingBottom: 10 }}>
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
        <ChevronRight size={16} color={Palette.textSecondary} />
      </PressableScale>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 12 }}>
        <Button
          title={plan.status === 'active' ? 'Pause' : 'Resume'}
          onPress={() => onUpdate(plan.status === 'active' ? 'paused' : 'active')}
          disabled={busy}
          variant="secondary"
          size="sm"
          style={{ flex: 1 }}
        />
        <Button
          title="Cancel"
          onPress={onCancel}
          disabled={busy}
          variant="danger"
          size="sm"
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

function Meta({ Icon, text }: { Icon: typeof Users; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon size={13} color={Palette.textSecondary} />
      <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>{text}</Text>
    </View>
  );
}

function LivePlanCard({ plan, onSubscribe, busy, subscribed }: { plan: MealPlan; onSubscribe: () => void; busy: boolean; subscribed: boolean }) {
  return (
    <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
      {plan.image_url ? <Image source={plan.image_url} style={{ width: '100%', height: 140 }} contentFit="cover" transition={200} accessibilityLabel={plan.name} /> : null}
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
          <Button
            title={subscribed ? 'Subscribed' : 'Subscribe'}
            onPress={onSubscribe}
            disabled={busy || subscribed}
            tone={subscribed ? Palette.success : undefined}
            Icon={subscribed ? Check : undefined}
            size="md"
            fullWidth={false}
          />
        </View>
      </View>
    </View>
  );
}

function FeaturedCard({ plan, onSubscribe }: { plan: MealPlan; onSubscribe: () => void }) {
  return (
    <PressableScale onPress={onSubscribe} accessibilityRole="button" accessibilityLabel={`Subscribe to ${plan.name}`} style={{ width: 230, backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
      {plan.image_url ? <Image source={plan.image_url} style={{ width: '100%', height: 120 }} contentFit="cover" transition={200} /> : null}
      <View style={{ padding: 14 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }} numberOfLines={1}>{plan.name}</Text>
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }}>by {plan.prepper}</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
          <Meta Icon={CalendarCheck} text={`${plan.meals_per_cycle} meals`} />
          <Meta Icon={Users} text={`serves ${plan.serves}`} />
        </View>
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: INK, marginTop: 8 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 17, color: ORANGE }}>{money(plan.price)}</Text> /{plan.frequency}
        </Text>
      </View>
    </PressableScale>
  );
}

function ActiveSubscriptionBanner({ sub, onManage, onCancel }: { sub: MySubscription; onManage: () => void; onCancel: () => void }) {
  const nextDate = sub.next_billing_at ? new Date(sub.next_billing_at) : null;
  return (
    <View style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: Palette.surface, borderRadius: Radius.md, borderLeftWidth: 4, borderLeftColor: Palette.success, padding: 16, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Check size={15} color={Palette.success} />
        <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK, flex: 1 }}>You're on the {sub.plan_name}</Text>
      </View>
      {nextDate ? (
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>
          Next billing: {nextDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        <Button title="Manage" onPress={onManage} variant="secondary" size="sm" style={{ flex: 1 }} />
        <Button title="Cancel" onPress={onCancel} variant="danger" size="sm" style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const fmtMoney = (n: number) => `$${n.toFixed(2)}`;

function StatusChip({ status }: { status: string }) {
  const s = status.toLowerCase();
  const color = s === 'paid' ? Palette.success : s === 'pending' ? Palette.amber : Palette.danger;
  return (
    <View style={{ backgroundColor: color + '1A', borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 11, color, textTransform: 'capitalize' }}>{status}</Text>
    </View>
  );
}

function BillingHistorySection({ records, onSeeAll }: { records: BillingRecord[]; onSeeAll?: () => void }) {
  const shown = records.slice(0, 6);
  return (
    <View style={{ marginTop: 24, marginBottom: 4 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 16, color: Palette.ink, letterSpacing: -0.4, paddingHorizontal: 20, marginBottom: 12 }}>billing history</Text>
      {shown.length === 0 ? (
        <View style={{ marginHorizontal: 20, backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 20, alignItems: 'center', gap: 8 }}>
          <X size={22} color={Palette.textSecondary} />
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, textAlign: 'center' }}>Your billing history will appear here once you subscribe.</Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 20, gap: 8 }}>
          {shown.map((r) => (
            <View key={r.id} style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.ink }}>{fmt(r.billing_date)}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>{r.plan_name}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.ink }}>{fmtMoney(r.amount)}</Text>
                <StatusChip status={r.status} />
              </View>
            </View>
          ))}
          {records.length > 6 && onSeeAll ? (
            <Button title="see all" onPress={onSeeAll} variant="secondary" size="sm" style={{ marginTop: 4 }} />
          ) : null}
        </View>
      )}
    </View>
  );
}

export default function MealPlansScreen() {
  const router = useRouter();
  const { openPlanId } = useLocalSearchParams<{ openPlanId?: string }>();
  const { user } = useAuth();
  const { data: livePlans, isLoading, isError: livePlansError, refetch: refetchPlans } = useMealPlans();
  const { data: subs, refetch: refetchSubs } = useMySubscriptions(user?.id);
  const { data: customPlans, refetch: refetchCustom } = useMyCustomPlans(user?.id);
  const { data: billingHistory = [] } = useMyBillingHistory(user?.id);
  const updateSub = useUpdateSubscription(user?.id);
  const updateCustomPlan = useUpdateCustomPlan(user?.id);
  const skipDelivery = useSkipDelivery(user?.id);

  // Subscribe sheet — the chosen plan (null = closed).
  const [sheetPlan, setSheetPlan] = useState<MealPlan | null>(null);

  // Auto-open the sheet when navigated here with a specific plan ID.
  useEffect(() => {
    if (openPlanId && livePlans) {
      const target = livePlans.find((p) => p.id === openPlanId);
      if (target) setSheetPlan(target);
    }
  }, [openPlanId, livePlans]);
  // Cancel confirmation
  const [cancelTarget, setCancelTarget] = useState<{ id: string; name: string; isCustom?: boolean } | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
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
  const activeSub = (subs ?? []).find((s) => s.status === 'active') ?? null;

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

        {actionErr ? (
          <PressableScale onPress={() => { feedback.tap(); setActionErr(null); }} accessibilityRole="button" accessibilityLabel="Dismiss error"
            style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: Palette.danger + '14', borderWidth: 1, borderColor: Palette.danger + '40', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.danger }}>{actionErr} (tap to dismiss)</Text>
          </PressableScale>
        ) : null}
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 12 : 6, paddingBottom: 32 }}>
          {/* Active subscription banner */}
          {activeSub ? (
            <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
              <ActiveSubscriptionBanner
                sub={activeSub}
                onManage={() => { feedback.tap(); router.push('/meal-plans?action=manage' as never); }}
                onCancel={() => setCancelTarget({ id: activeSub.id, name: activeSub.plan_name })}
              />
            </MotiView>
          ) : null}

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
          {customPlans !== undefined ? (
            customPlans.filter((p) => p.status !== 'cancelled').length > 0 ? (
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.5, paddingHorizontal: 20, marginBottom: 12 }}>your custom plans</Text>
                <View style={{ paddingHorizontal: 20, gap: 10 }}>
                  {customPlans.filter((p) => p.status !== 'cancelled').map((p, i) => (
                    <MotiView key={p.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: i * 45 }}>
                      <CustomPlanCard plan={p} busy={updateCustomPlan.isPending}
                        onView={() => { feedback.tap(); router.push(`/custom-plan?id=${p.id}` as never); }}
                        onUpdate={(status) => { setActionErr(null); updateCustomPlan.mutate({ id: p.id, status }, { onError: (e) => { feedback.error(); setActionErr(e instanceof Error ? e.message : 'Could not update plan. Please try again.'); } }); }}
                        onCancel={() => setCancelTarget({ id: p.id, name: p.name, isCustom: true })} />
                    </MotiView>
                  ))}
                </View>
              </View>
            ) : (
              <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 220 }}
                style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                  <ChefHat size={19} color={Palette.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK }}>No active custom plans</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary }}>Use the button above to build your first plan.</Text>
                </View>
              </MotiView>
            )
          ) : null}

          {/* My subscriptions */}
          {subs && subs.filter((s) => s.status !== 'cancelled').length > 0 ? (
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.5, paddingHorizontal: 20, marginBottom: 12 }}>your plans</Text>
              <View style={{ paddingHorizontal: 20, gap: 10 }}>
                {subs.filter((s) => s.status !== 'cancelled').map((s, i) => {
                  const nextDate = s.next_billing_at ? new Date(s.next_billing_at) : s.delivery_day ? nextDeliveryDate(s.delivery_day) : null;
                  return (
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
                        {nextDate && s.status === 'active' ? (
                          <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: ORANGE, marginTop: 2 }}>
                            Next delivery {nextDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </Text>
                        ) : null}
                      </View>
                      <View style={{ backgroundColor: s.status === 'active' ? Palette.success + '1A' : Palette.amber + '26', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: s.status === 'active' ? Palette.success : Palette.amber, textTransform: 'capitalize' }}>{s.status}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {s.status === 'active' ? (
                        <PressableScale
                          onPress={() => { feedback.tap(); setActionErr(null); skipDelivery.mutate(s.id, { onSuccess: (r) => (r.ok ? feedback.success() : feedback.warning()), onError: () => { feedback.error(); setActionErr('Could not skip delivery. Please try again.'); } }); }}
                          disabled={skipDelivery.isPending}
                          accessibilityRole="button"
                          accessibilityLabel="Skip next batch"
                          style={{ flex: 1, height: 38, borderRadius: Radius.pill, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.brandPressed }}>Skip next</Text>
                        </PressableScale>
                      ) : null}
                      <Button
                        title={s.status === 'active' ? 'Pause' : 'Resume'}
                        onPress={() => { setActionErr(null); updateSub.mutate({ id: s.id, status: s.status === 'active' ? 'paused' : 'active' }, { onSuccess: () => feedback.success(), onError: (e) => { feedback.error(); setActionErr(e instanceof Error ? e.message : 'Could not update plan. Please try again.'); } }); }}
                        disabled={updateSub.isPending}
                        variant="secondary"
                        size="sm"
                        style={{ flex: 1 }}
                      />
                      <Button
                        title="Cancel"
                        onPress={() => setCancelTarget({ id: s.id, name: s.plan_name })}
                        disabled={updateSub.isPending}
                        variant="danger"
                        size="sm"
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                  </MotiView>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Available (live) plans */}
          <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.5, paddingHorizontal: 20, marginTop: 16, marginBottom: 12 }}>available plans</Text>
          {isLoading ? (
            <View style={{ paddingHorizontal: 20 }}><ListSkeleton count={3} rowHeight={80} /></View>
          ) : livePlansError ? (
            <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
              style={{ marginHorizontal: 20, alignItems: 'center', gap: 10, paddingVertical: 24 }}>
              <ChefHat size={30} color={Palette.textSecondary} />
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>couldn't load plans</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, textAlign: 'center' }}>Check your connection and try again.</Text>
              <PressableScale onPress={() => { feedback.tap(); void refetchPlans(); }} accessibilityRole="button" accessibilityLabel="Retry loading plans"
                style={{ marginTop: 4, paddingHorizontal: 20, height: 44, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>retry</Text>
              </PressableScale>
            </MotiView>
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
              <ChefHat size={26} color={Palette.textSecondary} />
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, textAlign: 'center', lineHeight: 19 }}>
                No live plans in your area yet. Browse the featured plans below — or follow your favourite preppers to hear when they launch one.
              </Text>
            </View>
          )}

          {/* Featured plans — real data from live plans */}
          {(livePlans ?? []).length > 0 ? (
            <>
              <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 80 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, paddingHorizontal: 20, marginTop: 20, marginBottom: 10 }}>featured plans</Text>
              </MotiView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
                {(livePlans ?? []).slice(0, 4).map((p, i) => (
                  <MotiView key={p.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 120 + i * 55 }}>
                    <FeaturedCard plan={p} onSubscribe={() => onSubscribe(p)} />
                  </MotiView>
                ))}
              </ScrollView>
            </>
          ) : null}

          {/* Plan comparison table */}
          {(livePlans ?? []).length > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 60 }}>
              <PlanComparisonTable plans={livePlans ?? []} />
            </MotiView>
          ) : null}

          {/* Billing history — only shown to signed-in users */}
          {user ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 100 }}>
              <BillingHistorySection records={billingHistory} />
            </MotiView>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {/* Subscribe sheet — servings + delivery-day schedule (shared component) */}
      {user ? <SubscribePlanSheet plan={sheetPlan} userId={user.id} onClose={() => setSheetPlan(null)} /> : null}

      {/* Cancel confirmation modal */}
      <Modal visible={!!cancelTarget} transparent animationType="fade" onRequestClose={() => setCancelTarget(null)}>
        <Pressable onPress={() => setCancelTarget(null)} accessibilityRole="button" accessibilityLabel="Keep plan" style={{ flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Pressable onPress={(e) => e.stopPropagation()} accessible={false}
            style={{ backgroundColor: Palette.surface, borderRadius: 24, padding: 24, width: '100%', maxWidth: 360, gap: 16, alignItems: 'center' }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={24} color={Palette.danger} />
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 19, color: INK, letterSpacing: -0.4, textAlign: 'center' }}>Cancel this plan?</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center', lineHeight: 19 }}>
                "<Text style={{ fontFamily: Font.semibold }}>{cancelTarget?.name}</Text>" will be cancelled immediately. You won't be charged again.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
              <Button title="Keep plan" onPress={() => setCancelTarget(null)} variant="secondary" size="md" style={{ flex: 1 }} />
              <Button
                title="Yes, cancel" variant="danger" size="md" style={{ flex: 1 }}
                disabled={updateSub.isPending || updateCustomPlan.isPending}
                onPress={() => {
                  if (!cancelTarget) return;
                  feedback.warning(); setActionErr(null);
                  const onCancelErr = (e: unknown) => { feedback.error(); setActionErr(e instanceof Error ? e.message : 'Could not cancel plan. Please try again.'); };
                  if (cancelTarget.isCustom) { updateCustomPlan.mutate({ id: cancelTarget.id, status: 'cancelled' }, { onError: onCancelErr }); }
                  else { updateSub.mutate({ id: cancelTarget.id, status: 'cancelled' }, { onError: onCancelErr }); }
                  setCancelTarget(null);
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
