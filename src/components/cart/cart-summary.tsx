import { Check, Clock, ChevronRight, Lock } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ActivityIndicator, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import type { FulfillmentType } from '@/types/database.types';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const money = (n: number) => `$${n.toFixed(2)}`;

interface CartSummaryProps {
  subtotal: number;
  method: FulfillmentType | 'in_home';
  deliveryFee: number;
  tip: number;
  maxPrepTime: number | null;
  total: number;
  discount: number;
  giftCardDiscount: number;
  multiProgress: { done: number; total: number; current: string } | null;
  kitchenGroups: { id: string; name: string }[];
  mixed: boolean;
  busy: boolean;
  hasUnavailable: boolean;
  paymentsOn: boolean;
  ctaLabel: string;
  onCheckout: () => void;
}

export function CartSummary({
  subtotal, method, deliveryFee, tip, maxPrepTime, total, discount, giftCardDiscount,
  multiProgress, kitchenGroups, mixed, busy, hasUnavailable,
  paymentsOn, ctaLabel, onCheckout,
}: CartSummaryProps) {
  return (
    <>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Subtotal</Text>
        <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK, fontVariant: ['tabular-nums'] }}>{money(subtotal)}</Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>
          {method === 'delivery' ? 'Delivery fee' : method === 'in_home' ? 'In-home prep' : 'Pickup / meet up'}
        </Text>
        <Text style={{ fontFamily: Font.medium, fontSize: 13, color: method === 'in_home' ? Palette.textSecondary : deliveryFee ? INK : Palette.success, fontVariant: ['tabular-nums'] }}>
          {method === 'in_home' ? 'Quoted' : deliveryFee ? money(deliveryFee) : 'Free'}
        </Text>
      </View>
      {tip > 0 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Tip</Text>
          <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK, fontVariant: ['tabular-nums'] }}>{money(tip)}</Text>
        </View>
      ) : null}
      {discount > 0 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.success }}>Discount</Text>
          <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.success, fontVariant: ['tabular-nums'] }}>-{money(discount)}</Text>
        </View>
      ) : null}
      {giftCardDiscount > 0 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.success }}>Gift card</Text>
          <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.success, fontVariant: ['tabular-nums'] }}>-{money(giftCardDiscount)}</Text>
        </View>
      ) : null}
      {maxPrepTime ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>Est. prep time</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Clock size={13} color={Palette.textSecondary} />
            <Text style={{ fontFamily: Font.medium, fontSize: 13, color: INK }}>{Math.max(maxPrepTime - 5, 5)}–{maxPrepTime + 5} min</Text>
          </View>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderTopWidth: 1, borderTopColor: Palette.border, marginTop: 8, paddingTop: 14, marginBottom: 20 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.textSecondary }}>Total due</Text>
        <Text style={{ fontFamily: Font.display, fontSize: 28, color: INK, letterSpacing: -0.8, fontVariant: ['tabular-nums'] }}>{money(total)}</Text>
      </View>

      {multiProgress ? (
        <View style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.md, padding: 12, marginBottom: 12, gap: 4 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>
            Placing order {multiProgress.done + 1} of {multiProgress.total}…
          </Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>{multiProgress.current}</Text>
        </View>
      ) : null}

      <MotiView from={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 16, stiffness: 200, delay: 80 }}>
        <PressableScale
          onPress={onCheckout}
          disabled={busy || hasUnavailable}
          accessibilityRole="button"
          accessibilityLabel={mixed ? `Pay all ${kitchenGroups.length} kitchens — ${money(total)}` : paymentsOn ? `Pay ${money(total)} securely` : `Place preorder for ${money(total)}`}
          style={{
            minHeight: 62, borderRadius: Radius.lg, paddingVertical: 12, paddingHorizontal: 20,
            backgroundColor: ORANGE, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center',
            opacity: busy || hasUnavailable ? 0.4 : 1,
            shadowColor: ORANGE, shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
          }}>
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              {paymentsOn ? <Lock size={18} color="rgba(255,255,255,0.88)" /> : null}
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 17, color: '#fff', letterSpacing: -0.2 }}>{ctaLabel}</Text>
                {method !== 'in_home' ? (
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                    {money(total)}{paymentsOn ? ' · secured by Stripe' : ' · pay when confirmed'}
                  </Text>
                ) : null}
              </View>
              <ChevronRight size={20} color="rgba(255,255,255,0.55)" />
            </>
          )}
        </PressableScale>
      </MotiView>
      {hasUnavailable ? (
        <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.danger, textAlign: 'center', marginTop: 8 }}>
          Remove unavailable items to continue
        </Text>
      ) : (
        <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary, textAlign: 'center', marginTop: 10 }}>
          {mixed ? `${kitchenGroups.length} separate orders · ` : ''}{paymentsOn ? 'Auto-refunded if your preorder is declined.' : 'Payment collected when the prepper confirms.'}
        </Text>
      )}
    </>
  );
}
