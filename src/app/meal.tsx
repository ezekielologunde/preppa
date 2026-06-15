import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BadgeCheck, Check, Clock, MessageCircle, RefreshCw, Star, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { MotiView } from 'moti';
import { Platform, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MealGallery } from '@/components/meal-gallery';
import { MealConfirmSheet, MealSwitchPrompt } from '@/components/meal-modals';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { recordMealView } from '@/lib/recently-viewed';
import { useAddToCart, useCart } from '@/lib/queries/cart';
import { useFeatureEnabled } from '@/lib/queries/feature-flags';
import { QuickAddButton } from '@/components/home-feed';
import { MealCard } from '@/components/meal-card';
import { useMeal, useMealsByPrepper } from '@/lib/queries/meals';
import { BP } from '@/lib/layout';
import { useStartConversation } from '@/lib/queries/messages';
import { getCurrentRush, getRushUrgency } from '@/lib/rush-hour';
import { useIsFollowing, useToggleFollow } from '@/lib/queries/preppers';
import { usePrepperReviews } from '@/lib/queries/reviews';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

/** "ends in 3h" / "ends in 2d" — null when no expiry or already past. */
function dropTimeLeft(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return 'ends soon';
  if (hours < 24) return `ends in ${hours}h`;
  return `ends in ${Math.round(hours / 24)}d`;
}

function Macro({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: Palette.canvas, borderRadius: 14, paddingVertical: 12 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 18, color: INK, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textMuted }}>{label}</Text>
    </View>
  );
}

