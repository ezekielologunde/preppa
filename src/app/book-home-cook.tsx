import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChefHat, ChevronLeft, ChevronRight, Crown, MapPin, Minus, Plus, Sparkles, Users } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useCreateHomeCookRequest } from '@/lib/queries/home-cook';
import { useCustomerMembership } from '@/lib/queries/memberships';
import { usePrepperProfile } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const HC = '#5B21B6';
const HC_TINT = '#EDE9FE';
const INK = Palette.ink;

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const TIME_OPTS = [
  { key: 'morning', label: 'Morning', sub: '8–11 am' },
  { key: 'afternoon', label: 'Afternoon', sub: '12–4 pm' },
  { key: 'evening', label: 'Evening', sub: '5–9 pm' },
  { key: 'late_night', label: 'Late night', sub: '9 pm+' },
];
const BUDGETS = [30, 60, 100, 150, 200];

// Strip control chars from single-line fields
const cleanLine = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ');
// Strip dangerous control chars from multi-line fields (preserve \n \t)
const cleanBlock = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

function CalendarPicker({ value, onChange }: { value: Date | null; onChange: (d: Date) => void }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [cursor, setCursor] = useState(() => new Date());
  const yr = cursor.getFullYear(), mo = cursor.getMonth();
  const firstDow = new Date(yr, mo, 1).getDay();
  const dim = new Date(yr, mo + 1, 0).getDate();
  const cells = [...Array(firstDow).fill(0), ...Array.from({ length: dim }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(0);
  return (
    <View style={{ backgroundColor: Palette.canvas, borderRadius: 16, borderWidth: 1, borderColor: Palette.border, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Palette.border }}>
        <PressableScale onPress={() => setCursor(new Date(yr, mo - 1, 1))} accessibilityRole="button" accessibilityLabel="Previous month" style={{ padding: 6 }}>
          <ChevronLeft size={18} color={Palette.inkSoft} />
        </PressableScale>
        <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>{MONTHS[mo]} {yr}</Text>
        <PressableScale onPress={() => setCursor(new Date(yr, mo + 1, 1))} accessibilityRole="button" accessibilityLabel="Next month" style={{ padding: 6 }}>
          <ChevronRight size={18} color={Palette.inkSoft} />
        </PressableScale>
      </View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 10, paddingTop: 8 }}>
        {DOW.map((d) => <Text key={d} style={{ flex: 1, textAlign: 'center', fontFamily: Font.medium, fontSize: 11, color: Palette.textSecondary }}>{d}</Text>)}
      </View>
      <View style={{ paddingHorizontal: 10, paddingBottom: 10 }}>
        {Array.from({ length: cells.length / 7 }, (_, row) => (
          <View key={row} style={{ flexDirection: 'row' }}>
            {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
              if (!day) return <View key={col} style={{ flex: 1, height: 38 }} />;
              const d = new Date(yr, mo, day); d.setHours(0, 0, 0, 0);
              const past = d <= today;
              const sel = value != null && d.getTime() === value.getTime();
              return (
                <PressableScale key={col} onPress={() => { if (!past) { feedback.tap(); onChange(d); } }} disabled={past}
                  accessibilityRole="button"
                  accessibilityLabel={`${MONTHS[mo]} ${day}`}
                  accessibilityState={{ disabled: past, selected: sel }}
                  style={{ flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: sel ? HC : 'transparent' }}>
                  <Text style={{ fontFamily: sel ? Font.heading : Font.body, fontSize: 13.5, color: past ? Palette.border : sel ? '#fff' : INK }}>{day}</Text>
                </PressableScale>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function BudgetPicker({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  const [custom, setCustom] = useState(value != null && !BUDGETS.includes(value));
  const [raw, setRaw] = useState(value != null && !BUDGETS.includes(value) ? String(value) : '');
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {BUDGETS.map((p) => {
          const on = !custom && value === p;
          return (
            <PressableScale key={p} onPress={() => { feedback.tap(); setCustom(false); onChange(p); }} accessibilityRole="button" accessibilityLabel={'$' + p + ' budget'} accessibilityState={{ selected: on }}
              style={{ paddingHorizontal: 18, height: 42, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: on ? HC : Palette.border, backgroundColor: on ? HC_TINT : Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: on ? HC : INK }}>${p}</Text>
            </PressableScale>
          );
        })}
        <PressableScale onPress={() => { feedback.tap(); setCustom(true); }} accessibilityRole="button" accessibilityLabel="Custom budget" accessibilityState={{ selected: custom }}
          style={{ paddingHorizontal: 18, height: 42, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: custom ? HC : Palette.border, backgroundColor: custom ? HC_TINT : Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: custom ? HC : INK }}>Other</Text>
        </PressableScale>
      </View>
      {custom ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.canvas, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: 14, height: 50, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: Palette.border }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.textSecondary }}>$</Text>
          </View>
          <TextInput value={raw} onChangeText={(t) => { const n = t.replace(/[^0-9.]/g, ''); setRaw(n); const v = parseFloat(n); if (!isNaN(v) && v > 0) onChange(v); }}
            placeholder="e.g. 250" placeholderTextColor={Palette.textSecondary} keyboardType="numeric" maxLength={7}
            style={{ flex: 1, height: 50, paddingHorizontal: 12, fontFamily: Font.body, fontSize: 15, color: INK }}
            accessibilityLabel="Custom ingredient budget" />
        </View>
      ) : null}
    </View>
  );
}

export default function BookHomeCookScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { prepperId } = useLocalSearchParams<{ prepperId?: string }>();
  const { data: p } = usePrepperProfile(prepperId);
  const { data: membership } = useCustomerMembership(user?.id);
  const create = useCreateHomeCookRequest();

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [time, setTime] = useState('evening');
  const [address, setAddress] = useState('');
  const [guests, setGuests] = useState(2);
  const [cuisine, setCuisine] = useState('');
  const [menuIdeas, setMenuIdeas] = useState('');
  const [budget, setBudget] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const isPlus = membership?.isPlus ?? false;
  const prepperName = p?.name.split(' ')[0] ?? '…';
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) { router.back(); } else { router.replace('/'); }
  }

  function submit() {
    if (!user) return router.push('/auth?mode=signup');
    setErr(null);
    if (!selectedDate) { feedback.error(); return setErr('Pick a date for your session.'); }
    if (selectedDate <= today) { feedback.error(); return setErr('The date must be in the future.'); }
    const addr = cleanLine(address).trim();
    if (addr.length < 5) { feedback.error(); return setErr('Enter your full home address.'); }
    if (!budget || budget < 20) { feedback.error(); return setErr('Set an ingredient budget of at least $20.'); }
    if (!prepperId) { feedback.error(); return setErr('Prepper not found.'); }

    const iso = [
      selectedDate.getFullYear(),
      String(selectedDate.getMonth() + 1).padStart(2, '0'),
      String(selectedDate.getDate()).padStart(2, '0'),
    ].join('-');

    feedback.tap();
    create.mutate(
      {
        prepperId,
        requestedDate: iso,
        requestedTime: time,
        address: addr.slice(0, 200),
        guestCount: guests,
        cuisine: cleanLine(cuisine).trim().slice(0, 60) || undefined,
        menuIdeas: cleanBlock(menuIdeas).trim().slice(0, 500) || undefined,
        ingredientBudget: budget,
      },
      {
        onSuccess: ({ conversationId }) => {
          feedback.success();
          if (conversationId) {
            router.replace({ pathname: '/chat', params: { id: conversationId, name: prepperName } });
          } else {
            router.replace('/messages');
          }
        },
        onError: (e) => {
          feedback.error();
          const msg = e instanceof Error ? e.message : '';
          if (msg.includes('rate_limited')) setErr("You've sent 3 requests in the last 24 hours. Please wait before sending another.");
          else if (msg.includes('membership_required')) setErr('Home cook bookings require a Prep+ membership.');
          else if (msg.includes('prepper_unavailable')) setErr("This prepper isn't currently accepting home cook bookings.");
          else if (msg.includes('invalid_date')) setErr('The booking date must be at least 24 hours in the future.');
          else if (msg.includes('duplicate_request')) setErr('You already have an active request with this prepper. Check your messages.');
          else setErr('Could not send request. Please try again.');
        },
      },
    );
  }

  const dateLabel = selectedDate
    ? `${MONTHS[selectedDate.getMonth()].slice(0, 3)} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5 }}>Cook at my home</Text>
            {p ? <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary }}>with {prepperName}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: HC_TINT, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 }}>
            <Crown size={12} color={HC} />
            <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: HC }}>Prep+</Text>
          </View>
        </View>

        {!isPlus ? (
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
            <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: HC_TINT, alignItems: 'center', justifyContent: 'center' }}>
              <Crown size={32} color={HC} />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5, textAlign: 'center' }}>Prep+ exclusive</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 21, maxWidth: 300 }}>
              Home cook bookings are available on the Prep+ plan — a prepper comes to your kitchen, cooks your favourite meals with fresh ingredients, and handles all the clean-up.
            </Text>
            <PressableScale onPress={() => { feedback.tap(); router.push('/prep-plus'); }} accessibilityRole="button" accessibilityLabel="Upgrade to Prep+"
              style={{ height: 52, paddingHorizontal: 32, borderRadius: Radius.pill, backgroundColor: HC, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              <Sparkles size={16} color="#fff" />
              <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Upgrade to Prep+</Text>
            </PressableScale>
          </MotiView>
        ) : (
          <>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 24 }}>

              {/* How it works */}
              <View style={{ backgroundColor: HC_TINT, borderRadius: Radius.md, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: HC + '22', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ChefHat size={18} color={HC} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: HC }}>How it works</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: '#4C1D95', lineHeight: 18 }}>
                    Submit this form → {prepperName} proposes their fee → you confirm → they cook at your home on the agreed date. Payment is released only after the session is complete.
                  </Text>
                </View>
              </View>

              {/* Date */}
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>Preferred date</Text>
                  {dateLabel ? (
                    <View style={{ backgroundColor: HC_TINT, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: HC }}>{dateLabel}</Text>
                    </View>
                  ) : null}
                </View>
                <CalendarPicker value={selectedDate} onChange={setSelectedDate} />
              </View>

              {/* Time of day */}
              <View style={{ gap: 10 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>Time of day</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {TIME_OPTS.map((t) => {
                    const active = time === t.key;
                    return (
                      <PressableScale key={t.key} onPress={() => { feedback.tap(); setTime(t.key); }} accessibilityRole="button" accessibilityLabel={t.label}
                        style={{ flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: active ? HC : Palette.border, backgroundColor: active ? HC_TINT : Palette.surface, paddingVertical: 10, alignItems: 'center', gap: 2 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: active ? HC : INK }}>{t.label}</Text>
                        <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: active ? HC : Palette.textSecondary }}>{t.sub}</Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>

              {/* Guests */}
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Users size={15} color={HC} />
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>Guests</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, backgroundColor: Palette.surface, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: Palette.border, alignSelf: 'flex-start' }}>
                  <PressableScale onPress={() => { feedback.tap(); setGuests(Math.max(1, guests - 1)); }} disabled={guests <= 1} accessibilityRole="button" accessibilityLabel="Decrease guests"
                    style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center', opacity: guests <= 1 ? 0.35 : 1 }}>
                    <Minus size={16} color={INK} />
                  </PressableScale>
                  <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, minWidth: 36, textAlign: 'center', fontVariant: ['tabular-nums'] }} accessibilityLabel={guests + ' guests'}>{guests}</Text>
                  <PressableScale onPress={() => { feedback.tap(); setGuests(Math.min(20, guests + 1)); }} disabled={guests >= 20} accessibilityRole="button" accessibilityLabel="Increase guests"
                    style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: HC_TINT, alignItems: 'center', justifyContent: 'center', opacity: guests >= 20 ? 0.35 : 1 }}>
                    <Plus size={16} color={HC} />
                  </PressableScale>
                </View>
              </View>

              {/* Address */}
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <MapPin size={15} color={HC} />
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>Your home address</Text>
                </View>
                <TextInput value={address} onChangeText={(t) => setAddress(cleanLine(t))}
                  placeholder="Street, City, State" placeholderTextColor={Palette.textSecondary}
                  autoCapitalize="words" maxLength={200}
                  style={{ height: 50, borderRadius: 14, backgroundColor: Palette.canvas, paddingHorizontal: 14, fontSize: 15, fontFamily: Font.body, color: INK, borderWidth: 1, borderColor: Palette.border }}
                  accessibilityLabel="Your home address" />
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>Shared only with the prepper after booking is confirmed.</Text>
              </View>

              {/* Cuisine + menu ideas */}
              <View style={{ gap: 10 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>Cuisine & menu ideas <Text style={{ fontFamily: Font.body, color: Palette.textSecondary }}>(optional)</Text></Text>
                <TextInput value={cuisine} onChangeText={(t) => setCuisine(cleanLine(t))}
                  placeholder="e.g. West African, Italian, Japanese…" placeholderTextColor={Palette.textSecondary}
                  maxLength={60}
                  style={{ height: 50, borderRadius: 14, backgroundColor: Palette.canvas, paddingHorizontal: 14, fontSize: 15, fontFamily: Font.body, color: INK, borderWidth: 1, borderColor: Palette.border }}
                  accessibilityLabel="Cuisine preference" />
                <TextInput value={menuIdeas} onChangeText={(t) => setMenuIdeas(cleanBlock(t))}
                  placeholder="Specific dishes, dietary restrictions, or any requests?" placeholderTextColor={Palette.textSecondary}
                  multiline maxLength={500} textAlignVertical="top"
                  style={{ height: 90, borderRadius: 14, backgroundColor: Palette.canvas, paddingHorizontal: 14, paddingTop: 13, fontSize: 15, fontFamily: Font.body, color: INK, borderWidth: 1, borderColor: Palette.border }}
                  accessibilityLabel="Menu ideas and notes" />
              </View>

              {/* Ingredient budget */}
              <View style={{ gap: 10 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>Ingredient budget</Text>
                <BudgetPicker value={budget} onChange={setBudget} />
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>Covers groceries. The prepper proposes their cooking fee separately after reviewing.</Text>
              </View>

              {err ? (
                <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FECACA' }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: '#991B1B' }}>{err}</Text>
                </View>
              ) : null}
            </ScrollView>

            {/* Footer — normal flow, not absolute */}
            <View style={{ backgroundColor: Palette.surface, borderTopWidth: 1, borderTopColor: Palette.border, paddingHorizontal: 20, paddingTop: 14, paddingBottom: Math.max(insets.bottom, 16) }}>
              <Button
                title={`Send request to ${prepperName}`}
                Icon={ChefHat}
                tone={HC}
                loading={create.isPending}
                onPress={submit}
                accessibilityLabel="Send home cook request"
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
