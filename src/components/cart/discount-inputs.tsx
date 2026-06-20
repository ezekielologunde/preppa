import { Check } from 'lucide-react-native';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import type { GiftCard } from '@/lib/queries/gift-cards';
import type { PromoResult } from '@/lib/queries/promos';

interface DiscountInputsProps {
  // Promo
  promoInput: string;
  setPromoInput: (v: string) => void;
  promo: PromoResult | null;
  promoErr: string | null;
  promoLoading: boolean;
  onApplyPromo: () => void;
  onRemovePromo: () => void;
  // Gift card
  giftInput: string;
  setGiftInput: (v: string) => void;
  giftCard: GiftCard | null;
  giftCardDiscount: number;
  giftErr: string | null;
  giftCardPending: boolean;
  onApplyGiftCard: () => void;
  onRemoveGiftCard: () => void;
}

export function DiscountInputs({
  promoInput, setPromoInput, promo, promoErr, promoLoading, onApplyPromo, onRemovePromo,
  giftInput, setGiftInput, giftCard, giftCardDiscount, giftErr, giftCardPending, onApplyGiftCard, onRemoveGiftCard,
}: DiscountInputsProps) {
  return (
    <>
      {/* Promo code */}
      {promo ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Palette.success + '18', borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Check size={14} color={Palette.success} strokeWidth={3} />
            <Text style={{ flex: 1, fontFamily: Font.semibold, fontSize: 13, color: Palette.success }}>
              {promo.code} · {promo.discount_type === 'percent' ? `${promo.discount_value}% off` : `$${promo.discount_value} off`}
            </Text>
          </View>
          <PressableScale onPress={onRemovePromo} accessibilityRole="button" accessibilityLabel="Remove promo code"
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.textSecondary }}>×</Text>
          </PressableScale>
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={promoInput} onChangeText={(t) => setPromoInput(t.toUpperCase())} placeholder="Promo code"
              placeholderTextColor={Palette.textSecondary} autoCapitalize="characters" maxLength={32} accessibilityLabel="Promo code"
              style={{ flex: 1, height: 44, backgroundColor: Palette.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: Palette.ink }} />
            <PressableScale onPress={onApplyPromo} disabled={promoLoading || !promoInput.trim()} accessibilityRole="button" accessibilityLabel="Apply promo code"
              style={{ width: 80, height: 44, borderRadius: Radius.md, backgroundColor: promoInput.trim() ? Palette.brand : Palette.chip, alignItems: 'center', justifyContent: 'center', opacity: promoLoading ? 0.6 : 1 }}>
              {promoLoading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 14, color: promoInput.trim() ? '#fff' : Palette.textSecondary }}>Apply</Text>}
            </PressableScale>
          </View>
          {promoErr ? <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.danger, paddingHorizontal: 4 }}>{promoErr}</Text> : null}
        </View>
      )}

      {/* Gift card */}
      {giftCard ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Palette.success + '18', borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10 }}>
            <Check size={14} color={Palette.success} strokeWidth={3} />
            <Text style={{ flex: 1, fontFamily: Font.semibold, fontSize: 13, color: Palette.success }}>
              Gift card {giftCard.code} · -${giftCardDiscount.toFixed(2)} applied
            </Text>
          </View>
          <PressableScale onPress={onRemoveGiftCard} accessibilityRole="button" accessibilityLabel="Remove gift card"
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.textSecondary }}>×</Text>
          </PressableScale>
        </View>
      ) : (
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={giftInput} onChangeText={(t) => { setGiftInput(t.toUpperCase()); }} placeholder="Gift card code"
              placeholderTextColor={Palette.textSecondary} autoCapitalize="characters" maxLength={16} accessibilityLabel="Gift card code"
              style={{ flex: 1, height: 44, backgroundColor: Palette.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 14, fontFamily: Font.body, fontSize: 15, color: Palette.ink }} />
            <PressableScale onPress={onApplyGiftCard} disabled={giftCardPending || !giftInput.trim()} accessibilityRole="button" accessibilityLabel="Apply gift card"
              style={{ width: 80, height: 44, borderRadius: Radius.md, backgroundColor: giftInput.trim() ? Palette.brand : Palette.chip, alignItems: 'center', justifyContent: 'center', opacity: giftCardPending ? 0.6 : 1 }}>
              {giftCardPending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 14, color: giftInput.trim() ? '#fff' : Palette.textSecondary }}>Apply</Text>}
            </PressableScale>
          </View>
          {giftErr ? <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.danger, paddingHorizontal: 4 }}>{giftErr}</Text> : null}
        </View>
      )}
    </>
  );
}
