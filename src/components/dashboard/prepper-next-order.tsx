import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { Check, ShoppingBag, UtensilsCrossed } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { Skeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import type { FulfillmentType, OrderStatus } from '@/types/database.types';
import type { OrderSummary } from '@/lib/queries/orders';

const ORANGE = Palette.brand;
const GREEN = Palette.success;
const INK = Palette.ink;
const MUTED = Palette.textSecondary;
const CARD = Palette.surface;

const FL: Record<FulfillmentType, string> = { pickup: 'pickup', delivery: 'delivery', meetup: 'meetup', home_cook: 'home cook' };
const FC: Record<FulfillmentType, string> = { pickup: '#f59e0b', delivery: '#06b6d4', meetup: '#a78bfa', home_cook: '#22c55e' };

export interface PrepperNextOrderProps {
  next: OrderSummary | null;
  step: { next: OrderStatus; cta: string } | undefined;
  activeCount: number;
  statsLoading: boolean;
  advancePending: boolean;
  advanceErr: string | null;
  router: ReturnType<typeof useRouter>;
  onAdvance: () => void;
  onDismissErr: () => void;
}

export function PrepperNextOrder({ next, step, activeCount, statsLoading, advancePending, advanceErr, router, onAdvance, onDismissErr: _d }: PrepperNextOrderProps) {
  return (
    <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320, delay: 80 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginTop: 16, marginBottom: 10 }}>
        <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3 }}>next preorder</Text>
        {next && (
          <View style={{ backgroundColor: ORANGE + '26', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: ORANGE }}>{next.status === 'pending' ? 'new' : next.status}</Text>
          </View>
        )}
      </View>

      {next ? (
        <PressableScale
          onPress={() => { feedback.tap(); router.push('/prepper-orders'); }}
          accessibilityRole="button"
          accessibilityLabel="View order details"
          style={{ marginHorizontal: 20 }}
        >
          <View style={{ backgroundColor: CARD, borderRadius: 22, padding: 16, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {next.items[0]?.image ? (
                <Image source={next.items[0].image} style={{ width: 76, height: 76, borderRadius: 18 }} contentFit="cover" accessibilityLabel={next.items[0].title} />
              ) : (
                <View style={{ width: 76, height: 76, borderRadius: 18, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                  <UtensilsCrossed size={26} color={MUTED} />
                </View>
              )}
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }} numberOfLines={1}>{next.customer}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }} numberOfLines={1}>
                  {next.items[0]?.title ?? 'preorder'}{next.items.length > 1 ? ` +${next.items.length - 1}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: next.paymentStatus === 'succeeded' ? GREEN + '24' : Palette.chip, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
                    {next.paymentStatus === 'succeeded' && <Check size={11} color={GREEN} strokeWidth={2.5} />}
                    <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: next.paymentStatus === 'succeeded' ? GREEN : MUTED }}>
                      {next.paymentStatus === 'succeeded' ? 'paid' : 'unpaid'}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: FC[next.fulfillment] + '22', borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: FC[next.fulfillment] }}>{FL[next.fulfillment]}</Text>
                  </View>
                  <Text style={{ fontFamily: Font.display, fontSize: 16, color: INK, fontVariant: ['tabular-nums'] }}>${next.total.toFixed(2)}</Text>
                </View>
              </View>
            </View>

            {step && (
              <>
                <PressableScale
                  onPress={() => { feedback.tap(); onAdvance(); }}
                  disabled={advancePending}
                  accessibilityRole="button"
                  accessibilityLabel={step.cta}
                  style={{ height: 50, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: advancePending ? 0.7 : 1 }}
                >
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{step.cta}</Text>
                </PressableScale>
                {advanceErr && (
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.danger, textAlign: 'center' }}>{advanceErr}</Text>
                )}
              </>
            )}

            {activeCount > 1 && (
              <PressableScale onPress={() => { feedback.tap(); router.push('/prepper-orders'); }} accessibilityRole="button" accessibilityLabel={`See all ${activeCount} active orders`} style={{ alignItems: 'center', paddingVertical: 4 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>+{activeCount - 1} more in queue — see all →</Text>
              </PressableScale>
            )}
          </View>
        </PressableScale>
      ) : statsLoading ? (
        <View style={{ marginHorizontal: 20 }}>
          <Skeleton width="100%" height={108} radius={22} />
        </View>
      ) : (
        <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }} style={{ marginHorizontal: 20, backgroundColor: CARD, borderRadius: 22, padding: 24, alignItems: 'center', gap: 10 }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center', shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
            <ShoppingBag size={28} color={Palette.textSecondary} />
          </View>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK, textAlign: 'center' }}>No active preorders</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 19 }}>
            New preorders land here instantly once customers check out.
          </Text>
          <PressableScale onPress={() => { feedback.tap(); router.push('/prepper-orders'); }} accessibilityRole="button" accessibilityLabel="View all preorders" style={{ marginTop: 2, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 22, paddingVertical: 10 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#fff' }}>view all orders →</Text>
          </PressableScale>
        </MotiView>
      )}
    </MotiView>
  );
}
