import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  CalendarCheck,
  ChefHat,
  ChevronRight,
  Crown,
  GraduationCap,
  HandPlatter,
  MessageSquareQuote,
  Plus,
  Sparkles,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RequestDetailSheet } from '@/components/request-detail-sheet';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { type MyExperienceRequest, useMyExperienceRequests } from '@/lib/queries/experiences';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

const TYPE_ICONS: Record<string, LucideIcon> = { UtensilsCrossed, ChefHat, GraduationCap, Wine, HandPlatter, Sparkles };
const EXPERIENCE_TYPES = [
  { key: 'catering',      label: 'Catering',      icon: 'UtensilsCrossed', blurb: 'Feed your event' },
  { key: 'private_chef',  label: 'Private chef',  icon: 'ChefHat',         blurb: 'Cooked at home' },
  { key: 'food_service',  label: 'Food service',  icon: 'HandPlatter',     blurb: 'Servers & staff' },
  { key: 'cleaning',      label: 'Cleaning',      icon: 'Sparkles',        blurb: 'Before & after' },
  { key: 'class',         label: 'Cooking class', icon: 'GraduationCap',   blurb: 'Learn hands-on' },
  { key: 'tasting',       label: 'Tasting menu',  icon: 'Wine',            blurb: "Chef's selection" },
] as const;

const KIND_LABEL: Record<string, string> = {
  catering: 'Catering', private_chef: 'Private chef', food_service: 'Food service',
  cleaning: 'Cleaning', class: 'Cooking class', tasting: 'Tasting menu',
};

function RequestCard({ r, onPress }: { r: MyExperienceRequest; onPress: () => void }) {
  const pendingBids = r.bids.filter((b) => b.status === 'pending').length;
  const isBooked = r.status === 'booked';
  const acceptedBid = r.bids.find((b) => b.status === 'accepted');
  const hasBids = pendingBids > 0 && !isBooked;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={r.title}
      style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 16, borderWidth: 1, borderColor: isBooked ? Palette.success + '44' : hasBids ? ORANGE + '44' : Palette.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: isBooked ? Palette.success + '1A' : hasBids ? Palette.brandTint : Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
          {isBooked
            ? <Crown size={18} color={Palette.success} />
            : <MessageSquareQuote size={18} color={hasBids ? ORANGE : Palette.textSecondary} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }} numberOfLines={1}>{r.title}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: isBooked ? Palette.success : hasBids ? ORANGE : Palette.textSecondary, marginTop: 2 }}>
            {isBooked
              ? `Booked · ${acceptedBid?.prepper?.display_name ?? 'Chef confirmed'}`
              : hasBids
              ? `${pendingBids} bid${pendingBids === 1 ? '' : 's'} — tap to review`
              : `${KIND_LABEL[r.kind] ?? r.kind} · waiting for bids`}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {hasBids ? (
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#fff' }}>{pendingBids}</Text>
            </View>
          ) : null}
          <ChevronRight size={16} color={Palette.textMuted} />
        </View>
      </View>
    </PressableScale>
  );
}