export default function MealScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuth();
  const { data: meal, isLoading, isError, refetch: refetchMeal } = useMeal(id);
  const [added, setAdded] = useState(false);
  const [cartErr, setCartErr] = useState<string | null>(null);
  const [msgErr, setMsgErr] = useState<string | null>(null);
  const [switchPrompt, setSwitchPrompt] = useState(false);
  const [allReviews, setAllReviews] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Desktop web: gallery on the left, scrollable details + pinned CTA on the right.
  const twoCol = Platform.OS === 'web' && width >= BP.desktop;

  useEffect(() => {
    if (meal?.id) recordMealView(meal.id);
  }, [meal?.id]);
  const startConv = useStartConversation();
  const addToCart = useAddToCart();
  const { data: cart } = useCart(user?.id);
  const { data: reviews } = usePrepperReviews(meal?.prepperId);
  const { data: moreMeals } = useMealsByPrepper(meal?.prepperId, id ?? null, 6);
  const { data: isFollowing } = useIsFollowing(meal?.prepperId, user?.id);
  const toggleFollow = useToggleFollow(meal?.prepperId ?? '', user?.id);
  const orderingOn = useFeatureEnabled('ordering');
  const nowHour = new Date().getHours();
  const liveRush = getRushUrgency(nowHour, new Date().getMinutes()) === 'live' ? getCurrentRush(nowHour) : null;

  function messagePrepper() {
    feedback.tap();
    if (!user) return router.push('/auth?mode=signin');
    if (!meal?.prepperUserId) return;
    setMsgErr(null);
    startConv.mutate(meal.prepperUserId, {
      onSuccess: (convId) => router.push(`/chat?id=${convId}&name=${encodeURIComponent(meal.prepper)}`),
      onError: () => { feedback.error(); setMsgErr('Could not open chat. Please try again.'); },
    });
  }

  function handleFollow() {
    feedback.tap();
    if (!user) return router.push('/auth?mode=signin');
    if (!meal?.prepperId) return;
    toggleFollow.mutate(isFollowing ?? false, { onSuccess: () => feedback.success(), onError: () => feedback.error() });
  }

  // A cart holds one prepper at a time (each prepper cooks & fulfils its own order).
  const cartPrepperId = cart?.items[0]?.prepperId ?? null;
  const cartPrepperName = cart?.items[0]?.prepper ?? 'another kitchen';
  const conflicts = !!meal && !!cartPrepperId && !!meal.prepperId && cartPrepperId !== meal.prepperId;

  function doAdd(replace: boolean) {
    if (!user || !meal) return;
    setCartErr(null);
    addToCart.mutate(
      { userId: user.id, mealId: meal.id, price: meal.price, replace },
      {
        onSuccess: () => {
          setSwitchPrompt(false);
          setAdded(true);
          setShowConfirm(true);
          feedback.success();
          setTimeout(() => setAdded(false), 2200);
        },
        onError: () => {
          feedback.error();
          setCartErr('Could not add to cart. Please try again.');
        },
      },
    );
  }

  function handleAddToCart() {
    if (!user) {
      router.push('/auth?mode=signup');
      return;
    }
    if (!meal) return;
    if (conflicts) {
      feedback.warning();
      setSwitchPrompt(true);
      return;
    }
    doAdd(false);
  }

  // ─── Body (details, macros, reviews) ────────────────────────────────────────
  const bodyEl = (
        <View style={{ padding: 20, gap: 12, backgroundColor: Palette.surface, ...(twoCol ? {} : { borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -24 }) }}>
          {isLoading ? (
            <>
              <Skeleton width="70%" height={26} radius={8} />
              <Skeleton width="40%" height={16} radius={6} />
              <Skeleton width="100%" height={60} radius={10} />
            </>
          ) : isError || !meal ? (
            <View style={{ alignItems: 'center', gap: 14, paddingVertical: 24 }}>
              <Text style={{ fontFamily: Font.medium, fontSize: 15, color: Palette.danger, textAlign: 'center' }}>Couldn&apos;t load this meal. Check your connection and try again.</Text>
              <PressableScale onPress={() => { feedback.tap(); void refetchMeal(); }} accessibilityRole="button" accessibilityLabel="Retry loading meal" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 20, borderRadius: Radius.pill, backgroundColor: Palette.ink }}>
                <RefreshCw size={15} color="#fff" />
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>Try again</Text>
              </PressableScale>
            </View>
          ) : (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
              {meal.isLimited ? (() => {
                const timeLeft = dropTimeLeft(meal.expiresAt);
                return (
                  <MotiView
                    from={{ opacity: 0, translateY: -4 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 240 }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#f5f3ff', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Zap size={13} color="#8b5cf6" fill="#8b5cf6" />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: '#8b5cf6' }}>
                      limited drop{timeLeft ? ` · ${timeLeft}` : ''}
                    </Text>
                  </MotiView>
                );
              })() : null}

              <Text style={{ fontFamily: Font.display, fontSize: 28, color: INK, letterSpacing: -0.6 }}>{meal.title}</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <PressableScale
                  onPress={() => { if (meal.prepperId) { feedback.tap(); router.push(`/prepper?id=${meal.prepperId}`); } }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.inkSoft, flexShrink: 1 }}>by {meal.prepper}</Text>
                  {meal.prepperVerified ? <BadgeCheck size={16} color={ORANGE} fill={ORANGE} stroke="#fff" /> : null}
                </PressableScale>
                {meal.prepperId ? (
                  <MotiView
                    animate={{ backgroundColor: isFollowing ? ORANGE : Palette.brandTint }}
                    transition={{ type: 'spring', damping: 18, stiffness: 220 }}
                    style={{ borderRadius: 18, overflow: 'hidden' }}>
                    <PressableScale
                      onPress={handleFollow}
                      disabled={toggleFollow.isPending}
                      accessibilityRole="button"
                      accessibilityLabel={isFollowing ? `Unfollow ${meal.prepper}` : `Follow ${meal.prepper}`}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 36 }}>
                      {isFollowing ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
                      <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: isFollowing ? '#fff' : ORANGE }}>
                        {isFollowing ? 'following' : 'follow'}
                      </Text>
                    </PressableScale>
                  </MotiView>
                ) : null}
                {meal.prepperUserId ? (
                  <PressableScale
                    onPress={messagePrepper}
                    disabled={startConv.isPending}
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${meal.prepper}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: Palette.brandTint }}>
                    <MessageCircle size={15} color={ORANGE} />
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>Message</Text>
                  </PressableScale>
                ) : null}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Star size={15} color={Palette.amber} fill={Palette.amber} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{meal.rating.toFixed(1)}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted }}>({meal.reviews})</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Clock size={15} color={Palette.textMuted} />
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>{meal.time} prep</Text>
                </View>
              </View>

              {msgErr ? <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.danger }}>{msgErr}</Text> : null}
              {meal.description ? (
                <Text style={{ fontFamily: Font.body, fontSize: 15, lineHeight: 23, color: Palette.inkSoft }}>{meal.description}</Text>
              ) : null}

              {meal.nutrition && (meal.nutrition.calories != null || meal.nutrition.protein != null) ? (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <Macro label="cal" value={meal.nutrition.calories} />
                  <Macro label="protein" value={meal.nutrition.protein} />
                  <Macro label="carbs" value={meal.nutrition.carbs} />
                  <Macro label="fat" value={meal.nutrition.fat} />
                </View>
              ) : null}

              {meal.prepperBio ? (
                <View style={{ backgroundColor: Palette.canvas, borderRadius: 16, padding: 14, marginTop: 4 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textMuted, marginBottom: 4 }}>about the prepper</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13.5, lineHeight: 20, color: Palette.inkSoft }}>{meal.prepperBio}</Text>
                </View>
              ) : null}

              {reviews && reviews.length > 0 ? (
                <View>
                  <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, marginBottom: 8 }}>reviews ({reviews.length})</Text>
                  {(allReviews ? reviews : reviews.slice(0, 4)).map((rv, i) => (
                    <MotiView key={rv.id} from={{ opacity: 0, translateX: -6 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 40 }}
                      style={{ paddingVertical: 11, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: Palette.divider, gap: 5 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: INK }}>{rv.author}</Text>
                        <View style={{ flexDirection: 'row', gap: 1 }}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} size={12} color={Palette.amber} fill={n <= rv.rating ? Palette.amber : 'transparent'} />
                          ))}
                        </View>
                      </View>
                      {rv.body ? <Text style={{ fontFamily: Font.body, fontSize: 13.5, lineHeight: 20, color: Palette.inkSoft }}>{rv.body}</Text> : null}
                      {rv.photos?.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 2 }}>
                          {rv.photos.map((ph, pi) => (
                            <View key={pi} style={{ width: 68, height: 68, borderRadius: 10, overflow: 'hidden', backgroundColor: Palette.canvas }}>
                              <Image source={ph} style={{ flex: 1 }} contentFit="cover" transition={200} />
                            </View>
                          ))}
                        </ScrollView>
                      ) : null}
                    </MotiView>
                  ))}
                  {reviews.length > 4 ? (
                    <PressableScale onPress={() => { feedback.tap(); setAllReviews((v) => !v); }} accessibilityRole="button" accessibilityLabel={allReviews ? 'Show fewer reviews' : `See all ${reviews.length} reviews`} style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: ORANGE }}>
                        {allReviews ? 'show fewer' : `see all ${reviews.length} reviews`}
                      </Text>
                    </PressableScale>
                  ) : null}
                </View>
              ) : null}
            </MotiView>
          )}

          {/* More from this kitchen */}
          {moreMeals && moreMeals.length > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 16, color: INK, letterSpacing: -0.3 }}>more from this kitchen</Text>
                {meal?.prepperId ? (
                  <PressableScale onPress={() => { feedback.tap(); router.push(`/prepper?id=${meal.prepperId}`); }} accessibilityRole="button" accessibilityLabel="View all meals from this kitchen" style={{ paddingVertical: 4 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>see all →</Text>
                  </PressableScale>
                ) : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 8 }}>
                {moreMeals.map((m, i) => (
                  <MotiView key={m.id} from={{ opacity: 0, translateX: 14 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 35 }}>
                    <View style={{ position: 'relative' }}>
                      <MealCard meal={m} width={160} />
                      <View style={{ position: 'absolute', bottom: 12, right: 12 }}>
                        <QuickAddButton meal={m} />
                      </View>
                    </View>
                  </MotiView>
                ))}
              </ScrollView>
            </MotiView>
          ) : null}
        </View>
  );

  // ─── Price + add-to-cart CTA (pinned bottom on mobile, in right column on desktop) ──
  const ctaContent = !meal ? null : (
    <>
          {liveRush ? (
            <MotiView
              from={{ opacity: 0, translateY: 6 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 220 }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingTop: 10 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: liveRush.color }} />
              <Text numberOfLines={1} style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textSecondary, flex: 1 }}>
                {liveRush.buyerTip}
              </Text>
            </MotiView>
          ) : null}
          {cartErr ? (
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.danger, textAlign: 'center', paddingHorizontal: 20 }}>{cartErr}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12 }}>
            <View>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>price</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, fontVariant: ['tabular-nums'] }}>${meal.price.toFixed(2)}</Text>
            </View>
            <MotiView
              animate={{ backgroundColor: !orderingOn ? Palette.textMuted : added ? Palette.success : ORANGE }}
              transition={{ type: 'timing', duration: 300 }}
              style={{ flex: 1, height: 54, borderRadius: Radius.pill, overflow: 'hidden' }}>
              <PressableScale
                onPress={handleAddToCart}
                disabled={addToCart.isPending || !orderingOn}
                accessibilityRole="button"
                accessibilityLabel={!orderingOn ? 'Ordering paused' : user ? 'Add to cart' : 'Sign in to preorder'}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, opacity: addToCart.isPending ? 0.7 : 1 }}>
                {added && orderingOn ? <Check size={18} color="#fff" strokeWidth={3} /> : null}
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
                  {!orderingOn ? 'Ordering paused' : added ? 'Added to cart' : user ? 'Add to cart' : 'Sign in to preorder'}
                </Text>
              </PressableScale>
            </MotiView>
          </View>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: twoCol ? Palette.canvas : Palette.surface }}>
      {twoCol ? (
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ flex: 1, flexDirection: 'row', gap: 24, paddingHorizontal: 24, paddingVertical: 20, width: '100%', maxWidth: 1080, alignSelf: 'center' }}>
            {/* Left: gallery */}
            <View style={{ width: '44%', maxWidth: 480 }}>
              <MealGallery meal={meal} isLoading={isLoading} cart={cart} id={id} />
            </View>
            {/* Right: details + pinned CTA */}
            <View style={{ flex: 1, maxWidth: 600, backgroundColor: Palette.surface, borderRadius: 24, overflow: 'hidden' }}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                {bodyEl}
              </ScrollView>
              {ctaContent ? (
                <View style={{ borderTopWidth: 1, borderTopColor: Palette.border, paddingBottom: 8 }}>{ctaContent}</View>
              ) : null}
            </View>
          </View>
        </SafeAreaView>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
            <MealGallery meal={meal} isLoading={isLoading} cart={cart} id={id} />
            {bodyEl}
          </ScrollView>
          {ctaContent ? (
            <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: Palette.surface, borderTopWidth: 1, borderTopColor: Palette.border }}>
              {ctaContent}
            </SafeAreaView>
          ) : null}
        </>
      )}

      <MealConfirmSheet
        visible={showConfirm}
        onClose={() => setShowConfirm(false)}
        onGoToCart={() => { feedback.tap(); setShowConfirm(false); router.push('/cart'); }}
        meal={meal ? { title: meal.title, prepper: meal.prepper, price: meal.price, images: meal.images } : null}
        cartCount={cart?.count ?? 0}
        insetsBottom={insets.bottom}
      />
      <MealSwitchPrompt
        visible={switchPrompt}
        onClose={() => setSwitchPrompt(false)}
        cartPrepperName={cartPrepperName}
        mealPrepper={meal?.prepper}
        isPending={addToCart.isPending}
        onSwitch={() => doAdd(true)}
      />
    </View>
  );
}
