import { useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native';
import { CheckCircle, Circle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { Font } from '@/constants/fonts';
import { Palette, Radius, Space, TouchTarget, Type } from '@/constants/theme';
import type { ApplicationForm } from '@/app/apply/index';

const BIO_LIMIT = 280;

type Props = {
  form: ApplicationForm;
  update: <K extends keyof ApplicationForm>(key: K, value: ApplicationForm[K]) => void;
};

function Field({
  label,
  required,
  hint,
  inputProps,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  inputProps: TextInputProps & { ref?: React.Ref<TextInput> };
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <TextInput style={styles.input} placeholderTextColor={Palette.textMuted} {...inputProps} />
    </View>
  );
}

function CheckRow({
  checked,
  onToggle,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={styles.checkRow}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      activeOpacity={0.7}
    >
      <View style={styles.checkIcon}>
        {checked
          ? <CheckCircle size={22} color={Palette.brand} strokeWidth={2} />
          : <Circle size={22} color={Palette.border} strokeWidth={2} />
        }
      </View>
      <Text style={styles.checkText}>{children}</Text>
    </TouchableOpacity>
  );
}

export function LegalStep({ form, update }: Props) {
  const postcodeRef = useRef<TextInput>(null);
  const addressRef  = useRef<TextInput>(null);
  const bioRef      = useRef<TextInput>(null);
  const yearsRef    = useRef<TextInput>(null);
  const specRef     = useRef<TextInput>(null);

  function toggle(key: 'insuranceAttested' | 'contractorAttested' | 'natashsLawAcknowledged') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    update(key, !form[key]);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>About you</Text>
      <Text style={styles.sub}>This information appears on your public kitchen profile once approved.</Text>

      <Field
        label="Full legal name"
        required
        inputProps={{
          value: form.legalName,
          onChangeText: v => update('legalName', v),
          placeholder: 'As on your government ID',
          autoCapitalize: 'words',
          returnKeyType: 'next',
          onSubmitEditing: () => postcodeRef.current?.focus(),
        }}
      />
      <Field
        label="Postcode"
        required
        inputProps={{
          ref: postcodeRef,
          value: form.postcode,
          onChangeText: v => update('postcode', v.toUpperCase()),
          placeholder: 'E.g. SW1A 1AA',
          autoCapitalize: 'characters',
          returnKeyType: 'next',
          onSubmitEditing: () => addressRef.current?.focus(),
        }}
      />
      <Field
        label="Kitchen address"
        hint="Street address where food is prepared. Visible to customers after order."
        inputProps={{
          ref: addressRef,
          value: form.kitchenAddress,
          onChangeText: v => update('kitchenAddress', v),
          placeholder: 'E.g. 12 Baker Street, London',
          returnKeyType: 'next',
          onSubmitEditing: () => bioRef.current?.focus(),
        }}
      />

      <View style={styles.fieldWrap}>
        <Text style={styles.label}>Bio</Text>
        <Text style={styles.hint}>Tell customers about your cooking background.</Text>
        <TextInput
          ref={bioRef}
          style={[styles.input, styles.inputMultiline]}
          value={form.bio}
          onChangeText={v => update('bio', v.slice(0, BIO_LIMIT))}
          placeholder="E.g. Trained chef with 10 years of experience..."
          placeholderTextColor={Palette.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          returnKeyType="next"
        />
        <Text style={styles.charCount}>{form.bio.length}/{BIO_LIMIT}</Text>
      </View>

      <Field
        label="Years of experience"
        inputProps={{
          ref: yearsRef,
          value: form.experienceYears,
          onChangeText: v => update('experienceYears', v.replace(/[^0-9]/g, '')),
          placeholder: 'E.g. 5',
          keyboardType: 'number-pad',
          maxLength: 2,
          returnKeyType: 'next',
          onSubmitEditing: () => specRef.current?.focus(),
        }}
      />
      <Field
        label="Specialities"
        hint="Comma-separated. E.g. Nigerian, BBQ, Vegan"
        inputProps={{
          ref: specRef,
          value: form.specialties,
          onChangeText: v => update('specialties', v),
          placeholder: 'Nigerian, BBQ, Vegan, Gluten-free',
          returnKeyType: 'done',
        }}
      />

      <View style={styles.divider} />
      <Text style={styles.sectionTitle}>Legal declarations</Text>
      <Text style={styles.sectionSub}>All three are required to continue.</Text>

      <CheckRow
        checked={form.insuranceAttested}
        onToggle={() => toggle('insuranceAttested')}
      >
        I confirm I hold valid food business public liability insurance (minimum £2 million cover).
      </CheckRow>
      <CheckRow
        checked={form.contractorAttested}
        onToggle={() => toggle('contractorAttested')}
      >
        I understand I operate as a self-employed food business operator, not an employee of Preppa.
      </CheckRow>
      <CheckRow
        checked={form.natashsLawAcknowledged}
        onToggle={() => toggle('natashsLawAcknowledged')}
      >
        {"I understand my legal obligation under Natasha's Law to provide full ingredient and allergen information for every meal I list."}
      </CheckRow>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { paddingHorizontal: Space.lg, paddingBottom: 120 },
  heading:       { fontFamily: Font.heading, fontSize: Type.displayLg, color: Palette.ink, marginBottom: Space.sm },
  sub:           { fontFamily: Font.body, fontSize: Type.body, color: Palette.textSecondary, marginBottom: Space.xl, lineHeight: 22 },
  fieldWrap:     { marginBottom: Space.lg },
  label:         { fontFamily: Font.semibold, fontSize: Type.label, color: Palette.ink, marginBottom: Space.sm },
  required:      { color: Palette.danger },
  hint:          { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted, marginBottom: Space.sm, lineHeight: 18 },
  input: {
    height: TouchTarget,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Space.lg,
    fontFamily: Font.body,
    fontSize: Type.body,
    color: Palette.ink,
    backgroundColor: Palette.surface,
  },
  inputMultiline: { height: 100, paddingTop: Space.md, paddingBottom: Space.md },
  charCount:     { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted, textAlign: 'right', marginTop: Space.sm },
  divider:       { height: 1, backgroundColor: Palette.border, marginVertical: Space.xl },
  sectionTitle:  { fontFamily: Font.semibold, fontSize: Type.title, color: Palette.ink, marginBottom: Space.sm },
  sectionSub:    { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary, marginBottom: Space.lg },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
    marginBottom: Space.lg,
    minHeight: TouchTarget,
  },
  checkIcon:     { paddingTop: 2, flexShrink: 0 },
  checkText:     { flex: 1, fontFamily: Font.body, fontSize: Type.body, color: Palette.ink, lineHeight: 22 },
});
