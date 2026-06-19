import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Check, ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Meal } from '@/components/meal-card';
import { PaymentRedirectOverlay } from '@/components/payment-redirect-overlay';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useCreateCustomPlan } from '@/lib/queries/custom-meal-plans';
import { useFeaturedMeals, useMealSearch } from '@/lib/queries/meals';
import { useAuth } from '@/providers/auth-provider';

const cleanLine = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, '');

const ORANGE = Palette.brand;
const INK = Palette.ink;
const FREQ = ['weekly', 'biweekly', 'monthly'] as const;
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_LABEL: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Freq = (typeof FREQ)[number];
type Day = (typeof DAYS)[number];

function MealPickerRow({ meal, selected, onToggle }: { meal: Meal; selected: boolean; onToggle: () => void }) {
  const img = meal.images?.[0] ?? meal.image;
  return (
    <MotiView
      animate={{ borderColor: selected ? ORANGE : Palette.surface }}
      transition={{ type: 'timing', duration: 180 }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 12, borderWidth: 1.5 }}>
      {img ? (
        <Image source={{ uri: img }} style={{ width: 56, height: 56, borderRadius: Radius.sm }} contentFit="cover" transition={200} />
      ) : (
        <View style={{ width: 56, height: 56, borderRadius: Radius.sm, backgroundColor: Palette.chip }} />
      )}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{meal.title}</Text>
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>{meal.prepper}</Text>
        <Text style={{ fontFamily: Font.heading, fontSize: 13, color: ORANGE, marginTop: 2 }}>{money(meal.price)}</Text>
      </View>
      <MotiView
        animate={{
          backgroundColor: selected ? Palette.brandTint : Palette.chip,
          borderColor: selected ? ORANGE : Palette.chip,
        }}
        transition={{ type: 'timing', duration: 180 }}
        style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, overflow: 'hidden' }}>
        <PressableScale
          onPress={() => { feedback.tap(); onToggle(); }}
          accessibilityRole="button"
          accessibilityLabel={selected ? `Remove ${meal.title}` : `Add ${meal.title}`}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {selected ? <X size={15} color={ORANGE} strokeWidth={2.5} /> : <Plus size={15} color={Palette.textMuted} strokeWidth={2.5} />}
        </PressableScale>
      </MotiView>
    </MotiView>
  );
}

