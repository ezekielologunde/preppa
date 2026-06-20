import { useRouter } from 'expo-router';
import { ChevronLeft, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import {
  DAYS,
  DAY_LABELS,
  DEFAULT_SCHEDULE,
  genTimes,
  parseTimeToMinutes,
  useCookSchedule,
  useSaveCookSchedule,
  type CookSchedule,
  type Day,
  type DaySchedule,
} from '@/lib/queries/schedule';
import { useAuth } from '@/providers/auth-provider';

const BG     = '#F8F6F3';
const CARD   = '#FFFFFF';
const INK    = '#1A1714';
const MUTED  = Palette.textSecondary;
const BORDER = '#EDE9E4';
const S1     = { shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 };

const TIMES = genTimes();
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

// ── Time picker modal ──────────────────────────────────────────────────────────

type TimePickerProps = {
  visible: boolean;
  selected: string;
  title: string;
  onSelect: (t: string) => void;
  onClose: () => void;
};

function TimePicker({ visible, selected, title, onSelect, onClose }: TimePickerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <Pressable onPress={(e) => e.stopPropagation()} accessible={false}>
          <SafeAreaView edges={['bottom']} style={{ backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: BORDER }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK, flex: 1 }}>{title}</Text>
              <PressableScale onPress={onClose} style={{ padding: 4 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.brand }}>Done</Text>
              </PressableScale>
            </View>
            <FlatList
              data={TIMES}
              keyExtractor={(t) => t}
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const active = item === selected;
                return (
                  <PressableScale
                    onPress={() => { feedback.tap(); onSelect(item); }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: BORDER,
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: active ? Palette.brand + '18' : 'transparent',
                    }}>
                    <Clock size={14} color={active ? Palette.brand : MUTED} style={{ marginRight: 10 }} />
                    <Text style={{ fontFamily: active ? Font.semibold : Font.body, fontSize: 15, color: active ? Palette.brand : INK }}>
                      {item}
                    </Text>
                  </PressableScale>
                );
              }}
            />
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Day row ───────────────────────────────────────────────────────────────────

type DayRowProps = {
  day: Day;
  slot: DaySchedule;
  onToggle: () => void;
  onPickFrom: () => void;
  onPickTo: () => void;
};

