import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronLeft, Minus, Plus } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { feedback } from '@/lib/feedback';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { useCreateExperienceRequest } from '@/lib/queries/experiences';
import { useAuth } from '@/providers/auth-provider';
import type { ExperienceKind } from '@/types/database.types';

const ORANGE = Palette.brand;
const INK = Palette.ink;

const KINDS: { key: ExperienceKind; label: string }[] = [
  { key: 'catering',      label: 'Catering' },
  { key: 'private_chef',  label: 'Private chef' },
  { key: 'food_service',  label: 'Cook at mine' },
  { key: 'cleaning',      label: 'Kitchen reset' },
  { key: 'class',         label: 'Cooking class' },
  { key: 'tasting',       label: 'Tasting menu' },
];

type KindConfig = {
  titlePlaceholder: string;
  detailsPlaceholder: string;
  guestLabel: string;
  guestMax: number;
  locationLabel: string;
  locationPlaceholder: string;
  showGuests: boolean;
  showSkillLevel: boolean;
};

const KIND_CONFIG: Record<ExperienceKind, KindConfig> = {
  catering: {
    titlePlaceholder: 'e.g. Wedding reception for 80, Nigerian buffet',
    detailsPlaceholder: 'Cuisine style, dietary needs, event vibe, service style…',
    guestLabel: 'Number of guests',
    guestMax: 500,
    locationLabel: 'Event venue or address',
    locationPlaceholder: 'Venue name or street address',
    showGuests: true,
    showSkillLevel: false,
  },
  private_chef: {
    titlePlaceholder: 'e.g. Dinner party for 6, Mediterranean theme',
    detailsPlaceholder: 'Cuisine preferences, dietary restrictions, number of courses…',
    guestLabel: 'Number of diners',
    guestMax: 50,
    locationLabel: 'Your home address',
    locationPlaceholder: 'Street address where the chef will cook',
    showGuests: true,
    showSkillLevel: false,
  },
  food_service: {
    titlePlaceholder: 'e.g. Weekly family meal prep — 4 people, healthy meals',
    detailsPlaceholder: 'Dietary needs, meal types, how often, any restrictions…',
    guestLabel: 'People to feed',
    guestMax: 20,
    locationLabel: 'Your address',
    locationPlaceholder: 'Street address where the chef will cook',
    showGuests: true,
    showSkillLevel: false,
  },
  cleaning: {
    titlePlaceholder: 'e.g. Post-event kitchen deep clean',
    detailsPlaceholder: 'Kitchen size, equipment to clean, any special requirements…',
    guestLabel: '',
    guestMax: 1,
    locationLabel: 'Kitchen address',
    locationPlaceholder: 'Street address of the kitchen',
    showGuests: false,
    showSkillLevel: false,
  },
  class: {
    titlePlaceholder: 'e.g. Learn to make Nigerian jollof rice from scratch',
    detailsPlaceholder: 'What you want to learn, dishes to master, any allergies…',
    guestLabel: 'Number of participants',
    guestMax: 20,
    locationLabel: 'Where to host the class',
    locationPlaceholder: 'Your home, rented kitchen, or leave blank for chef to suggest',
    showGuests: true,
    showSkillLevel: true,
  },
  tasting: {
    titlePlaceholder: 'e.g. West African tasting menu for two',
    detailsPlaceholder: 'Cuisine interests, dietary restrictions, atmosphere preference…',
    guestLabel: 'Number of guests',
    guestMax: 20,
    locationLabel: 'Venue or your home',
    locationPlaceholder: 'Neighbourhood or address',
    showGuests: true,
    showSkillLevel: false,
  },
  other: {
    titlePlaceholder: 'e.g. Custom food experience',
    detailsPlaceholder: 'Tell us what you have in mind…',
    guestLabel: 'Number of people',
    guestMax: 100,
    locationLabel: 'Location',
    locationPlaceholder: 'Neighbourhood or address',
    showGuests: true,
    showSkillLevel: false,
  },
};

const SKILL_LEVELS = [
  { key: 'beginner',     label: 'Beginner',     desc: "I'm new to cooking" },
  { key: 'intermediate', label: 'Intermediate', desc: 'I know the basics' },
  { key: 'advanced',     label: 'Advanced',     desc: 'I want to refine my skills' },
] as const;
type SkillLevel = typeof SKILL_LEVELS[number]['key'];