export default function CreateMealPlanScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const createPlan = useCreateCustomPlan();

  const [name, setName] = useState('My Weekly Plan');
  const [freq, setFreq] = useState<Freq>('weekly');
  const [day, setDay] = useState<Day>('fri');
  const [search, setSearch] = useState('');
  const [selectedMeals, setSelectedMeals] = useState<Map<string, Meal>>(new Map());
  const [err, setErr] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const { data: featured, isLoading: loadingFeatured, isError: featuredError, refetch: refetchFeatured } = useFeaturedMeals(40);
  const { data: searchResults, isFetching: searching } = useMealSearch(search);
  const displayMeals = search.length >= 2 ? (searchResults ?? []) : (featured ?? []);

  function toggle(meal: Meal) {
    setSelectedMeals((prev) => {
      const next = new Map(prev);
      if (next.has(meal.id)) next.delete(meal.id);
      else next.set(meal.id, meal);
      return next;
    });
  }

  const selCount = selectedMeals.size;
  const total = Array.from(selectedMeals.values()).reduce((acc, m) => acc + m.price, 0);
  const canCreate = name.trim().length > 0 && selCount > 0 && !createPlan.isPending;

  async function handleCreate() {
    if (!user) { router.push('/auth?mode=signup'); return; }
    if (!canCreate) return;
    feedback.tap();
    setErr(null);
    let planId: string;
    try {
      planId = await createPlan.mutateAsync({
        name: cleanLine(name).trim(),
        frequency: freq,
        deliveryDay: day,
        mealIds: [...selectedMeals.keys()],
      });
    } catch {
      feedback.error();
      setErr('Could not create your plan. Please try again.');
      return;
    }
    feedback.success();
    setPaying(true);
    try {
      const { data } = await supabase.functions.invoke('stripe-subscribe', {
        body: { type: 'custom_plan', planId },
      });
      if (data?.url) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.location.href = data.url;
          return;
        } else {
          await WebBrowser.openBrowserAsync(data.url);
        }
      }
    } catch {
      // Stripe unavailable — plan exists, navigate anyway.
    } finally {
      setPaying(false);
    }
    router.replace(`/custom-plan?id=${planId}` as never);
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>build your plan</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>curate meals from any kitchen</Text>
          </View>
          {selCount > 0 ? (
            <View style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: ORANGE }}>{selCount} meal{selCount !== 1 ? 's' : ''}</Text>
            </View>
          ) : null}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 120 }}>

          {/* Plan name */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary }}>plan name</Text>
              <TextInput value={name} onChangeText={setName} placeholder="e.g. My Healthy Week"
                placeholderTextColor={Palette.textMuted} maxLength={60} accessibilityLabel="Plan name"
                style={{ height: 50, backgroundColor: Palette.surface, borderRadius: Radius.sm, paddingHorizontal: 16, fontFamily: Font.body, fontSize: 15, color: INK }} />
            </View>
          </MotiView>

          {/* Frequency */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 60 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary }}>frequency</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {FREQ.map((f) => {
                  const on = freq === f;
                  return (
                    <MotiView
                      key={f}
                      animate={{ backgroundColor: on ? ORANGE : Palette.surface, borderColor: on ? ORANGE : Palette.border }}
                      transition={{ type: 'timing', duration: 180 }}
                      style={{ flex: 1, borderRadius: Radius.sm, borderWidth: 1.5, overflow: 'hidden' }}>
                      <PressableScale
                        onPress={() => { feedback.tap(); setFreq(f); }}
                        accessibilityRole="button"
                        accessibilityLabel={f.charAt(0).toUpperCase() + f.slice(1)}
                        accessibilityState={{ selected: on }}
                        style={{ height: 52, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        {on ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
                        <Text style={{ fontFamily: Font.semibold, fontSize: 13, textTransform: 'capitalize', color: on ? '#fff' : Palette.textSecondary }}>{f}</Text>
                      </PressableScale>
                    </MotiView>
                  );
                })}
              </View>
            </View>
          </MotiView>

          {/* Delivery day */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 120 }}>
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary }}>fulfillment day</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {DAYS.map((d) => {
                  const on = day === d;
                  return (
                  <MotiView
                    key={d}
                    animate={{
                      backgroundColor: on ? ORANGE : Palette.surface,
                      borderColor: on ? ORANGE : Palette.border,
                    }}
                    transition={{ type: 'timing', duration: 180 }}
                    style={{ flex: 1, height: 46, borderRadius: Radius.sm, borderWidth: 1.5, overflow: 'hidden' }}>
                    <PressableScale
                      onPress={() => { feedback.tap(); setDay(d); }}
                      accessibilityRole="button"
                      accessibilityLabel={DAY_LABEL[d]}
                      accessibilityState={{ selected: on }}
                      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: on ? '#fff' : Palette.textSecondary }}>{DAY_LABEL[d]}</Text>
                    </PressableScale>
                  </MotiView>
                  );
                })}
              </View>
            </View>
          </MotiView>

          {/* Meal browser */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 180 }}>
            <View style={{ gap: 12 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary }}>add meals</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, backgroundColor: Palette.surface, borderRadius: Radius.sm, paddingHorizontal: 14 }}>
                <Search size={16} color={Palette.textMuted} />
                <TextInput value={search} onChangeText={setSearch} placeholder="search any meal…"
                  placeholderTextColor={Palette.textMuted} maxLength={100} accessibilityLabel="Search meals"
                  style={{ flex: 1, fontFamily: Font.body, fontSize: 14, color: INK }} />
                {searching ? <ActivityIndicator size="small" color={Palette.textMuted} /> : null}
              </View>
              {loadingFeatured && search.length < 2 ? (
                <ListSkeleton count={3} rowHeight={60} />
              ) : featuredError && search.length < 2 ? (
                <View style={{ alignItems: 'center', gap: 10, paddingVertical: 16 }}>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted, textAlign: 'center' }}>Couldn't load meals. Check your connection.</Text>
                  <PressableScale onPress={() => { feedback.tap(); void refetchFeatured(); }} accessibilityRole="button" accessibilityLabel="Retry loading meals"
                    style={{ paddingHorizontal: 16, height: 36, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.textSecondary }}>retry</Text>
                  </PressableScale>
                </View>
              ) : displayMeals.length === 0 ? (
                <View style={{ alignItems: 'center', gap: 10, paddingVertical: 16 }}>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted, textAlign: 'center' }}>
                    {search.length >= 2 ? 'No meals match that search.' : 'No meals available right now.'}
                  </Text>
                  {search.length < 2 ? (
                    <PressableScale onPress={() => { feedback.tap(); router.push('/'); }} accessibilityRole="button" accessibilityLabel="Browse all meals"
                      style={{ paddingHorizontal: 16, height: 36, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.textSecondary }}>Browse all meals</Text>
                    </PressableScale>
                  ) : null}
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {displayMeals.map((m) => (
                    <MealPickerRow key={m.id} meal={m} selected={selectedMeals.has(m.id)} onToggle={() => toggle(m)} />
                  ))}
                </View>
              )}
            </View>
          </MotiView>
        </ScrollView>

        {/* Sticky create button */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Palette.canvas, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 20 }}>
          {err ? (
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.danger, textAlign: 'center', marginBottom: 8 }}>{err}</Text>
          ) : null}
          <Button
            title={selCount > 0 ? `Create Plan · ${money(total)}/${freq}` : 'Select meals to continue'}
            TrailingIcon={selCount > 0 ? ChevronRight : undefined}
            variant={canCreate ? 'primary' : 'muted'}
            loading={createPlan.isPending}
            disabled={!canCreate}
            onPress={handleCreate}
            accessibilityLabel="Create meal plan"
          />
        </View>
      </SafeAreaView>
      <PaymentRedirectOverlay visible={paying} />
    </View>
  );
}
