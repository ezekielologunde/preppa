import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, ChevronLeft } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Switch, Text, View } from 'react-native';
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
              <MotiView
                key={opt}
                animate={{
                  backgroundColor: active ? Palette.brand : Palette.surface,
                  borderColor: active ? Palette.brand : Palette.border,
                }}
                transition={{ type: 'timing', duration: 180 }}
                style={{ borderRadius: Radius.pill, borderWidth: 1.5, overflow: 'hidden' }}>
                <PressableScale
                  onPress={() => { feedback.tap(); onToggle(opt); }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={opt}
                  style={{ paddingHorizontal: 14, paddingVertical: 9 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: active ? '#fff' : Palette.textSecondary }}>
                    {opt}
                  </Text>
                </PressableScale>
              </MotiView>
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
              <MotiView
                key={level}
                animate={{ backgroundColor: active ? Palette.brand : Palette.surface }}
                transition={{ type: 'timing', duration: 200 }}
                style={{ flex: 1, borderRadius: Radius.sm, overflow: 'hidden' }}>
                <PressableScale
                  onPress={() => { feedback.tap(); onSelect(level); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={level}
                  style={{ paddingVertical: 10, alignItems: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: active ? '#fff' : Palette.textSecondary }} numberOfLines={1}>
                    {level}
                  </Text>
                </PressableScale>
              </MotiView>
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
  const { fromOnboarding } = useLocalSearchParams<{ fromOnboarding?: string }>();
  const isOnboarding = fromOnboarding === 'true';

  const meta = user?.user_metadata ?? {};
  const [dietary, setDietary] = useState<string[]>((meta.dietary as string[] | undefined) ?? []);
  const [allergies, setAllergies] = useState<string[]>((meta.allergies as string[] | undefined) ?? []);
  const [cuisines, setCuisines] = useState<string[]>((meta.cuisines as string[] | undefined) ?? []);
  const [spice, setSpice] = useState<SpiceLevel>((meta.spice as SpiceLevel | undefined) ?? 'Medium');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const hasPriorConsent = !!(meta.dietary_consent_at as string | undefined);
  const hasPriorData =
    (meta.dietary as string[] | undefined)?.length ||
    (meta.allergies as string[] | undefined)?.length;
  const [consentGiven, setConsentGiven] = useState<boolean>(hasPriorConsent);

  function toggle(arr: string[], set: (v: string[]) => void, val: string) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  async function handleSave() {
    feedback.tap();
    setSaving(true);
    setSaveErr(null);
    if (!consentGiven) {
      setSaveErr('Please give consent before saving dietary and allergy data.');
      setSaving(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({
      data: { dietary, allergies, cuisines, spice, dietary_consent_at: new Date().toISOString() },
    });
    setSaving(false);
    if (!error) {
      feedback.success();
      if (isOnboarding) {
        router.replace('/');
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } else {
      feedback.error();
      setSaveErr('Could not save preferences. Please try again.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
          {!isOnboarding ? (
            <PressableScale
              onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/settings'); } }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color={Palette.ink} />
            </PressableScale>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: Palette.ink, letterSpacing: -0.7 }}>
              {isOnboarding ? 'your food preferences' : 'dietary preferences'}
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 1 }}>
              {isOnboarding ? 'help us personalise your feed — takes 30 seconds' : 'we use these to personalise your meal feed'}
            </Text>
          </View>
          {isOnboarding ? (
            <PressableScale
              onPress={() => { feedback.tap(); router.replace('/'); }}
              accessibilityRole="button"
              accessibilityLabel="Skip for now"
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: Palette.surface }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.textSecondary }}>skip</Text>
            </PressableScale>
          ) : null}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 }}>
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
            <View style={{ backgroundColor: consentGiven ? Palette.brandTint : Palette.surface, borderRadius: Radius.md, padding: 16, marginBottom: 20, borderWidth: 1.5, borderColor: consentGiven ? Palette.brand : Palette.border }}>
              {!hasPriorConsent && !!hasPriorData ? (
                <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.brand, marginBottom: 6 }}>
                  Consent required to continue storing your dietary data
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.ink, flex: 1, lineHeight: 18 }}>
                  I consent to Preppa storing my health and dietary data to personalize meal recommendations
                </Text>
                <Switch
                  value={consentGiven}
                  onValueChange={(v) => { feedback.tap(); setConsentGiven(v); }}
                  trackColor={{ false: Palette.border, true: Palette.brand }}
                  thumbColor="#fff"
                  accessibilityLabel="Consent to storing dietary and health data"
                  accessibilityRole="switch"
                />
              </View>
            </View>
          </MotiView>
          <View style={{ opacity: consentGiven ? 1 : 0.38, pointerEvents: consentGiven ? 'auto' : 'none' }}>
          <ChipGroup label="dietary restrictions" options={DIETARY} selected={dietary} onToggle={(v) => toggle(dietary, setDietary, v)} delay={0} />
          <ChipGroup label="allergies" options={ALLERGIES} selected={allergies} onToggle={(v) => toggle(allergies, setAllergies, v)} delay={80} />
          <ChipGroup label="cuisine preferences" options={CUISINES} selected={cuisines} onToggle={(v) => toggle(cuisines, setCuisines, v)} delay={160} />
          <SpiceRow selected={spice} onSelect={setSpice} />
          </View>
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
          {saveErr ? (
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.danger, textAlign: 'center', marginBottom: 8 }}>{saveErr}</Text>
          ) : null}
          <MotiView
            animate={{ backgroundColor: saved ? Palette.success : Palette.brand }}
            transition={{ type: 'timing', duration: 300 }}
            style={{ height: 56, borderRadius: Radius.pill, overflow: 'hidden', ...Shadow.floating }}>
            <PressableScale
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save preferences"
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: saving ? 0.7 : 1 }}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : saved ? (
                <>
                  <CheckCircle2 size={18} color="#fff" />
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>saved!</Text>
                </>
              ) : (
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
                  {isOnboarding ? 'save & get started' : 'save preferences'}
                </Text>
              )}
            </PressableScale>
          </MotiView>
        </View>
      </SafeAreaView>
    </View>
  );
}