const BUDGET_PRESETS = [500, 1000, 2000, 5000, 10000];
const money = (n: number | null) => (n == null ? '—' : `$${n.toLocaleString('en-US')}`);
const cleanLine = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ');
const cleanBlock = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

function GuestStepper({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, backgroundColor: Palette.canvas, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: Palette.border }}>
      <PressableScale onPress={() => { feedback.tap(); onChange(Math.max(1, value - 1)); }} disabled={value <= 1}
        accessibilityRole="button" accessibilityLabel="Decrease"
        style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', opacity: value <= 1 ? 0.35 : 1 }}>
        <Minus size={15} color={INK} />
      </PressableScale>
      <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, minWidth: 34, textAlign: 'center', fontVariant: ['tabular-nums'] }} accessibilityLabel={`${value}`}>{value}</Text>
      <PressableScale onPress={() => { feedback.tap(); onChange(Math.min(max, value + 1)); }} disabled={value >= max}
        accessibilityRole="button" accessibilityLabel="Increase"
        style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: ORANGE + '1A', alignItems: 'center', justifyContent: 'center', opacity: value >= max ? 0.35 : 1 }}>
        <Plus size={15} color={ORANGE} />
      </PressableScale>
    </View>
  );
}

function BudgetPicker({ value, onChange }: { value: number | null; onChange: (n: number | null) => void }) {
  const [custom, setCustom] = useState(value != null && !BUDGET_PRESETS.includes(value));
  const [raw, setRaw] = useState(value != null && !BUDGET_PRESETS.includes(value) ? String(value) : '');
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {BUDGET_PRESETS.map((p) => {
          const on = !custom && value === p;
          return (
            <PressableScale key={p} onPress={() => { feedback.tap(); setCustom(false); onChange(p); }}
              accessibilityRole="button" accessibilityLabel={`$${p.toLocaleString('en-US')} budget`} accessibilityState={{ selected: on }}
              style={{ paddingHorizontal: 14, height: 40, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: on ? ORANGE : Palette.border, backgroundColor: on ? Palette.brandTint : Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: on ? ORANGE : INK }}>${(p / 1000).toFixed(p < 1000 ? 0 : 1)}k</Text>
            </PressableScale>
          );
        })}
        <PressableScale onPress={() => { feedback.tap(); setCustom(true); onChange(null); }}
          accessibilityRole="button" accessibilityLabel="Custom budget" accessibilityState={{ selected: custom }}
          style={{ paddingHorizontal: 14, height: 40, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: custom ? ORANGE : Palette.border, backgroundColor: custom ? Palette.brandTint : Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: custom ? ORANGE : INK }}>Custom</Text>
        </PressableScale>
      </View>
      {custom ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: Palette.canvas, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, overflow: 'hidden' }}>
          <View style={{ paddingHorizontal: 12, height: 50, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: Palette.border }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.textSecondary }}>$</Text>
          </View>
          <TextInput value={raw} onChangeText={(t) => { const n = t.replace(/[^0-9.]/g, ''); setRaw(n); const v = parseFloat(n); onChange(!isNaN(v) && v > 0 ? v : null); }}
            placeholder="enter amount" placeholderTextColor={Palette.textMuted} keyboardType="numeric" maxLength={8}
            style={{ flex: 1, height: 50, paddingHorizontal: 12, fontFamily: Font.body, fontSize: 15, color: INK }}
            accessibilityLabel="Custom budget amount" />
        </View>
      ) : null}
    </View>
  );
}

