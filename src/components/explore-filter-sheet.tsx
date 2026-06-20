/**
 * ExploreFilterSheet — bottom-sheet filter panel for the Explore tab.
 * Uses Modal + MotiView (no third-party sheet library).
 * Exports: AdvancedFilters, FILTER_DEFAULTS, countActiveFilters, ExploreFilterSheet
 */

import { MotiView } from 'moti';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdvancedFilters = {
  cuisines: string[];
  dietary: string[];
  maxPrice: number | null;
  minRating: number | null;
  sort: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'nearest';
  fulfillment: 'any' | 'pickup' | 'delivery';
};

export const FILTER_DEFAULTS: AdvancedFilters = {
  cuisines: [],
  dietary: [],
  maxPrice: null,
  minRating: null,
  sort: 'relevance',
  fulfillment: 'any',
};

export function countActiveFilters(f: AdvancedFilters): number {
  return (
    f.cuisines.length +
    f.dietary.length +
    (f.maxPrice !== null ? 1 : 0) +
    (f.minRating !== null ? 1 : 0) +
    (f.sort !== 'relevance' ? 1 : 0) +
    (f.fulfillment !== 'any' ? 1 : 0)
  );
}

// ─── Static data ──────────────────────────────────────────────────────────────

export const CUISINE_FILTER_OPTIONS = [
  'Nigerian', 'West African', 'Caribbean', 'Soul Food', 'African',
  'Asian', 'Mediterranean', 'Mexican', 'Italian', 'American',
];

const CUISINES = CUISINE_FILTER_OPTIONS;

const DIETARY = [
  'Vegan', 'Vegetarian', 'Gluten-free', 'Halal', 'Kosher',
  'Dairy-free', 'Nut-free', 'Keto', 'High-protein',
];

const PRICE_OPTIONS = [
  { label: 'Under $15', value: 15 },
  { label: 'Under $25', value: 25 },
  { label: 'Under $40', value: 40 },
] as const;

const RATING_OPTIONS = [
  { label: '★ 3+', value: 3 },
  { label: '★ 4+', value: 4 },
  { label: '★ 4.5+', value: 4.5 },
] as const;

const FULFILLMENT_OPTIONS: { label: string; value: AdvancedFilters['fulfillment'] }[] = [
  { label: 'Any', value: 'any' },
  { label: '🏠 Pickup', value: 'pickup' },
  { label: '🚗 Delivery', value: 'delivery' },
];

const SORT_OPTIONS: { label: string; value: AdvancedFilters['sort'] }[] = [
  { label: 'Relevance',  value: 'relevance' },
  { label: 'Nearest',   value: 'nearest' },
  { label: 'Price ↑',   value: 'price_asc' },
  { label: 'Price ↓',   value: 'price_desc' },
  { label: 'Top rated', value: 'rating' },
  { label: 'Newest',    value: 'newest' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label}>
      <MotiView
        animate={{ backgroundColor: selected ? Palette.brand : Palette.canvas }}
        transition={{ type: 'timing', duration: 160 }}
        style={{
          height: 34,
          borderRadius: 17,
          paddingHorizontal: 14,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: selected ? Palette.brand : Palette.border,
        }}>
        <Text style={{ fontFamily: Font.medium, fontSize: 13, color: selected ? '#fff' : Palette.inkSoft }}>
          {label}
        </Text>
      </MotiView>
    </PressableScale>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={{
      fontFamily: Font.semibold,
      fontSize: 11,
      color: Palette.textSecondary,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      marginBottom: 10,
    }}>
      {children}
    </Text>
  );
}

function ChipGroup({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
      {children}
    </View>
  );
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  initial: AdvancedFilters;
  isTabletUp: boolean;
  onClose: () => void;
  onApply: (filters: AdvancedFilters) => void;
};

