import { useRouter } from 'expo-router';
import { ChevronLeft, Minus, Plus, RefreshCw, ToggleLeft, ToggleRight, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import {
  useCreatePrepperMealPlan,
  useMyPrepperMealPlans,
  useUpdatePrepperMealPlan,
  type PrepperMealPlan,
} from '@/lib/queries/meal-plans';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const FREQ = ['weekly', 'biweekly', 'monthly'] as const;
type Freq = (typeof FREQ)[number];

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cleanLine = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ');
const cleanBlock = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

function Stepper({ label, value, onChange, min = 1, max = 20 }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: Palette.canvas, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: Palette.border }}>
        <PressableScale onPress={() => { feedback.tap(); onChange(Math.max(min, value - 1)); }} disabled={value <= min}
          style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', opacity: value <= min ? 0.35 : 1 }}>
          <Minus size={15} color={INK} />
        </PressableScale>
        <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, minWidth: 32, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{value}</Text>
        <PressableScale onPress={() => { feedback.tap(); onChange(Math.min(max, value + 1)); }} disabled={value >= max}
          style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: ORANGE + '1A', alignItems: 'center', justifyContent: 'center', opacity: value >= max ? 0.35 : 1 }}>
          <Plus size={15} color={ORANGE} />
        </PressableScale>
      </View>
    </View>
  );
}

function PlanCard({ plan, onToggle, busy }: { plan: PrepperMealPlan; onToggle: () => void; busy: boolean }) {
  const cycleLabel = plan.frequency === 'weekly' ? '/wk' : plan.frequency === 'biweekly' ? '/2wk' : '/mo';
  return (
    <View style={{ backgroundColor: Palette.surface, borderRadius: 20, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: plan.active ? Palette.brandTint : Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw size={17} color={plan.active ? ORANGE : Palette.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>{plan.name}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2, lineHeight: 17 }}>
            {plan.meals_per_cycle} meals · serves {plan.serves} · {plan.frequency}
          </Text>
          {plan.description ? (
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 4, lineHeight: 18 }} numberOfLines={2}>{plan.description}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 18, color: ORANGE, letterSpacing: -0.4 }}>{money(plan.price)}<Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textMuted }}>{cycleLabel}</Text></Text>
          <View style={{ backgroundColor: plan.active ? Palette.success + '1A' : Palette.chip, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: plan.active ? Palette.success : Palette.textMuted }}>
              {plan.active ? 'LIVE' : 'HIDDEN'}
            </Text>
          </View>
        </View>
      </View>
      <PressableScale onPress={() => { feedback.tap(); onToggle(); }} disabled={busy} accessibilityRole="button"
        accessibilityLabel={plan.active ? 'Hide plan from customers' : 'Make plan visible to customers'}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 38, borderRadius: Radius.sm, backgroundColor: Palette.canvas, borderWidth: 1, borderColor: Palette.border }}>
        {busy ? <ActivityIndicator size="small" color={Palette.textMuted} /> : plan.active ? (
          <>
            <ToggleRight size={17} color={Palette.success} />
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.success }}>Visible to customers — tap to hide</Text>
          </>
        ) : (
          <>
            <ToggleLeft size={17} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.textMuted }}>Hidden — tap to make live</Text>
          </>
        )}
      </PressableScale>
    </View>
  );
}

