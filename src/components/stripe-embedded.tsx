import { loadStripe } from '@stripe/stripe-js';
import { Lock, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentType, type CSSProperties, type Ref } from 'react';
import { ActivityIndicator, Modal, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';

// Raw DOM host for Stripe's embedded iframe — web-only by construction (the
// opener gates on Platform.OS === 'web').
const Div = 'div' as unknown as ComponentType<{ ref?: Ref<HTMLDivElement>; style?: CSSProperties }>;

/**
 * In-app Stripe payment overlay. The customer pays without ever leaving
 * Preppa — Stripe's embedded Checkout mounts inside this sheet and redirects
 * to /orders?paid=1 on success (same webhook records the payment).
 */
export function StripeEmbeddedSheet({ clientSecret, pk, onClose }: { clientSecret: string; pk: string; onClose: () => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let checkout: { destroy: () => void } | null = null;
    (async () => {
      try {
        const stripe = await loadStripe(pk);
        if (!stripe) throw new Error('Could not load the payment form.');
        if (cancelled) return;
        // v9 renamed initEmbeddedCheckout → createEmbeddedCheckoutPage; accept either.
        const init =
          stripe.createEmbeddedCheckoutPage?.bind(stripe) ??
          (stripe as unknown as { initEmbeddedCheckout: typeof stripe.createEmbeddedCheckoutPage }).initEmbeddedCheckout?.bind(stripe);
        if (!init) throw new Error('Embedded checkout unavailable.');
        const c = await init({ clientSecret });
        if (cancelled) { c.destroy(); return; }
        checkout = c;
        if (hostRef.current) {
          c.mount(hostRef.current);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'Could not load the payment form.'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; checkout?.destroy(); };
  }, [clientSecret, pk]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '92%', alignSelf: 'center', width: '100%', maxWidth: 520, overflow: 'hidden' }}>
          {/* Sheet header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, gap: 9, borderBottomWidth: 1, borderBottomColor: Palette.chip }}>
            <Lock size={15} color={Palette.success} />
            <Text style={{ flex: 1, fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>Secure payment</Text>
            <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel="Close payment" hitSlop={8} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
              <X size={17} color={Palette.textSecondary} />
            </PressableScale>
          </View>

          {error ? (
            <View style={{ padding: 28, gap: 12, alignItems: 'center' }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 14, color: '#b91c1c', textAlign: 'center' }}>{error}</Text>
              <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={{ paddingHorizontal: 20, height: 46, borderRadius: 13, backgroundColor: Palette.ink, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>Close</Text>
              </PressableScale>
            </View>
          ) : (
            <View style={{ minHeight: 420 }}>
              {loading ? (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 1 }}>
                  <ActivityIndicator color={Palette.brand} size="large" />
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Loading secure payment…</Text>
                </View>
              ) : null}
              <Div ref={hostRef} style={{ minHeight: 420, maxHeight: '78vh' as never, overflowY: 'auto' }} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
