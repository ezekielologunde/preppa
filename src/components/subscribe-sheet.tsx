import { Minus, Plus, X } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { nextDeliveryDate, type DeliveryDay, type MealPlan } from '@/lib/queries/meal-plans';

const DAYS: { key: DeliveryDay; label: string }[] = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' }, { key: 'sun', label: 'Sun' },
];

const ORANGE = Palette.brand;
const INK = Palette.ink;
const money = (n: number) => `$${n.toLocaleString('en-US')}`;

/**
 * Bottom-sheet to subscribe to a meal plan — servings + delivery-day schedule.
 * Sends the user to Stripe for billing, then the webhook creates the subscription.
 * Pass `plan=null` to keep it closed; `userId` must be set (callers gate sign-in before opening).
 */
export function SubscribePlanSheet({ plan, userId, onClose }: { plan: MealPlan | null; userId: string; onClose: () => void }) {
  const [qty, setQty] = useState(1);
  const [day, setDay] = useState<DeliveryDay>('mon');
  const [loading, setLoading] = useState(false);

  // Reset form each time a new plan opens the sheet.
  const [prevPlanId, setPrevPlanId] = useState<string | null>(plan?.id ?? null);
  if ((plan?.id ?? null) !== prevPlanId) {
    setPrevPlanId(plan?.id ?? null);
    if (plan) { setQty(1); setDay('mon'); }
  }

  async function confirm() {
    if (!plan || loading) return;
    feedback.tap();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-subscribe', {
        body: { type: 'meal_plan', planId: plan.id, prepperId: plan.prepper_id, qty, deliveryDay: day },
      });
      if (error || !data?.url) throw new Error(error?.message ?? 'Checkout failed');
      onClose();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = data.url;
      } else {
        Linking.openURL(data.url);
      }
    } catch (e) {
      feedback.error?.();
      console.error('subscribe-sheet stripe error', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={!!plan} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: Palette.overlay, justifyContent: 'flex-end' }}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, paddingBottom: 34, gap: 16, alignSelf: 'center', width: '100%', maxWidth: 480 }}>
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 21, color: INK, letterSpacing: -0.4 }}>{plan?.name}</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 2 }}>
                by {plan?.prepper} · {plan?.meals_per_cycle} meals / {plan?.frequency}
              </Text>
            </View>
            <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} color={INK} />
            </PressableScale>
          </View>
          </MotiView>

          {/* Servings */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK }}>Servings of each meal</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <PressableScale onPress={() => setQty((q) => Math.max(1, q - 1))} accessibilityRole="button" accessibilityLabel="Fewer servings" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                <Minus size={17} color={INK} />
              </PressableScale>
              <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, minWidth: 32, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{qty}</Text>
              <PressableScale onPress={() => setQty((q) => Math.min(6, q + 1))} accessibilityRole="button" accessibilityLabel="More servings" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={17} color="#fff" />
              </PressableScale>
              <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary }}>
                {qty === 1 ? 'Just for you' : `Feeds ${qty} people per meal`}
              </Text>
            </View>
          </View>
          </MotiView>

          {/* Delivery day */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 160 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK }}>Delivery day</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {DAYS.map((d) => {
                const on = day === d.key;
                return (
                  <MotiView
                    key={d.key}
                    animate={{ backgroundColor: on ? ORANGE : Palette.canvas }}
                    transition={{ type: 'timing', duration: 180 }}
                    style={{ flex: 1, borderRadius: 12, overflow: 'hidden' }}>
                    <PressableScale onPress={() => setDay(d.key)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={d.label}
                      style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: on ? '#fff' : INK }}>{d.label}</Text>
                    </PressableScale>
                  </MotiView>
                );
              })}
            </View>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary }}>
              First delivery {nextDeliveryDate(day).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} · renews {plan?.frequency}
            </Text>
          </View>
          </MotiView>

          {/* Confirm */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 240 }}>
          <PressableScale
            onPress={confirm}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Start plan"
            style={{ height: 54, borderRadius: 16, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
                Start plan · {money((plan?.price ?? 0) * qty)}/{plan?.frequency}
              </Text>
            )}
          </PressableScale>
          </MotiView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
