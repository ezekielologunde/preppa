import * as WebBrowser from 'expo-web-browser';
import { loadStripe, type Stripe, type StripeCardElement } from '@stripe/stripe-js';
import { CreditCard, Lock, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type Ref } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Spacing, Type } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

// ─── Brand config (kept  -  consumed by payment-methods list rendering) ──────────

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'other';

export const BRAND_CONFIG: Record<CardBrand, { label: string; bg: string; textColor: string }> = {
  visa: { label: 'Visa', bg: '#1A1F71', textColor: '#FFFFFF' },
  mastercard: { label: 'Mastercard', bg: '#EB001B', textColor: '#FFFFFF' },
  amex: { label: 'Amex', bg: '#007B5E', textColor: '#FFFFFF' },
  other: { label: 'Card', bg: Palette.chip, textColor: Palette.inkSoft },
};

// Raw DOM host for Stripe's hosted Card field  -  web-only by construction (the
// PAN is entered inside Stripe's iframe and never touches our code → PCI SAQ-A).
const Div = 'div' as unknown as ComponentType<{ ref?: Ref<HTMLDivElement>; style?: CSSProperties }>;

// ─── AddCardSheet ──────────────────────────────────────────────────────────────

/**
 * Save a card for off-session use (reorder / subscription billing) via a
 * SetupIntent + Stripe Elements. The card number/CVC live in Stripe's hosted
 * iframe  -  no raw cardholder data is collected, transmitted, or stored by us.
 */
