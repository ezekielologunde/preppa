import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const STEPS = 3;

const DIETARY_OPTIONS = [
  { key: 'High Protein', emoji: '💪' },
  { key: 'Keto', emoji: '🥑' },
  { key: 'Plant-Based', emoji: '🌿' },
  { key: 'Gluten-Free', emoji: '🌾' },
  { key: 'Halal', emoji: '☪️' },
  { key: 'Vegan', emoji: '🌱' },
  { key: 'Dairy-Free', emoji: '🥛' },
  { key: 'Low-Carb', emoji: '📉' },
  { key: 'Paleo', emoji: '🍖' },
  { key: 'Kosher', emoji: '✡️' },
];

const INTENT_OPTIONS = [
  {
    key: 'plans',
    emoji: '📅',
    title: 'Automated weekly meal plans',
    desc: 'Set it and forget it — curated fresh meals from local chefs every week.',
  },
  {
    key: 'drops',
    emoji: '⚡',
    title: 'Explore & order individual drops',
    desc: 'Browse the latest chef drops and order exactly what you want, when you want.',
  },
];

// ─── Step progress bar ────────────────────────────────────────────────────────

function StepBar({ current }: { current: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 4 }}>
      {Array.from({ length: STEPS }, (_, i) => (
        <MotiView key={i}
          animate={{ flex: i <= current ? 2 : 1, backgroundColor: i <= current ? Palette.brand : 'rgba(255,255,255,0.15)' }}
          transition={{ type: 'spring', damping: 16, stiffness: 180 }}
          style={{ height: 3, borderRadius: 2 }} />
      ))}
    </View>
  );
}

// ─── Step 1: Location ─────────────────────────────────────────────────────────

function StepLocation({ onNext }: { onNext: (city: string) => void }) {
  const [city, setCity] = useState('');
  return (
    <MotiView from={{ opacity: 0, translateX: 40 }} animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: -40 }}
      transition={{ type: 'spring', damping: 18, stiffness: 160 }}
      style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
      <MotiView from={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 140, delay: 100 }}
        style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(241,95,34,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <Text style={{ fontSize: 36 }}>📍</Text>
      </MotiView>
      <Text style={{ fontFamily: Font.display, fontSize: 26, color: '#fff', letterSpacing: -0.6, marginBottom: 10 }}>
        where are you?
      </Text>
      <Text style={{ fontFamily: Font.body, fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 22, marginBottom: 28 }}>
        We use your location to surface the best local chefs within miles of you.
      </Text>
      <TextInput
        value={city}
        onChangeText={setCity}
        placeholder="City or zip code"
        placeholderTextColor="rgba(255,255,255,0.3)"
        maxLength={100}
        style={{ height: 54, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 16, fontSize: 16, fontFamily: Font.body, color: '#fff', marginBottom: 16 }}
        returnKeyType="done"
        onSubmitEditing={() => onNext(city.trim())}
      />
      <PressableScale onPress={() => { feedback.tap(); onNext(city.trim()); }}
        style={{ height: 54, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
          {city.trim() ? 'continue →' : 'skip for now →'}
        </Text>
      </PressableScale>
    </MotiView>
  );
}

// ─── Step 2: Dietary profile ──────────────────────────────────────────────────

function StepDietary({ onNext }: { onNext: (selected: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(key: string) {
    feedback.tap();
    setSelected((s) => s.includes(key) ? s.filter((k) => k !== key) : [...s, key]);
  }

  return (
    <MotiView from={{ opacity: 0, translateX: 40 }} animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: -40 }}
      transition={{ type: 'spring', damping: 18, stiffness: 160 }}
      style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 26, color: '#fff', letterSpacing: -0.6, marginBottom: 8 }}>
        your dietary profile
      </Text>
      <Text style={{ fontFamily: Font.body, fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 22, marginBottom: 24 }}>
        Select all that apply. We'll tailor your feed around your lifestyle.
      </Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: 24 }}>
        {DIETARY_OPTIONS.map((opt, i) => {
          const active = selected.includes(opt.key);
          return (
            <MotiView key={opt.key}
              animate={{ scale: active ? 1.06 : 1, backgroundColor: active ? Palette.brand : 'rgba(255,255,255,0.08)' }}
              transition={{ type: 'spring', damping: 12, stiffness: 260, delay: i * 30 }}>
              <PressableScale onPress={() => toggle(opt.key)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 40, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: active ? Palette.brand : 'rgba(255,255,255,0.15)' }}>
                <Text style={{ fontSize: 16 }}>{opt.emoji}</Text>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: active ? '#fff' : 'rgba(255,255,255,0.75)' }}>{opt.key}</Text>
                {active ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
              </PressableScale>
            </MotiView>
          );
        })}
      </ScrollView>
      <PressableScale onPress={() => { feedback.success(); onNext(selected); }}
        style={{ height: 54, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
          {selected.length ? `looks good (${selected.length} selected)` : 'skip for now →'}
        </Text>
      </PressableScale>
    </MotiView>
  );
}

