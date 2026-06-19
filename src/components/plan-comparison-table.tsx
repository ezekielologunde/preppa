import { Check, X } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import type { MealPlan } from '@/lib/queries/meal-plans';

type ComparisonFeature = {
  label: string;
  getValue: (plan: MealPlan, tier: number) => boolean | string;
};

const FEATURES: ComparisonFeature[] = [
  { label: 'Meals per cycle', getValue: (p) => `${p.meals_per_cycle}` },
  { label: 'Prepper choice', getValue: (_p, tier) => tier >= 1 },
  { label: 'Meal customization', getValue: (_p, tier) => tier >= 2 },
  { label: 'Priority scheduling', getValue: (_p, tier) => tier >= 2 },
  { label: 'Free delivery', getValue: (_p, tier) => tier >= 1 },
  { label: 'Cancel anytime', getValue: () => true },
];

const money = (n: number) => `$${n.toLocaleString('en-US')}`;

function CheckMark({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.ink, textAlign: 'center' }}>{value}</Text>;
  }
  return value
    ? <Check size={14} color={Palette.success} />
    : <X size={14} color={Palette.textMuted} />;
}

/** Horizontally scrollable plan comparison table derived from live plan data. */
export function PlanComparisonTable({ plans }: { plans: MealPlan[] }) {
  if (plans.length === 0) return null;

  // Sort by price ascending to assign tier (cheapest = 0, priciest = last).
  const sorted = [...plans].sort((a, b) => a.price - b.price);
  const tierOf = (p: MealPlan) => sorted.findIndex((s) => s.id === p.id);

  const COL = 96;
  const LABEL_COL = 140;

  return (
    <View style={{ marginTop: 24, marginBottom: 4 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 16, color: Palette.ink, letterSpacing: -0.4, paddingHorizontal: 20, marginBottom: 12 }}>
        compare plans
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
        {/* Sticky label column */}
        <View style={{ width: LABEL_COL }}>
          {/* Header spacer */}
          <View style={{ height: 52 }} />
          {FEATURES.map((f, i) => (
            <View key={f.label} style={{ height: 40, justifyContent: 'center', backgroundColor: i % 2 === 0 ? Palette.canvas : Palette.surface }}>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.inkSoft }}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* One column per plan */}
        {sorted.map((plan) => {
          const tier = tierOf(plan);
          return (
            <View key={plan.id} style={{ width: COL }}>
              {/* Plan header */}
              <View style={{ height: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.brand, textAlign: 'center' }} numberOfLines={1}>
                  {plan.name}
                </Text>
                <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.brand, textAlign: 'center' }}>
                  {money(plan.price)}
                </Text>
              </View>
              {FEATURES.map((f, i) => {
                const val = f.getValue(plan, tier);
                return (
                  <View key={f.label} style={{ height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: i % 2 === 0 ? Palette.canvas : Palette.surface }}>
                    <CheckMark value={val} />
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>

      {/* Bottom border */}
      <View style={{ height: 1, backgroundColor: Palette.border, marginHorizontal: 20, marginTop: 2, borderRadius: Radius.pill }} />
    </View>
  );
}
