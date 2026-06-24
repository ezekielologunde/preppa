import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInput as TextInputType } from 'react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Space, Type } from '@/constants/theme';
import type { ListingForm } from '@/app/create-listing';

type Props = {
  form: ListingForm;
  update: <K extends keyof ListingForm>(key: K, value: ListingForm[K]) => void;
};

export function BasicsStep({ form, update }: Props) {
  const taglineRef = useRef<TextInputType>(null);
  const priceRef   = useRef<TextInputType>(null);
  const servingsRef = useRef<TextInputType>(null);
  const descriptionRef = useRef<TextInputType>(null);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>Meal details</Text>
      <Text style={styles.sub}>Tell customers what you're cooking up.</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Meal name <Text style={styles.required}>*</Text></Text>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={v => update('name', v)}
          placeholder="e.g. Jerk Chicken Meal Prep"
          placeholderTextColor={Palette.textMuted}
          maxLength={60}
          returnKeyType="next"
          onSubmitEditing={() => taglineRef.current?.focus()}
          blurOnSubmit={false}
          accessibilityLabel="Meal name, required"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Tagline</Text>
        <TextInput
          ref={taglineRef}
          style={styles.input}
          value={form.tagline}
          onChangeText={v => update('tagline', v)}
          placeholder="e.g. Smoky, tender, protein-packed"
          placeholderTextColor={Palette.textMuted}
          maxLength={80}
          returnKeyType="next"
          onSubmitEditing={() => priceRef.current?.focus()}
          blurOnSubmit={false}
          accessibilityLabel="Tagline"
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Price per serving <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputWrapper}>
            <Text style={styles.currencyPrefix}>£</Text>
            <TextInput
              ref={priceRef}
              style={[styles.input, styles.inputWithPrefix]}
              value={form.price}
              onChangeText={v => update('price', v.replace(/[^0-9.]/g, ''))}
              placeholder="0.00"
              placeholderTextColor={Palette.textMuted}
              keyboardType="decimal-pad"
              returnKeyType="next"
              onSubmitEditing={() => servingsRef.current?.focus()}
              blurOnSubmit={false}
              accessibilityLabel="Price per serving in pounds, required"
            />
          </View>
        </View>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Servings <Text style={styles.required}>*</Text></Text>
          <TextInput
            ref={servingsRef}
            style={styles.input}
            value={form.servings}
            onChangeText={v => update('servings', v.replace(/[^0-9]/g, ''))}
            placeholder="e.g. 5"
            placeholderTextColor={Palette.textMuted}
            keyboardType="number-pad"
            returnKeyType="next"
            onSubmitEditing={() => descriptionRef.current?.focus()}
            blurOnSubmit={false}
            accessibilityLabel="Number of servings available, required"
          />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          ref={descriptionRef}
          style={[styles.input, styles.textarea]}
          value={form.description}
          onChangeText={v => update('description', v)}
          placeholder="Describe your meal — ingredients, cooking method, what makes it special…"
          placeholderTextColor={Palette.textMuted}
          multiline
          maxLength={500}
          textAlignVertical="top"
          returnKeyType="done"
          accessibilityLabel="Meal description, 500 character maximum"
        />
        <Text style={styles.charCount}>{form.description.length}/500</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Space.lg, paddingBottom: 100 },
  heading: { fontFamily: Font.heading, fontSize: Type.displayLg, color: Palette.ink, marginBottom: Space.sm },
  sub: { fontFamily: Font.body, fontSize: Type.body, color: Palette.textSecondary, marginBottom: Space.xl },
  field: { marginBottom: Space.lg },
  label: { fontFamily: Font.medium, fontSize: Type.label, color: Palette.inkSoft, marginBottom: Space.sm },
  required: { color: Palette.danger },
  row: { flexDirection: 'row', gap: Space.md },
  inputWrapper: { flexDirection: 'row', alignItems: 'center' },
  currencyPrefix: {
    fontFamily: Font.medium,
    fontSize: Type.body,
    color: Palette.inkSoft,
    paddingLeft: Space.lg,
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: Palette.border,
    borderTopLeftRadius: Radius.md,
    borderBottomLeftRadius: Radius.md,
    paddingVertical: 13,
  },
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
    flex: 1,
  },
  inputWithPrefix: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderLeftWidth: 0,
  },
  textarea: { height: 120, paddingTop: 13, flex: 0 },
  charCount: {
    fontFamily: Font.body,
    fontSize: Type.micro,
    color: Palette.textMuted,
    textAlign: 'right',
    marginTop: Space.sm,
  },
});