// ─── Step 3: Intent ───────────────────────────────────────────────────────────

function StepIntent({ onDone }: { onDone: (intent: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <MotiView from={{ opacity: 0, translateX: 40 }} animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: -40 }}
      transition={{ type: 'spring', damping: 18, stiffness: 160 }}
      style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 26, color: '#fff', letterSpacing: -0.6, marginBottom: 8 }}>
        how do you want to use preppa?
      </Text>
      <Text style={{ fontFamily: Font.body, fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 22, marginBottom: 28 }}>
        This shapes your home feed. You can change it anytime in settings.
      </Text>
      <View style={{ gap: 12, flex: 1 }}>
        {INTENT_OPTIONS.map((opt) => {
          const active = selected === opt.key;
          return (
            <MotiView key={opt.key}
              animate={{ scale: active ? 1.02 : 1, borderColor: active ? Palette.brand : 'rgba(255,255,255,0.12)' }}
              transition={{ type: 'spring', damping: 14, stiffness: 260 }}
              style={{ borderWidth: 2, borderRadius: 20, overflow: 'hidden' }}>
              <PressableScale onPress={() => { feedback.tap(); setSelected(opt.key); }}
                style={{ padding: 20, flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: active ? 'rgba(241,95,34,0.12)' : 'rgba(255,255,255,0.04)' }}>
                <Text style={{ fontSize: 32 }}>{opt.emoji}</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>{opt.title}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 19 }}>{opt.desc}</Text>
                </View>
                {active ? (
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={14} color="#fff" strokeWidth={3} />
                  </View>
                ) : null}
              </PressableScale>
            </MotiView>
          );
        })}
      </View>
      <PressableScale onPress={() => { feedback.success(); onDone(selected ?? 'drops'); }}
        style={{ height: 54, borderRadius: Radius.pill, backgroundColor: selected ? Palette.brand : 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 4 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
          {selected ? 'build my feed →' : 'skip and explore →'}
        </Text>
      </PressableScale>
    </MotiView>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function OnboardingFlow() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  async function finish(intent: string, dietary: string[], city: string) {
    setSaving(true);
    try {
      await supabase.auth.updateUser({
        data: { dietary_preferences: dietary, preppa_intent: intent, onboarding_city: city || null },
      });
    } catch {
      // Non-fatal — preferences can be set later
    }
    feedback.success();
    setSaving(false);
    router.replace('/');
  }

  const [city, setCity] = useState('');
  const [dietary, setDietary] = useState<string[]>([]);

  if (saving) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0b0604', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <ActivityIndicator color={Palette.brand} size="large" />
        <Text style={{ fontFamily: Font.body, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>setting up your feed…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0b0604' }}>
      {/* Ambient glow */}
      <MotiView from={{ opacity: 0.5, translateY: -8 }} animate={{ opacity: 0.9, translateY: 12 }}
        transition={{ type: 'timing', duration: 5000, loop: true, repeatReverse: true }} pointerEvents="none"
        style={{ position: 'absolute', top: -120, alignSelf: 'center', width: 400, height: 400, borderRadius: 200,
          experimental_backgroundImage: 'radial-gradient(circle, rgba(241,95,34,0.18), transparent 70%)' }} />
      <SafeAreaView style={{ flex: 1 }}>
        <StepBar current={step} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {step === 0 ? (
            <StepLocation onNext={(c) => { setCity(c); setStep(1); }} />
          ) : step === 1 ? (
            <StepDietary onNext={(d) => { setDietary(d); setStep(2); }} />
          ) : (
            <StepIntent onDone={(i) => finish(i, dietary, city)} />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
