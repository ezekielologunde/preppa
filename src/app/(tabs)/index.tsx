import { Image } from 'expo-image';
import { MotiView } from 'moti';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  Bell,
  Bike,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Coffee,
  Gift,
  Leaf,
  MapPin,
  MoreHorizontal,
  RefreshCw,
  Salad,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Ticket,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { Modal, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MealCard } from '@/components/meal-card';
import { MarketingBanner } from '@/components/marketing-banner';
import { PreppaLogo } from '@/components/preppa-logo';
import { Font } from '@/constants/fonts';
import { categories, recommendedMeals } from '@/constants/mock';
import { PressableScale } from '@/components/ui/pressable-scale';
import { feedback } from '@/lib/feedback';
import { CardRowSkeleton } from '@/components/ui/skeleton';
import { Palette, Radius } from '@/constants/theme';
import { greeting } from '@/lib/greeting';
import { useFeaturedMeals, useFollowingFeed } from '@/lib/queries/meals';
import { useFeatureFlags } from '@/lib/queries/feature-flags';
import { useMyOrders } from '@/lib/queries/orders';
import { useNotifications } from '@/lib/queries/notifications';
import { useRewards } from '@/lib/queries/rewards';
import { usePersonalizedMeals } from '@/lib/queries/recommend';
import { gridCardWidth, useBreakpoint, useCarouselCardWidth, useContentWidth, usePagePadding } from '@/lib/layout';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const MUTED = Palette.textMuted;

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Order placed — awaiting the kitchen',
  confirmed: 'Order confirmed',
  preparing: 'Your food is being prepared',
  ready: 'Your order is ready',
  out_for_delivery: 'On the way to you',
};

const CITIES = [
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX',
  'Atlanta, GA', 'Washington, DC', 'Miami, FL', 'London, UK', 'Lagos, NG',
];

