import { useRouter } from 'expo-router';
import { ShoppingBag } from 'lucide-react-native';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { GroupedKitchenSection } from '@/components/cart/grouped-kitchen-section';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useCart } from '@/lib/queries/cart';
import { useAuth } from '@/providers/auth-provider';

const money = (n: number) => `$${n.toFixed(2)}`;

export function CartTabContent() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: cart, isLoading } = useCart(user?.id);

  const kitchens = useMemo(() => {
    const map = new Map<string, { name: string; items: NonNullable<typeof cart>['items'] }>();
    for (const it of cart?.items ?? []) {
      const key = it.prepperId ?? it.prepper;
      if (!map.has(key)) map.set(key, { name: it.prepper, items: [] });
      map.get(key)!.items.push(it);
    }
    return [...map.values()];
  }, [cart?.items]);

  const kitchenStarts = useMemo(() => {
    const starts: number[] = [];
    let idx = 0;
    for (const g of kitchens) {
      starts.push(idx);
      idx += g.items.length;
    }
    return starts;
  }, [kitchens]);

  if (isLoading) {
    return <View style={{ paddingHorizontal: 16, paddingTop: 12 }}><ListSkeleton count={3} /></View>;
  }

  if (!cart?.count) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48, gap: 10 }}>
        <ShoppingBag size={56} color={Palette.border} />
        <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink }}>Your cart is empty</Text>
        <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 240 }}>
          Browse kitchens and add meals to start your order.
        </Text>
        <PressableScale
          onPress={() => { feedback.tap(); router.replace('/explore'); }}
          accessibilityRole="button"
          accessibilityLabel="Browse meals"
          style={{ marginTop: 4, paddingHorizontal: 22, height: 44, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>Browse meals</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100, gap: 20 }}
        showsVerticalScrollIndicator={false}>
        {kitchens.map((g, i) => (
          <GroupedKitchenSection
            key={g.name}
            kitchenName={g.name}
            items={g.items}
            userId={user!.id}
            startIndex={kitchenStarts[i]}
          />
        ))}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.ink }}>Subtotal</Text>
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.ink, fontVariant: ['tabular-nums'] }}>
            {money(cart.subtotal)}
          </Text>
        </View>
      </ScrollView>
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 20, paddingVertical: 16,
        backgroundColor: Palette.canvas,
        borderTopWidth: 1, borderTopColor: Palette.border,
      }}>
        <PressableScale
          onPress={() => { feedback.tap(); router.push('/cart'); }}
          accessibilityRole="button"
          accessibilityLabel="Proceed to checkout"
          style={{ height: 52, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
            Checkout · {money(cart.subtotal)}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}
