import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ALLERGENS, DIETARY_TAGS, dietaryTagColor } from '@/constants/dietary';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Space, TouchTarget, Type } from '@/constants/theme';
import type { ListingForm } from '@/app/create-listing';

type Props = {
  form: ListingForm;
  update: <K extends keyof ListingForm>(key: K, value: ListingForm[K]) => void;
};

export function DietStep({ form, update }: Props) {
  function toggleDietary(key: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = form.dietaryTags.includes(key)
      ? form.dietaryTags.filter(k => k !== key)
      : [...form.dietaryTags, key];
    update('dietaryTags', next);
  }

  function toggleAllergen(key: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = form.allergens.includes(key)
      ? form.allergens.filter(k => k !== key)
      : [...form.allergens, key];
    update('allergens', next);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.heading}>Diet & allergens</Text>
      <Text style={styles.sub}>Help customers find meals that fit their needs.</Text>

      <Text style={styles.sectionLabel}>Dietary suitability</Text>
      <Text style={styles.sectionSub}>Select everything that applies to this meal.</Text>
      <View style={styles.chipRow}>
        {DIETARY_TAGS.map(tag => {
          const active = form.dietaryTags.includes(tag.key);
          const color = dietaryTagColor(tag.key);
          return (
            <TouchableOpacity
              key={tag.key}
              onPress={() => toggleDietary(tag.key)}
              style={[
                styles.chip,
                active && { backgroundColor: color + '22', borderColor: color },
              ]}
              activeOpacity={0.8}
            >
              <Text style={styles.chipEmoji}>{tag.emoji}</Text>
              <Text style={[styles.chipLabel, active && { color }]}>{tag.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionLabel}>Contains allergens</Text>
      <Text style={styles.sectionSub}>Select all allergens present so customers can make safe choices.</Text>
      <View style={styles.chipRow}>
        {ALLERGENS.map(a => {
          const active = form.allergens.includes(a.key);
          return (
            <TouchableOpacity
              key={a.key}
              onPress={() => toggleAllergen(a.key)}
              style={[
                styles.chip,
                active && { backgroundColor: Palette.dangerTint, borderColor: Palette.danger },
              ]}
              activeOpacity={0.8}
            >
              <Text style={styles.chipEmoji}>{a.emoji}</Text>
              <Text style={[styles.chipLabel, active && { color: Palette.dangerDeep }]}>{a.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Space.lg, paddingBottom: 100 },
  heading: { fontFamily: Font.heading, fontSize: Type.displayLg, color: Palette.ink, marginBottom: Space.sm },
  sub: { fontFamily: Font.body, fontSize: Type.body, color: Palette.textSecondary, marginBottom: Space.xl },
  sectionLabel: { fontFamily: Font.semibold, fontSize: Type.body, color: Palette.ink, marginBottom: Space.sm },
  sectionSub: { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary, marginBottom: Space.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm, marginBottom: Space.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.lg,
    minHeight: TouchTarget,
    borderRadius: Radius.pill,
    backgroundColor: Palette.chip,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontFamily: Font.medium, fontSize: Type.label, color: Palette.inkSoft },
  divider: { height: 1, backgroundColor: Palette.border, marginVertical: Space.lg },
});
