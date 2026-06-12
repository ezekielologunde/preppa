import { useRouter } from 'expo-router';
import { CheckCircle2, ChevronLeft } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const DIETARY = ['Vegan', 'Vegetarian', 'Pescatarian', 'Halal', 'Kosher', 'Gluten-free', 'Dairy-free', 'Keto', 'Paleo', 'No pork'];
const ALLERGIES = ['Peanuts', 'Tree nuts', 'Dairy', 'Eggs', 'Fish', 'Shellfish', 'Wheat', 'Soy', 'Sesame'];
const CUISINES = ['West African', 'Caribbean', 'Nigerian', 'Jamaican', 'Mexican', 'Italian', 'Chinese', 'Japanese', 'Korean', 'Indian', 'Mediterranean', 'American', 'Thai', 'Vietnamese'];
const SPICE = ['None', 'Mild', 'Medium', 'Hot', 'Extra hot'] as const;

type SpiceLevel = typeof SPICE[number];

const ORANGE = Palette.brand;

function ChipGroup({
  label,
  options,
  selected,
  onToggle,
  delay = 0,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
  delay?: number;
}) {
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay }}>
      <View style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 }}>
            {label}
          </Text>
          {selected.length > 0 ? (
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: Palette.brandTint }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: ORANGE }}>{selected.length}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {options.map((opt) => {
            const active = selected.includes(opt);
            return (
              <PressableScale
                key={opt}
                onPress={() => { feedback.tap(); onToggle(opt); }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                accessibilityLabel={opt}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: Radius.pill,
                  backgroundColor: active ? Palette.brand : Palette.surface,
                  borderWidth: 1.5,
                  borderColor: active ? Palette.brand : Palette.border,
                }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: active ? '#fff' : Palette.textSecondary }}>
                  {opt}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>
    </MotiView>
  );
}

function SpiceRow({ selected, onSelect }: { selected: SpiceLevel; onSelect: (v: SpiceLevel) => void }) {
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 240 }}>
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
          spice tolerance
        </Text>
        <View style={{ flexDirection: 'row', backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 4, gap: 4 }}>
          {SPICE.map((level) => {
            const active = selected === level;
            return (
              <PressableScale
                key={level}
                onPress={() => { feedback.tap(); onSelect(level); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={level}
                style={{ flex: 1, paddingVertical: 10, borderRadius: Radius.sm, backgroundColor: active ? Palette.brand : 'transparent', alignItems: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: active ? '#fff' : Palette.textSecondary }} numberOfLines={1}>
                  {level}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>
    </MotiView>
  );
}

export default function DietaryPreferencesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const meta = user?.user_metadata ?? {};
  const [dietary, setDietary] = useState<string[]>((meta.dietary as string[] | undefined) ?? []);
  const [allergies, setAllergies] = useState<string[]>((meta.allergies as string[] | undefined) ?? []);
  const [cuisines, setCuisines] = useState<string[]>((meta.cuisines as string[] | undefined) ?? []);
  const [spice, setSpice] = useState<SpiceLevel>((meta.spice as SpiceLevel | undefined) ?? 'Medium');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(arr: string[], set: (v: string[]) => void, val: string) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase.auth.updateUser({
      data: { dietary, allergies, cuisines, spice },
    });
    setSaving(false);
    if (!error) {
      feedback.success();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      feedback.error?.();
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
          <PressableScale
            onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/settings'); } }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: Palette.ink, letterSpacing: -0.7 }}>dietary preferences</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 1 }}>we use these to personalise your meal feed</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 }}>
          <ChipGroup label="dietary restrictions" options={DIETARY} selected={dietary} onToggle={(v) => toggle(dietary, setDietary, v)} delay={0} />
          <ChipGroup label="allergies" options={ALLERGIES} selected={allergies} onToggle={(v) => toggle(allergies, setAllergies, v)} delay={80} />
          <ChipGroup label="cuisine preferences" options={CUISINES} selected={cuisines} onToggle={(v) => toggle(cuisines, setCuisines, v)} delay={160} />
          <SpiceRow selected={spice} onSelect={setSpice} />
          <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 260, delay: 320 }}>
            <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 14, flexDirection: 'row', gap: 10 }}>
              <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, flex: 1, lineHeight: 18 }}>
                Your preferences personalise your home feed, explore results, and meal plan recommendations. They are never shared with other users.
              </Text>
            </View>
          </MotiView>
        </ScrollView>

        {/* Sticky save */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Palette.canvas, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
          <PressableScale
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save preferences"
            style={{ height: 56, borderRadius: Radius.md, backgroundColor: saved ? Palette.success : Palette.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: saving ? 0.7 : 1, ...Shadow.floating }}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : saved ? (
              <>
                <CheckCircle2 size={18} color="#fff" />
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>saved!</Text>
              </>
            ) : (
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>save preferences</Text>
            )}
          </PressableScale>
        </View>
      </SafeAreaView>
    </View>
  );
}
