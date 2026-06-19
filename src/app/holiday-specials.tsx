import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Flame, Gift, RotateCcw, Sparkles } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette, Radius } from '@/constants/theme';
import { useHolidayEvents, type HolidayEventRow } from '@/lib/queries/holiday-events';

const ORANGE = Palette.brand;
const INK = Palette.ink;

// ─── Date helpers ────────────────────────────────────────────────────────────

const MONTH_ABR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Returns the 3rd Sunday in June (Father's Day) as an ISO date string for the current year. */
function fathersDayISO(): string {
  const year = new Date().getFullYear();
  const june1 = new Date(year, 5, 1);
  const daysToFirstSun = (7 - june1.getDay()) % 7;
  const fd = new Date(year, 5, 1 + daysToFirstSun + 14);
  return fd.toISOString().slice(0, 10);
}

/** Resolve a DB date_str ('dynamic' → calculated, otherwise ISO date) to days from today. */
function daysUntilISO(dateStr: string): number {
  const resolved = dateStr === 'dynamic' ? fathersDayISO() : dateStr;
  // If already past this year's date, try next year
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let target = new Date(resolved + 'T00:00:00');
  if (target < today) {
    // bump to same month/day next year
    target = new Date(target.getFullYear() + 1, target.getMonth(), target.getDate());
  }
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Format a date_str for display: 'dynamic' → computed label, ISO → 'Mon DD'. */
function formatDateStr(dateStr: string): string {
  const resolved = dateStr === 'dynamic' ? fathersDayISO() : dateStr;
  const d = new Date(resolved + 'T00:00:00');
  return `${MONTH_ABR[d.getMonth()]} ${d.getDate()}`;
}

function urgencyFor(days: number): 'today' | 'soon' | 'upcoming' {
  if (days <= 0) return 'today';
  if (days <= 7) return 'soon';
  return 'upcoming';
}

const URGENCY_LABEL: Record<'today' | 'soon' | 'upcoming', { label: string; color: string }> = {
  today: { label: 'preorder now', color: '#dc2626' },
  soon: { label: 'preorder ahead', color: ORANGE },
  upcoming: { label: 'pre-save', color: '#8b5cf6' },
};

type EnrichedEvent = HolidayEventRow & { daysAway: number; urgency: 'today' | 'soon' | 'upcoming'; displayDate: string };

function enrichEvent(e: HolidayEventRow): EnrichedEvent {
  const daysAway = daysUntilISO(e.date_str);
  return { ...e, daysAway, urgency: urgencyFor(daysAway), displayDate: formatDateStr(e.date_str) };
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function HolidaySpecialsScreen() {
  const router = useRouter();
  const { data: events, isLoading, isError, refetch } = useHolidayEvents();

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/explore'); } }

  const enriched = (events ?? [])
    .map(enrichEvent)
    .filter((e) => e.daysAway >= -1)
    .sort((a, b) => a.daysAway - b.daysAway);

  const todayEvent = enriched.find((e) => e.urgency === 'today');
  const rest = enriched.filter((e) => e.urgency !== 'today');

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>holiday specials</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>celebrate with local food culture</Text>
          </View>
          <Gift size={20} color={ORANGE} />
        </View>

        {isLoading ? (
          <ListSkeleton count={4} rowHeight={96} />
        ) : isError ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <Gift size={28} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>couldn't load holiday events</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Check your connection and try again.</Text>
            <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading holiday events"
              style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              <RotateCcw size={16} color="#fff" />
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>retry</Text>
            </PressableScale>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 120 }}>

            {/* Hero: today's event */}
            {todayEvent ? (
              <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
              <PressableScale onPress={() => { feedback.tap(); router.push(`/search?q=${encodeURIComponent(todayEvent.name)}`); }} accessibilityRole="button" accessibilityLabel={todayEvent.name}
                style={{ backgroundColor: todayEvent.color_hex, borderRadius: 20, overflow: 'hidden', padding: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <Text style={{ fontSize: 32 }}>{todayEvent.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Flame size={14} color="rgba(255,255,255,0.9)" />
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>happening today</Text>
                    </View>
                    <Text style={{ fontFamily: Font.display, fontSize: 22, color: '#fff', letterSpacing: -0.5, marginTop: 2 }}>{todayEvent.name}</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{todayEvent.displayDate}</Text>
                  </View>
                </View>
                <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: 'rgba(255,255,255,0.9)', lineHeight: 20, marginBottom: 12 }}>{todayEvent.description}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {todayEvent.dishes.slice(0, 4).map((d) => (
                    <View key={d} style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: '#fff' }}>{d}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignSelf: 'flex-start' }}>
                  <Sparkles size={14} color="#fff" />
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>preorder now</Text>
                  <ChevronRight size={14} color="#fff" />
                </View>
              </PressableScale>
              </MotiView>
            ) : null}

            {/* Rush hour note */}
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 80 }}>
            <View style={{ backgroundColor: INK, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <Flame size={17} color={ORANGE} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 19 }}>
                Holiday meals sell out fast during rush hours. Preorder by <Text style={{ fontFamily: Font.semibold, color: '#fff' }}>11 am</Text> for same-day fulfillment or by <Text style={{ fontFamily: Font.semibold, color: '#fff' }}>4 pm</Text> for evening pickup.
              </Text>
            </View>
            </MotiView>

            {/* Remaining events */}
            {rest.length > 0 ? (
              <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, marginTop: 4 }}>coming up</Text>
            ) : null}
            {rest.map(({ id, key, name, emoji, displayDate, daysAway, description, dishes, color_hex, urgency }, i) => {
              const urge = URGENCY_LABEL[urgency];
              return (
                <MotiView key={id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 120 + i * 50 }}>
                <PressableScale onPress={() => { feedback.tap(); router.push(`/search?q=${encodeURIComponent(name)}`); }} accessibilityRole="button" accessibilityLabel={name}
                  style={{ backgroundColor: Palette.surface, borderRadius: 16, padding: 16, gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: color_hex + '18', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 22 }}>{emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: INK }}>{name}</Text>
                      <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }}>{displayDate}</Text>
                    </View>
                    <View style={{ gap: 4, alignItems: 'flex-end' }}>
                      <View style={{ backgroundColor: urge.color + '18', borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 4 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: urge.color }}>{urge.label}</Text>
                      </View>
                      <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textMuted }}>in {daysAway}d</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>{description}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {dishes.slice(0, 3).map((d) => (
                      <View key={d} style={{ backgroundColor: color_hex + '14', borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4 }}>
                        <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: color_hex }}>{d}</Text>
                      </View>
                    ))}
                    {dishes.length > 3 ? (
                      <View style={{ backgroundColor: Palette.border, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4 }}>
                        <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: Palette.textMuted }}>+{dishes.length - 3} more</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: color_hex }}>explore meals</Text>
                    <ChevronRight size={13} color={color_hex} />
                  </View>
                </PressableScale>
                </MotiView>
              );
            })}

            {/* Prepper CTA */}
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 420 }}>
            <PressableScale onPress={() => { feedback.tap(); router.push('/specials'); }} accessibilityRole="button" accessibilityLabel="Add a holiday special as a prepper"
              style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: ORANGE + '30' }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={20} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>are you a prepper?</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 2 }}>Add your holiday special and get early discovery placement</Text>
              </View>
              <ChevronRight size={16} color={Palette.textMuted} />
            </PressableScale>
            </MotiView>

          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
