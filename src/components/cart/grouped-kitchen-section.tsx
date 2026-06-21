import { ChefHat } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { CartItemRow } from '@/components/cart/cart-item-row';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import type { CartItem } from '@/lib/queries/cart';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const money = (n: number) => `$${n.toFixed(2)}`;

function MinOrderProgress({ subtotal, min }: { subtotal: number; min: number }) {
  const pct = Math.min(1, subtotal / min);
  const met = pct >= 1;
  return (
    <View style={{ gap: 5, paddingTop: 6 }}>
      <View style={{ height: 4, backgroundColor: Palette.chip, borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ height: 4, width: `${pct * 100}%` as `${number}%`, backgroundColor: met ? Palette.success : ORANGE, borderRadius: 2 }} />
      </View>
      <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: met ? Palette.success : Palette.textSecondary }}>
        {met ? '✓ Delivery minimum met' : `Add ${money(min - subtotal)} more for delivery`}
      </Text>
    </View>
  );
}

interface Props {
  kitchenName: string;
  items: CartItem[];
  userId: string;
  startIndex: number;
  mixed?: boolean;
  deliveryMinOrder?: number;
  method?: string;
}

export function GroupedKitchenSection({ kitchenName, items, userId, startIndex, mixed, deliveryMinOrder = 0, method }: Props) {
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

      {/* Per-kitchen delivery minimum progress — only shown in multi-kitchen delivery carts */}
      {mixed && method === 'delivery' && deliveryMinOrder > 0 ? (
        <MinOrderProgress subtotal={subtotal} min={deliveryMinOrder} />
      ) : null}

      {/* Divider after the section */}
      <View style={{ height: 1, backgroundColor: Palette.chip, marginTop: 4 }} />
    </View>
  );
}
