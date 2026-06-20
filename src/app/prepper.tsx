import { useLocalSearchParams, useRouter } from 'expo-router';
import { Award, BadgeCheck, Bike, CalendarCheck, Check, ChefHat, Crown, MapPin, Pencil, RefreshCw, ShieldCheck, ShoppingBag, Star, Store, Users, MessageSquare } from 'lucide-react-native';
import { useState } from 'react';
import { MotiView } from 'moti';
import { RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrepperBadgeShelf } from '@/components/badge-shelf';
import { AboutKitchenCard } from '@/components/kitchen-profile/about-card';
import { ExpandableBio } from '@/components/kitchen-profile/expandable-bio';
import { KitchenHero } from '@/components/kitchen-profile/hero';
import { KitchenMealGrid } from '@/components/kitchen-profile/meal-grid';
import { KitchenReviews } from '@/components/kitchen-profile/reviews';
import { KitchenStatChips } from '@/components/kitchen-profile/stat-chips';
import { SpecialtyPills } from '@/components/kitchen-profile/specialty-pills';
import { SubscribePlanSheet } from '@/components/subscribe-sheet';
import { BottomActionBar } from '@/components/ui/bottom-action-bar';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { gridCardWidth, useContentWidth } from '@/lib/layout';
import { useKitchenPlans, useMySubscriptions, type MealPlan } from '@/lib/queries/meal-plans';
import { useStartConversation } from '@/lib/queries/messages';
import { useActiveLiveSessions, useIsFollowing, useMyPrepperApplication, usePrepperBadges, usePrepperProfile, useToggleFollow, type PrepperStats } from '@/lib/queries/preppers';
import { isKitchenOpenNow, nextOpenTime, useCookSchedule } from '@/lib/queries/schedule';
import { usePrepperReviews } from '@/lib/queries/reviews';
import { KitchenHoursCard } from '@/components/kitchen-profile/hours-card';
import { useAuth } from '@/providers/auth-provider';
import { useDeviceLocation } from '@/lib/use-location';
import { formatDistance, haversineKm } from '@/lib/distance';

const PREVIEW_REVIEWS = 3;

