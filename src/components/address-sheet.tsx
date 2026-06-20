import { X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Spacing, Type } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Address {
  id: string;
  label: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface FormState {
  label: string;
  customLabel: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

interface FormErrors {
  street1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

const cleanLine = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, '');

// ─── Constants ────────────────────────────────────────────────────────────────

export const PRESET_LABELS = ['Home', 'Work', 'Other'];

export const EMPTY_FORM: FormState = {
  label: 'Home',
  customLabel: '',
  street1: '',
  street2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'United States',
  isDefault: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  const street = form.street1.trim();
  if (!street || street.length < 5) {
    errors.street1 = 'Enter your full street address including door number';
  } else if (!/\d/.test(street)) {
    errors.street1 = 'Include your door or building number — e.g. 14 Oak Street';
  }
  if (!form.city.trim() || form.city.trim().length < 2) {
    errors.city = 'Enter the city or town name';
  }
  if (!form.state.trim()) {
    errors.state = 'State / Province is required';
  }
  if (!form.postalCode.trim() || form.postalCode.trim().length < 3) {
    errors.postalCode = 'Postal / ZIP code must be at least 3 characters';
  }
  return errors;
}

export function resolvedLabel(form: FormState): string {
  if (form.label === 'Other' && form.customLabel.trim()) return form.customLabel.trim();
  if (form.label === 'Other') return 'Other';
  return form.label;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <Text
      style={{ fontFamily: Font.body, fontSize: Type.micro, color: Palette.danger, marginTop: 4 }}
      accessibilityRole="alert">
      {msg}
    </Text>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  optional,
  autoCapitalize,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'numeric';
  maxLength?: number;
}) {
  return (
    <View style={{ marginBottom: Spacing.three }}>
      <Text
        style={{
          fontFamily: Font.medium,
          fontSize: Type.label,
          color: Palette.inkSoft,
          marginBottom: 6,
        }}>
        {label}
        {optional && (
          <Text style={{ color: Palette.textSecondary, fontFamily: Font.body }}> (optional)</Text>
        )}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={Palette.textSecondary}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength}
        accessibilityLabel={label}
        style={{
          fontFamily: Font.body,
          fontSize: Type.body,
          color: Palette.ink,
          backgroundColor: Palette.canvas,
          borderRadius: Radius.sm,
          borderWidth: 1,
          borderColor: error ? Palette.danger : Palette.border,
          paddingHorizontal: Spacing.three,
          paddingVertical: 13,
          minHeight: 44,
        }}
      />
      {error ? (
        <FieldError msg={error} />
      ) : hint ? (
        <Text style={{ fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, marginTop: 4 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ─── AddressSheet ─────────────────────────────────────────────────────────────

export function AddressSheet({
  visible,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial?: Address;
  onClose: () => void;
  onSave: (form: FormState) => void;
}) {
  const [form, setForm] = useState<FormState>(() => {
    if (initial) {
      const presetMatch = PRESET_LABELS.includes(initial.label);
      return {
        label: presetMatch ? initial.label : 'Other',
        customLabel: presetMatch ? '' : initial.label,
        street1: initial.street1,
        street2: initial.street2 ?? '',
        city: initial.city,
        state: initial.state,
        postalCode: initial.postalCode,
        country: initial.country,
        isDefault: initial.isDefault,
      };
    }
    return { ...EMPTY_FORM };
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const set = (key: keyof FormState) => (val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleSave = () => {
    const errs = validate(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    onSave({
      ...form,
      customLabel: cleanLine(form.customLabel).trim(),
      street1: cleanLine(form.street1).trim(),
      street2: cleanLine(form.street2).trim(),
      city: cleanLine(form.city).trim(),
      state: cleanLine(form.state).trim(),
      postalCode: cleanLine(form.postalCode).trim(),
      country: cleanLine(form.country).trim(),
    });
    setErrors({});
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: Palette.surface }}>
          {/* Sheet header */}
          <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: Spacing.three,
              paddingVertical: Spacing.two,
              borderBottomWidth: 1,
              borderBottomColor: Palette.border,
            }}>
            <Text
              style={{ fontFamily: Font.heading, fontSize: Type.title, color: Palette.ink }}>
              {initial ? 'edit address' : 'add address'}
            </Text>
            <PressableScale
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: Palette.chip,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <X size={18} color={Palette.inkSoft} />
            </PressableScale>
          </View>
          </MotiView>

          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 80 }} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: Spacing.three }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* Label chips */}
            <Text
              style={{
                fontFamily: Font.medium,
                fontSize: Type.label,
                color: Palette.inkSoft,
                marginBottom: 8,
              }}>
              label
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: Spacing.three }}>
              {PRESET_LABELS.map((lbl) => (
                <MotiView
                  key={lbl}
                  animate={{ backgroundColor: form.label === lbl ? Palette.brand : Palette.chip }}
                  transition={{ type: 'timing', duration: 180 }}
                  style={{ borderRadius: Radius.pill, overflow: 'hidden' }}>
                  <PressableScale
                    onPress={() => set('label')(lbl)}
                    accessibilityRole="button"
                    accessibilityLabel={`Label: ${lbl}`}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      minHeight: 44,
                      justifyContent: 'center',
                    }}>
                    <Text
                      style={{
                        fontFamily: Font.medium,
                        fontSize: Type.label,
                        color: form.label === lbl ? Palette.surface : Palette.inkSoft,
                      }}>
                      {lbl}
                    </Text>
                  </PressableScale>
                </MotiView>
              ))}
            </View>

            {form.label === 'Other' && (
              <FormField
                label="custom label"
                value={form.customLabel}
                onChangeText={set('customLabel')}
                placeholder="e.g. Gym, Parents..."
                maxLength={30}
              />
            )}

            <FormField
              label="street address"
              value={form.street1}
              onChangeText={(v) => {
                set('street1')(v);
                if (errors.street1) setErrors((e) => ({ ...e, street1: undefined }));
              }}
              placeholder="e.g. 14 Oak Street"
              hint="Start with your door or building number so we can find you"
              error={errors.street1}
              maxLength={100}
            />

            <FormField
              label="apt / unit / floor"
              value={form.street2}
              onChangeText={set('street2')}
              placeholder="e.g. Apt 4B, Floor 2"
              optional
              maxLength={50}
            />

            <FormField
              label="city"
              value={form.city}
              onChangeText={(v) => {
                set('city')(v);
                if (errors.city) setErrors((e) => ({ ...e, city: undefined }));
              }}
              placeholder="e.g. Chicago"
              hint="The city or town your post is delivered to"
              error={errors.city}
              maxLength={80}
            />

            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <View style={{ flex: 1 }}>
                <FormField
                  label="state / province"
                  value={form.state}
                  onChangeText={(v) => {
                    set('state')(v);
                    if (errors.state) setErrors((e) => ({ ...e, state: undefined }));
                  }}
                  autoCapitalize="characters"
                  error={errors.state}
                  maxLength={80}
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField
                  label="postal / ZIP"
                  value={form.postalCode}
                  onChangeText={(v) => {
                    set('postalCode')(v);
                    if (errors.postalCode) setErrors((e) => ({ ...e, postalCode: undefined }));
                  }}
                  keyboardType="default"
                  autoCapitalize="characters"
                  error={errors.postalCode}
                  maxLength={10}
                />
              </View>
            </View>

            <FormField
              label="country"
              value={form.country}
              onChangeText={set('country')}
              maxLength={50}
            />

            {/* Default toggle */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: Palette.canvas,
                borderRadius: Radius.sm,
                paddingHorizontal: Spacing.three,
                paddingVertical: 14,
                marginBottom: Spacing.three,
              }}>
              <Text
                style={{ fontFamily: Font.medium, fontSize: Type.body, color: Palette.ink }}>
                set as default
              </Text>
              <Switch
                value={form.isDefault}
                onValueChange={(v) => set('isDefault')(v)}
                trackColor={{ false: Palette.border, true: Palette.brand }}
                thumbColor={Palette.surface}
                accessibilityRole="switch"
                accessibilityLabel="Set as default address"
              />
            </View>

            {/* Save button */}
            <PressableScale
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel="Save address"
              style={{
                backgroundColor: Palette.brand,
                borderRadius: Radius.pill,
                paddingVertical: 16,
                alignItems: 'center',
                marginBottom: Spacing.four,
                minHeight: 54,
                justifyContent: 'center',
              }}>
              <Text
                style={{
                  fontFamily: Font.heading,
                  fontSize: Type.body,
                  color: Palette.surface,
                }}>
                save address
              </Text>
            </PressableScale>
          </ScrollView>
          </MotiView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
