import { BlurView } from 'expo-blur';
import { Check, SlidersHorizontal, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { DualRangeSlider, RangeSlider } from '@/components/ui/range-slider';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

export type SortKey = 'default' | 'rating' | 'newest';

export type AdvancedFilters = {
  dietary: string[];
  sort: SortKey;
  /** Max distance in miles (1–15); null = any distance. */
  distance: number | null;
  /** Price-per-serving band in dollars. */
  priceMin: number;
  priceMax: number;
  mixMatch: boolean;
  certifications: string[];
};

export const DISTANCE_MAX = 15;
export const PRICE_FLOOR = 4;
export const PRICE_CEILING = 40;

export const FILTER_DEFAULTS: AdvancedFilters = {
  dietary: [],
  sort: 'default',
  distance: null,
  priceMin: PRICE_FLOOR,
  priceMax: PRICE_CEILING,
  mixMatch: false,
  certifications: [],
};

// ── Shared predicates (single source of truth for "is this filter active?") ──
export const isNearby = (f: AdvancedFilters) => f.distance != null;
export const isPriceFiltered = (f: AdvancedFilters) => f.priceMin > PRICE_FLOOR || f.priceMax < PRICE_CEILING;
export function countActiveFilters(f: AdvancedFilters): number {
  return (
    f.dietary.length +
    (f.sort !== 'default' ? 1 : 0) +
    (isNearby(f) ? 1 : 0) +
    (isPriceFiltered(f) ? 1 : 0) +
    (f.mixMatch ? 1 : 0) +
    f.certifications.length
  );
}
export const isFilterDirty = (f: AdvancedFilters) => countActiveFilters(f) > 0;

const SORT_OPTIONS = [
  { key: 'default', label: 'Default' },
  { key: 'rating', label: 'Highest rated' },
  { key: 'newest', label: 'Newest' },
] as const;

const DIETARY_TAGS = [
  { key: 'vegan', label: 'Vegan' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'gluten-free', label: 'Gluten-free' },
  { key: 'halal', label: 'Halal' },
  { key: 'dairy-free', label: 'Dairy-free' },
  { key: 'nut-free', label: 'Nut-free' },
  { key: 'keto', label: 'Keto' },
  { key: 'low-carb', label: 'Low-carb' },
];

const CERTIFICATIONS = [
  { key: 'commercial', label: 'Commercial kitchen verified' },
  { key: 'home', label: 'Home cook certified' },
  { key: 'eco', label: 'Eco-friendly packaging' },
];

const LABEL_STYLE = { fontFamily: Font.semibold, fontSize: 11, color: Palette.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.8 };
const SCALE_STYLE = { fontFamily: Font.medium, fontSize: 11, color: Palette.textMuted };

function FilterLabel({ text }: { text: string }) {
  return <Text style={{ ...LABEL_STYLE, paddingHorizontal: 22, marginBottom: 10 }}>{text}</Text>;
}

function SingleSelectRow({ options, active, onSelect }: { options: { key: string; label: string }[]; active: string; onSelect: (k: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 24 }}>
      {options.map((opt) => {
        const isActive = active === opt.key;
        return (
          <PressableScale key={opt.key} onPress={() => { feedback.tap(); onSelect(opt.key); }}
            accessibilityRole="radio" accessibilityState={{ checked: isActive }} accessibilityLabel={opt.label}
            style={{ paddingHorizontal: 16, height: 36, borderRadius: Radius.pill, backgroundColor: isActive ? Palette.brand : Palette.canvas, borderWidth: 1.5, borderColor: isActive ? Palette.brand : Palette.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: isActive ? '#fff' : Palette.inkSoft }}>{opt.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export function ExploreFilterSheet({
  visible,
  initial,
  isTabletUp,
  onClose,
  onApply,
}: {
  visible: boolean;
  initial: AdvancedFilters;
  isTabletUp: boolean;
  onClose: () => void;
  onApply: (f: AdvancedFilters) => void;
}) {
  const [pending, setPending] = useState<AdvancedFilters>(initial);

  useEffect(() => { if (visible) setPending(initial); }, [visible]);

  const dirty = isFilterDirty(pending);
  const priceText = `$${pending.priceMin} – $${pending.priceMax}${pending.priceMax >= PRICE_CEILING ? '+' : ''}`;

  function toggleDietary(key: string) {
    feedback.tap();
    setPending((p) => ({ ...p, dietary: p.dietary.includes(key) ? p.dietary.filter((k) => k !== key) : [...p.dietary, key] }));
  }
  function toggleCert(key: string) {
    feedback.tap();
    setPending((p) => ({ ...p, certifications: p.certifications.includes(key) ? p.certifications.filter((k) => k !== key) : [...p.certifications, key] }));
  }
  function toggleAnyDistance() {
    feedback.tap();
    setPending((p) => ({ ...p, distance: p.distance == null ? 5 : null }));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close filters" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <BlurView intensity={18} tint="dark" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Pressable onPress={(e) => e.stopPropagation()} accessible={false}
          style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%', ...(isTabletUp ? { maxWidth: 540, alignSelf: 'center', width: '100%' } : {}) }}>

          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Palette.border, alignSelf: 'center', marginTop: 12 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <SlidersHorizontal size={18} color={Palette.brand} />
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.4 }}>filters</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              {dirty ? (
                <PressableScale onPress={() => { feedback.tap(); setPending(FILTER_DEFAULTS); }} accessibilityRole="button" accessibilityLabel="Clear all filters"
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Palette.canvas }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Palette.textSecondary }}>clear all</Text>
                </PressableScale>
              ) : null}
              <PressableScale onPress={() => { feedback.tap(); onClose(); }} accessibilityRole="button" accessibilityLabel="Close"
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={Palette.textSecondary} />
              </PressableScale>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>

            <FilterLabel text="sort by" />
            <SingleSelectRow
              options={SORT_OPTIONS as unknown as { key: string; label: string }[]}
              active={pending.sort}
              onSelect={(k) => setPending((p) => ({ ...p, sort: k as SortKey }))}
            />

            {/* Module A — proximity & delivery (interactive 1–15 mi slider) */}
            <View style={{ paddingHorizontal: 22, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={LABEL_STYLE}>proximity & delivery</Text>
                <PressableScale onPress={toggleAnyDistance} accessibilityRole="button" accessibilityState={{ selected: pending.distance == null }} accessibilityLabel="Any distance"
                  style={{ paddingHorizontal: 12, height: 28, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: pending.distance == null ? Palette.brand : Palette.canvas, borderWidth: 1.5, borderColor: pending.distance == null ? Palette.brand : Palette.border }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: pending.distance == null ? '#fff' : Palette.inkSoft }}>Any</Text>
                </PressableScale>
              </View>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink, marginBottom: 2 }}>
                {pending.distance == null ? 'Any distance' : `Within ${pending.distance} ${pending.distance === 1 ? 'mile' : 'miles'}`}
              </Text>
              <RangeSlider
                min={1}
                max={DISTANCE_MAX}
                value={pending.distance ?? DISTANCE_MAX}
                disabled={pending.distance == null}
                onChange={(v) => setPending((p) => ({ ...p, distance: v }))}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={SCALE_STYLE}>1 mi</Text>
                <Text style={SCALE_STYLE}>{DISTANCE_MAX} mi</Text>
              </View>
            </View>

            {/* Module B — price per serving (dual-point range slider) */}
            <View style={{ paddingHorizontal: 22, marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={LABEL_STYLE}>price per serving</Text>
                <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.brand, fontVariant: ['tabular-nums'] }}>{priceText}</Text>
              </View>
              <DualRangeSlider
                min={PRICE_FLOOR}
                max={PRICE_CEILING}
                lo={pending.priceMin}
                hi={pending.priceMax}
                onChange={(lo, hi) => setPending((p) => ({ ...p, priceMin: lo, priceMax: hi }))}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={SCALE_STYLE}>${PRICE_FLOOR}</Text>
                <Text style={SCALE_STYLE}>${PRICE_CEILING}+</Text>
              </View>
            </View>

            {/* Module C — multi-chef capability */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 22, marginBottom: 24, gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.ink }}>Mix & Match friendly</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 2, lineHeight: 18 }}>
                  Chefs whose delivery schedules pair seamlessly with other local creators
                </Text>
              </View>
              <Switch
                value={pending.mixMatch}
                onValueChange={(v) => { feedback.tap(); setPending((p) => ({ ...p, mixMatch: v })); }}
                trackColor={{ false: Palette.border, true: Palette.brand }}
                thumbColor="#fff"
                ios_backgroundColor={Palette.border}
                accessibilityLabel="Mix and match friendly"
              />
            </View>

            <FilterLabel text="dietary" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 24 }}>
              {DIETARY_TAGS.map((tag) => {
                const active = pending.dietary.includes(tag.key);
                return (
                  <PressableScale key={tag.key} onPress={() => toggleDietary(tag.key)}
                    accessibilityRole="checkbox" accessibilityState={{ checked: active }} accessibilityLabel={tag.label}
                    style={{ paddingHorizontal: 14, height: 36, borderRadius: Radius.pill, backgroundColor: active ? Palette.brandTint : Palette.canvas, borderWidth: 1.5, borderColor: active ? Palette.brand : Palette.border, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {active ? <Check size={13} color={Palette.brand} strokeWidth={2.5} /> : null}
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: active ? Palette.brand : Palette.inkSoft }}>{tag.label}</Text>
                  </PressableScale>
                );
              })}
            </View>

            {/* Module D — kitchen certifications */}
            <FilterLabel text="kitchen certifications" />
            <View style={{ paddingHorizontal: 20, marginBottom: 28, gap: 14 }}>
              {CERTIFICATIONS.map((cert) => {
                const active = pending.certifications.includes(cert.key);
                return (
                  <PressableScale key={cert.key} onPress={() => toggleCert(cert.key)}
                    accessibilityRole="checkbox" accessibilityState={{ checked: active }} accessibilityLabel={cert.label}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: active ? Palette.brand : Palette.border, backgroundColor: active ? Palette.brandTint : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {active ? <Check size={13} color={Palette.brand} strokeWidth={3} /> : null}
                    </View>
                    <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.ink }}>{cert.label}</Text>
                  </PressableScale>
                );
              })}
            </View>

            <PressableScale onPress={() => { feedback.success(); onApply(pending); }} accessibilityRole="button" accessibilityLabel="Apply filters"
              style={{ marginHorizontal: 20, height: 52, borderRadius: Radius.pill, backgroundColor: Palette.ink, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
                {dirty ? 'Apply filters' : 'Show all meals'}
              </Text>
            </PressableScale>

          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
