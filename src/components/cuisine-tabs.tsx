/**
 * Cuisine filter UI: CuisineTabsRow + ActiveFilterBar.
 * Both are extracted here to keep explore.tsx under 500 lines.
 */

import { ScrollView, Text, View } from 'react-native';
import { X } from 'lucide-react-native';

import { type AdvancedFilters, CUISINE_FILTER_OPTIONS, FILTER_DEFAULTS } from '@/components/explore-filter-sheet';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

type Props = {
  /** The currently active cuisine, or 'all' when none selected. */
  active: string;
  pad: number;
  /**
   * Called with the cuisine name when tapped, or 'all' when the active tab is
   * tapped again (deselect) or the "All" chip is tapped.
   */
  onSelect: (cuisine: string) => void;
};

const TABS = [{ key: 'all', label: 'All' }, ...CUISINE_FILTER_OPTIONS.map((c) => ({ key: c, label: c }))];

export function CuisineTabsRow({ active, pad, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: pad, gap: 8, paddingVertical: 6 }}>
      {TABS.map(({ key, label }) => {
        const on = key === active;
        return (
          <PressableScale
            key={key}
            onPress={() => {
              feedback.tap();
              // Tapping the active cuisine deselects it (goes back to All)
              onSelect(on && key !== 'all' ? 'all' : key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={key === 'all' ? 'All cuisines' : `Filter by ${label}`}>
            <Text
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: Radius.pill,
                overflow: 'hidden',
                fontFamily: Font.semibold,
                fontSize: 13,
                color: on ? '#fff' : Palette.textSecondary,
                backgroundColor: on ? Palette.brand : Palette.surface,
                borderWidth: on ? 0 : 1,
                borderColor: Palette.border,
              }}>
              {label}
            </Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

// ─── ActiveFilterBar ──────────────────────────────────────────────────────────

export type ActiveFilterBarProps = {
  filters: AdvancedFilters;
  pad: number;
  onRemoveCuisine: (c: string) => void;
  onRemoveDietary: (d: string) => void;
  onRemoveMaxPrice: () => void;
  onRemoveMinRating: () => void;
  onRemoveSort: () => void;
};

export function ActiveFilterBar({ filters, pad, onRemoveCuisine, onRemoveDietary, onRemoveMaxPrice, onRemoveMinRating, onRemoveSort }: ActiveFilterBarProps) {
  const chips = [
    ...filters.cuisines.map((c) => ({ key: `cuisine-${c}`, label: c, onRemove: () => onRemoveCuisine(c) })),
    ...filters.dietary.map((d) => ({ key: `diet-${d}`, label: d, onRemove: () => onRemoveDietary(d) })),
    ...(filters.maxPrice !== null ? [{ key: 'price', label: `Under $${filters.maxPrice}`, onRemove: onRemoveMaxPrice }] : []),
    ...(filters.minRating !== null ? [{ key: 'rating', label: `★ ${filters.minRating}+`, onRemove: onRemoveMinRating }] : []),
    ...(filters.sort !== FILTER_DEFAULTS.sort ? [{ key: 'sort', label: filters.sort.replace('_', ' '), onRemove: onRemoveSort }] : []),
  ];
  if (chips.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 6, paddingBottom: 6 }}>
      {chips.map((chip) => (
        <PressableScale key={chip.key} onPress={() => { feedback.tap(); chip.onRemove(); }} accessibilityRole="button" accessibilityLabel={`Remove filter: ${chip.label}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: Palette.brandTint, borderWidth: 1, borderColor: '#F6C6AC' }}>
          <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: Palette.brand }}>{chip.label}</Text>
          <X size={10} color={Palette.brand} />
        </PressableScale>
      ))}
    </ScrollView>
  );
}
