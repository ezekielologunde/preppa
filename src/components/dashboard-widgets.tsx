import { type LucideIcon } from 'lucide-react-native';
import { Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

const CARD = Palette.surface;
const INK = Palette.ink;
const MUTED = Palette.textMuted;

export function Sparkline({ color, data, w = 116, h = 30 }: { color: string; data: number[]; w?: number; h?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(' ');
  return (
    <Svg width={w} height={h}>
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

export function Ring({ pct, color, size = 96, stroke = 9 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  const center = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={center} cy={center} r={r} stroke={Palette.border} strokeWidth={stroke} fill="none" />
      <Circle
        cx={center}
        cy={center}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
    </Svg>
  );
}

export function StatCard({ Icon, value, label, trend, color, spark, onPress, flex }: { Icon: LucideIcon; value: string; label: string; trend: string; color: string; spark: number[]; onPress?: () => void; flex?: boolean }) {
  return (
    <PressableScale onPress={onPress ? () => { feedback.tap(); onPress(); } : undefined} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={flex ? { flexBasis: '47%', flexGrow: 1, backgroundColor: CARD, borderRadius: 20, padding: 14, gap: 6 } : { width: 150, backgroundColor: CARD, borderRadius: 22, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: color + '24', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={19} color={color} />
        </View>
        <Text style={{ fontFamily: Font.semibold, fontSize: 12, color }}>{trend}</Text>
      </View>
      <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: MUTED }}>{label}</Text>
      <Text style={{ fontFamily: Font.display, fontSize: 26, color: INK, letterSpacing: -0.6 }}>{value}</Text>
      <Sparkline color={color} data={spark} />
    </PressableScale>
  );
}