export function ExploreFilterSheet({ visible, initial, isTabletUp, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<AdvancedFilters>(initial);

  function handleOpen() {
    // Reset draft to current applied filters each time the sheet opens
    setDraft(initial);
  }

  function toggleMulti(field: 'cuisines' | 'dietary', value: string) {
    feedback.tap();
    setDraft((prev) => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value],
      };
    });
  }

  function toggleSingle<K extends 'maxPrice' | 'minRating'>(field: K, value: AdvancedFilters[K]) {
    feedback.tap();
    setDraft((prev) => ({ ...prev, [field]: prev[field] === value ? null : value }));
  }

  function toggleSort(value: AdvancedFilters['sort']) {
    feedback.tap();
    setDraft((prev) => ({ ...prev, sort: prev.sort === value ? 'relevance' : value }));
  }

  function handleClearAll() {
    feedback.tap();
    setDraft(FILTER_DEFAULTS);
  }

  function handleApply() {
    feedback.tap();
    onApply(draft);
  }

  const activeCount = countActiveFilters(draft);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onShow={handleOpen}
      statusBarTranslucent
      onRequestClose={onClose}>

      {/* Scrim */}
      <Pressable
        style={{ flex: 1, backgroundColor: Palette.overlay }}
        onPress={onClose}
        accessibilityLabel="Close filter panel"
        accessibilityRole="button"
      />

      {/* Slide-up panel */}
      <MotiView
        from={{ translateY: 640 }}
        animate={{ translateY: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: isTabletUp ? '10%' : 0,
          right: isTabletUp ? '10%' : 0,
          backgroundColor: Palette.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: '88%',
          ...Shadow.floating,
        }}>

        {/* Drag handle */}
        <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 2 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: Palette.border }} />
        </View>

        {/* Header row */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
        }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 18, color: Palette.ink, letterSpacing: -0.3 }}>
            filters
          </Text>
          {activeCount > 0 ? (
            <PressableScale onPress={handleClearAll} accessibilityRole="button" accessibilityLabel="Clear all filters">
              <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.brand }}>
                clear all
              </Text>
            </PressableScale>
          ) : null}
        </View>

        <View style={{ height: 1, backgroundColor: Palette.border, marginHorizontal: 20 }} />

        {/* Filter sections */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>

          <SectionLabel>cuisine</SectionLabel>
          <ChipGroup>
            {CUISINES.map((c) => (
              <FilterChip
                key={c}
                label={c}
                selected={draft.cuisines.includes(c)}
                onPress={() => toggleMulti('cuisines', c)}
              />
            ))}
          </ChipGroup>

          <SectionLabel>dietary</SectionLabel>
          <ChipGroup>
            {DIETARY.map((d) => (
              <FilterChip
                key={d}
                label={d}
                selected={draft.dietary.includes(d.toLowerCase())}
                onPress={() => toggleMulti('dietary', d.toLowerCase())}
              />
            ))}
          </ChipGroup>

          <SectionLabel>max price</SectionLabel>
          <ChipGroup>
            {PRICE_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                label={opt.label}
                selected={draft.maxPrice === opt.value}
                onPress={() => toggleSingle('maxPrice', opt.value)}
              />
            ))}
          </ChipGroup>

          <SectionLabel>min rating</SectionLabel>
          <ChipGroup>
            {RATING_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                label={opt.label}
                selected={draft.minRating === opt.value}
                onPress={() => toggleSingle('minRating', opt.value)}
              />
            ))}
          </ChipGroup>

          <SectionLabel>sort by</SectionLabel>
          <ChipGroup>
            {SORT_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                label={opt.label}
                selected={draft.sort === opt.value}
                onPress={() => toggleSort(opt.value)}
              />
            ))}
          </ChipGroup>

          <SectionLabel>fulfillment</SectionLabel>
          <ChipGroup>
            {FULFILLMENT_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                label={opt.label}
                selected={draft.fulfillment === opt.value}
                onPress={() => {
                  feedback.tap();
                  setDraft((prev) => ({ ...prev, fulfillment: opt.value }));
                }}
              />
            ))}
          </ChipGroup>

        </ScrollView>

        {/* Apply CTA */}
        <View style={{
          paddingHorizontal: 20,
          paddingBottom: 36,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: Palette.border,
        }}>
          <PressableScale onPress={handleApply} accessibilityRole="button" accessibilityLabel="Apply filters">
            <View style={{
              height: 52,
              borderRadius: Radius.pill,
              backgroundColor: Palette.brand,
              alignItems: 'center',
              justifyContent: 'center',
              ...Shadow.card,
            }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>
                {activeCount > 0
                  ? `show results  •  ${activeCount} filter${activeCount === 1 ? '' : 's'} active`
                  : 'show results'}
              </Text>
            </View>
          </PressableScale>
        </View>

      </MotiView>
    </Modal>
  );
}