export default function ExperiencesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: myRequests, isLoading, isError, refetch } = useMyExperienceRequests(user?.id);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<MyExperienceRequest | null>(null);

  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  const allRequests = myRequests ?? [];
  const booked = allRequests.filter((r) => r.status === 'booked');
  const open = allRequests.filter((r) => r.status === 'open');
  const hasAny = allRequests.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
          contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 16 : 8, paddingBottom: 40 }}>

          {/* Header */}
          <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
            <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 26, color: INK, letterSpacing: -0.6 }}>experiences</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>private chefs, catering, classes & tastings</Text>
            </View>
          </MotiView>

          {/* Loading state */}
          {isLoading ? (
            <View style={{ marginTop: 16, paddingHorizontal: 20, gap: 10 }}>
              <Skeleton width={130} height={13} radius={6} />
              {[0, 1].map(i => <Skeleton key={i} width="100%" height={80} radius={16} />)}
            </View>
          ) : null}

          {/* Error state */}
          {!isLoading && isError ? (
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }}>
              <View style={{ marginHorizontal: 20, marginTop: 12, marginBottom: 4, backgroundColor: Palette.danger + '12', borderRadius: Radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <UtensilsCrossed size={18} color={Palette.danger} />
                <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: Palette.danger, lineHeight: 18 }}>
                  Couldn't load your requests. Pull down to retry.
                </Text>
              </View>
            </MotiView>
          ) : null}

          {/* Confirmed / booked */}
          {booked.length > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 60 }}>
              <View style={{ marginTop: 16, paddingHorizontal: 20, gap: 10 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Confirmed</Text>
                {booked.map((r) => (
                  <RequestCard key={r.id} r={r} onPress={() => { feedback.tap(); setSelected(r); }} />
                ))}
              </View>
            </MotiView>
          ) : null}

          {/* Active open requests */}
          {open.length > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
              <View style={{ marginTop: 16, paddingHorizontal: 20, gap: 10 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Active requests</Text>
                {open.map((r) => (
                  <RequestCard key={r.id} r={r} onPress={() => { feedback.tap(); setSelected(r); }} />
                ))}
              </View>
            </MotiView>
          ) : null}

          {/* Premium hero — Chef at Home */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 100 }}>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/experience-request?kind=private_chef'); }}
              accessibilityRole="button"
              accessibilityLabel="Book a private chef to cook at your home"
              style={{ marginHorizontal: 20, marginTop: 20, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: INK, ...Shadow.floating }}>
              <Image
                source="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=70"
                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '52%', opacity: 0.55 }}
                contentFit="cover" transition={250} />
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(17,21,28,0.45)' }} />
              <View style={{ padding: 20, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(232,97,26,0.92)', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Crown size={13} color="#fff" />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#fff', letterSpacing: 0.3 }}>PREMIUM</Text>
                </View>
                <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', letterSpacing: -0.6, maxWidth: '78%', lineHeight: 28 }}>chef at your home</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: 'rgba(255,255,255,0.88)', maxWidth: '70%', lineHeight: 19 }}>
                  A personal chef shops, cooks and cleans up. You just show up hungry.
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <View style={{ backgroundColor: '#fff', borderRadius: Radius.pill, paddingHorizontal: 18, height: 42, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>Request a chef</Text>
                    <ChevronRight size={16} color={INK} />
                  </View>
                  <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.85)' }}>set your budget · get bids</Text>
                </View>
              </View>
            </PressableScale>
          </MotiView>

          {/* Post new request CTA */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/experience-request'); }}
              accessibilityRole="button"
              accessibilityLabel="Post a custom experience request"
              style={{ marginHorizontal: 20, marginTop: 14, backgroundColor: ORANGE, borderRadius: Radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, ...Shadow.floating, shadowColor: ORANGE, shadowOpacity: 0.35 }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={24} color="#fff" strokeWidth={2.6} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Post a custom request</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 1 }}>Catering, classes, food service & more — get bids</Text>
              </View>
            </PressableScale>
          </MotiView>

          {/* Meal plans link */}
          <PressableScale
            onPress={() => { feedback.tap(); router.push('/meal-plans'); }}
            accessibilityRole="button"
            accessibilityLabel="Meal plans and subscriptions"
            style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <CalendarCheck size={18} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: INK }}>meal plans & subscriptions</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>weekly, monthly & family — prepped on repeat</Text>
            </View>
            <ChevronRight size={18} color={Palette.textMuted} />
          </PressableScale>

          {/* Browse by type */}
          <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 20, marginTop: 22, marginBottom: 10 }}>Browse by type</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10 }}>
            {EXPERIENCE_TYPES.map((t, i) => {
              const Icon = TYPE_ICONS[t.icon] ?? UtensilsCrossed;
              return (
                <MotiView key={t.key} from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 200, delay: 160 + i * 35 }} style={{ flexBasis: '30%', flexGrow: 1 }}>
                  <PressableScale
                    onPress={() => { feedback.tap(); router.push(`/experience-request?kind=${t.key}`); }}
                    accessibilityRole="button"
                    accessibilityLabel={t.label}
                    style={{ alignItems: 'center', gap: 8, backgroundColor: Palette.surface, borderRadius: Radius.md, paddingVertical: 14 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} color={ORANGE} />
                    </View>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: INK, textAlign: 'center' }} numberOfLines={2}>{t.label}</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary, textAlign: 'center' }}>{t.blurb}</Text>
                  </PressableScale>
                </MotiView>
              );
            })}
          </View>

          {/* How it works — only shown to new users with no requests yet */}
          {!hasAny ? (
            <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, paddingHorizontal: 20, marginTop: 22, marginBottom: 10 }}>how it works</Text>
              <View style={{ marginHorizontal: 20, backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16, gap: 4 }}>
                {[
                  { emoji: '📋', title: 'Post a request', body: 'Tell us your event, date and budget' },
                  { emoji: '💬', title: 'Compare bids', body: 'Local preppers send quotes to you' },
                  { emoji: '🎉', title: 'Book & enjoy', body: 'Pick your favourite and confirm' },
                ].map((s, i) => (
                  <View key={s.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.chip }}>
                    <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>{s.title}</Text>
                      <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>{s.body}</Text>
                    </View>
                    <Text style={{ fontFamily: Font.display, fontSize: 18, color: Palette.border }}>{i + 1}</Text>
                  </View>
                ))}
              </View>
            </MotiView>
          ) : null}

        </ScrollView>

        <RequestDetailSheet request={selected} onClose={() => setSelected(null)} />
      </SafeAreaView>
    </View>
  );
}
