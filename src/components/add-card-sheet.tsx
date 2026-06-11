import { Lock, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Spacing, Type } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'other';

export interface CardForm {
  cardholderName: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
}

interface CardErrors {
  cardholderName?: string;
  cardNumber?: string;
  expiry?: string;
  cvv?: string;
}

// ─── Brand config ─────────────────────────────────────────────────────────────

export const BRAND_CONFIG: Record<CardBrand, { label: string; bg: string; textColor: string }> = {
  visa: { label: 'Visa', bg: '#1A1F71', textColor: '#FFFFFF' },
  mastercard: { label: 'Mastercard', bg: '#EB001B', textColor: '#FFFFFF' },
  amex: { label: 'Amex', bg: '#007B5E', textColor: '#FFFFFF' },
  other: { label: 'Card', bg: Palette.chip, textColor: Palette.inkSoft },
};

const EMPTY_FORM: CardForm = {
  cardholderName: '',
  cardNumber: '',
  expiry: '',
  cvv: '',
};

// ─── Luhn algorithm ───────────────────────────────────────────────────────────

function luhnCheck(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function detectBrand(digits: string): CardBrand {
  if (/^4/.test(digits)) return 'visa';
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return 'mastercard';
  if (/^3[47]/.test(digits)) return 'amex';
  return 'other';
}

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function getCurrentYY(): number {
  return new Date().getFullYear() % 100;
}

function validateCard(form: CardForm): CardErrors {
  const errors: CardErrors = {};

  if (!/^[a-zA-Z\s\-]{2,60}$/.test(form.cardholderName.trim())) {
    errors.cardholderName = 'Enter a valid name (letters, spaces, hyphens)';
  }

  const digits = form.cardNumber.replace(/\s/g, '');
  if (!/^\d{13,19}$/.test(digits)) {
    errors.cardNumber = 'Card number must be 13–19 digits';
  } else if (!luhnCheck(digits)) {
    errors.cardNumber = 'Card number is invalid';
  }

  const expiryMatch = form.expiry.match(/^(\d{2})\/(\d{2})$/);
  if (!expiryMatch) {
    errors.expiry = 'Enter expiry as MM/YY';
  } else {
    const mm = parseInt(expiryMatch[1], 10);
    const yy = parseInt(expiryMatch[2], 10);
    if (mm < 1 || mm > 12) {
      errors.expiry = 'Month must be 01–12';
    } else if (yy < getCurrentYY()) {
      errors.expiry = 'Card has expired';
    }
  }

  if (!/^\d{3,4}$/.test(form.cvv)) {
    errors.cvv = 'CVV must be 3–4 digits';
  }

  return errors;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <Text
      style={{
        fontFamily: Font.body,
        fontSize: Type.micro,
        color: Palette.danger,
        marginTop: 4,
      }}
      accessibilityRole="alert">
      {msg}
    </Text>
  );
}

function CardFormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType,
  maxLength,
  secureTextEntry,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string;
  keyboardType?: 'default' | 'numeric' | 'number-pad';
  maxLength?: number;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
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
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={Palette.textMuted}
        keyboardType={keyboardType ?? 'default'}
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize ?? 'sentences'}
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
      <FieldError msg={error} />
    </View>
  );
}

// ─── AddCardSheet ─────────────────────────────────────────────────────────────

