import { MotiView } from 'moti';
import { ScrollView, Text } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

import type { FilterKey } from './experience-card';

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_CHIPS: { key: FilterKey; label: string }[] = [
  { key: 'all',    label: 'All' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'lunch',  label: 'Lunch' },
  { key: 'class',  label: 'Class' },
  { key: 'popup',  label: 'Pop-up' },
];

// ─── FilterChips ──────────────────────────────────────────────────────────────

export interface FilterChipsProps {
  active: FilterKey;
  onSelect: (key: FilterKey) => void;
}

export function FilterChips({ active, onSelect }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8 }}>
      {FILTER_CHIPS.map((chip) => {
        const isActive = chip.key === active;
        return (
          <PressableScale
            key={chip.key}
            onPress={() => { feedback.tap(); onSelect(chip.key); }}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${chip.label}`}>
            <MotiView
              animate={{ scale: isActive ? 1 : 0.97 }}
              transition={{ type: 'spring', damping: 20, stiffness: 260 }}
              style={{
                height: 36,
                borderRadius: 18,
                paddingHorizontal: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isActive ? Palette.brand : Palette.surface,
                borderWidth: isActive ? 0 : 1,
                borderColor: Palette.border,
              }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: isActive ? '#fff' : Palette.textSecondary }}>
                {chip.label}
              </Text>
            </MotiView>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}
