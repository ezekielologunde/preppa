import { Image } from 'expo-image';
import { Minus, Plus, Trash2 } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useUpdateCartItem } from '@/lib/queries/cart';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const money = (n: number) => `$${n.toFixed(2)}`;

export interface CartItem {
  id: string;
  title: string;
  prepper: string;
  prepperId?: string | null;
  price_snapshot: number;
  quantity: number;
  available: boolean;
  image?: string | null;
  prepTime?: number | null;
}

interface Props {
  item: CartItem;
  index: number;
  userId: string;
}

export function CartItemRow({ item: it, index: i, userId }: Props) {
  const updateItem = useUpdateCartItem(userId);

  return (
    <MotiView
      key={it.id}
      from={{ opacity: 0, translateX: -8 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'timing', duration: 260, delay: i * 50 }}
    >
      <View
        style={{
          backgroundColor: Palette.surface,
          borderRadius: Radius.md,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {it.image ? (
          <Image source={it.image} style={{ width: 64, height: 64, borderRadius: 12 }} contentFit="cover" />
        ) : (
          <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: Palette.canvas }} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }} numberOfLines={1}>
            {it.title}
          </Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1 }}>
            by {it.prepper}
          </Text>
          <Text style={{ fontFamily: Font.display, fontSize: 16, color: ORANGE, marginTop: 4 }}>
            {money(it.price_snapshot)}
          </Text>
          {!it.available ? (
            <View
              style={{
                marginTop: 5,
                alignSelf: 'flex-start',
                backgroundColor: Palette.danger + '1A',
                borderRadius: Radius.pill,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.danger }}>
                Unavailable — remove to continue
              </Text>
            </View>
          ) : null}
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: Palette.canvas,
            borderRadius: Radius.pill,
            paddingHorizontal: 6,
            paddingVertical: 4,
          }}
        >
          <PressableScale
            onPress={() => {
              feedback.tap();
              updateItem.mutate(
                { itemId: it.id, quantity: it.quantity - 1 },
                { onSuccess: () => feedback.success(), onError: () => feedback.error() },
              );
            }}
            accessibilityRole="button"
            accessibilityLabel="Decrease quantity"
            hitSlop={8}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: Palette.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {it.quantity <= 1 ? <Trash2 size={14} color={Palette.danger} /> : <Minus size={14} color={INK} />}
          </PressableScale>
          <Text
            style={{
              fontFamily: Font.heading,
              fontSize: 15,
              color: INK,
              minWidth: 18,
              textAlign: 'center',
              fontVariant: ['tabular-nums'],
            }}
          >
            {it.quantity}
          </Text>
          <PressableScale
            onPress={() => {
              feedback.tap();
              updateItem.mutate(
                { itemId: it.id, quantity: it.quantity + 1 },
                { onSuccess: () => feedback.success(), onError: () => feedback.error() },
              );
            }}
            accessibilityRole="button"
            accessibilityLabel="Increase quantity"
            hitSlop={8}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: ORANGE,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={14} color="#fff" />
          </PressableScale>
        </View>
      </View>
    </MotiView>
  );
}
