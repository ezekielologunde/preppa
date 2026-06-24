import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Space, TouchTarget, Type } from '@/constants/theme';
import type { ListingForm } from '@/app/create-listing';

type Category = 'meal-plans' | 'individual' | 'services' | 'specialty';

type UseCase = {
  key: string;
  emoji: string;
  title: string;
  description: string;
  category: Category;
  featured?: true;
};

const USE_CASES: UseCase[] = [
  { key: 'weekly-prep',   emoji: '🥗', title: 'Weekly Meal Prep',      description: '5–7 portions batch cooked and portioned for the week',  category: 'meal-plans',  featured: true },
  { key: 'lunch-box',    emoji: '🍱', title: 'Lunch Box',              description: 'Office and work-day specials, packed and ready to go',   category: 'individual',  featured: true },
  { key: 'daily-drop',   emoji: '⚡',  title: 'Daily Drop',             description: 'Limited fresh availability — sell out by evening',       category: 'individual',  featured: true },
  { key: 'monthly-sub',  emoji: '📦', title: 'Subscription Box',       description: 'Recurring weekly or bi-weekly delivery plan',            category: 'meal-plans' },
  { key: 'family-bundle',emoji: '👨‍👩‍👧', title: 'Family Bundle',         description: 'Large portions designed to feed four or more people',   category: 'meal-plans' },
  { key: 'macro-plan',   emoji: '💪', title: 'Macro-Balanced Plan',    description: 'Tracked calories and macros printed per container',      category: 'meal-plans' },
  { key: 'dinner',       emoji: '🍽️', title: 'Dinner Special',         description: 'Evening meal, heat-and-eat ready by 5 pm',              category: 'individual' },
  { key: 'single',       emoji: '🥡', title: 'Single Serving',         description: 'Individual portions ordered on demand',                  category: 'individual' },
  { key: 'snack-pack',   emoji: '🫙', title: 'Snack Pack',             description: 'Healthy snacks and sides prepped in bulk',               category: 'individual' },
  { key: 'class',        emoji: '👩‍🍳', title: 'Cooking Class',          description: 'In-person or virtual cooking workshop',                 category: 'services' },
  { key: 'consult',      emoji: '📋', title: 'Meal Planning',          description: 'Personalised weekly meal plan consultation',             category: 'services' },
  { key: 'catering',     emoji: '🏢', title: 'Corporate Catering',     description: 'Bulk orders for offices or events',                     category: 'services' },
  { key: 'diet-spec',    emoji: '🌿', title: 'Dietary Specialist',     description: 'Certified focus: keto, vegan, halal and more',           category: 'specialty' },
  { key: 'cultural',     emoji: '🌍', title: 'Cultural Cuisine',       description: 'Traditional recipes rooted in a specific heritage',      category: 'specialty' },
  { key: 'therapeutic',  emoji: '💊', title: 'Therapeutic Meals',      description: 'Gut health, anti-inflammatory and medical diet focus',   category: 'specialty' },
];

type FilterKey = 'featured' | 'all' | Category;

const FILTERS: { key: FilterKey; label: string; count: number }[] = [
  { key: 'featured',    label: 'Featured',    count: USE_CASES.filter(u => u.featured).length },
  { key: 'all',         label: 'All',         count: USE_CASES.length },
  { key: 'meal-plans',  label: 'Meal Plans',  count: USE_CASES.filter(u => u.category === 'meal-plans').length },
  { key: 'individual',  label: 'Individual',  count: USE_CASES.filter(u => u.category === 'individual').length },
  { key: 'services',    label: 'Services',    count: USE_CASES.filter(u => u.category === 'services').length },
  { key: 'specialty',   label: 'Specialty',   count: USE_CASES.filter(u => u.category === 'specialty').length },
];

type Props = {
  form: ListingForm;
  update: <K extends keyof ListingForm>(key: K, value: ListingForm[K]) => void;
};

export function TypeStep({ form, update }: Props) {
  const [filter, setFilter] = useState<FilterKey>('featured');

  const visible = USE_CASES.filter(uc => {
    if (filter === 'featured') return uc.featured;
    if (filter === 'all') return true;
    return uc.category === filter;
  });

  function toggle(key: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = form.useCases.includes(key)
      ? form.useCases.filter(k => k !== key)
      : [...form.useCases, key];
    update('useCases', next);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Listing type</Text>
      <Text style={styles.sub}>Select all that describe your offering.</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScroll}
      >
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
          >
            <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>
              {f.label}
            </Text>
            <Text style={[styles.filterCount, filter === f.key && styles.filterCountActive]}>
              {f.count}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.grid}>
        {visible.map(uc => {
          const selected = form.useCases.includes(uc.key);
          return (
            <TouchableOpacity
              key={uc.key}
              onPress={() => toggle(uc.key)}
              style={[styles.card, selected && styles.cardSelected]}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <Text style={styles.emoji}>{uc.emoji}</Text>
                {selected && (
                  <View style={styles.checkBadge}>
                    <Check size={11} color={Palette.surface} strokeWidth={3} />
                  </View>
                )}
              </View>
              <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>
                {uc.title}
              </Text>
              <Text style={styles.cardDesc} numberOfLines={2}>{uc.description}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {form.useCases.length > 0 && (
        <Text style={styles.selectionNote}>
          {form.useCases.length} type{form.useCases.length !== 1 ? 's' : ''} selected
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 100 },
  heading: { fontFamily: Font.heading, fontSize: Type.displayLg, color: Palette.ink, paddingHorizontal: Space.lg, marginBottom: Space.sm },
  sub: { fontFamily: Font.body, fontSize: Type.body, color: Palette.textSecondary, paddingHorizontal: Space.lg, marginBottom: Space.lg },
  filterScroll: { flexGrow: 0, marginBottom: Space.lg },
  filterRow: { paddingHorizontal: Space.lg, gap: Space.sm },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: Space.lg,
    minHeight: TouchTarget,
    borderRadius: Radius.pill,
    backgroundColor: Palette.chip,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  filterTabActive: { backgroundColor: Palette.brandTint, borderColor: Palette.brand },
  filterLabel: { fontFamily: Font.medium, fontSize: Type.label, color: Palette.inkSoft },
  filterLabelActive: { color: Palette.brandPressed },
  filterCount: {
    fontFamily: Font.body,
    fontSize: Type.micro,
    color: Palette.textMuted,
    backgroundColor: Palette.chipOff,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  filterCountActive: { color: Palette.brandPressed, backgroundColor: Palette.brandTint },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Space.md,
    gap: Space.md,
  },
  card: {
    width: '47%',
    backgroundColor: Palette.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
    borderWidth: 1.5,
    borderColor: Palette.border,
  },
  cardSelected: { borderColor: Palette.brand, backgroundColor: Palette.brandTint },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Space.sm },
  emoji: { fontSize: 26 },
  checkBadge: {
    width: 20, height: 20,
    borderRadius: 10,
    backgroundColor: Palette.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.ink, marginBottom: 3 },
  cardTitleSelected: { color: Palette.brandPressed },
  cardDesc: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, lineHeight: 16 },
  selectionNote: {
    fontFamily: Font.medium,
    fontSize: Type.label,
    color: Palette.brand,
    textAlign: 'center',
    marginTop: Space.lg,
    paddingBottom: Space.lg,
  },
});
