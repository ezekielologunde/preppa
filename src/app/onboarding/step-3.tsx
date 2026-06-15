import { useRouter } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { markFtueComplete } from '@/app/_layout';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const DIETARY = ['Vegan', 'Vegetarian', 'Pescatarian', 'Halal', 'Kosher', 'Gluten-free', 'Dairy-free', 'Keto', 'Paleo', 'No pork'];
const ALLERGIES = ['Peanuts', 'Tree nuts', 'Dairy', 'Eggs', 'Fish', 'Shellfish', 'Wheat', 'Soy', 'Sesame'];
const SPICE = ['None', 'Mild', 'Medium', 'Hot', 'Extra hot'] as const;
type SpiceLevel = typeof SPICE[number];

function Chip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <MotiView animate={{ backgroundColor: active ? Palette.brand : Palette.surface, borderColor: active ? Palette.brand : Palette.border }}
      transition={{ type: 'timing', duration: 180 }}
      style={{ borderRadius: Radius.pill, borderWidth: 1.5 }}>
      <PressableScale onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: active }} accessibilityLabel={label}
        style={{ paddingHorizontal: 14, paddingVertical: 9 }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: active ? '#fff' : Palette.textSecondary }}>{label}</Text>
      </PressableScale>
    </MotiView>
  );
}

export default function OnboardingStep3() {
  const router = useRouter();
  const { user } = useAuth();

  const meta = user?.user_metadata ?? {};
  const [dietary, setDietary] = useState<string[]>((meta.dietary as string[] | undefined) ?? []);
  const [allergies, setAllergies] = useState<string[]>((meta.allergies as string[] | undefined) ?? []);
  const [spice, setSpice] = useState<SpiceLevel>((meta.spice as SpiceLevel | undefined) ?? 'Medium');
  const [saving, setSaving] = useState(false);

  function toggle(arr: string[], set: (v: string[]) => void, val: string) {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  }

  async function handleSave() {
    feedback.tap();
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { dietary, allergies, spice } });
    if (!error && user) {
      await markFtueComplete(user.id);
      feedback.success();
      router.replace('/');
    } else {
      feedback.error();
      setSaving(false);
    }
  }

  async function handleSkip() {
    feedback.tap();
    if (user) await markFtueComplete(user.id);
    router.replace('/');
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 26, color: Palette.ink, letterSpacing: -0.8 }}>your food preferences</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 2 }}>
              helps us personalise your feed — 30 seconds
            </Text>
          </View>
          <PressableScale onPress={handleSkip} accessibilityRole="button" accessibilityLabel="Skip dietary preferences"
            style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill, backgroundColor: Palette.surface }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.textSecondary }}>skip</Text>
          </PressableScale>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
            dietary restrictions
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
            {DIETARY.map((d) => <Chip key={d} label={d} active={dietary.includes(d)} onToggle={() => toggle(dietary, setDietary, d)} />)}
          </View>

          <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
            allergies
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
            {ALLERGIES.map((a) => <Chip key={a} label={a} active={allergies.includes(a)} onToggle={() => toggle(allergies, setAllergies, a)} />)}
          </View>

          <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
            spice tolerance
          </Text>
          <View style={{ flexDirection: 'row', backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 4, gap: 4 }}>
            {SPICE.map((level) => {
              const active = spice === level;
              return (
                <MotiView key={level} animate={{ backgroundColor: active ? Palette.brand : Palette.surface }} transition={{ type: 'timing', duration: 200 }}
                  style={{ flex: 1, borderRadius: Radius.sm }}>
                  <PressableScale onPress={() => { feedback.tap(); setSpice(level); }} accessibilityRole="radio" accessibilityState={{ selected: active }} accessibilityLabel={level}
                    style={{ paddingVertical: 10, alignItems: 'center' }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: active ? '#fff' : Palette.textSecondary }} numberOfLines={1}>{level}</Text>
                  </PressableScale>
                </MotiView>
              );
            })}
          </View>
        </ScrollView>

        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Palette.canvas, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
          <MotiView animate={{ backgroundColor: Palette.brand }} style={{ height: 56, borderRadius: Radius.pill, overflow: 'hidden', ...Shadow.floating }}>
            <PressableScale onPress={handleSave} disabled={saving} accessibilityRole="button" accessibilityLabel="Save preferences and start"
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: saving ? 0.7 : 1 }}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <CheckCircle2 size={18} color="#fff" />
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>save & get started</Text>
                </>
              )}
            </PressableScale>
          </MotiView>
        </View>
      </SafeAreaView>
    </View>
  );
}