const ICONS: Record<string, LucideIcon> = {
  Coffee,
  Salad,
  UtensilsCrossed,
  Leaf,
  Sprout,
  MoreHorizontal,
  RefreshCw,
};

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 8, marginBottom: 10 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3 }}>{title}</Text>
      {onSeeAll ? (
        <PressableScale onPress={onSeeAll} accessibilityRole="button" accessibilityLabel={`See all ${title}`}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: ORANGE }}>see all</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // Greet by first name only when a real name exists — never the email handle.
  const rawFirst = (user?.user_metadata?.full_name as string | undefined)?.trim().split(/\s+/)[0];
  const firstName = rawFirst ? rawFirst.toLowerCase() : null;
  // Live meals from Supabase (RLS-scoped); fall back to mock if the query is empty.
  const { data: liveMeals, isLoading: mealsLoading, isError: mealsError, refetch: refetchMeals } = useFeaturedMeals();
  const { data: followingFeed, refetch: refetchFeed } = useFollowingFeed(user?.id);
  const meals = liveMeals && liveMeals.length > 0 ? liveMeals : recommendedMeals;
  const { data: flags } = useFeatureFlags();
  const showPlans = flags?.meal_plans !== false;
  const showExperiences = flags?.experiences !== false;
  // "Order again" = the user's most recent delivered order (hidden until one exists).
  const { data: myOrders, refetch: refetchOrders } = useMyOrders(user?.id);
  const lastDone = myOrders?.find((o) => o.status === 'completed');
  // Most recent in-progress order → a live tracker banner so orders are always findable.
  const activeOrder = (myOrders ?? []).find((o) => o.status !== 'completed' && o.status !== 'cancelled');
  const { data: notifications, refetch: refetchNotifs } = useNotifications(user?.id);
  const rewards = useRewards(user?.id);
  // Preppa AI: rank meals from real signals (time of day, favorites, history).
  const contentWidth = useContentWidth();
  const bp = useBreakpoint();
  const pad = usePagePadding();
  const carouselCardWidth = useCarouselCardWidth();
  const ranked = usePersonalizedMeals(meals, user?.id);
  const [aiIdx, setAiIdx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState('New York, NY');
  const [locationOpen, setLocationOpen] = useState(false);
  async function handleRefresh() { setRefreshing(true); await Promise.all([refetchMeals(), refetchFeed(), refetchOrders(), refetchNotifs()]); setRefreshing(false); }
  const topPicks = ranked.slice(0, Math.min(5, ranked.length));
  const aiPick = topPicks.length ? topPicks[aiIdx % topPicks.length] : null;
  const hour = new Date().getHours();
  const rushActive = (hour >= 11 && hour < 14) || (hour >= 16 && hour < 20) || (hour >= 7 && hour < 10);
  const rushLabel = hour >= 11 && hour < 14 ? 'lunch rush' : hour >= 16 && hour < 20 ? 'dinner window' : 'morning prep';
  // Bell badge = orders in motion + unread notifications (real, actionable).
  const activeOrders = (myOrders ?? []).filter(
    (o) => o.status !== 'completed' && o.status !== 'cancelled',
  ).length;
  const unreadNotifs = (notifications ?? []).filter((n) => !n.read).length;
  const badgeCount = activeOrders + unreadNotifs;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
          contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 12 : 0, paddingBottom: 24 }}>
          {/* Header */}
          <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, gap: 12 }}>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/profile'); }}
              accessibilityRole="button"
              accessibilityLabel="Your profile"
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
              <PreppaLogo size={40} glow />
            </PressableScale>
            <View style={{ flex: 1, paddingTop: 2 }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>{greeting()}{firstName ? `, ${firstName}` : ''}</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 14.5, color: INK, letterSpacing: -0.3, lineHeight: 18 }}>
                what are you <Text style={{ color: ORANGE }}>craving?</Text>
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <PressableScale onPress={() => { feedback.tap(); router.push('/messages'); }} accessibilityRole="button" accessibilityLabel={badgeCount ? `Inbox, ${badgeCount} updates` : 'Inbox'} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={20} color={INK} />
                {badgeCount > 0 ? (
                  <View style={{ position: 'absolute', top: 8, right: 9, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 9, color: '#fff' }}>{badgeCount}</Text>
                  </View>
                ) : null}
              </PressableScale>
              <PressableScale onPress={() => { feedback.tap(); setLocationOpen(true); }} accessibilityRole="button" accessibilityLabel={`Change location, ${location}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.surface, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 }}>
                <MapPin size={11} color={ORANGE} />
                <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: Palette.textSecondary }}>{location.split(',')[0]}</Text>
                <ChevronDown size={10} color={Palette.textSecondary} />
              </PressableScale>
            </View>
          </View>
          </MotiView>

          {/* Search bar — full width now that location is in header */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 60 }}>
          <PressableScale
            onPress={() => { feedback.tap(); router.push('/search'); }}
            accessibilityRole="search"
            accessibilityLabel="Search meals, cuisines, or preppers"
            style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginTop: 10, backgroundColor: Palette.surface, borderRadius: 18, paddingHorizontal: 16, height: 46, gap: 10 }}>
            <Search size={19} color={MUTED} />
            <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 14.5, color: MUTED }}>Search meals, cuisines…</Text>
            <SlidersHorizontal size={18} color={ORANGE} />
          </PressableScale>
          </MotiView>

          {/* Hero meal — first ranked card, full-width, anchors the "real local food" identity */}
          {!mealsLoading && ranked.length > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 80 }}>
              <View style={{ marginHorizontal: 20, marginTop: 14 }}>
                <MealCard meal={ranked[0].meal} width={null} variant="big" />
              </View>
            </MotiView>
          ) : mealsLoading ? (
            <View style={{ marginHorizontal: 20, marginTop: 14, height: 218, backgroundColor: Palette.surface, borderRadius: 24 }} />
          ) : null}

          {/* Rush hour / specials entry — only when rush is active */}
          {rushActive ? (
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
            <PressableScale onPress={() => { feedback.tap(); router.push('/specials'); }} accessibilityRole="button" accessibilityLabel="Deals and specials"
              style={{ marginHorizontal: 20, marginTop: 10, backgroundColor: ORANGE, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Sparkles size={17} color="#fff" />
              <Text style={{ flex: 1, fontFamily: Font.semibold, fontSize: 14, color: '#fff' }} numberOfLines={1}>{rushLabel} — specials live now</Text>
              <ChevronRight size={16} color="rgba(255,255,255,0.7)" />
            </PressableScale>
            </MotiView>
          ) : null}

          {/* Error banner — shown when primary data fails */}
          {mealsError && !mealsLoading ? (
            <PressableScale onPress={handleRefresh} accessibilityRole="button" accessibilityLabel="Data failed to load. Tap to retry." style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 12, backgroundColor: Palette.danger + '14', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 }}>
              <AlertCircle size={18} color={Palette.danger} />
              <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 13.5, color: Palette.danger }}>Couldn't load meals. Tap to retry.</Text>
            </PressableScale>
          ) : null}

          {/* Active order tracker — always-findable live status */}
          {activeOrder ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/orders'); }}
              accessibilityRole="button"
              accessibilityLabel={`Track your order from ${activeOrder.prepper}, ${ORDER_STATUS_LABEL[activeOrder.status]}`}
              style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: INK, borderRadius: Radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <MotiView
                from={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'timing', duration: 900, loop: true, repeatReverse: true }}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                <Bike size={19} color="#fff" />
              </MotiView>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }} numberOfLines={1}>{ORDER_STATUS_LABEL[activeOrder.status]}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: 'rgba(255,255,255,0.7)' }} numberOfLines={1}>{activeOrder.prepper} · ${activeOrder.total.toFixed(2)} · tap to track</Text>
              </View>
              <ChevronRight size={20} color="rgba(255,255,255,0.6)" />
            </PressableScale>
            </MotiView>
          ) : null}

          {/* Categories — horizontal scroll on phone, wrapping chip grid on tablet+ */}
          {(() => {
            const items = categories.map((c, i) => {
              const Icon = ICONS[c.icon] ?? MoreHorizontal;
              const onPress = () => { feedback.tap(); c.key === 'more' ? router.push('/explore') : router.push(`/category?key=${c.key}&label=${encodeURIComponent(c.label)}`); };
              return (
                <MotiView key={c.key} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 100 + i * 35 }}>
                  <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${c.label} meals`} style={{ alignItems: 'center', gap: 5, width: 52 }}>
                    <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} color={c.color} />
                    </View>
                    <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: Palette.inkSoft }}>{c.label}</Text>
                  </PressableScale>
                </MotiView>
              );
            });
            return bp !== 'mobile'
              ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: pad, gap: 12, paddingVertical: 16 }}>{items}</View>
              : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingVertical: 8 }}>{items}</ScrollView>;
          })()}

          {/* More meals — skip [0] which is already the hero above */}
          <SectionHeader title="more near you" onSeeAll={() => { feedback.tap(); router.push('/category?key=all&label=recommended'); }} />
          {mealsLoading ? (
            <View style={{ paddingBottom: 20 }}>
              <CardRowSkeleton count={3} />
            </View>
          ) : bp !== 'mobile' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: pad, paddingBottom: 20 }}>
              {ranked.slice(1).map((s, i) => (
                <MotiView key={s.meal.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200, delay: i * 28 }}>
                  <MealCard meal={s.meal} width={gridCardWidth(contentWidth, pad)} />
                </MotiView>
              ))}
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
              {ranked.slice(1).map((s) => (
                <MealCard key={s.meal.id} meal={s.meal} width={carouselCardWidth} />
              ))}
            </ScrollView>
          )}

          {/* From kitchens you follow */}
          {followingFeed && followingFeed.length > 0 ? (
            <>
              <SectionHeader title="from kitchens you follow" />
              {bp !== 'mobile' ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: pad, paddingBottom: 20 }}>
                  {followingFeed.map((m, i) => (
                    <MotiView key={m.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200, delay: i * 30 }}>
                      <MealCard meal={m} width={gridCardWidth(contentWidth, pad)} />
                    </MotiView>
                  ))}
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: pad, gap: 12, paddingBottom: 20 }}>
                  {followingFeed.map((m) => (<MealCard key={m.id} meal={m} width={carouselCardWidth} />))}
                </ScrollView>
              )}
            </>
          ) : null}

          {/* Marketing banner — between meals and secondary nav so meals are immediately visible */}
          {!rushActive ? <MarketingBanner /> : null}

          {/* Browse — secondary navigation after primary content */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 60 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, paddingHorizontal: 20, marginTop: 12, marginBottom: 10 }}>browse</Text>
          <View style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden' }}>
            {showPlans ? (
              <>
              <PressableScale onPress={() => { feedback.tap(); router.push('/meal-plans'); }} accessibilityRole="button" accessibilityLabel="Meal plans"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarCheck size={18} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK }}>meal plans</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>weekly & family, on repeat</Text>
                </View>
                <ChevronRight size={16} color={Palette.textSecondary} />
              </PressableScale>
              <View style={{ height: 1, backgroundColor: Palette.border, marginLeft: 68 }} />
              </>
            ) : null}
            {showExperiences ? (
              <>
              <PressableScale onPress={() => { feedback.tap(); router.push('/experiences'); }} accessibilityRole="button" accessibilityLabel="Experiences"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                  <Ticket size={18} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK }}>experiences</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>catering, chefs & classes</Text>
                </View>
                <ChevronRight size={16} color={Palette.textSecondary} />
              </PressableScale>
              <View style={{ height: 1, backgroundColor: Palette.border, marginLeft: 68 }} />
              </>
            ) : null}
            <PressableScale onPress={() => { feedback.tap(); router.push('/bid-requests'); }} accessibilityRole="button" accessibilityLabel="Meal requests"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                <UtensilsCrossed size={18} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK }}>requests</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>post a request, get bids</Text>
              </View>
              <ChevronRight size={16} color={Palette.textSecondary} />
            </PressableScale>
          </View>
          </MotiView>

          {/* Preppa AI — a personalized pick that learns from your taste */}
          {aiPick ? (
            <View style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: INK, borderRadius: Radius.lg, padding: 16, gap: 10, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: ORANGE }}>
                  <Sparkles size={14} color="#fff" />
                </View>
                <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff', flex: 1 }}>Preppa AI · picked for you</Text>
                <PressableScale onPress={() => { feedback.tap(); setAiIdx((i) => i + 1); }} accessibilityRole="button" accessibilityLabel="Suggest another meal" hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 30, borderRadius: Radius.pill, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                  <RefreshCw size={13} color="#fff" />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#fff' }}>shuffle</Text>
                </PressableScale>
              </View>
              <PressableScale onPress={() => { feedback.tap(); router.push(`/meal?id=${aiPick.meal.id}`); }} accessibilityRole="button" accessibilityLabel={`${aiPick.meal.title} — ${aiPick.reason}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Image source={aiPick.meal.image} style={{ width: 76, height: 76, borderRadius: 16 }} contentFit="cover" transition={200} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{aiPick.meal.title}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: ORANGE }} numberOfLines={1}>{aiPick.reason}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED }} numberOfLines={1}>by {aiPick.meal.prepper} · ${aiPick.meal.price.toFixed(2)}</Text>
                </View>
                <ChevronRight size={20} color={Palette.textSecondary} />
              </PressableScale>
            </View>
          ) : null}

          {/* Points banner — real points from completed orders */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
          <PressableScale onPress={() => { feedback.tap(); router.push('/rewards'); }} accessibilityRole="button" accessibilityLabel={`Rewards, ${rewards.points} points, ${rewards.tier.name} tier`} style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: Palette.success + '18', borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.success, alignItems: 'center', justifyContent: 'center' }}>
              <Gift size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>
                {rewards.points > 0 ? `you have ${rewards.points.toLocaleString()} points` : 'start earning rewards'}
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>
                {rewards.nextTier ? `${rewards.tier.name} · $${rewards.toNext.toFixed(0)} to ${rewards.nextTier.name}` : `${rewards.tier.name} member · top tier`}
              </Text>
            </View>
            <View style={{ backgroundColor: INK, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#fff' }}>view rewards</Text>
              <ChevronRight size={13} color="#fff" />
            </View>
          </PressableScale>
          </MotiView>

          {/* Order again — the user's real last delivered order */}
          {lastDone ? (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
              <SectionHeader title="order again" />
              <PressableScale
                onPress={() => { feedback.tap(); lastDone.firstMealId && router.push(`/meal?id=${lastDone.firstMealId}`); }}
                accessibilityRole="button"
                accessibilityLabel="Order again"
                style={{ marginHorizontal: 20, backgroundColor: Palette.surface, borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {lastDone.items[0]?.image ? (
                  <Image source={lastDone.items[0].image} style={{ width: 60, height: 60, borderRadius: 14 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 60, height: 60, borderRadius: 14, backgroundColor: Palette.brandTint }} />
                )}
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>{lastDone.items[0]?.title ?? 'Your order'}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 2 }}>by {lastDone.prepper}</Text>
                  <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textSecondary, marginTop: 4 }}>
                    ${lastDone.total.toFixed(2)} · delivered {new Date(lastDone.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: ORANGE, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 9 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff' }}>order again</Text>
                  <ChevronRight size={13} color="rgba(255,255,255,0.8)" />
                </View>
              </PressableScale>
            </MotiView>
          ) : null}
        </ScrollView>
      </SafeAreaView>

      {/* Location picker overlay */}
      <Modal visible={locationOpen} transparent animationType="slide" onRequestClose={() => setLocationOpen(false)}>
        <Pressable onPress={() => setLocationOpen(false)} style={{ flex: 1, backgroundColor: Palette.overlay, justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40, ...(bp !== 'mobile' ? { maxWidth: 540, alignSelf: 'center', width: '100%' } : {}) }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Palette.border, alignSelf: 'center', marginTop: 12, marginBottom: 6 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 14 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.4 }}>your location</Text>
              <PressableScale onPress={() => { feedback.tap(); setLocationOpen(false); }} accessibilityRole="button" accessibilityLabel="Close" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} color={Palette.textSecondary} />
              </PressableScale>
            </View>
            {CITIES.map((city, i) => (
              <PressableScale
                key={city}
                onPress={() => { feedback.tap(); setLocation(city); setLocationOpen(false); }}
                accessibilityRole="button"
                accessibilityLabel={`Set location to ${city}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingVertical: 15, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.divider }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: location === city ? Palette.brandTint : Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                  <MapPin size={16} color={location === city ? ORANGE : Palette.textMuted} />
                </View>
                <Text style={{ flex: 1, fontFamily: location === city ? Font.semibold : Font.medium, fontSize: 15, color: location === city ? ORANGE : INK }}>{city}</Text>
                {location === city ? <Check size={18} color={ORANGE} /> : null}
              </PressableScale>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
