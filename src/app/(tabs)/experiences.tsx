import { LinearGradient } from 'expo-linear-gradient';
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
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { type MyExperienceRequest, useMyExperienceRequests } from '@/lib/queries/experiences';
import { useAuth } from '@/providers/auth-provider';
import { Image } from 'expo-image';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, LucideIcon> = {
  UtensilsCrossed, ChefHat, GraduationCap, Wine, HandPlatter, Sparkles,
};

const EXPERIENCE_TYPES = [
  { key: 'private_chef',  label: 'Private chef',  icon: 'ChefHat',         color: Palette.homeCook, blurb: 'Cooked at home' },
  { key: 'catering',      label: 'Catering',      icon: 'UtensilsCrossed', color: Palette.brand,    blurb: 'Feed your event' },
  { key: 'class',         label: 'Cooking class', icon: 'GraduationCap',   color: Palette.leafGreen, blurb: 'Learn hands-on' },
  { key: 'tasting',       label: 'Tasting menu',  icon: 'Wine',            color: '#D97706', blurb: "Chef's selection" },
  { key: 'food_service',  label: 'Cook at mine',  icon: 'HandPlatter',     color: '#0891B2', blurb: 'Chefs come to you' },
  { key: 'cleaning',      label: 'Kitchen reset', icon: 'Sparkles',        color: '#64748B', blurb: 'Clean & organised' },
] as const;

const KIND_LABEL: Record<string, string> = {
  catering: 'Catering', private_chef: 'Private chef', food_service: 'Cook at mine',
  cleaning: 'Kitchen reset', class: 'Cooking class', tasting: 'Tasting menu',
};


// ─── Sub-components ────────────────────────────────────────────────────────────

