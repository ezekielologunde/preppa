import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Award, BadgeCheck, Bike, CalendarCheck, Check, ChefHat, ChevronLeft, Crown, MapPin, MessageSquare, RefreshCw, Share2, ShieldCheck, ShoppingBag, Star, Store, UserPlus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { MotiView } from 'moti';
import { RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrepperBadgeShelf } from '@/components/badge-shelf';
import { MealCard } from '@/components/meal-card';
import { SubscribePlanSheet } from '@/components/subscribe-sheet';
import { Avatar } from '@/components/ui/avatar';
import { BottomActionBar } from '@/components/ui/bottom-action-bar';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CardRowSkeleton, Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { gridCardWidth, useContentWidth } from '@/lib/layout';
import { useKitchenPlans, useMySubscriptions, type MealPlan } from '@/lib/queries/meal-plans';
import { useStartConversation } from '@/lib/queries/messages';
import { useIsFollowing, usePrepperBadges, usePrepperProfile, useToggleFollow, type PrepperStats } from '@/lib/queries/preppers';
import { usePrepperReviews } from '@/lib/queries/reviews';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

function memberSince(iso: string | null): string {
  if (!iso) return 'recently';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/** 1234 → "1.2k". */
function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}k`;
  return String(n);
}

function TrustStat({ value, label, color = INK }: { value: string; label: string; color?: string }) {
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
    { value: isNew ? 'New' : String(s!.completed_orders), label: isNew ? 'kitchen' : 'orders done', color: INK },
    { value: isNew || s!.completion_rate == null ? '—' : `${s!.completion_rate}%`, label: 'completion', color: Palette.success },
    { value: isNew || !s!.unique_customers ? '—' : `${Math.round((s!.repeat_customers / s!.unique_customers) * 100)}%`, label: 'repeat buyers', color: Palette.brandPressed },
  ];
}

export default function PrepperScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const { data: p, isLoading, refetch: refetchProfile } = usePrepperProfile(id);
  const { data: reviews, refetch: refetchReviews } = usePrepperReviews(id, 6);
  const { data: following, refetch: refetchFollowing } = useIsFollowing(id, user?.id);
  const toggleFollow = useToggleFollow(id ?? '', user?.id);
  const { data: plans, refetch: refetchPlans } = useKitchenPlans(id);
  const { data: badges, refetch: refetchBadges } = usePrepperBadges(id);
  const { data: mySubs } = useMySubscriptions(user?.id);
  const cardW = gridCardWidth(useContentWidth());
  const startConversation = useStartConversation();
  const [sheetPlan, setSheetPlan] = useState<MealPlan | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [msgErr, setMsgErr] = useState<string | null>(null);
  async function handleRefresh() { setRefreshing(true); await Promise.all([refetchProfile(), refetchReviews(), refetchFollowing(), refetchPlans(), refetchBadges()]); setRefreshing(false); }
  const subscribedNames = new Set((mySubs ?? []).filter((s) => s.status !== 'cancelled').map((s) => s.plan_name));
  const onToggleFollow = () => {
    if (!user?.id) { router.push('/auth'); return; }
    feedback.tap();
    toggleFollow.mutate(!!following, { onError: () => feedback.error() });
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
    try { await Share.share({ message: msg }); } catch {}
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ paddingBottom: 180 }}>
        {/* Header band */}
        <View style={{ backgroundColor: INK, paddingBottom: 22 }}>
          <SafeAreaView edges={['top']}>
            <View style={{ paddingHorizontal: 16, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft size={22} color="#fff" />
              </PressableScale>
              {p ? (
                <PressableScale onPress={handleShare} accessibilityRole="button" accessibilityLabel={`Share ${p.name}'s kitchen`} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                  <Share2 size={17} color="#fff" />
                </PressableScale>
              ) : <View style={{ width: 40 }} />}
            </View>
            <View style={{ alignItems: 'center', paddingHorizontal: 20, gap: 8, marginTop: 4 }}>
              {isLoading ? (
                <Skeleton width={84} height={84} radius={42} />
              ) : (
                <LinearGradient colors={['#FF9A5A', ORANGE]} style={{ width: 90, height: 90, borderRadius: 45, padding: 3, alignItems: 'center', justifyContent: 'center' }}>
                  <Avatar name={p?.name ?? 'preppa'} url={p?.avatar ?? undefined} size={78} />
                </LinearGradient>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', letterSpacing: -0.5 }}>{p?.name ?? '…'}</Text>
                {p?.verified ? <BadgeCheck size={20} color={ORANGE} fill={ORANGE} stroke={INK} /> : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {p?.city ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MapPin size={13} color="rgba(255,255,255,0.7)" />
                    <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: 'rgba(255,255,255,0.8)' }}>{p.city}</Text>
                  </View>
                ) : null}
                <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: 'rgba(255,255,255,0.6)' }}>Joined {memberSince(p?.stats?.member_since ?? null)}</Text>
              </View>

              {/* Followers + Follow — the creator-economy primitive */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 }}>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                  <Text style={{ fontFamily: Font.heading, color: '#fff', fontVariant: ['tabular-nums'] }}>{compact(p?.stats?.followers ?? 0)}</Text>
                  {` follower${(p?.stats?.followers ?? 0) === 1 ? '' : 's'}`}
                </Text>
                {p ? (
                  <MotiView
                    animate={{
                      backgroundColor: following ? 'transparent' : ORANGE,
                      borderColor: following ? 'rgba(255,255,255,0.35)' : ORANGE,
                    }}
                    transition={{ type: 'timing', duration: 220 }}
                    style={{ borderWidth: 1.5, borderRadius: 19, overflow: 'hidden' }}>
                    <PressableScale
                      onPress={onToggleFollow}
                      disabled={toggleFollow.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={following ? `Following ${p.name}. Tap to unfollow` : `Follow ${p.name}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 18 }}>
                      {following ? <Check size={15} color="#fff" /> : <UserPlus size={15} color="#fff" />}
                      <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#fff' }}>{following ? 'Following' : 'Follow'}</Text>
                    </PressableScale>
                  </MotiView>
                ) : null}
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Trust stats — overlaps the header band */}
        <MotiView
          from={{ opacity: 0, translateY: 10, scale: 0.98 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          transition={{ type: 'timing', duration: 280 }}
          style={{ marginHorizontal: 16, marginTop: -16, backgroundColor: Palette.surface, borderRadius: Radius.lg, paddingVertical: 16, paddingHorizontal: 8, flexDirection: 'row', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}>
          {trustRow(p?.rating ?? 0, p?.reviews ?? 0, p?.stats ?? null).map((t, i) => (
            <MotiView key={t.label} style={{ flex: 1 }} from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 200, delay: 100 + i * 50 }}>
              <TrustStat value={t.value} label={t.label} color={t.color} />
            </MotiView>
          ))}
        </MotiView>

        {/* Achievement badges */}
        {badges && badges.length > 0 ? (
          <View style={{ marginHorizontal: 16, marginTop: 14 }}>
            <PrepperBadgeShelf badges={badges} />
          </View>
        ) : null}

        {/* Verified-kitchen trust line */}
        {p?.verified ? (
          <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: Palette.success + '14', borderRadius: Radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <ShieldCheck size={18} color={Palette.success} />
            <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 12.5, color: '#15803d' }}>Verified kitchen — ID and food-safety checked by Preppa.</Text>
          </View>
        ) : null}

        {/* About — creator identity: bio, specialties, certifications, fulfillment */}
        {(p?.bio || p?.specialties.length || p?.certifications.length || p?.delivers || p?.pickup) ? (
          <View style={{ marginHorizontal: 16, marginTop: 20, gap: 14 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4 }}>about</Text>

            {p?.bio ? (
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, lineHeight: 21 }}>{p.bio}</Text>
            ) : null}

            {p?.specialties.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {p.specialties.map((s) => (
                  <PressableScale
                    key={s}
                    onPress={() => { feedback.tap(); router.push(`/kitchens?tag=${encodeURIComponent(s)}`); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Find more ${s} kitchens`}
                    style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.pill, paddingHorizontal: 13, height: 30, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Palette.brandPressed }}>{s}</Text>
                  </PressableScale>
                ))}
              </View>
            ) : null}

            {p?.certifications.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {p.certifications.map((c) => (
                  <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Palette.success + '14', borderRadius: Radius.pill, paddingHorizontal: 11, height: 30 }}>
                    <Award size={12} color={Palette.success} />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: '#15803d' }}>{c}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {(p?.delivers || p?.pickup) ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {p?.delivers ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Palette.surface, borderRadius: Radius.pill, paddingHorizontal: 11, height: 30, borderWidth: 1, borderColor: Palette.border }}>
                    <Bike size={13} color={Palette.textSecondary} />
                    <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.textSecondary }}>Delivery</Text>
                  </View>
                ) : null}
                {p?.pickup ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Palette.surface, borderRadius: Radius.pill, paddingHorizontal: 11, height: 30, borderWidth: 1, borderColor: Palette.border }}>
                    <Store size={13} color={Palette.textSecondary} />
                    <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.textSecondary }}>Pickup</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Subscription plans — the kitchen's recurring storefront (creator/Patreon) */}
        {plans && plans.length > 0 ? (
          <View style={{ marginTop: 20 }}>
            <View style={{ marginHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3 }}>subscribe & save</Text>
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
                      <RefreshCw size={20} color={ORANGE} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>{plan.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 3 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <CalendarCheck size={12} color={Palette.textMuted} />
                          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>{plan.meals_per_cycle} meals</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Users size={12} color={Palette.textMuted} />
                          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>serves {plan.serves}</Text>
                        </View>
                      </View>
                      <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: INK, marginTop: 4 }}>
                        <Text style={{ fontFamily: Font.display, fontSize: 17, color: ORANGE }}>${plan.price.toLocaleString('en-US')}</Text>
                        <Text style={{ color: Palette.textSecondary }}>{` /${plan.frequency}`}</Text>
                      </Text>
                    </View>
                    <PressableScale
                      onPress={() => onSubscribe(plan)}
                      disabled={subscribed}
                      accessibilityRole="button"
                      accessibilityLabel={subscribed ? `Subscribed to ${plan.name}` : `Subscribe to ${plan.name}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 40, paddingHorizontal: 16, borderRadius: Radius.pill, backgroundColor: subscribed ? Palette.success : ORANGE }}>
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

        {/* Their menu */}
        <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, marginHorizontal: 20, marginTop: 20, marginBottom: 10 }}>
          {p ? `${p.name.split(' ')[0]}'s menu` : 'menu'}
        </Text>
        {isLoading ? (
          <CardRowSkeleton count={3} />
        ) : !p?.meals.length ? (
          <View style={{ marginHorizontal: 16, backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 22, alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={24} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center' }}>No live meals right now. Check back soon.</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 }}>
            {p.meals.map((m, i) => (
              <MotiView key={m.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 210, delay: i * 40 }}>
                <MealCard meal={m} width={cardW} />
              </MotiView>
            ))}
          </View>
        )}

        {/* Reviews */}
        {reviews && reviews.length ? (
          <>
            <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, marginHorizontal: 20, marginTop: 20, marginBottom: 10 }}>reviews</Text>
            <View style={{ gap: 10, marginHorizontal: 16 }}>
              {reviews.map((r, i) => (
                <MotiView key={r.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
                <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 14, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Avatar name={r.author} size={32} />
                    <Text style={{ flex: 1, fontFamily: Font.heading, fontSize: 13.5, color: INK }}>{r.author}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Star size={13} color={Palette.amber} fill={Palette.amber} />
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: INK }}>{r.rating}</Text>
                    </View>
                  </View>
                  {r.body ? <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>{r.body}</Text> : null}
                  {r.photos?.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 2 }}>
                      {r.photos.map((ph, pi) => (
                        <View key={pi} style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', backgroundColor: Palette.canvas }}>
                          <Image source={ph} style={{ flex: 1 }} contentFit="cover" transition={200} />
                        </View>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
                </MotiView>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Subscribe sheet — servings + delivery schedule (shared with /meal-plans) */}
      {user ? <SubscribePlanSheet plan={sheetPlan} userId={user.id} onClose={() => setSheetPlan(null)} /> : null}

      {/* Sticky action bar — message, preorder, and home cook booking */}
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
              title={`Preorder from ${p.name.split(' ')[0]}`}
              Icon={ShoppingBag}
              variant="primary"
              style={{ flex: 1 }}
              onPress={() => router.push(`/search?q=${encodeURIComponent(p.name)}`)}
              accessibilityLabel={`Preorder from ${p.name}`}
            />
          </View>
          {p.homeCookAvailable ? (
            <PressableScale
              onPress={() => { feedback.tap(); router.push({ pathname: '/book-home-cook' as never, params: { prepperId: id } }); }}
              accessibilityRole="button"
              accessibilityLabel={`Book ${p.name.split(' ')[0]} to cook at your home`}
              style={{ height: 48, borderRadius: 14, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderWidth: 1.5, borderColor: '#7C3AED26' }}>
              <ChefHat size={16} color="#5B21B6" />
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#5B21B6' }}>Book {p.name.split(' ')[0]} to cook at your home</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#5B21B6', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                <Crown size={9} color="#fff" />
                <Text style={{ fontFamily: Font.semibold, fontSize: 9.5, color: '#fff' }}>Prep+</Text>
              </View>
            </PressableScale>
          ) : null}
        </BottomActionBar>
      ) : null}
    </View>
  );
}