function DayRow({ day, slot, onToggle, onPickFrom, onPickTo }: DayRowProps) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: slot.open ? INK : MUTED, width: 100 }}>
        {DAY_LABELS[day]}
      </Text>

      {slot.open ? (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <PressableScale
            onPress={onPickFrom}
            style={{ flex: 1, height: 36, borderRadius: Radius.sm, backgroundColor: Palette.brand + '18', borderWidth: 1, borderColor: Palette.brand + '40', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.brand }}>{slot.from}</Text>
          </PressableScale>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }}>—</Text>
          <PressableScale
            onPress={onPickTo}
            style={{ flex: 1, height: 36, borderRadius: Radius.sm, backgroundColor: Palette.brand + '18', borderWidth: 1, borderColor: Palette.brand + '40', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.brand }}>{slot.to}</Text>
          </PressableScale>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }}>Closed</Text>
        </View>
      )}

      <Switch
        value={slot.open}
        onValueChange={onToggle}
        trackColor={{ true: Palette.brand + '60', false: Palette.border }}
        thumbColor={slot.open ? Palette.brand : '#f4f4f4'}
        accessibilityLabel={`${DAY_LABELS[day]} availability`}
      />
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PrepperScheduleScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: application } = useMyPrepperApplication(user?.id);
  const prepperId = application?.id ?? null;
  const { data: saved } = useCookSchedule(prepperId);
  const saveMutation = useSaveCookSchedule(prepperId);

  const [schedule, setSchedule] = useState<CookSchedule | null>(null);
  const effective = schedule ?? saved ?? DEFAULT_SCHEDULE;

  // Has the user made unsaved local changes?
  const isDirty = !!schedule;

  type PickerTarget = { day: Day; field: 'from' | 'to' } | null;
  const [picker, setPicker] = useState<PickerTarget>(null);

  // Bulk apply state — separate from per-day picker
  const [bulkFrom, setBulkFrom] = useState('10:00 AM');
  const [bulkTo, setBulkTo]     = useState('6:00 PM');
  const [bulkPicker, setBulkPicker] = useState<'from' | 'to' | null>(null);

  function toggleDay(day: Day) {
    feedback.tap();
    setSchedule({ ...effective, [day]: { ...effective[day], open: !effective[day].open } });
  }

  function setTime(day: Day, field: 'from' | 'to', value: string) {
    const slot = effective[day];
    const fromMins = field === 'from' ? parseTimeToMinutes(value) : parseTimeToMinutes(slot.from);
    const toMins   = field === 'to'   ? parseTimeToMinutes(value) : parseTimeToMinutes(slot.to);
    if (toMins <= fromMins) {
      Alert.alert('Invalid range', 'Closing time must be after opening time.');
      return;
    }
    setSchedule({ ...effective, [day]: { ...effective[day], [field]: value } });
  }

  function applyBulkHours() {
    if (parseTimeToMinutes(bulkTo) <= parseTimeToMinutes(bulkFrom)) {
      Alert.alert('Invalid range', 'Closing time must be after opening time.');
      return;
    }
    const updated = { ...effective };
    for (const d of DAYS) {
      if (effective[d]?.open) {
        updated[d] = { ...effective[d], from: bulkFrom, to: bulkTo };
      }
    }
    feedback.success();
    setSchedule(updated);
  }

  async function handleSave() {
    if (!prepperId) return;
    feedback.impact();
    try {
      await saveMutation.mutateAsync(effective);
      feedback.success();
      setSchedule(null); // clear dirty state — saved state now matches server
      Alert.alert('Schedule saved!', 'Customers can see your updated hours on your kitchen page.');
    } catch {
      feedback.error();
      Alert.alert('Save failed', 'Please check your connection and try again.');
    }
  }

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); }
  }

  const pickerSlot = picker ? effective[picker.day] : null;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>cook schedule</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Subheading */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: MUTED, lineHeight: 21 }}>
              Set the days and hours you're available to cook. Customers see this on your kitchen page.
            </Text>
          </View>

          {/* Day rows */}
          <View style={{ backgroundColor: CARD, borderRadius: Radius.lg, marginHorizontal: 16, overflow: 'hidden', ...S1 }}>
            {DAYS.map((day) => (
              <DayRow
                key={day}
                day={day}
                slot={effective[day] ?? DEFAULT_SCHEDULE[day]}
                onToggle={() => toggleDay(day)}
                onPickFrom={() => { feedback.tap(); setPicker({ day, field: 'from' }); }}
                onPickTo={() => { feedback.tap(); setPicker({ day, field: 'to' }); }}
              />
            ))}
          </View>

          {/* Timezone note */}
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 8, marginHorizontal: 20 }}>
            Times shown in your local timezone: {TZ}
          </Text>

          {/* Bulk apply row */}
          <View style={{ marginTop: 16, marginHorizontal: 16, backgroundColor: CARD, borderRadius: Radius.lg, padding: 14, gap: 10, ...S1 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: MUTED }}>Apply same hours to all open days</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <PressableScale
                onPress={() => { feedback.tap(); setBulkPicker('from'); }}
                style={{ flex: 1, height: 36, borderRadius: Radius.sm, backgroundColor: Palette.brand + '18', borderWidth: 1, borderColor: Palette.brand + '40', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.brand }}>{bulkFrom}</Text>
              </PressableScale>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }}>—</Text>
              <PressableScale
                onPress={() => { feedback.tap(); setBulkPicker('to'); }}
                style={{ flex: 1, height: 36, borderRadius: Radius.sm, backgroundColor: Palette.brand + '18', borderWidth: 1, borderColor: Palette.brand + '40', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.brand }}>{bulkTo}</Text>
              </PressableScale>
              <PressableScale
                onPress={applyBulkHours}
                accessibilityRole="button"
                accessibilityLabel="Apply to all open days"
                style={{ height: 36, paddingHorizontal: 14, borderRadius: Radius.sm, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#fff' }}>Apply</Text>
              </PressableScale>
            </View>
          </View>

          {/* Save button */}
          <View style={{ marginTop: 24, marginHorizontal: 16 }}>
            <PressableScale
              onPress={handleSave}
              disabled={saveMutation.isPending || !prepperId}
              accessibilityRole="button"
              accessibilityLabel="Save schedule"
              style={{
                height: 52,
                borderRadius: Radius.pill,
                backgroundColor: Palette.brand,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: saveMutation.isPending || !prepperId ? 0.6 : 1,
              }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 16, color: '#fff' }}>
                  {saveMutation.isPending ? 'Saving…' : 'Save schedule'}
                </Text>
                {isDirty && !saveMutation.isPending ? (
                  <View style={{ backgroundColor: '#fff', borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: Palette.brand }}>Unsaved changes</Text>
                  </View>
                ) : null}
              </View>
            </PressableScale>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Day time picker modal */}
      {picker && pickerSlot ? (
        <TimePicker
          visible
          title={picker.field === 'from' ? `${DAY_LABELS[picker.day]} — opens at` : `${DAY_LABELS[picker.day]} — closes at`}
          selected={picker.field === 'from' ? pickerSlot.from : pickerSlot.to}
          onSelect={(t) => { setTime(picker.day, picker.field, t); setPicker(null); }}
          onClose={() => setPicker(null)}
        />
      ) : null}

      {/* Bulk time picker modal */}
      {bulkPicker ? (
        <TimePicker
          visible
          title={bulkPicker === 'from' ? 'All open days — opens at' : 'All open days — closes at'}
          selected={bulkPicker === 'from' ? bulkFrom : bulkTo}
          onSelect={(t) => { if (bulkPicker === 'from') setBulkFrom(t); else setBulkTo(t); setBulkPicker(null); }}
          onClose={() => setBulkPicker(null)}
        />
      ) : null}
    </View>
  );
}
