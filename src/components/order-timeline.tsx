import { MotiView } from 'moti';
import { Text, View } from 'react-native';
import { Truck } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import type { OrderStatus } from '@/types/database.types';

export const TIMELINE_STEPS = [
  { key: 'pending', label: 'Received' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Cooking' },
  { key: 'ready', label: 'Ready' },
  { key: 'out_for_delivery', label: 'On the way' },
  { key: 'completed', label: 'Done' },
] as const;

export function timelineIdx(status: OrderStatus): number {
  if (status === 'pending') return 0;
  if (status === 'confirmed') return 1;
  if (status === 'preparing') return 2;
  if (status === 'ready') return 3;
  if (status === 'out_for_delivery') return 4;
  if (status === 'completed') return 5;
  return 0;
}

export function OrderTimeline({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') return null;
  const curr = timelineIdx(status);
  const inFlight = status !== 'completed';
  return (
    <View style={{ marginTop: 4, marginBottom: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 18 }}>
        {TIMELINE_STEPS.map((step, i) => {
          const done = i <= curr;
          const active = i === curr;
          const nodeStyle = {
            width: active ? 11 : 8,
            height: active ? 11 : 8,
            borderRadius: 6,
            backgroundColor: done ? Palette.brand : Palette.border,
            ...(active
              ? { shadowColor: Palette.brand, shadowRadius: 5, shadowOpacity: 0.55, elevation: 3 }
              : {}),
          };
          return (
            <View
              key={step.key}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flex: i < TIMELINE_STEPS.length - 1 ? 1 : 0,
              }}>
              {active && inFlight ? (
                <MotiView
                  from={{ opacity: 0.55, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'timing', duration: 950, loop: true, repeatReverse: true }}>
                  <View style={nodeStyle} />
                </MotiView>
              ) : (
                <View style={nodeStyle} />
              )}
              {i < TIMELINE_STEPS.length - 1 ? (
                <View
                  style={{
                    flex: 1,
                    height: 2,
                    backgroundColor: i < curr ? Palette.brand : Palette.border,
                    marginHorizontal: 2,
                    borderRadius: 1,
                  }}
                />
              ) : null}
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {TIMELINE_STEPS.map((step, i) => {
          const active = i === curr;
          const done = i < curr;
          return (
            <View
              key={step.key}
              style={{
                flex: i < TIMELINE_STEPS.length - 1 ? 1 : 0,
                minWidth: 32,
                alignItems:
                  i === 0
                    ? 'flex-start'
                    : i === TIMELINE_STEPS.length - 1
                    ? 'flex-end'
                    : 'center',
              }}>
              <Text
                style={{
                  fontFamily: active ? Font.semibold : Font.body,
                  fontSize: 9.5,
                  color: active ? Palette.brand : done ? Palette.inkSoft : Palette.textMuted,
                }}>
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function DeliveryEtaBanner() {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: Palette.brandTint,
          borderRadius: Radius.sm,
          paddingHorizontal: 13,
          paddingVertical: 11,
        }}>
        <MotiView
          from={{ translateX: -3 }}
          animate={{ translateX: 3 }}
          transition={{ type: 'timing', duration: 900, loop: true, repeatReverse: true }}>
          <Truck size={16} color={Palette.brandPressed} />
        </MotiView>
        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.brandPressed }}>
          On the way — arriving soon
        </Text>
      </View>
    </MotiView>
  );
}
