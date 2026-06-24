import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Space, Type } from '@/constants/theme';
import type { ListingForm } from '@/app/create-listing';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SERVICE_OPTIONS: { key: 'pickup' | 'delivery'; label: string; emoji: string; hint: string }[] = [
  { key: 'pickup',   label: 'Pickup',   emoji: '🏃', hint: 'Customers collect from you' },
  { key: 'delivery', label: 'Delivery', emoji: '🛵', hint: 'You deliver to the customer' },
];

type Props = {
  form: ListingForm;
  update: <K extends keyof ListingForm>(key: K, value: ListingForm[K]) => void;
};

export function AvailabilityStep({ form, update }: Props) {
  function toggleService(type: 'pickup' | 'delivery') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const has = form.serviceTypes.includes(type);
    if (has && form.serviceTypes.length === 1) return;
    const next = has
      ? form.serviceTypes.filter(t => t !== type)
      : [...form.serviceTypes, type];
    update('serviceTypes', next);
  }

  function toggleDay(day: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = form.availableDays.includes(day)
      ? form.availableDays.filter(d => d !== day)
      : [...form.availableDays, day];
    update('availableDays', next);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>Availability</Text>
      <Text style={styles.sub}>How and when can customers order from you?</Text>

      <Text style={styles.sectionLabel}>Service type</Text>
      <View style={styles.serviceRow}>
        {SERVICE_OPTIONS.map(s => {
          const active = form.serviceTypes.includes(s.key);
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => toggleService(s.key)}
              style={[styles.serviceCard, active && styles.serviceCardActive]}
              activeOpacity={0.8}
            >
              <Text style={styles.serviceEmoji}>{s.emoji}</Text>
              <Text style={[styles.serviceLabel, active && styles.serviceLabelActive]}>
                {s.label}
              </Text>
              <Text style={[styles.serviceHint, active && styles.serviceHintActive]}>
                {s.hint}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Available days</Text>
      <View style={styles.dayRow}>
        {DAYS.map((day, i) => {
          const active = form.availableDays.includes(i);
          return (
            <TouchableOpacity
              key={day}
              onPress={() => toggleDay(i)}
              style={[styles.dayChip, active && styles.dayChipActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{day}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Daily portions</Text>
      <Text style={styles.sectionSub}>How many servings do you prepare each day?</Text>
      <TextInput
        style={styles.input}
        value={form.dailyPortions}
        onChangeText={v => update('dailyPortions', v)}
        placeholder="e.g. 10"
        placeholderTextColor={Palette.textMuted}
        keyboardType="number-pad"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Space.lg, paddingBottom: 100 },
  heading: { fontFamily: Font.heading, fontSize: Type.displayLg, color: Palette.ink, marginBottom: Space.sm },
  sub: { fontFamily: Font.body, fontSize: Type.body, color: Palette.textSecondary, marginBottom: Space.xl },
  sectionLabel: { fontFamily: Font.semibold, fontSize: Type.body, color: Palette.ink, marginBottom: Space.sm, marginTop: Space.md },
  sectionSub: { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary, marginBottom: Space.md },
  serviceRow: { flexDirection: 'row', gap: Space.md, marginBottom: Space.xl },
  serviceCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Space.lg,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1.5,
    borderColor: Palette.border,
    gap: Space.sm,
  },
  serviceCardActive: { borderColor: Palette.brand, backgroundColor: Palette.brandTint },
  serviceEmoji: { fontSize: 28 },
  serviceLabel: { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.inkSoft },
  serviceLabelActive: { color: Palette.brandPressed },
  serviceHint: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted, textAlign: 'center' },
  serviceHintActive: { color: Palette.brandPressed },
  dayRow: { flexDirection: 'row', gap: Space.sm, marginBottom: Space.xl, flexWrap: 'wrap' },
  dayChip: {
    width: 44, height: 44,
    borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Palette.chip,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayChipActive: { backgroundColor: Palette.brand, borderColor: Palette.brand },
  dayLabel: { fontFamily: Font.medium, fontSize: Type.micro, color: Palette.inkSoft },
  dayLabelActive: { color: Palette.surface },
  input: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.md,
    paddingHorizontal: Space.lg,
    paddingVertical: 13,
    fontFamily: Font.body,
    fontSize: Type.body,
    color: Palette.ink,
  },
});
