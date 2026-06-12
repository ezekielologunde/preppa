import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  CalendarCheck,
  ChefHat,
  ChevronRight,
  ClipboardList,
  Crown,
  GraduationCap,
  HandPlatter,
  MapPin,
  MessageSquareQuote,
  PartyPopper,
  Plus,
  Sparkles,
  Star,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { feedback } from '@/lib/feedback';
import { Font } from '@/constants/fonts';
import { experienceTypes, featuredExperiences, type Experience } from '@/constants/mock';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { useMyExperienceRequests } from '@/lib/queries/experiences';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

const TYPE_ICONS: Record<string, LucideIcon> = { UtensilsCrossed, ChefHat, GraduationCap, Wine, HandPlatter, Sparkles };
const STEPS: { Icon: LucideIcon; title: string; body: string }[] = [
  { Icon: ClipboardList, title: 'Post a request', body: 'Tell us your event, date and budget' },
  { Icon: MessageSquareQuote, title: 'Compare bids', body: 'Local preppers send quotes to you' },
  { Icon: PartyPopper, title: 'Book & enjoy', body: 'Pick your favourite and confirm' },
];

function ExperienceCard({ exp, onPress }: { exp: Experience; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${exp.title} by ${exp.host}, from $${exp.from} ${exp.per}`} style={{ width: 260, backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
      <Image source={exp.image} style={{ width: '100%', height: 150 }} contentFit="cover" transition={200} />
      <View style={{ padding: 14 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }} numberOfLines={1}>{exp.title}</Text>
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }}>by {exp.host}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
          <Star size={13} color={Palette.amber} fill={Palette.amber} />
          <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: INK }}>{exp.rating.toFixed(1)}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>({exp.reviews})</Text>
          <MapPin size={12} color={Palette.textMuted} style={{ marginLeft: 6 }} />
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }} numberOfLines={1}>{exp.location}</Text>
        </View>
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: INK, marginTop: 8 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 16, color: ORANGE }}>${exp.from}</Text> {exp.per}
        </Text>
      </View>
    </PressableScale>
  );
}

export default function ExperiencesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // Live feedback loop: posted requests show their bid count right on the tab.
  const { data: myRequests, refetch } = useMyExperienceRequests(user?.id);
  const activeRequests = (myRequests ?? []).filter((r) => r.status === 'open').slice(0, 2);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }
  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 16 : 8, paddingBottom: 130 }}>
          {/* Header */}
          <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 26, color: INK, letterSpacing: -0.6 }}>experiences</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>
              private chefs, catering, classes & tastings near you
            </Text>
          </View>
          </MotiView>

          {/* PREMIUM FLAGSHIP — Chef at Home */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 80 }}>
          <PressableScale
            onPress={() => { feedback.tap(); router.push('/experience-request?kind=private_chef'); }}
            accessibilityRole="button"
            accessibilityLabel="Book a private chef to cook at your home"
            style={{ marginHorizontal: 20, marginTop: 16, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: INK, ...Shadow.floating }}>
            <Image source="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=70" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '52%', opacity: 0.55 }} contentFit="cover" transition={250} />
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(17,21,28,0.45)' }} />
            <View style={{ padding: 20, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(241,95,34,0.92)', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Crown size={13} color="#fff" />
                <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#fff', letterSpacing: 0.3 }}>PREMIUM</Text>
              </View>
              <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', letterSpacing: -0.6, maxWidth: '78%', lineHeight: 28 }}>chef at your home</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: 'rgba(255,255,255,0.88)', maxWidth: '70%', lineHeight: 19 }}>
                A personal chef shops, cooks a multi-course dinner in your kitchen, and cleans up. You just show up hungry.
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                <View style={{ backgroundColor: '#fff', borderRadius: Radius.pill, paddingHorizontal: 18, height: 42, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>Request a chef</Text>
                  <ChevronRight size={16} color={INK} />
                </View>
                <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.85)' }}>from $65 / guest</Text>
              </View>
            </View>
          </PressableScale>
          </MotiView>

          {/* Primary action — post a request */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 160 }}>
          <PressableScale
            onPress={() => { feedback.tap(); router.push('/experience-request'); }}
            accessibilityRole="button"
            accessibilityLabel="Post an experience request"
            style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: ORANGE, borderRadius: Radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, ...Shadow.floating, shadowColor: ORANGE, shadowOpacity: 0.35 }}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={24} color="#fff" strokeWidth={2.6} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Post a custom request</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 1 }}>Catering, classes, food service & more — get bids</Text>
            </View>
          </PressableScale>

          {/* Live status of my open requests — the post→bids feedback loop */}
          {activeRequests.map((r) => {
            const pending = r.bids.filter((b) => b.status === 'pending').length;
            return (
              <PressableScale
                key={r.id}
                onPress={() => { feedback.tap(); router.push('/experience-request'); }}
                accessibilityRole="button"
                accessibilityLabel={`Your request ${r.title}: ${pending ? `${pending} bids received, compare now` : 'waiting for bids'}`}
                style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: pending ? ORANGE + '55' : Palette.border }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: pending ? Palette.brandTint : Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                  <MessageSquareQuote size={18} color={pending ? ORANGE : Palette.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: INK }} numberOfLines={1}>{r.title}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: pending ? Palette.brandPressed : Palette.textSecondary, marginTop: 1 }}>
                    {pending ? `${pending} bid${pending === 1 ? '' : 's'} received — compare & book` : 'request posted · waiting for bids'}
                  </Text>
                </View>
                {pending ? (
                  <View style={{ minWidth: 24, height: 24, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#fff' }}>{pending}</Text>
                  </View>
                ) : null}
              </PressableScale>
            );
          })}

          {/* Meal plans live here too — weekly/family subscriptions */}
          <PressableScale
            onPress={() => { feedback.tap(); router.push('/meal-plans'); }}
            accessibilityRole="button"
            accessibilityLabel="Meal plans — weekly and family subscriptions"
            style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <CalendarCheck size={18} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: INK }}>meal plans & subscriptions</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>weekly, monthly & family — delivered on repeat</Text>
            </View>
            <ChevronRight size={18} color={Palette.textMuted} />
          </PressableScale>
          </MotiView>

          {/* Experience types */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginTop: 22 }}>
            {experienceTypes.map((t) => {
              const Icon = TYPE_ICONS[t.icon] ?? UtensilsCrossed;
              return (
                <PressableScale key={t.key} onPress={() => { feedback.tap(); router.push(`/experience-request?kind=${t.key}`); }} accessibilityRole="button" accessibilityLabel={t.label} style={{ flex: 1, alignItems: 'center', gap: 8, backgroundColor: Palette.surface, borderRadius: Radius.md, paddingVertical: 14 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} color={ORANGE} />
                  </View>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: INK, textAlign: 'center' }}>{t.label}</Text>
                </PressableScale>
              );
            })}
          </View>

          {/* How it works */}
          <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, paddingHorizontal: 20, marginTop: 22, marginBottom: 10 }}>how it works</Text>
          <View style={{ marginHorizontal: 20, backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16, gap: 4 }}>
            {STEPS.map((s, i) => (
              <MotiView key={s.title} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 260, delay: 160 + i * 45 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.chip }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                  <s.Icon size={19} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>{s.title}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>{s.body}</Text>
                </View>
                <Text style={{ fontFamily: Font.display, fontSize: 18, color: Palette.border }}>{i + 1}</Text>
              </View>
              </MotiView>
            ))}
          </View>

          {/* Featured */}
          <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, paddingHorizontal: 20, marginTop: 22, marginBottom: 10 }}>featured experiences</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
            {featuredExperiences.map((e) => (
              <ExperienceCard key={e.id} exp={e} onPress={() => { feedback.tap(); router.push(`/experience-request?kind=${e.type}`); }} />
            ))}
          </ScrollView>

          {/* My requests entry */}
          <PressableScale onPress={() => { feedback.tap(); router.push('/experience-request'); }} accessibilityRole="button" accessibilityLabel="View my requests" style={{ marginHorizontal: 20, marginTop: 24, alignItems: 'center', paddingVertical: 15, borderRadius: Radius.sm, borderWidth: 1, borderColor: Palette.border, backgroundColor: Palette.surface }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>view my requests & bids</Text>
          </PressableScale>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
