import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProgressDots } from '@/components/onboarding/progress-dots';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

const DIETARY_OPTIONS = [
  'Vegan', 'Vegetarian', 'Halal', 'Gluten-free',
  'Dairy-free', 'Kosher', 'Nut-free', 'No pork', 'No shellfish', 'Pescatarian',
];

function DietChip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <MotiView
      animate={{
        backgroundColor: active ? Palette.brand : Palette.surface,
        borderColor: active ? Palette.brand : Palette.border,
      }}
      transition={{ type: 'spring', damping: 14, stiffness: 260 }}
      style={{ borderRadius: 22, borderWidth: 1.5, overflow: 'hidden' }}>
      <PressableScale
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: active }}
        accessibilityLabel={label}
        style={{ height: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
        <Text
          style={{
            fontFamily: active ? Font.semibold : Font.medium,
            fontSize: 13.5,
            color: active ? '#fff' : Palette.inkSoft,
          }}>
          {label}
        </Text>
      </PressableScale>
    </MotiView>
  );
}

export default function Step2Dietary() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string }>();
  const name = params.name ?? '';

  const [selected, setSelected] = useState<string[]>([]);

  function toggle(key: string) {
    feedback.tap();
    setSelected((s) => s.includes(key) ? s.filter((k) => k !== key) : [...s, key]);
  }

  function handleNext() {
    feedback.tap();
    router.push({
      pathname: '/onboarding/step-3',
      params: { name, dietary: selected.join(',') },
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
        <ProgressDots total={4} current={2} />

        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateX: 40 }}
          animate={{ opacity: 1, translateX: 0 }}
          transition={{ type: 'spring', damping: 18, stiffness: 160 }}
          style={{ paddingHorizontal: 24, paddingTop: 12 }}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <ChevronLeft size={22} color={Palette.inkSoft} strokeWidth={2} />
          </Pressable>

          <Text
            style={{
              fontFamily: Font.display,
              fontSize: 30,
              color: Palette.ink,
              letterSpacing: -0.8,
              lineHeight: 38,
              marginBottom: 6,
            }}>
            what do you eat?
          </Text>
          <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, lineHeight: 21, marginBottom: 24 }}>
            Select everything that applies — we'll filter your feed accordingly.
          </Text>
        </MotiView>

        {/* Chips grid */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DIETARY_OPTIONS.map((opt) => (
              <DietChip
                key={opt}
                label={opt}
                active={selected.includes(opt)}
                onToggle={() => toggle(opt)}
              />
            ))}
          </View>
        </ScrollView>

        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, textAlign: 'center', marginTop: 12, paddingHorizontal: 24 }}>
          You can update these anytime in your profile
        </Text>

        {/* CTA */}
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 260, delay: 160 }}
          style={{ paddingHorizontal: 24, paddingBottom: 24, gap: 8 }}>
          <PressableScale
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel={selected.length ? `Continue with ${selected.length} selected` : 'Continue'}
            style={{
              height: 54,
              borderRadius: Radius.pill,
              backgroundColor: Palette.brand,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
              {selected.length ? `Continue (${selected.length} selected)` : 'Continue'}
            </Text>
          </PressableScale>

          <PressableScale
            onPress={() => {
              feedback.tap();
              router.push({ pathname: '/onboarding/step-3', params: { name, dietary: '' } });
            }}
            accessibilityRole="button"
            accessibilityLabel="Skip dietary preferences"
            style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.textSecondary }}>Skip</Text>
          </PressableScale>
        </MotiView>
      </SafeAreaView>
    </View>
  );
}