function RequestCard({ r, onPress }: { r: MyExperienceRequest; onPress: () => void }) {
  const pendingBids = r.bids.filter((b) => b.status === 'pending').length;
  const isBooked = r.status === 'booked';
  const acceptedBid = r.bids.find((b) => b.status === 'accepted');
  const hasBids = pendingBids > 0 && !isBooked;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={r.title}
      style={{
        backgroundColor: Palette.surface,
        borderRadius: Radius.md,
        padding: 16,
        borderWidth: 1,
        borderColor: isBooked ? Palette.success + '44' : hasBids ? Palette.brand + '44' : Palette.border,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 42, height: 42, borderRadius: 12,
          backgroundColor: isBooked ? Palette.success + '1A' : hasBids ? Palette.brandTint : Palette.chip,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {isBooked
            ? <Crown size={18} color={Palette.success} />
            : <MessageSquareQuote size={18} color={hasBids ? Palette.brand : Palette.textSecondary} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.ink }} numberOfLines={1}>
            {r.title}
          </Text>
          <Text style={{
            fontFamily: Font.body, fontSize: 12.5, marginTop: 2,
            color: isBooked ? Palette.success : hasBids ? Palette.brand : Palette.textSecondary,
          }}>
            {isBooked
              ? `Booked · ${acceptedBid?.prepper?.display_name ?? 'Chef confirmed'}`
              : hasBids
              ? `${pendingBids} bid${pendingBids === 1 ? '' : 's'} — tap to review`
              : `${KIND_LABEL[r.kind] ?? r.kind} · waiting for bids`}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {hasBids ? (
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#fff' }}>{pendingBids}</Text>
            </View>
          ) : null}
          <ChevronRight size={16} color={Palette.textSecondary} />
        </View>
      </View>
    </PressableScale>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />}
          contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 16 : 0, paddingBottom: 40 }}>

          {/* ── Hero Banner ── */}
          <MotiView
            from={{ opacity: 0, translateY: -8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300 }}>
            <LinearGradient
              colors={[Palette.prepperBg, '#1C2133']}
              style={{ height: 180, paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, justifyContent: 'space-between' }}>
              <View style={{ gap: 4 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 28, color: '#F0F2F5', letterSpacing: -0.6 }}>
                  Dine with the chef
                </Text>
                <Text style={{ fontFamily: Font.body, fontSize: 14, color: 'rgba(240,242,245,0.75)', lineHeight: 20 }}>
                  Exclusive in-home dining &amp; cooking classes
                </Text>
              </View>
              <View style={{ alignSelf: 'flex-end' }}>
                <PressableScale
                  onPress={() => { feedback.tap(); router.push('/experience-request'); }}
                  accessibilityRole="button"
                  accessibilityLabel="Browse all experiences"
                  style={{ height: 36, borderRadius: 18, paddingHorizontal: 16, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>Browse all →</Text>
                </PressableScale>
              </View>
            </LinearGradient>
          </MotiView>

          {/* ── Browse by type ── */}
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 280, delay: 40 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 16, paddingVertical: 16 }}>
              {EXPERIENCE_TYPES.map((t, i) => {
                const Icon = TYPE_ICONS[t.icon] ?? UtensilsCrossed;
                return (
                  <MotiView
                    key={t.key}
                    from={{ opacity: 0, scale: 0.88 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'timing', duration: 220, delay: 60 + i * 30 }}>
                    <PressableScale
                      onPress={() => { feedback.tap(); router.push(`/experience-request?kind=${t.key}`); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Browse ${t.label} experiences`}
                      style={{ alignItems: 'center', gap: 8, width: 82 }}>
                      <View style={{ width: 68, height: 68, borderRadius: 22, backgroundColor: t.color + '18', borderWidth: 1, borderColor: t.color + '2A', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={27} color={t.color} />
                      </View>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.ink, textAlign: 'center', lineHeight: 15 }} numberOfLines={2}>
                        {t.label}
                      </Text>
                      <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: Palette.textSecondary, textAlign: 'center' }} numberOfLines={1}>
                        {t.blurb}
                      </Text>
                    </PressableScale>
                  </MotiView>
                );
              })}
            </ScrollView>
          </MotiView>

          {/* ── Premium hero — Chef at Home ── */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: 100 }}>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/experience-request?kind=private_chef'); }}
              accessibilityRole="button"
              accessibilityLabel="Book a private chef to cook at your home"
              style={{ marginHorizontal: 16, marginBottom: 16, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Palette.ink, ...Shadow.floating }}>
              <Image
                source="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=900&q=70"
                style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '52%', opacity: 0.55 }}
                contentFit="cover"
                transition={250}
              />
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(17,21,28,0.45)' }} />
              <View style={{ padding: 20, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(232,97,26,0.92)', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Crown size={13} color="#fff" />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#fff', letterSpacing: 0.3 }}>PREMIUM</Text>
                </View>
                <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', letterSpacing: -0.6, maxWidth: '78%', lineHeight: 28 }}>
                  chef at your home
                </Text>
                <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: 'rgba(255,255,255,0.88)', maxWidth: '70%', lineHeight: 19 }}>
                  A personal chef shops, cooks and cleans up. You just show up hungry.
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.pill, paddingHorizontal: 18, height: 42, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.ink }}>Request a chef</Text>
                    <ChevronRight size={16} color={Palette.ink} />
                  </View>
                  <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.85)' }}>set your budget · get bids</Text>
                </View>
              </View>
            </PressableScale>
          </MotiView>

          {/* ── My requests (error) ── */}
          {!isLoading && isError ? (
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }}>
              <View style={{ marginHorizontal: 16, marginTop: 4, backgroundColor: Palette.danger + '12', borderRadius: Radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <UtensilsCrossed size={18} color={Palette.danger} />
                <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13, color: Palette.danger, lineHeight: 18 }}>
                  Couldn't load your requests.
                </Text>
                <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading requests" hitSlop={8}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.danger }}>retry</Text>
                </PressableScale>
              </View>
            </MotiView>
          ) : null}

          {/* ── Confirmed / booked ── */}
          {booked.length > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 120 }}>
              <View style={{ marginTop: 8, paddingHorizontal: 16, gap: 10 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.textSecondary, letterSpacing: 0 }}>Confirmed</Text>
                {booked.map((r) => (
                  <RequestCard key={r.id} r={r} onPress={() => { feedback.tap(); setSelected(r); }} />
                ))}
              </View>
            </MotiView>
          ) : null}

          {/* ── Active open requests ── */}
          {open.length > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
              <View style={{ marginTop: 16, paddingHorizontal: 16, gap: 10 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 12, color: Palette.textSecondary, letterSpacing: 0 }}>Active requests</Text>
                {open.map((r) => (
                  <RequestCard key={r.id} r={r} onPress={() => { feedback.tap(); setSelected(r); }} />
                ))}
              </View>
            </MotiView>
          ) : null}

          {/* ── Post new request CTA ── */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 160 }}>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/experience-request'); }}
              accessibilityRole="button"
              accessibilityLabel="Post a custom experience request"
              style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: Palette.brand, borderRadius: Radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, ...Shadow.floating, shadowColor: Palette.brand, shadowOpacity: 0.35 }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={24} color="#fff" strokeWidth={2.6} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Post a custom request</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 1 }}>Catering, classes, food service &amp; more — get bids</Text>
              </View>
            </PressableScale>
          </MotiView>

          {/* ── Meal plans link ── */}
          <PressableScale
            onPress={() => { feedback.tap(); router.push('/meal-plans'); }}
            accessibilityRole="button"
            accessibilityLabel="Meal plans and subscriptions"
            style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <CalendarCheck size={18} color={Palette.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: Palette.ink }}>meal plans &amp; subscriptions</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>weekly, monthly &amp; family — prepped on repeat</Text>
            </View>
            <ChevronRight size={18} color={Palette.textSecondary} />
          </PressableScale>

          {/* ── How it works (new users only) ── */}
          {!hasAny ? (
            <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 15, color: Palette.ink, letterSpacing: -0.3, paddingHorizontal: 16, marginTop: 22, marginBottom: 10 }}>
                how it works
              </Text>
              <View style={{ marginHorizontal: 16, backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16, gap: 4 }}>
                {[
                  { emoji: '📋', title: 'Post a request', body: 'Tell us your event, date and budget' },
                  { emoji: '💬', title: 'Compare bids', body: 'Local preppers send quotes to you' },
                  { emoji: '🎉', title: 'Book & enjoy', body: 'Pick your favourite and confirm' },
                ].map((s, i) => (
                  <View key={s.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.chip }}>
                    <Text style={{ fontSize: 22 }}>{s.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.ink }}>{s.title}</Text>
                      <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>{s.body}</Text>
                    </View>
                    <Text style={{ fontFamily: Font.display, fontSize: 32, color: Palette.brand }}>{i + 1}</Text>
                  </View>
                ))}
              </View>
            </MotiView>
          ) : null}

        </ScrollView>

        <RequestDetailSheet
          request={selected}
          onClose={() => setSelected(null)}
        />
      </SafeAreaView>
    </View>
  );
}
