import { X } from 'lucide-react-native';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

export const SCHEDULE_DATES = (() => {
  const now = new Date();
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i + 1);
    d.setHours(0, 0, 0, 0);
    dates.push(d);
  }
  return dates;
})();

export const SCHEDULE_HOURS = Array.from({ length: 24 }, (_, i) => i);
export const SCHEDULE_MINUTES = [0, 15, 30, 45];

function hourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function confirmLabel(dates: Date[], dateIdx: number, hour: number, minute: number): string {
  const d = dates[dateIdx];
  const dayStr = d?.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) ?? '';
  const h = hour === 0 ? 12 : hour <= 12 ? hour : hour - 12;
  const m = String(minute).padStart(2, '0');
  const period = hour < 12 ? 'AM' : 'PM';
  return `Confirm — ${dayStr} at ${h}:${m} ${period}`;
}

type Props = {
  visible: boolean;
  pickDate: number;
  pickHour: number;
  pickMinute: number;
  onDateChange: (i: number) => void;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
  onConfirm: () => void;
  onClose: () => void;
};

const ORANGE = Palette.brand;
const INK = Palette.ink;

export function SchedulePickerModal({ visible, pickDate, pickHour, pickMinute, onDateChange, onHourChange, onMinuteChange, onConfirm, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"
        style={{ flex: 1, backgroundColor: Palette.overlay, justifyContent: 'flex-end' }}>
        <Pressable onPress={(e) => e.stopPropagation()} accessible={false}
          style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 16 }}>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4 }}>Pick a date & time</Text>
            <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel="Close"
              style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} color={Palette.textSecondary} />
            </PressableScale>
          </View>
          <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary }}>Minimum 2 hours from now · up to 7 days ahead</Text>

          {/* Date */}
          <View>
            <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SCHEDULE_DATES.map((d, i) => {
                const on = pickDate === i;
                return (
                  <PressableScale key={i} onPress={() => { feedback.tap(); onDateChange(i); }}
                    accessibilityRole="button" accessibilityLabel={d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                    style={{ paddingHorizontal: 16, height: 44, borderRadius: Radius.pill, backgroundColor: on ? ORANGE : Palette.canvas, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: on ? ORANGE : Palette.border }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: on ? '#fff' : INK }}>
                      {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </View>

          {/* Hour */}
          <View>
            <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Hour</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SCHEDULE_HOURS.map((h) => {
                const on = pickHour === h;
                const label = hourLabel(h);
                return (
                  <PressableScale key={h} onPress={() => { feedback.tap(); onHourChange(h); }}
                    accessibilityRole="button" accessibilityLabel={label}
                    style={{ paddingHorizontal: 14, height: 40, borderRadius: Radius.pill, backgroundColor: on ? ORANGE : Palette.canvas, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: on ? ORANGE : Palette.border }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: on ? '#fff' : INK }}>{label}</Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </View>

          {/* Minute */}
          <View>
            <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>Minute</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {SCHEDULE_MINUTES.map((m) => {
                const on = pickMinute === m;
                return (
                  <PressableScale key={m} onPress={() => { feedback.tap(); onMinuteChange(m); }}
                    accessibilityRole="button" accessibilityLabel={`:${String(m).padStart(2, '0')}`}
                    style={{ flex: 1, height: 44, borderRadius: Radius.sm, backgroundColor: on ? ORANGE : Palette.canvas, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: on ? ORANGE : Palette.border }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: on ? '#fff' : INK }}>:{String(m).padStart(2, '0')}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          <PressableScale onPress={onConfirm} accessibilityRole="button" accessibilityLabel="Confirm scheduled time"
            style={{ height: 52, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 4,
              shadowColor: ORANGE, shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
              {confirmLabel(SCHEDULE_DATES, pickDate, pickHour, pickMinute)}
            </Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
