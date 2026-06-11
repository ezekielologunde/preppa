import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Award, BadgeCheck, Bike, CalendarCheck, Check, ChevronLeft, MapPin, MessageCircle, RefreshCw, Repeat, ShieldCheck, ShoppingBag, Star, Store, UserPlus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MealCard } from '@/components/meal-card';
import { SubscribePlanSheet } from '@/components/subscribe-sheet';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { CardRowSkeleton, Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { gridCardWidth, useContentWidth } from '@/lib/layout';
import { useKitchenPlans, useMySubscriptions, type MealPlan } from '@/lib/queries/meal-plans';
import { useIsFollowing, usePrepperProfile, useToggleFollow, type PrepperStats } from '@/lib/queries/preppers';
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
  const { data: p, isLoading } = usePrepperProfile(id);
  const { data: reviews } = usePrepperReviews(id, 6);
  const { data: following } = useIsFollowing(id, user?.id);
  const toggleFollow = useToggleFollow(id ?? '', user?.id);
  const { data: plans } = useKitchenPlans(id);
  const { data: mySubs } = useMySubscriptions(user?.id);
  const cardW = gridCardWidth(useContentWidth());
  const [sheetPlan, setSheetPlan] = useState<MealPlan | null>(null);
  const subscribedNames = new Set((mySubs ?? []).filter((s) => s.status !== 'cancelled').map((s) => s.plan_name));
  const onToggleFollow = () => {
    if (!user?.id) { router.push('/auth'); return; }
    feedback.tap();
    toggleFollow.mutate(!!following);
  };
  const onSubscribe = (plan: MealPlan) => {
    if (!user?.id) { router.push('/auth?mode=signup'); return; }
    feedback.tap();
    setSheetPlan(plan);
  };

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Header band */}
        <View style={{ backgroundColor: INK, paddingBottom: 22 }}>
          <SafeAreaView edges={['top']}>
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <PressableScale onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronLeft size={22} color="#fff" />
              </PressableScale>
            </View>
            <View style={{ alignItems: 'center', paddingHorizontal: 20, gap: 8, marginTop: 4 }}>
              {isLoading ? (
                <Skeleton width={84} height={84} radius={42} />
              ) : (
                <View style={{ borderWidth: 3, borderColor: ORANGE, borderRadius: 46, padding: 3 }}>
                  <Avatar name={p?.name ?? 'preppa'} url={p?.avatar ?? undefined} size={78} />
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 24, color: '#fff', letterSpacing: -0.5 }}>{p?.name ?? '…'}</Text>
                {p?.verified ? <BadgeCheck size={20} color={ORANGE} fill={ORANGE} stroke="#11151C" /> : null}
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
                  <PressableScale
                    onPress={onToggleFollow}
                    disabled={toggleFollow.isPending}
                    accessibilityRole="button"
                    accessibilityLabel={following ? `Following ${p.name}. Tap to unfollow` : `Follow ${p.name}`}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 18, borderRadius: 19,
                      backgroundColor: following ? 'transparent' : ORANGE,
                      borderWidth: following ? 1.5 : 0, borderColor: 'rgba(255,255,255,0.35)',
                    }}>
                    {following ? <Check size={15} color="#fff" /> : <UserPlus size={15} color="#fff" />}
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#fff' }}>{following ? 'Following' : 'Follow'}</Text>
                  </PressableScale>
                ) : null}
              </View>
            </View>
          </SafeAreaView>
        </View>

        {/* Trust stats — overlaps the header band */}
        <View style={{ marginHorizontal: 16, marginTop: -16, backgroundColor: '#fff', borderRadius: Radius.lg, paddingVertical: 16, paddingHorizontal: 8, flexDirection: 'row', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}>
          {trustRow(p?.rating ?? 0, p?.reviews ?? 0, p?.stats ?? null).map((t) => (
            <TrustStat key={t.label} value={t.value} label={t.label} color={t.color} />
          ))}
        </View>

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
                  <View key={s} style={{ backgroundColor: Palette.brandTint, borderRadius: 999, paddingHorizontal: 13, height: 30, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Palette.brandPressed }}>{s}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {p?.certifications.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {p.certifications.map((c) => (
                  <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Palette.success + '14', borderRadius: 999, paddingHorizontal: 11, height: 30 }}>
                    <Award size={12} color={Palette.success} />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: '#15803d' }}>{c}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {(p?.delivers || p?.pickup) ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {p?.delivers ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 11, height: 30, borderWidth: 1, borderColor: Palette.border }}>
                    <Bike size={13} color={Palette.textSecondary} />
                    <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.textSecondary }}>Delivery</Text>
                  </View>
                ) : null}
                {p?.pickup ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 11, height: 30, borderWidth: 1, borderColor: Palette.border }}>
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
          <View style={{ marginTop: 26 }}>
            <View style={{ marginHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4 }}>subscribe & save</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 2 }}>
                Meals from {p?.name.split(' ')[0]} on repeat — pause or skip anytime.
              </Text>
            </View>
            <View style={{ marginHorizontal: 16, gap: 10 }}>
              {plans.map((plan) => {
                const subscribed = subscribedNames.has(plan.name);
                return (
                  <View key={plan.id} style={{ backgroundColor: '#fff', borderRadius: Radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
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
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, height: 40, paddingHorizontal: 16, borderRadius: 12, backgroundColor: subscribed ? Palette.success : ORANGE }}>
                      {subscribed ? <Check size={15} color="#fff" strokeWidth={3} /> : null}
                      <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#fff' }}>{subscribed ? 'Subscribed' : 'Subscribe'}</Text>
                    </PressableScale>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Their menu */}
        <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4, marginHorizontal: 20, marginTop: 26, marginBottom: 14 }}>
          {p ? `${p.name.split(' ')[0]}'s menu` : 'menu'}
        </Text>
        {isLoading ? (
          <CardRowSkeleton count={3} />
        ) : !p?.meals.length ? (
          <View style={{ marginHorizontal: 16, backgroundColor: '#fff', borderRadius: Radius.md, padding: 22, alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={24} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center' }}>No live meals right now. Check back soon.</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 }}>
            {p.meals.map((m) => <MealCard key={m.id} meal={m} width={cardW} />)}
          </View>
        )}

        {/* Reviews */}
        {reviews && reviews.length ? (
          <>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4, marginHorizontal: 20, marginTop: 28, marginBottom: 12 }}>reviews</Text>
            <View style={{ gap: 10, marginHorizontal: 16 }}>
              {reviews.map((r) => (
                <View key={r.id} style={{ backgroundColor: '#fff', borderRadius: Radius.md, padding: 14, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Avatar name={r.author} size={32} />
                    <Text style={{ flex: 1, fontFamily: Font.heading, fontSize: 13.5, color: INK }}>{r.author}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Star size={13} color={Palette.amber} fill={Palette.amber} />
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: INK }}>{r.rating}</Text>
                    </View>
                  </View>
                  {r.body ? <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 19 }}>{r.body}</Text> : null}
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Subscribe sheet — servings + delivery schedule (shared with /meal-plans) */}
      {user ? <SubscribePlanSheet plan={sheetPlan} userId={user.id} onClose={() => setSheetPlan(null)} /> : null}
    </View>
  );
}
