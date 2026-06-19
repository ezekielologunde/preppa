import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle, ChevronLeft, Clock, Heart, MessageCircle, Package, Star, Truck, UtensilsCrossed } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useOrderStatus, type OrderStatusStep } from '@/lib/queries/orders';
import type { OrderStatus } from '@/types/database.types';

// ── helpers ──────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.FC<{ size: number; color: string; strokeWidth?: number }>> = {
  Clock: Clock,
  CheckCircle: CheckCircle,
  UtensilsCrossed: UtensilsCrossed,
  Truck: Truck,
  Package: Package,
  Heart: Heart,
};

/** Ordered status keys used to determine step state. */
const STATUS_ORDER: OrderStatus[] = [
  'pending', 'confirmed', 'preparing', 'out_for_delivery', 'ready', 'completed',
];

function stepState(stepKey: string, currentStatus: OrderStatus): 'done' | 'current' | 'upcoming' {
  if (currentStatus === 'cancelled') return 'upcoming';
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  const stepIdx = STATUS_ORDER.indexOf(stepKey as OrderStatus);
  if (stepIdx < 0 || currentIdx < 0) return 'upcoming';
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'current';
  return 'upcoming';
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// ── sub-components ────────────────────────────────────────────────────────────

function TimelineStep({
  step,
  state,
  isLast,
}: {
  step: OrderStatusStep;
  state: 'done' | 'current' | 'upcoming';
  isLast: boolean;
}) {
  const IconComp = ICON_MAP[step.icon] ?? Clock;
  const dotColor = state === 'done' ? Palette.success : state === 'current' ? Palette.brand : Palette.border;
  const labelColor = state === 'current' ? Palette.brand : state === 'done' ? Palette.ink : Palette.textMuted;
  const lineColor = state === 'done' ? Palette.success : Palette.border;

  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {/* Left: dot + connector */}
      <View style={{ alignItems: 'center', width: 24 }}>
        {state === 'current' ? (
          <MotiView
            from={{ scale: 1, opacity: 1 }}
            animate={{ scale: [1, 1.18, 1], opacity: [1, 0.55, 1] }}
            transition={{ type: 'timing', duration: 1000, loop: true }}
            style={{
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: Palette.brand,
              alignItems: 'center', justifyContent: 'center',
            }}>
            <IconComp size={12} color="#fff" />
          </MotiView>
        ) : state === 'done' ? (
          <View style={{
            width: 24, height: 24, borderRadius: 12,
            backgroundColor: Palette.success,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircle size={14} color="#fff" strokeWidth={2.5} />
          </View>
        ) : (
          <View style={{
            width: 24, height: 24, borderRadius: 12,
            borderWidth: 2, borderColor: dotColor,
            backgroundColor: Palette.canvas,
          }} />
        )}
        {!isLast ? (
          <View style={{ width: 2, flex: 1, minHeight: 20, marginTop: 4, backgroundColor: lineColor }} />
        ) : null}
      </View>

      {/* Right: text */}
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 20, paddingTop: 2 }}>
        <Text style={{
          fontFamily: state === 'current' ? Font.semibold : Font.medium,
          fontSize: 15, color: labelColor,
        }}>
          {step.label}
        </Text>
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted, marginTop: 1 }}>
          {step.description}
        </Text>
      </View>
    </View>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: Palette.border }} />
      <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' }}>
        {title}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: Palette.border }} />
    </View>
  );
}

// ── main screen ───────────────────────────────────────────────────────────────

