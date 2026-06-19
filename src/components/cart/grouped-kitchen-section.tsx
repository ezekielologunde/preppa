import { ChefHat } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { CartItemRow } from '@/components/cart/cart-item-row';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import type { CartItem } from '@/lib/queries/cart';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const money = (n: number) => `$${n.toFixed(2)}`;

interface Props {
  kitchenName: string;
  items: CartItem[];
  userId: string;
  startIndex: number;
}

export function GroupedKitchenSection({ kitchenName, items, userId, startIndex }: Props) {
  const subtotal = items.reduce((s, it) => s + it.price_snapshot * it.quantity, 0);

  return (
    <View style={{ gap: 8 }}>
      {/* Kitchen header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 }}>
        <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <ChefHat size={15} color={ORANGE} />
        </View>
        <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: INK, flex: 1 }} numberOfLines={1}>
          {kitchenName}
        </Text>
      </View>

      {/* Items */}
      {items.map((it, i) => (
        <CartItemRow key={it.id} item={it} index={startIndex + i} userId={userId} />
      ))}

      {/* Per-kitchen subtotal */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: Palette.border }}>
        <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary }}>
          Subtotal · {kitchenName}
        </Text>
        <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: INK, fontVariant: ['tabular-nums'] }}>
          {money(subtotal)}
        </Text>
      </View>

      {/* Divider after the section */}
      <View style={{ height: 1, backgroundColor: Palette.chip, marginTop: 4 }} />
    </View>
  );
}