function memberSince(iso: string | null): string {
  if (!iso) return 'recently';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}k`;
  return String(n);
}

function TrustStat({ value, label, color = Palette.ink }: { value: string; label: string; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 20, color, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ fontFamily: Font.medium, fontSize: 11, color: Palette.textSecondary, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function trustRow(rating: number, reviews: number, s: PrepperStats | null) {
  const isNew = !s || s.completed_orders === 0;
  return [
    { value: reviews ? rating.toFixed(1) : '—', label: reviews ? `${reviews} reviews` : 'no reviews yet', color: Palette.amber },
    { value: isNew ? 'New' : String(s!.completed_orders), label: isNew ? 'kitchen' : 'orders done', color: Palette.ink },
    { value: isNew || s!.completion_rate == null ? '—' : `${s!.completion_rate}%`, label: 'completion', color: Palette.success },
    { value: isNew || !s!.unique_customers ? '—' : `${Math.round((s!.repeat_customers / s!.unique_customers) * 100)}%`, label: 'repeat buyers', color: Palette.brandPressed },
  ];
}

export default function PrepperScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const { loc } = useDeviceLocation();
  const { data: p, isLoading, isError, refetch: refetchProfile } = usePrepperProfile(id);
  const { data: reviews, isLoading: reviewsLoading, refetch: refetchReviews } = usePrepperReviews(id, 20);
  const { data: following, refetch: refetchFollowing } = useIsFollowing(id, user?.id);
  const toggleFollow = useToggleFollow(id ?? '', user?.id);
  const { data: plans, refetch: refetchPlans } = useKitchenPlans(id);
  const { data: badges, refetch: refetchBadges } = usePrepperBadges(id);
  const { data: mySubs } = useMySubscriptions(user?.id);
  const { data: myApplication } = useMyPrepperApplication(user?.id);
  const { data: liveSessions } = useActiveLiveSessions();
  const isLive = !!(id && liveSessions?.has(id));
  const { data: cookSchedule } = useCookSchedule(id);
  const isOpen = isKitchenOpenNow(cookSchedule);
  const closedNextOpen = !isOpen && cookSchedule ? nextOpenTime(cookSchedule) : null;
  const isOwnKitchen = !!p && !!myApplication?.id && p.id === myApplication.id;
  const cardW = gridCardWidth(useContentWidth());
  const startConversation = useStartConversation();
  const [sheetPlan, setSheetPlan] = useState<MealPlan | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [msgErr, setMsgErr] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string>('All');
  const [showAllReviews, setShowAllReviews] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchProfile(), refetchReviews(), refetchFollowing(), refetchPlans(), refetchBadges()]);
    setRefreshing(false);
  }

  const subscribedNames = new Set((mySubs ?? []).filter((s) => s.status !== 'cancelled').map((s) => s.plan_name));

  const onToggleFollow = () => {
    if (!user?.id) { router.push('/auth'); return; }
    toggleFollow.mutate(!!following, { onSuccess: () => feedback.success(), onError: () => feedback.error() });
  };

  const onSubscribe = (plan: MealPlan) => {
    if (!user?.id) { router.push('/auth?mode=signup'); return; }
    feedback.tap();
    setSheetPlan(plan);
  };

  async function handleShare() {
    feedback.tap();
    const name = p?.name ?? 'This kitchen';
    const specialty = p?.specialties?.[0];
    const msg = specialty
      ? `${name} on Preppa — fresh ${specialty} prepped from their local kitchen.`
      : `${name} on Preppa — fresh home-cooked meals from a local kitchen.`;
    try {
      await Share.share({
        title: `Check out ${name} on Preppa`,
        message: msg,
        url: `https://preppa.live/kitchen/${id ?? ''}`,
      });
    } catch {}
  }

  function handleBack() {
    feedback.tap();
    if (router.canGoBack()) { router.back(); } else { router.replace('/'); }
  }

  // Category chips derived from meals
  const mealTags = p?.meals
    ? ['All', ...Array.from(new Set(p.meals.map((m) => m.category).filter(Boolean) as string[]))]
    : ['All'];
  const filteredMeals = (p?.meals ?? []).filter((m) => activeTag === 'All' || m.category === activeTag);

  const previewReviews = showAllReviews ? (reviews ?? []) : (reviews ?? []).slice(0, PREVIEW_REVIEWS);
  const totalReviews = p?.reviews ?? 0;

  if (!isLoading && isError) {
    return (
      <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
        <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 }}>
          <View style={{ width: 56, height: 56, borderRadius: 20, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
            <Store size={24} color={Palette.textSecondary} />
          </View>
          <Text style={{ fontFamily: Font.display, fontSize: 20, color: Palette.ink, letterSpacing: -0.4, textAlign: 'center' }}>Kitchen not found</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', lineHeight: 21 }}>We couldn't load this kitchen right now. Check your connection and try again.</Text>
          <PressableScale onPress={() => { feedback.tap(); void refetchProfile(); }} accessibilityRole="button" accessibilityLabel="Retry loading kitchen"
            style={{ height: 48, paddingHorizontal: 24, borderRadius: Radius.pill, backgroundColor: Palette.ink, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
            <RefreshCw size={15} color="#fff" />
            <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: '#fff' }}>Try again</Text>
          </PressableScale>
          <PressableScale onPress={handleBack} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={{ fontFamily: Font.medium, fontSize: 14, color: Palette.textSecondary }}>go back</Text>
          </PressableScale>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />}
        contentContainerStyle={{ paddingBottom: 180 }}>

        {/* Hero */}
        <KitchenHero
          name={p?.name}
          avatarUrl={p?.avatar}
          following={following}
          followPending={toggleFollow.isPending}
          isLoading={isLoading}
          isLive={isLive}
          onBack={handleBack}
          onShare={handleShare}
          onToggleFollow={onToggleFollow}
        />

        {/* Name + verified badge + pro tag */}
        <View style={{ paddingHorizontal: 20, gap: 4, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            {isLoading ? (
              <Skeleton width={180} height={28} radius={8} />
            ) : (
              <>
                <Text style={{ fontFamily: Font.display, fontSize: 26, color: Palette.ink, letterSpacing: -0.5 }}>
                  {p?.name ?? '…'}
                </Text>
                {p?.verified ? <BadgeCheck size={22} color={Palette.brand} fill={Palette.brand} strokeWidth={1.5} /> : null}
                {p?.isPro ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Palette.amber + '18', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Crown size={11} color={Palette.amber} fill={Palette.amber} />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: Palette.amber }}>pro</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>

          {/* Star rating inline */}
          {!isLoading && p && p.reviews > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <Star size={14} color={Palette.amber} fill={Palette.amber} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.ink }}>{p.rating.toFixed(1)}</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>({p.reviews} reviews)</Text>
              {p.stats?.followers != null ? (
                <>
                  <Text style={{ color: Palette.divider, fontSize: 13 }}>·</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>{compact(p.stats.followers)} followers</Text>
                </>
              ) : null}
              {p.meals.length > 0 ? (
                <>
                  <Text style={{ color: Palette.divider, fontSize: 13 }}>·</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>{p.meals.length} meals</Text>
                </>
              ) : null}
            </View>
          ) : null}

          {p?.city ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Store size={12} color={Palette.textSecondary} />
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>{p.city}</Text>
            </View>
          ) : null}
          {loc.coords && p?.lat && p?.lng ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <MapPin size={12} color={Palette.textSecondary} />
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>{formatDistance(haversineKm(loc.coords.lat, loc.coords.lng, p.lat, p.lng))}</Text>
            </View>
          ) : null}
          {p?.stats?.member_since ? (
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary }}>
              Joined {memberSince(p.stats.member_since)}
            </Text>
          ) : null}
        </View>

        {/* Stat chips */}
        <KitchenStatChips
          followers={p?.stats?.followers ?? 0}
          mealCount={p?.meals.length ?? 0}
          rating={p?.rating ?? 0}
          reviews={p?.reviews ?? 0}
          isLoading={isLoading}
        />

        {/* Specialties */}
        {p?.specialties.length ? (
          <View style={{ marginTop: 16 }}>
            <SpecialtyPills specialties={p.specialties} />
          </View>
        ) : null}

        {/* Bio (expandable) */}
        {p?.bio ? (
          <View style={{ marginHorizontal: 20, marginTop: 16 }}>
            <ExpandableBio bio={p.bio} />
          </View>
        ) : null}

        {/* About this kitchen card */}
        {p ? (
          <AboutKitchenCard
            bio={null}
            city={p.city}
            specialties={p.specialties}
            memberSinceIso={p.stats?.member_since ?? null}
            certified={p.certifications.length > 0}
          />
        ) : null}

        {/* Verified trust line */}
        {p?.verified ? (
          <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: Palette.success + '14', borderRadius: Radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <ShieldCheck size={18} color={Palette.success} />
            <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 12.5, color: Palette.successDark }}>Verified kitchen — ID and food-safety checked by Preppa.</Text>
          </View>
        ) : null}

        {/* Achievement badges */}
        {badges && badges.length > 0 ? (
          <View style={{ marginHorizontal: 16, marginTop: 14 }}>
            <PrepperBadgeShelf badges={badges} />
          </View>
        ) : null}

        {/* Certifications + fulfillment options */}
        {(p?.certifications.length || p?.delivers || p?.pickup) ? (
          <View style={{ marginHorizontal: 16, marginTop: 16, gap: 10 }}>
            {p?.certifications.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {p.certifications.map((c) => (
                  <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Palette.success + '14', borderRadius: Radius.pill, paddingHorizontal: 11, height: 30 }}>
                    <Award size={12} color={Palette.success} />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Palette.successDark }}>{c}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {(p?.delivers || p?.pickup) ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {p?.delivers ? (() => {
                  const parts: string[] = ['Delivery'];
                  if (p.deliveryRadius != null) parts.push(`${p.deliveryRadius}km radius`);
                  if (p.deliveryFee > 0) parts.push(`$${p.deliveryFee.toFixed(2)} fee`);
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Palette.surface, borderRadius: Radius.pill, paddingHorizontal: 11, height: 30, borderWidth: 1, borderColor: Palette.border }}>
                      <Bike size={13} color={Palette.textSecondary} />
                      <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.textSecondary }}>{parts.join(' · ')}</Text>
                    </View>
                  );
                })() : null}
                {p?.pickup ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Palette.surface, borderRadius: Radius.pill, paddingHorizontal: 11, height: 30, borderWidth: 1, borderColor: Palette.border }}>
                    <Store size={13} color={Palette.textSecondary} />
                    <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.textSecondary }}>{p?.delivers ? 'Pickup' : 'Pickup only'}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {cookSchedule ? <KitchenHoursCard schedule={cookSchedule} isOpen={isOpen} /> : null}

        {!isOpen && cookSchedule ? (
          <View style={{ marginHorizontal: 16, marginTop: 10, backgroundColor: Palette.amberTint, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Palette.amber + '40' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.amberDeep }}>This kitchen is currently closed</Text>
            {closedNextOpen ? <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: '#B45309', marginTop: 3 }}>{closedNextOpen}</Text> : null}
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.amberDeep, marginTop: 4 }}>You can still browse meals and save for later</Text>
          </View>
        ) : null}

        {/* Trust stats detail row */}
        <MotiView
          from={{ opacity: 0, translateY: 10, scale: 0.98 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          transition={{ type: 'timing', duration: 280 }}
          style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: Palette.surface, borderRadius: Radius.lg, paddingVertical: 16, paddingHorizontal: 8, flexDirection: 'row', shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } }}>
          {trustRow(p?.rating ?? 0, p?.reviews ?? 0, p?.stats ?? null).map((t, i) => (
            <MotiView key={t.label} style={{ flex: 1 }} from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 200, delay: 100 + i * 50 }}>
              <TrustStat value={t.value} label={t.label} color={t.color} />
            </MotiView>
          ))}
        </MotiView>

        {/* Subscription plans */}
        {plans && plans.length > 0 ? (
          <View style={{ marginTop: 20 }}>
            <View style={{ marginHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 15, color: Palette.ink, letterSpacing: -0.3 }}>subscribe & save</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 2 }}>
                Meals from {p?.name.split(' ')[0]} on repeat — pause or skip anytime.
              </Text>
            </View>
            <View style={{ marginHorizontal: 16, gap: 10 }}>
              {plans.map((plan, i) => {
                const subscribed = subscribedNames.has(plan.name);
                return (
                  <MotiView key={plan.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: i * 45 }}>
                    <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
                      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                        <RefreshCw size={20} color={Palette.brand} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>{plan.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 3 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <CalendarCheck size={12} color={Palette.textSecondary} />
                            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>{plan.meals_per_cycle} meals</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Users size={12} color={Palette.textSecondary} />
                            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>serves {plan.serves}</Text>
                          </View>
                        </View>
                        <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.ink, marginTop: 4 }}>
                          <Text style={{ fontFamily: Font.display, fontSize: 17, color: Palette.brand }}>${plan.price.toLocaleString('en-US')}</Text>
                          <Text style={{ color: Palette.textSecondary }}>{` /${plan.frequency}`}</Text>
                        </Text>
                      </View>
                      <PressableScale
                        onPress={() => onSubscribe(plan)}
                        disabled={subscribed}
                        accessibilityRole="button"
                        accessibilityLabel={subscribed ? `Subscribed to ${plan.name}` : `Subscribe to ${plan.name}`}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 40, paddingHorizontal: 16, borderRadius: Radius.pill, backgroundColor: subscribed ? Palette.success : Palette.brand }}>
                        {subscribed ? <Check size={15} color="#fff" strokeWidth={3} /> : null}
                        <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#fff' }}>{subscribed ? 'Subscribed' : 'Subscribe'}</Text>
                      </PressableScale>
                    </View>
                  </MotiView>
                );
              })}
            </View>
          </View>
        ) : null}

        <KitchenMealGrid
          prepperFirstName={p?.name.split(' ')[0]}
          meals={p?.meals ?? []}
          isLoading={isLoading}
          activeTag={activeTag}
          mealTags={mealTags}
          filteredMeals={filteredMeals}
          cardW={cardW}
          onTagChange={setActiveTag}
          kitchenClosed={!isOpen && !!cookSchedule}
        />

        {/* Reviews */}
        {reviewsLoading ? (
          <View style={{ marginHorizontal: 16, marginTop: 20, gap: 10 }}>
            <Skeleton width={80} height={14} radius={6} />
            {[0, 1].map((i) => <Skeleton key={i} width="100%" height={80} radius={16} />)}
          </View>
        ) : (
          <KitchenReviews
            reviews={previewReviews}
            total={totalReviews}
            onSeeAll={() => { feedback.tap(); setShowAllReviews(true); }}
          />
        )}
      </ScrollView>

      {/* Subscribe sheet */}
      {user ? <SubscribePlanSheet plan={sheetPlan} userId={user.id} onClose={() => setSheetPlan(null)} /> : null}

      {/* Own-kitchen edit button */}
      {isOwnKitchen ? (
        <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, right: 0, pointerEvents: 'box-none' }}>
          <View style={{ paddingTop: 8, paddingRight: 16, alignItems: 'flex-end', pointerEvents: 'box-none' }}>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/kitchen-settings'); }}
              accessibilityRole="button"
              accessibilityLabel="Edit kitchen profile"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
              <Pencil size={16} color={Palette.ink} />
            </PressableScale>
          </View>
        </SafeAreaView>
      ) : null}

      {/* Sticky bottom bar */}
      {p && !isLoading ? (
        <BottomActionBar>
          {msgErr ? <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.danger, textAlign: 'center', paddingHorizontal: 16 }}>{msgErr}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              title={startConversation.isPending ? '…' : 'Message'}
              Icon={MessageSquare}
              variant="secondary"
              fullWidth={false}
              disabled={startConversation.isPending}
              onPress={async () => {
                if (!user?.id) { router.push('/auth'); return; }
                if (!p?.userId) return;
                feedback.tap();
                setMsgErr(null);
                try {
                  const convId = await startConversation.mutateAsync(p.userId);
                  router.push(`/chat?id=${convId}&name=${encodeURIComponent(p.name)}`);
                } catch { feedback.error(); setMsgErr('Could not open chat. Please try again.'); }
              }}
              accessibilityLabel="Message this prepper"
            />
            <Button
              title={`Order from ${p.name.split(' ')[0]}`}
              Icon={ShoppingBag}
              variant="primary"
              style={{ flex: 1 }}
              onPress={() => router.push(`/search?q=${encodeURIComponent(p.name)}`)}
              accessibilityLabel={`Order from ${p.name}`}
            />
          </View>
        </BottomActionBar>
      ) : null}
    </View>
  );
}
