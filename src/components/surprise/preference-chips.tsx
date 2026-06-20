import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

// ─── Constants ────────────────────────────────────────────────────────────────

export const BUDGET_OPTIONS = [
  { label: 'Under $10', value: 10 },
  { label: 'Under $15', value: 15 },
  { label: 'Under $20', value: 20 },
  { label: 'Under $25', value: 25 },
  { label: 'Any budget', value: 0 },
] as const;

export interface VibeOption {
  label: string;
  color: string;
  tag?: string;
  category?: string;
}

export const VIBE_OPTIONS: VibeOption[] = [
  { label: 'High Protein', tag: 'High-Protein',   color: '#ef4444' },
  { label: 'Vegan',        tag: 'Vegan-Friendly',  color: '#22c55e' },
  { label: 'Comfort Food', tag: 'Comfort',          color: Palette.amber },
  { label: 'Keto',         tag: 'Keto',             color: '#8b5cf6' },
  { label: 'Family',       tag: 'Family Meals',     color: '#3b82f6' },
  { label: 'Breakfast',    category: 'breakfast',   color: '#f97316' },
  { label: 'Light & Clean',tag: 'Low-Calorie',      color: '#06b6d4' },
  { label: 'Spicy',        tag: 'Spicy',            color: '#ef4444' },
];

// ─── Chip ─────────────────────────────────────────────────────────────────────

export interface ChipProps {
  label: string;
  color: string;
  active: boolean;
  onPress: () => void;
}

export function Chip({ label, color, active, onPress }: ChipProps) {
  return (
    <MotiView
      animate={{
        backgroundColor: active ? color + '22' : Palette.surface,
        borderColor: active ? color : Palette.border,
      }}
      transition={{ type: 'timing', duration: 180 }}
      style={{ borderRadius: Radius.pill, borderWidth: 1.5, overflow: 'hidden', ...Shadow.card }}>
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
        style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: active ? color : Palette.textSecondary }}>
          {label}
        </Text>
      </PressableScale>
    </MotiView>
  );
}

// ─── BudgetPicker ─────────────────────────────────────────────────────────────

export interface BudgetPickerProps {
  budget: number;
  onSelect: (value: number) => void;
}

export function BudgetPicker({ budget, onSelect }: BudgetPickerProps) {
  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
      <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink, marginBottom: 12 }}>
        budget
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {BUDGET_OPTIONS.map((b) => (
          <Chip
            key={b.value}
            label={b.label}
            color={Palette.brand}
            active={budget === b.value}
            onPress={() => { feedback.tap(); onSelect(b.value); }}
          />
        ))}
      </View>
    </View>
  );
}

// ─── VibePicker ───────────────────────────────────────────────────────────────

export interface VibePickerProps {
  vibe: VibeOption | null;
  onSelect: (vibe: VibeOption | null) => void;
}

export function VibePicker({ vibe, onSelect }: VibePickerProps) {
  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
      <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink, marginBottom: 12 }}>
        vibe{' '}
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>
          (optional)
        </Text>
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {VIBE_OPTIONS.map((v) => (
          <Chip
            key={v.label}
            label={v.label}
            color={v.color}
            active={vibe?.label === v.label}
            onPress={() => { feedback.tap(); onSelect(vibe?.label === v.label ? null : v); }}
          />
        ))}
      </View>
    </View>
  );
}