export default function ExperienceRequestScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ kind?: string }>();
  const create = useCreateExperienceRequest();

  const initialKind = (KINDS.find((k) => k.key === params.kind)?.key ?? 'catering') as ExperienceKind;
  const [kind, setKind] = useState<ExperienceKind>(initialKind);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [guests, setGuests] = useState(10);
  const [budget, setBudget] = useState<number | null>(null);
  const [location, setLocation] = useState('');
  const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [titleTouched, setTitleTouched] = useState(false);
  type Posted = { title: string; kind: ExperienceKind; guests: number; budget: number | null };
  const [posted, setPosted] = useState<Posted | null>(null);

  const cfg = KIND_CONFIG[kind] ?? KIND_CONFIG.other;

  function handleKindChange(k: ExperienceKind) {
    feedback.tap();
    setKind(k);
    // Reset kind-specific fields when switching type
    setSkillLevel(null);
    if (!KIND_CONFIG[k].showGuests) setGuests(1);
    else setGuests(10);
  }

  function goBack() { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/experiences'); } }

  function submit() {
    setErr(null);
    if (!user) return router.push('/auth?mode=signup');
    const cleanTitle = cleanLine(title).trim();
    if (cleanTitle.length < 3) { setTitleTouched(true); feedback.error(); return setErr('Give your request a short title (at least 3 characters).'); }
    feedback.tap();
    // Append skill level to details for class requests
    const finalDetails = kind === 'class' && skillLevel
      ? `[Skill level: ${skillLevel}] ${cleanBlock(details).trim()}`.trim()
      : cleanBlock(details).trim();
    create.mutate(
      { kind, title: cleanTitle, details: finalDetails, guests: cfg.showGuests ? guests : 1, budget, location: cleanLine(location).trim() },
      {
        onSuccess: () => {
          feedback.success();
          setPosted({ title: cleanTitle.slice(0, 100), kind, guests, budget });
          setTitle(''); setDetails(''); setGuests(10); setBudget(null); setLocation(''); setSkillLevel(null); setTitleTouched(false);
        },
        onError: (e) => { feedback.error(); setErr(e instanceof Error ? e.message : 'Could not post request.'); },
      },
    );
  }

  const inputStyle = { height: 50, borderRadius: 14, backgroundColor: Palette.canvas, paddingHorizontal: 14, fontSize: 15, fontFamily: Font.body, color: INK, borderWidth: 1, borderColor: Palette.border } as const;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.surface }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5 }}>Post a request</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>

          {/* Kind selector */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 13, color: INK, marginTop: 8, marginBottom: 8 }}>What do you need?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {KINDS.map((k) => {
                const on = kind === k.key;
                return (
                  <MotiView key={k.key} animate={{ backgroundColor: on ? Palette.brandTint : Palette.canvas, borderColor: on ? ORANGE : Palette.border }}
                    transition={{ type: 'timing', duration: 180 }}
                    style={{ borderRadius: Radius.pill, borderWidth: 1, overflow: 'hidden' }}>
                    <PressableScale onPress={() => handleKindChange(k.key)} accessibilityRole="button"
                      accessibilityState={{ selected: on }} accessibilityLabel={k.label} style={{ paddingHorizontal: 14, paddingVertical: 9 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: on ? ORANGE : Palette.inkSoft }}>{k.label}</Text>
                    </PressableScale>
                  </MotiView>
                );
              })}
            </View>
          </MotiView>

          {/* Success state */}
          {posted ? (
            <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}
              style={{ marginTop: 20, backgroundColor: Palette.canvas, borderRadius: 20, padding: 22, gap: 16, alignItems: 'center' }}>
              <MotiView from={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: Palette.success + '18', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={30} color={Palette.success} strokeWidth={2.5} />
                </View>
              </MotiView>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5, textAlign: 'center' }}>Request sent!</Text>
              <View style={{ width: '100%', backgroundColor: Palette.surface, borderRadius: 16, padding: 14, gap: 8, borderWidth: 1, borderColor: Palette.border }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 11, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {KINDS.find((k) => k.key === posted.kind)?.label ?? posted.kind}
                </Text>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>{posted.title}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>
                  {posted.guests > 1 ? `${posted.guests} ${KIND_CONFIG[posted.kind]?.guestLabel ?? 'guests'}` : ''}
                  {posted.budget != null ? ` · budget ${money(posted.budget)}` : ''}
                </Text>
                <View style={{ backgroundColor: Palette.brandTint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', marginTop: 2 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: ORANGE }}>Open · accepting bids</Text>
                </View>
              </View>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, textAlign: 'center', lineHeight: 19 }}>
                Preppers near you will bid on your request. Tap your request card on the Experiences tab to review bids as they arrive.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                <PressableScale onPress={() => setPosted(null)} accessibilityRole="button" accessibilityLabel="Post another request"
                  style={{ flex: 1, height: 46, borderRadius: Radius.pill, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Palette.border }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: INK }}>Post another</Text>
                </PressableScale>
                <PressableScale onPress={() => router.replace('/experiences')} accessibilityRole="button" accessibilityLabel="Go to Experiences"
                  style={{ flex: 1, height: 46, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>View requests</Text>
                </PressableScale>
              </View>
            </MotiView>
          ) : (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 80 }}>
              <View style={{ gap: 14, marginTop: 16 }}>

                {/* Title */}
                <View style={{ gap: 4 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: INK }}>Title <Text style={{ color: Palette.danger }}>*</Text></Text>
                  <TextInput style={[inputStyle, { borderColor: titleTouched && title.trim().length < 3 ? Palette.danger : Palette.border, borderWidth: 1.5 }]}
                    placeholder={cfg.titlePlaceholder} placeholderTextColor={Palette.textMuted}
                    value={title} onChangeText={(t) => setTitle(cleanLine(t))} onBlur={() => setTitleTouched(true)} maxLength={100}
                    accessibilityLabel="Request title" />
                  {titleTouched && title.trim().length < 3
                    ? <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.danger }}>At least 3 characters required</Text>
                    : <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textMuted, textAlign: 'right' }}>{title.length}/100</Text>}
                </View>

                {/* Details */}
                <View style={{ gap: 4 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: INK }}>Details <Text style={{ fontFamily: Font.body, color: Palette.textMuted }}>(optional)</Text></Text>
                  <TextInput style={[inputStyle, { height: 90, paddingTop: 14, textAlignVertical: 'top' }]}
                    placeholder={cfg.detailsPlaceholder} placeholderTextColor={Palette.textMuted}
                    value={details} onChangeText={(t) => setDetails(cleanBlock(t))} multiline maxLength={500}
                    accessibilityLabel="Request details" />
                  <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textMuted, textAlign: 'right' }}>{details.length}/500</Text>
                </View>

                {/* Skill level — cooking class only */}
                {cfg.showSkillLevel ? (
                  <View style={{ gap: 8 }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: INK }}>Your skill level <Text style={{ fontFamily: Font.body, color: Palette.textMuted }}>(optional)</Text></Text>
                    <View style={{ gap: 8 }}>
                      {SKILL_LEVELS.map((s) => {
                        const on = skillLevel === s.key;
                        return (
                          <PressableScale key={s.key} onPress={() => { feedback.tap(); setSkillLevel(on ? null : s.key); }}
                            accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={s.label}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1.5, borderColor: on ? ORANGE : Palette.border, backgroundColor: on ? Palette.brandTint : Palette.canvas }}>
                            <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: on ? ORANGE : Palette.border, backgroundColor: on ? ORANGE : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                              {on ? <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' }} /> : null}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: on ? ORANGE : INK }}>{s.label}</Text>
                              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>{s.desc}</Text>
                            </View>
                          </PressableScale>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {/* Guests / participants — hidden for cleaning */}
                {cfg.showGuests ? (
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: INK }}>{cfg.guestLabel}</Text>
                    <GuestStepper value={guests} max={cfg.guestMax} onChange={setGuests} />
                  </View>
                ) : null}

                {/* Budget */}
                <View style={{ gap: 6 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: INK }}>Approximate budget <Text style={{ fontFamily: Font.body, color: Palette.textMuted }}>(optional)</Text></Text>
                  <BudgetPicker value={budget} onChange={setBudget} />
                </View>

                {/* Location */}
                <View style={{ gap: 4 }}>
                  <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: INK }}>{cfg.locationLabel} <Text style={{ fontFamily: Font.body, color: Palette.textMuted }}>(optional)</Text></Text>
                  <TextInput
                    style={inputStyle}
                    placeholder={cfg.locationPlaceholder}
                    placeholderTextColor={Palette.textMuted}
                    value={location}
                    onChangeText={(t) => setLocation(cleanLine(t))}
                    maxLength={200}
                    autoComplete="off"
                    autoCorrect={false}
                    // @ts-ignore — textContentType is iOS-only
                    textContentType="none"
                    accessibilityLabel={cfg.locationLabel}
                  />
                </View>
              </View>

              {err ? (
                <MotiView from={{ opacity: 0, translateY: -4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }}>
                  <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginTop: 14, borderWidth: 1, borderColor: '#FECACA' }}>
                    <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: '#991B1B' }}>{err}</Text>
                  </View>
                </MotiView>
              ) : null}

              <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 160 }}>
                <PressableScale onPress={submit} disabled={create.isPending || title.trim().length < 3} accessibilityRole="button" accessibilityLabel="Post request"
                  style={{ height: 52, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 18, opacity: create.isPending || title.trim().length < 3 ? 0.5 : 1 }}>
                  {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Post request</Text>}
                </PressableScale>
              </MotiView>
            </MotiView>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