export function AddCardSheet({
  visible,
  stripePublishableKey,
  onClose,
  onSave,
}: {
  visible: boolean;
  stripePublishableKey: string | undefined;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState<CardForm>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<CardErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = (key: keyof CardForm) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const handleCardNumberChange = (raw: string) => {
    set('cardNumber')(formatCardNumber(raw));
    if (errors.cardNumber) setErrors((e) => ({ ...e, cardNumber: undefined }));
  };

  const handleExpiryChange = (raw: string) => {
    set('expiry')(formatExpiry(raw));
    if (errors.expiry) setErrors((e) => ({ ...e, expiry: undefined }));
  };

  const handleSave = async () => {
    const errs = validateCard(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!stripePublishableKey) { setSaveError('Payment system unavailable'); return; }

    setSaving(true);
    setSaveError(null);
    try {
      const digits = form.cardNumber.replace(/\s/g, '');
      const [expMonth, expYear] = form.expiry.split('/');
      const res = await fetch('https://api.stripe.com/v1/payment_methods', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripePublishableKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          type: 'card',
          'card[number]': digits,
          'card[exp_month]': expMonth,
          'card[exp_year]': `20${expYear}`,
          'card[cvc]': form.cvv,
        }).toString(),
      });
      const pmData = await res.json();
      if (!pmData.id) throw new Error(pmData.error?.message ?? 'Card declined');

      const { error: fnErr } = await supabase.functions.invoke('stripe-payment-methods', {
        body: { action: 'attach', pmId: pmData.id },
      });
      if (fnErr) throw new Error('Failed to save card. Please try again.');

      setForm({ ...EMPTY_FORM });
      setErrors({});
      setSaveError(null);
      onSave();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const detectedBrand = detectBrand(form.cardNumber.replace(/\s/g, ''));
  const brandCfg = BRAND_CONFIG[detectedBrand];

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
          {/* Header */}
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
              add card
            </Text>
            <PressableScale
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close add card"
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

          <ScrollView
            contentContainerStyle={{ padding: Spacing.three, paddingBottom: Spacing.six }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* Brand preview pill */}
            {form.cardNumber.replace(/\s/g, '').length >= 4 && (
              <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'timing', duration: 200 }}
                style={{ marginBottom: Spacing.three }}>
                <View
                  style={{
                    alignSelf: 'flex-start',
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: Radius.pill,
                    backgroundColor: brandCfg.bg,
                  }}>
                  <Text
                    style={{
                      fontFamily: Font.heading,
                      fontSize: Type.label,
                      color: brandCfg.textColor,
                    }}>
                    {brandCfg.label}
                  </Text>
                </View>
              </MotiView>
            )}

            <CardFormField
              label="cardholder name"
              value={form.cardholderName}
              onChangeText={(v) => {
                set('cardholderName')(v);
                if (errors.cardholderName) setErrors((e) => ({ ...e, cardholderName: undefined }));
              }}
              placeholder="Alex Johnson"
              autoCapitalize="words"
              error={errors.cardholderName}
            />

            <CardFormField
              label="card number"
              value={form.cardNumber}
              onChangeText={handleCardNumberChange}
              placeholder="1234 5678 9012 3456"
              keyboardType="number-pad"
              maxLength={23}
              error={errors.cardNumber}
            />

            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <View style={{ flex: 1 }}>
                <CardFormField
                  label="expiry"
                  value={form.expiry}
                  onChangeText={handleExpiryChange}
                  placeholder="MM/YY"
                  keyboardType="number-pad"
                  maxLength={5}
                  error={errors.expiry}
                />
              </View>
              <View style={{ flex: 1 }}>
                <CardFormField
                  label="CVV"
                  value={form.cvv}
                  onChangeText={(v) => {
                    set('cvv')(v.replace(/\D/g, '').slice(0, 4));
                    if (errors.cvv) setErrors((e) => ({ ...e, cvv: undefined }));
                  }}
                  placeholder="•••"
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  error={errors.cvv}
                />
              </View>
            </View>

            {/* Save error */}
            {saveError ? (
              <Text
                style={{
                  fontFamily: Font.body,
                  fontSize: Type.label,
                  color: Palette.danger,
                  textAlign: 'center',
                  marginBottom: Spacing.two,
                }}
                accessibilityRole="alert">
                {saveError}
              </Text>
            ) : null}

            {/* Save button */}
            <PressableScale
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Save card"
              style={{
                backgroundColor: Palette.brand,
                borderRadius: Radius.md,
                paddingVertical: 16,
                alignItems: 'center',
                marginTop: Spacing.two,
                minHeight: 54,
                justifyContent: 'center',
                opacity: saving ? 0.75 : 1,
              }}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{
                    fontFamily: Font.heading,
                    fontSize: Type.body,
                    color: Palette.surface,
                  }}>
                  save card
                </Text>
              )}
            </PressableScale>

            {/* Security note */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                marginTop: Spacing.three,
              }}>
              <Lock size={13} color={Palette.textMuted} />
              <Text
                style={{
                  fontFamily: Font.body,
                  fontSize: Type.micro,
                  color: Palette.textMuted,
                }}>
                Cards are secured with 256-bit encryption
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
