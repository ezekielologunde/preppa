import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Flame, Gift, Sparkles } from 'lucide-react-native';
import { MotiView } from 'moti';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette, Radius } from '@/constants/theme';

const ORANGE = Palette.brand;
const INK = Palette.ink;

type HolidayEvent = {
  id: string;
  name: string;
  flag: string;
  date: string;
  description: string;
  dishes: string[];
  color: string;
  culture: string;
};

function daysUntil(dateStr: string): number {
  const year = new Date().getFullYear();
  const target = new Date(`${dateStr} ${year}`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function urgencyFor(days: number): 'today' | 'soon' | 'upcoming' {
  if (days <= 0) return 'today';
  if (days <= 7) return 'soon';
  return 'upcoming';
}

const EVENTS: HolidayEvent[] = [
  {
    id: 'eid', name: 'Eid al-Adha', flag: '☪️', date: 'Jun 16', color: '#16a34a',
    description: 'Celebratory feast meals from West African and Middle Eastern preppers. Limited slots — usually sells out 48 hrs before.',
    dishes: ['Grilled lamb suya', 'Jollof rice party packs', 'Moin moin', 'Baklava boxes', 'Puff puff trays'],
    culture: 'Muslim / West African',
  },
  {
    id: 'juneteenth', name: 'Juneteenth', flag: '✊', date: 'Jun 19', color: '#dc2626',
    description: 'Soul food specials celebrating freedom and heritage. Preorder ahead to support Black-owned kitchens in your city.',
    dishes: ['BBQ rib packs', 'Mac & cheese family size', 'Collard greens', 'Sweet potato pie', 'Red velvet slices'],
    culture: 'African American',
  },
  {
    id: 'fathers_day', name: "Father's Day", flag: '👨', date: 'Jun 15', color: ORANGE,
    description: 'Treat dad to a hearty homemade meal from local preppers. Feast packs for 4 available.',
    dishes: ['Pepper soup', 'Grilled chicken platter', 'Egusi with pounded yam', 'Beef stew rice', 'Chapman punch jug'],
    culture: 'Universal',
  },
  {
    id: 'sallah', name: 'Sallah Day (Eid Kabir)', flag: '🌙', date: 'Jun 17', color: '#8b5cf6',
    description: 'Northern Nigerian and Hausa-Fulani celebration. Kilishi, tuwo shinkafa, and ram pepper soup — made by verified Northern preppers.',
    dishes: ['Kilishi packs', 'Tuwo shinkafa', 'Ram pepper soup', 'Miyan taushe', 'Zobo drink'],
    culture: 'Northern Nigerian',
  },
  {
    id: 'canada_day', name: 'Canada Day', flag: '🇨🇦', date: 'Jul 1', color: '#dc2626',
    description: 'For Canadian users: poutine kits, maple-glazed dishes, and backyard BBQ packs.',
    dishes: ['Poutine kit', 'Maple-glazed salmon', 'Nanaimo bar boxes', 'BeaverTails', 'Peameal bacon bun packs'],
    culture: 'Canadian',
  },
  {
    id: 'independence_ng', name: 'Nigerian Independence', flag: '🇳🇬', date: 'Oct 1', color: '#16a34a',
    description: 'Pre-save your spot for jollof battles, suya parties, and naija kitchen feasts in October.',
    dishes: ['Party jollof rice', 'Ofada rice stew', 'Asun (peppered goat)', 'Akara', 'Small chops platter'],
    culture: 'Nigerian',
  },
];

const URGENCY_LABEL: Record<'today' | 'soon' | 'upcoming', { label: string; color: string }> = {
  today: { label: 'preorder now', color: '#dc2626' },
  soon: { label: 'preorder ahead', color: ORANGE },
  upcoming: { label: 'pre-save', color: '#8b5cf6' },
};

export default function HolidaySpecialsScreen() {
  const router = useRouter();

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/explore'); } }

  const upcoming = EVENTS
    .map((e) => ({ ...e, daysAway: daysUntil(e.date), urgency: urgencyFor(daysUntil(e.date)) }))
    .filter((e) => e.daysAway >= -1)
    .sort((a, b) => a.daysAway - b.daysAway);

  const todayEvent = upcoming.find((e) => e.urgency === 'today');
  const rest = upcoming.filter((e) => e.urgency !== 'today');

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

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 120 }}>

          {/* Hero: today's event */}
          {todayEvent ? (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
            <PressableScale onPress={() => { feedback.tap(); router.push(`/search?q=${encodeURIComponent(todayEvent.name)}`); }} accessibilityRole="button" accessibilityLabel={todayEvent.name}
              style={{ backgroundColor: todayEvent.color, borderRadius: 20, overflow: 'hidden', padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Text style={{ fontSize: 32 }}>{todayEvent.flag}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Flame size={14} color="rgba(255,255,255,0.9)" />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>happening today</Text>
                  </View>
                  <Text style={{ fontFamily: Font.display, fontSize: 22, color: '#fff', letterSpacing: -0.5, marginTop: 2 }}>{todayEvent.name}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{todayEvent.culture} · {todayEvent.date}</Text>
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
          <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, marginTop: 4 }}>coming up</Text>
          {rest.map(({ id, name, flag, date, daysAway, description, dishes, color, urgency, culture }, i) => {
            const urge = URGENCY_LABEL[urgency as keyof typeof URGENCY_LABEL];
            return (
              <MotiView key={id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 120 + i * 50 }}>
              <PressableScale onPress={() => { feedback.tap(); router.push(`/search?q=${encodeURIComponent(name)}`); }} accessibilityRole="button" accessibilityLabel={name}
                style={{ backgroundColor: Palette.surface, borderRadius: 16, padding: 16, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 22 }}>{flag}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: INK }}>{name}</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }}>{culture} · {date}</Text>
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
                    <View key={d} style={{ backgroundColor: color + '14', borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4 }}>
                      <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: color }}>{d}</Text>
                    </View>
                  ))}
                  {dishes.length > 3 ? (
                    <View style={{ backgroundColor: Palette.border, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4 }}>
                      <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: Palette.textMuted }}>+{dishes.length - 3} more</Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: color }}>explore meals</Text>
                  <ChevronRight size={13} color={color} />
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
      </SafeAreaView>
    </View>
  );
}
