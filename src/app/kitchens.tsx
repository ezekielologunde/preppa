import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Compass } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrepperCard } from '@/components/prepper-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CardRowSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useKitchensByTag, useKitchenTags } from '@/lib/queries/preppers';

const INK = Palette.ink;

function TagChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{ paddingHorizontal: 15, height: 38, borderRadius: Radius.pill, backgroundColor: selected ? INK : Palette.surface, borderWidth: 1.5, borderColor: selected ? 'transparent' : Palette.border, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: selected ? '#fff' : Palette.inkSoft }}>{label}</Text>
    </PressableScale>
  );
}

export default function KitchensScreen() {
  const router = useRouter();
  const { tag } = useLocalSearchParams<{ tag?: string }>();
  const [selected, setSelected] = useState<string | null>(tag || null);
  const { data: tags } = useKitchenTags();
  const { data: kitchens, isLoading } = useKitchensByTag(selected);

  function pick(next: string | null) {
    feedback.tap();
    setSelected(next);
    router.setParams({ tag: next ?? '' });
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/explore'); } }} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>discover kitchens</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>find your kind of kitchen — by cuisine, diet & community</Text>
          </View>
        </View>

        {/* Tag chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, gap: 8, alignItems: 'center' }}>
          <TagChip label="All" selected={!selected} onPress={() => pick(null)} />
          {(tags ?? []).map((t) => (
            <TagChip key={t.tag} label={t.tag} selected={selected === t.tag} onPress={() => pick(t.tag)} />
          ))}
        </ScrollView>

        {/* Results */}
        {isLoading ? (
          <View style={{ paddingTop: 18 }}><CardRowSkeleton count={3} width={210} /></View>
        ) : kitchens && kitchens.length > 0 ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <MotiView
              key={selected ?? 'all'}
              from={{ opacity: 0, translateY: 8 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 240 }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary, marginBottom: 14 }}>
                {kitchens.length} {selected ? `${selected} ` : ''}kitchen{kitchens.length === 1 ? '' : 's'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
                {kitchens.map((k, i) => (
                  <MotiView key={k.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 45 }}>
                    <PrepperCard prepper={k} />
                  </MotiView>
                ))}
              </View>
            </MotiView>
          </ScrollView>
        ) : (
          <MotiView
            from={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
            <Compass size={40} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>no kitchens here yet</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textMuted, textAlign: 'center' }}>
              {selected ? `No ${selected} kitchens nearby yet — try another tag.` : 'Check back soon as more kitchens join.'}
            </Text>
          </MotiView>
        )}
      </SafeAreaView>
    </View>
  );
}
