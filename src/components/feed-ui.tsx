import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';

export function PositionDots({ total, current }: { total: number; current: number }) {
  const MAX = 7;
  const shown = Math.min(total, MAX);
  return (
    <View style={{ position: 'absolute', top: 60, right: 14, gap: 4, alignItems: 'center' }}>
      {Array.from({ length: shown }, (_, i) => {
        const active = i === Math.min(current, MAX - 1);
        return (
          <MotiView
            key={i}
            animate={{ width: active ? 4 : 3, height: active ? 18 : 8, opacity: active ? 1 : 0.28 }}
            transition={{ type: 'timing', duration: 200 }}
            style={{ borderRadius: 2, backgroundColor: Palette.surface }}
          />
        );
      })}
    </View>
  );
}

export function FeedTabs({ tab, onTab }: { tab: 'following' | 'explore'; onTab: (t: 'following' | 'explore') => void }) {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, alignItems: 'center', paddingTop: 14 }} pointerEvents="box-none">
      <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: Radius.pill, padding: 3, gap: 2 }}>
        {(['following', 'explore'] as const).map((t) => (
          <PressableScale key={t} onPress={() => onTab(t)} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} accessibilityLabel={t === 'following' ? 'Following feed' : 'Explore all meals'}>
            <MotiView
              animate={{ backgroundColor: tab === t ? 'rgba(255,255,255,0.18)' : 'transparent' }}
              transition={{ type: 'timing', duration: 180 }}
              style={{ paddingHorizontal: 18, paddingVertical: 7, borderRadius: Radius.pill }}>
              <Text style={{ fontFamily: tab === t ? Font.semibold : Font.medium, fontSize: 13.5, color: tab === t ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                {t === 'following' ? 'following' : 'for you'}
              </Text>
            </MotiView>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}