export function AddCardSheet({
  visible,
  isFirstCard,
  onClose,
  onSaved,
}: {
  visible: boolean;
  isFirstCard?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isWeb = Platform.OS === 'web';
  const hostRef = useRef<HTMLDivElement | null>(null);
  const stripeRef = useRef<Stripe | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  // On open (web): create a SetupIntent, load Stripe, mount the hosted Card field.
  useEffect(() => {
    if (!visible || !isWeb) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setClientSecret(null);
    (async () => {
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('stripe-payment-methods', {
          body: { action: 'create_setup_intent' },
        });
        if (fnErr || !data?.clientSecret || !data?.pk) throw new Error('Could not start card setup.');
        const stripe = await loadStripe(data.pk);
        if (!stripe) throw new Error('Could not load the payment form.');
        if (cancelled) return;
        stripeRef.current = stripe;
        setClientSecret(data.clientSecret);
        const card = stripe.elements().create('card', {
          style: { base: { fontSize: '16px', color: '#1C1A18', '::placeholder': { color: '#B8B0A8' } } },
        });
        cardRef.current = card;
        if (hostRef.current) {
          card.mount(hostRef.current);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not start card setup.');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      cardRef.current?.unmount();
      cardRef.current = null;
      stripeRef.current = null;
    };
  }, [visible, isWeb]);

  async function openPortal() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('stripe-payment-methods', {
        body: { action: 'create_portal_session' },
      });
      if (fnErr || !data?.url) throw new Error('Could not open payment portal.');
      await WebBrowser.openBrowserAsync(data.url);
      onSaved(); // refetch payment methods after portal closes
    } catch (e) {
      setPortalError(e instanceof Error ? e.message : 'Could not open payment portal.');
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleSave() {
    const stripe = stripeRef.current;
    const card = cardRef.current;
    if (saving || !stripe || !card || !clientSecret) {
      if (!stripe || !card || !clientSecret) setError('Card form is still loading.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error: confErr, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card, billing_details: name.trim() ? { name: name.trim() } : undefined },
      });
      if (confErr) throw new Error(confErr.message ?? 'Card could not be saved.');

      // First card → make it the default (subscriptions charge the default off-session).
      const pmId = typeof setupIntent?.payment_method === 'string' ? setupIntent.payment_method : null;
      if (isFirstCard && pmId) {
        await supabase.functions.invoke('stripe-payment-methods', { body: { action: 'set_default', pmId } });
      }
      setName('');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Card could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
          <Text style={{ fontFamily: Font.heading, fontSize: Type.title, color: Palette.ink }}>add card</Text>
          <PressableScale
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close add card"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} color={Palette.inkSoft} />
          </PressableScale>
        </View>

        {!isWeb ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: 16 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={28} color={Palette.brand} />
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 18, color: Palette.ink, textAlign: 'center' }}>
                Manage your cards
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 20 }}>
                Add, remove, and set your default card in our secure payment portal.
              </Text>
            </View>
            {portalError ? (
              <Text style={{ fontFamily: Font.body, fontSize: Type.label, color: Palette.danger, textAlign: 'center' }} accessibilityRole="alert">
                {portalError}
              </Text>
            ) : null}
            <PressableScale
              onPress={openPortal}
              disabled={portalLoading}
              accessibilityRole="button"
              accessibilityLabel="Open payment portal"
              style={{
                backgroundColor: Palette.brand,
                borderRadius: Radius.pill,
                paddingVertical: 15,
                paddingHorizontal: 32,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 54,
                opacity: portalLoading ? 0.6 : 1,
              }}>
              {portalLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ fontFamily: Font.heading, fontSize: Type.body, color: Palette.surface }}>Open payment portal</Text>}
            </PressableScale>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Lock size={13} color={Palette.textMuted} />
              <Text style={{ fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted }}>
                Secured by Stripe  -  we never see your card details
              </Text>
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: Spacing.three, paddingBottom: Spacing.six }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontFamily: Font.medium, fontSize: Type.label, color: Palette.inkSoft, marginBottom: 6 }}>
              cardholder name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Alex Johnson"
              placeholderTextColor={Palette.textMuted}
              autoCapitalize="words"
              maxLength={80}
              accessibilityLabel="Cardholder name"
              style={{
                fontFamily: Font.body,
                fontSize: Type.body,
                color: Palette.ink,
                backgroundColor: Palette.canvas,
                borderRadius: Radius.sm,
                borderWidth: 1,
                borderColor: Palette.border,
                paddingHorizontal: Spacing.three,
                paddingVertical: 13,
                minHeight: 48,
                marginBottom: Spacing.three,
              }}
            />

            <Text style={{ fontFamily: Font.medium, fontSize: Type.label, color: Palette.inkSoft, marginBottom: 6 }}>
              card details
            </Text>
            <View style={{ minHeight: 50, justifyContent: 'center' }}>
              {loading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 }}>
                  <ActivityIndicator color={Palette.brand} />
                  <Text style={{ fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary }}>Loading secure card field…</Text>
                </View>
              ) : null}
              {/* Stripe mounts its hosted card iframe here */}
              <Div
                ref={hostRef}
                style={{
                  display: loading ? 'none' : 'block',
                  border: `1px solid ${Palette.border}`,
                  borderRadius: 14,
                  padding: '15px 14px',
                  backgroundColor: Palette.canvas,
                }}
              />
            </View>

            {error ? (
              <Text
                style={{ fontFamily: Font.body, fontSize: Type.label, color: Palette.danger, textAlign: 'center', marginTop: Spacing.three }}
                accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <PressableScale
              onPress={handleSave}
              disabled={saving || loading}
              accessibilityRole="button"
              accessibilityLabel="Save card"
              accessibilityState={{ disabled: saving || loading }}
              style={{
                backgroundColor: Palette.brand,
                borderRadius: Radius.pill,
                paddingVertical: 16,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: Spacing.four,
                minHeight: 54,
                opacity: saving || loading ? 0.6 : 1,
              }}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontFamily: Font.heading, fontSize: Type.body, color: Palette.surface }}>save card</Text>
              )}
            </PressableScale>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.three }}>
              <Lock size={13} color={Palette.textMuted} />
              <Text style={{ fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted }}>
                Card details are handled and encrypted by Stripe
              </Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
