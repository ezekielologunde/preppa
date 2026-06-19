import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Day = (typeof DAYS)[number];

interface DayPickerProps {
  selected: string[];
  onChange: (days: string[]) => void;
  label?: string;
}

export function DayPicker({ selected, onChange, label = 'AVAILABLE DAYS' }: DayPickerProps) {
  function toggle(day: string) {
    feedback.tap();
    if (selected.includes(day)) {
      onChange(selected.filter((d) => d !== day));
    } else {
      onChange([...selected, day]);
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Palette.textMuted }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {DAYS.map((day) => {
          const sel = selected.includes(day);
          return (
            <MotiView
              key={day}
              animate={{ backgroundColor: sel ? Palette.brand : Palette.surface, borderColor: sel ? Palette.brand : Palette.border }}
              transition={{ type: 'timing', duration: 180 }}
              style={{ flex: 1, height: 36, borderRadius: 8, borderWidth: 1.5, overflow: 'hidden' }}>
              <PressableScale
                onPress={() => toggle(day)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: sel }}
                accessibilityLabel={`${sel ? 'Remove' : 'Add'} ${day}`}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: sel ? '#fff' : Palette.textMuted }}>
                  {day}
                </Text>
              </PressableScale>
            </MotiView>
          );
        })}
      </View>
      <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textMuted }}>
        leave empty = always available
      </Text>
    </View>
  );
}

/** Compress a days array into a human-readable label. */
export function compressDays(days: string[]): string {
  if (!days.length) return '';
  const ALL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const set = new Set(days);
  if (ALL.every((d) => set.has(d))) return 'Every day';
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  if (weekdays.every((d) => set.has(d)) && !set.has('Sat') && !set.has('Sun')) return 'Mon – Fri';
  if (set.has('Sat') && set.has('Sun') && days.length === 2) return 'Weekends';
  const sorted = ALL.filter((d) => set.has(d));
  return sorted.slice(0, 3).join(', ') + (sorted.length > 3 ? `+${sorted.length - 3}` : '');
}