export default function OrderStatusScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading, isError, steps } = useOrderStatus(id);

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) router.back();
    else router.replace('/orders' as never);
  }

  const shortId = id ? `#${id.slice(-6).toUpperCase()}` : '';

  // ── loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <Header shortId={shortId} onBack={goBack} />
          <ListSkeleton count={5} rowHeight={64} />
        </SafeAreaView>
      </View>
    );
  }

  // ── error ──────────────────────────────────────────────────────────────────
  if (isError || !order) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <Header shortId={shortId} onBack={goBack} />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.ink }}>Could not load order</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>
              Check your connection and try again.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const isCancelled = order.status === 'cancelled';
  const isCompleted = order.status === 'completed';

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <Header shortId={shortId} onBack={goBack} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

          {/* Cancelled banner */}
          {isCancelled ? (
            <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220 }}
              style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: Palette.danger + '14', borderWidth: 1, borderColor: Palette.danger + '40', borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 12 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.danger }}>Order cancelled</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 2 }}>
                This order was cancelled. Contact the kitchen if you have questions.
              </Text>
            </MotiView>
          ) : null}

          {/* Delivered celebration banner */}
          {isCompleted ? (
            <MotiView from={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
              style={{ marginHorizontal: 16, marginBottom: 12, backgroundColor: Palette.success + '14', borderWidth: 1, borderColor: Palette.success + '40', borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 14, gap: 8 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.success }}>Your order was delivered!</Text>
              <PressableScale
                onPress={() => { feedback.tap(); router.push(`/review?orderId=${order.id}&prepperId=${order.prepperId}&mealId=${order.firstMealId ?? ''}&prepper=${encodeURIComponent(order.prepper)}` as never); }}
                accessibilityRole="button"
                accessibilityLabel="Leave a review"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
                  backgroundColor: Palette.success, borderRadius: Radius.pill, paddingHorizontal: 16, height: 36, marginTop: 2 }}>
                <Star size={13} color="#fff" strokeWidth={2.5} />
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>Leave a review</Text>
              </PressableScale>
            </MotiView>
          ) : null}

          {/* Kitchen + order meta */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }}
            style={{ marginHorizontal: 16, backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 16, gap: 10, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={order.prepper} size={52} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.ink }}>{order.prepper}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>
                  Order placed {fmt(order.created_at)}
                </Text>
              </View>
            </View>
          </MotiView>

          {/* Timeline */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 40 }}
            style={{ marginHorizontal: 16, backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 16, marginBottom: 12 }}>
            <SectionLabel title="Timeline" />
            {steps.map((step, i) => (
              <TimelineStep
                key={step.key}
                step={step}
                state={isCancelled ? 'upcoming' : stepState(step.key, order.status)}
                isLast={i === steps.length - 1}
              />
            ))}
          </MotiView>

          {/* Order items */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}
            style={{ marginHorizontal: 16, backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 16, marginBottom: 12 }}>
            <SectionLabel title="Your order" />
            <View style={{ gap: 10 }}>
              {order.items.map((item) => (
                <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {item.image ? (
                    <Image source={item.image}
                      style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: Palette.canvas, flexShrink: 0 }}
                      contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: Palette.canvas, flexShrink: 0 }} />
                  )}
                  <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.ink, flex: 1 }} numberOfLines={1}>
                    {item.title} x{item.quantity}
                  </Text>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.ink, fontVariant: ['tabular-nums'] }}>
                    ${item.total.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Palette.border, gap: 8 }}>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary }}>Total</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 16, color: Palette.brand, fontVariant: ['tabular-nums'] }}>
                ${order.total.toFixed(2)}
              </Text>
            </View>
          </MotiView>

          {/* Actions */}
          {!isCancelled ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 120 }}
              style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16 }}>
              <PressableScale
                onPress={() => {
                  feedback.tap();
                  router.push(`/order-chat?orderId=${order.id}` as never);
                }}
                accessibilityRole="button"
                accessibilityLabel="Message kitchen"
                style={{ flex: 1, height: 48, borderRadius: Radius.sm, backgroundColor: Palette.surface,
                  borderWidth: 1, borderColor: Palette.border, flexDirection: 'row',
                  alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                <MessageCircle size={16} color={Palette.ink} />
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.ink }}>Message kitchen</Text>
              </PressableScale>
              {isCompleted && !order.reviewed ? (
                <PressableScale
                  onPress={() => {
                    feedback.tap();
                    router.push(`/review?orderId=${order.id}&prepperId=${order.prepperId}&mealId=${order.firstMealId ?? ''}&prepper=${encodeURIComponent(order.prepper)}` as never);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Leave a review"
                  style={{ flex: 1, height: 48, borderRadius: Radius.sm, backgroundColor: Palette.brand,
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  <Star size={16} color="#fff" />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>Leave a review</Text>
                </PressableScale>
              ) : null}
            </MotiView>
          ) : null}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Header({ shortId, onBack }: { shortId: string; onBack: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
      <PressableScale onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back"
        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
        <ChevronLeft size={22} color={Palette.ink} />
      </PressableScale>
      <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.5, flex: 1 }}>
        order {shortId}
      </Text>
    </View>
  );
}