export default function PrepperMealPlansScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: application } = useMyPrepperApplication(user?.id);
  const prepperId = application?.status === 'approved' ? application.id : null;

  const { data: plans, isLoading, refetch } = useMyPrepperMealPlans(prepperId);
  const createPlan = useCreatePrepperMealPlan(prepperId);
  const updatePlan = useUpdatePrepperMealPlan(prepperId);

  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toggleErr, setToggleErr] = useState<string | null>(null);
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  // Create form state
  const [planName, setPlanName] = useState('');
  const [planDesc, setPlanDesc] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planFreq, setPlanFreq] = useState<Freq>('weekly');
  const [mealsPerCycle, setMealsPerCycle] = useState(4);
  const [serves, setServes] = useState(2);
  const [formErr, setFormErr] = useState<string | null>(null);

  function resetForm() {
    setPlanName(''); setPlanDesc(''); setPlanPrice('');
    setPlanFreq('weekly'); setMealsPerCycle(4); setServes(2); setFormErr(null);
  }

  async function submitCreate() {
    setFormErr(null);
    const name = cleanLine(planName).trim();
    if (name.length < 3) return setFormErr('Give your plan a name (at least 3 characters).');
    const price = parseFloat(planPrice.replace(/[^0-9.]/g, ''));
    if (!price || price <= 0) return setFormErr('Enter a valid price per cycle.');
    if (price > 9999) return setFormErr('Price must be under $9,999 per cycle.');
    if (!prepperId) return setFormErr('Your prepper account is not approved.');
    try {
      await createPlan.mutateAsync({
        name: name.slice(0, 80),
        description: cleanBlock(planDesc).trim().slice(0, 300) || undefined,
        price,
        frequency: planFreq,
        mealsPerCycle,
        serves,
      });
      feedback.success();
      setShowCreate(false);
      resetForm();
    } catch (e) {
      setFormErr(e instanceof Error ? e.message : 'Could not create plan. Try again.');
    }
  }

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/prepper-hub'); } }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5 }}>your meal plans</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary }}>subscription plans customers can browse and join</Text>
          </View>
          <PressableScale onPress={() => setShowCreate(true)} accessibilityRole="button" accessibilityLabel="Create new plan"
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={20} color="#fff" />
          </PressableScale>
        </View>

        {toggleErr ? (
          <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.danger, marginHorizontal: 16, marginBottom: 6 }}>{toggleErr}</Text>
        ) : null}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>

          {isLoading ? <ListSkeleton count={3} rowHeight={110} /> : (plans ?? []).length === 0 ? (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}
              style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
              <RefreshCw size={32} color={Palette.textMuted} strokeWidth={1.5} />
              <Text style={{ fontFamily: Font.heading, fontSize: 18, color: INK }}>no plans yet</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 }}>
                Create your first subscription plan — customers can browse and join directly from the meal plans screen.
              </Text>
              <PressableScale onPress={() => setShowCreate(true)} accessibilityRole="button" accessibilityLabel="Create your first plan"
                style={{ marginTop: 8, height: 46, paddingHorizontal: 28, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Create your first plan</Text>
              </PressableScale>
            </MotiView>
          ) : (plans ?? []).map((p, i) => (
            <MotiView key={p.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
              <PlanCard plan={p} busy={updatePlan.isPending}
                onToggle={() => {
                  setToggleErr(null);
                  updatePlan.mutate({ id: p.id, active: !p.active }, {
                    onError: () => { feedback.error(); setToggleErr('Could not update plan status. Please try again.'); },
                  });
                }} />
            </MotiView>
          ))}
        </ScrollView>

        {/* Create plan modal */}
        <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => { setShowCreate(false); resetForm(); }}>
          <Pressable onPress={() => { setShowCreate(false); resetForm(); }} accessibilityRole="button" accessibilityLabel="Close" style={{ flex: 1, backgroundColor: Palette.overlay, justifyContent: 'flex-end' }}>
            <Pressable onPress={(e) => e.stopPropagation()} accessible={false} style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '92%' }}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5 }}>new subscription plan</Text>
                  <PressableScale onPress={() => { setShowCreate(false); resetForm(); }} accessibilityRole="button" accessibilityLabel="Close"
                    style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                    <X size={17} color={Palette.inkSoft} />
                  </PressableScale>
                </View>

                {/* Plan name */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK }}>Plan name</Text>
                  <TextInput value={planName} onChangeText={(t) => setPlanName(cleanLine(t))} maxLength={80}
                    placeholder="e.g. Weekly Family Prep" placeholderTextColor={Palette.textMuted}
                    style={{ height: 50, backgroundColor: Palette.canvas, borderRadius: 14, paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: INK, borderWidth: 1, borderColor: Palette.border }} />
                </View>

                {/* Description */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK }}>Description <Text style={{ fontFamily: Font.body, color: Palette.textMuted }}>(optional)</Text></Text>
                  <TextInput value={planDesc} onChangeText={(t) => setPlanDesc(cleanBlock(t))} multiline maxLength={300}
                    placeholder="What's included, cuisine style, any dietary focus…" placeholderTextColor={Palette.textMuted}
                    style={{ minHeight: 72, backgroundColor: Palette.canvas, borderRadius: 14, padding: 14, fontFamily: Font.body, fontSize: 14, color: INK, textAlignVertical: 'top', borderWidth: 1, borderColor: Palette.border }} />
                </View>

                {/* Price */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK }}>Price per cycle</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.canvas, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, overflow: 'hidden' }}>
                    <View style={{ paddingHorizontal: 14, height: 50, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: Palette.border }}>
                      <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.textSecondary }}>$</Text>
                    </View>
                    <TextInput value={planPrice} onChangeText={(t) => setPlanPrice(t.replace(/[^0-9.]/g, ''))}
                      placeholder="0.00" placeholderTextColor={Palette.textMuted} keyboardType="decimal-pad" maxLength={7}
                      style={{ flex: 1, height: 50, paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: INK }}
                      accessibilityLabel="Price per cycle" />
                  </View>
                </View>

                {/* Frequency */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK }}>Billing frequency</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {FREQ.map((f) => {
                      const on = planFreq === f;
                      return (
                        <PressableScale key={f} onPress={() => { feedback.tap(); setPlanFreq(f); }}
                          accessibilityRole="button" accessibilityState={{ selected: on }}
                          style={{ flex: 1, height: 42, borderRadius: Radius.sm, backgroundColor: on ? ORANGE : Palette.canvas, borderWidth: 1, borderColor: on ? ORANGE : Palette.border, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, textTransform: 'capitalize', color: on ? '#fff' : INK }}>{f}</Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                </View>

                {/* Meals per cycle + servings */}
                <Stepper label="Meals included per cycle" value={mealsPerCycle} onChange={setMealsPerCycle} min={1} max={30} />
                <Stepper label="Servings per meal" value={serves} onChange={setServes} min={1} max={12} />

                {/* Summary */}
                {planName.trim() && planPrice ? (
                  <View style={{ backgroundColor: Palette.brandTint, borderRadius: 14, padding: 14 }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13, color: ORANGE }}>
                      "{planName.trim()}" · {mealsPerCycle} meals · {serves} serving{serves !== 1 ? 's' : ''} each · {money(parseFloat(planPrice) || 0)}/{planFreq}
                    </Text>
                  </View>
                ) : null}

                {formErr ? (
                  <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FECACA' }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13, color: '#991B1B' }}>{formErr}</Text>
                  </View>
                ) : null}

                <PressableScale onPress={submitCreate} disabled={createPlan.isPending || !planName.trim() || !planPrice}
                  accessibilityRole="button" accessibilityLabel="Create plan"
                  style={{ height: 54, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: createPlan.isPending || !planName.trim() || !planPrice ? 0.6 : 1 }}>
                  {createPlan.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Create plan</Text>}
                </PressableScale>
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </View>
  );
}
