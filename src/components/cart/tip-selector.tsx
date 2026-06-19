import { Heart } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const money = (n: number) => `$${n.toFixed(2)}`;

const TIPS = [0, 1, 2, 5];

interface Props {
  tip: number;
  setTip: (t: number) => void;
  customTip: boolean;
  setCustomTip: (v: boolean) => void;
  prepper: string;
}

export function TipSelector({ tip, setTip, customTip, setCustomTip, prepper }: Props) {
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 }}>
        <Heart size={16} color={ORANGE} fill={ORANGE} />
        <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>Add a tip</Text>
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>
          · 100% goes to {prepper}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {TIPS.map((t) => {
          const on = !customTip && tip === t;
          return (
            <MotiView
              key={t}
              animate={{ backgroundColor: on ? ORANGE : Palette.surface, borderColor: on ? ORANGE : Palette.border }}
              transition={{ type: 'timing', duration: 180 }}
              style={{ flex: 1, borderRadius: Radius.pill, borderWidth: 1.5, overflow: 'hidden' }}
            >
              <PressableScale
                onPress={() => { feedback.tap(); setCustomTip(false); setTip(t); }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t === 0 ? 'No tip' : `Tip ${money(t)}`}
                style={{ height: 46, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: on ? '#fff' : INK }}>
                  {t === 0 ? 'None' : money(t)}
                </Text>
              </PressableScale>
            </MotiView>
          );
        })}
        <MotiView
          animate={{
            backgroundColor: customTip ? Palette.brandTint : Palette.surface,
            borderColor: customTip ? ORANGE : Palette.border,
          }}
          transition={{ type: 'timing', duration: 180 }}
          style={{ flex: 1, borderRadius: Radius.pill, borderWidth: 1.5, overflow: 'hidden' }}
        >
          <PressableScale
            onPress={() => { feedback.tap(); setCustomTip(true); setTip(0); }}
            accessibilityRole="button"
            accessibilityState={{ selected: customTip }}
            accessibilityLabel="Custom tip"
            style={{ height: 46, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: customTip ? Palette.brandPressed : INK }}>
              Custom
            </Text>
          </PressableScale>
        </MotiView>
      </View>
      {customTip ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: Palette.surface,
            borderRadius: Radius.md,
            borderWidth: 1.5,
            borderColor: ORANGE,
            paddingHorizontal: 14,
            height: 50,
            gap: 6,
          }}
        >
          <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK }}>$</Text>
          <TextInput
            value={tip ? String(tip) : ''}
            onChangeText={(t) => {
              const n = Number(t.replace(/[^0-9.]/g, ''));
              setTip(Number.isFinite(n) ? Math.min(n, 200) : 0);
            }}
            placeholder="0"
            placeholderTextColor={Palette.textMuted}
            keyboardType="decimal-pad"
            autoFocus
            maxLength={6}
            accessibilityLabel="Custom tip amount"
            style={{ flex: 1, fontFamily: Font.display, fontSize: 20, color: INK }}
          />
        </View>
      ) : null}
    </>
  );
}
