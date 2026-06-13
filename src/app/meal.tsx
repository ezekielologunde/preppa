import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BadgeCheck, Check, ChevronLeft, ChevronRight, Clock, Maximize2, MessageCircle, Share2, ShoppingBag, Star, X, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { MotiView } from 'moti';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Share, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FavoriteButton } from '@/components/ui/favorite-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { imgUrl } from '@/lib/img';
import { recordMealView } from '@/lib/recently-viewed';
import { useAddToCart, useCart } from '@/lib/queries/cart';
import { useFeatureEnabled } from '@/lib/queries/feature-flags';
import { useMeal } from '@/lib/queries/meals';
import { BP } from '@/lib/layout';
import { useStartConversation } from '@/lib/queries/messages';
import { getCurrentRush, getRushUrgency } from '@/lib/rush-hour';
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
  const { data: meal, isLoading, isError } = useMeal(id);
  const [added, setAdded] = useState(false);
  const [switchPrompt, setSwitchPrompt] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [heroIdx, setHeroIdx] = useState(0);
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
  const orderingOn = useFeatureEnabled('ordering');
  const nowHour = new Date().getHours();
  const liveRush = getRushUrgency(nowHour, new Date().getMinutes()) === 'live' ? getCurrentRush(nowHour) : null;

  async function handleShare() {
    feedback.tap();
    try {
      await Share.share({
        title: meal?.title ?? 'Check this out on Preppa',
        message: `${meal?.title ?? 'A great meal'} by ${meal?.prepper ?? 'a prepper'} — preorder on Preppa: https://app.preppa.live/meal?id=${id}`,
      });
    } catch { /* share sheet closed */ }
  }

  function messagePrepper() {
    feedback.tap();
    if (!user) return router.push('/auth?mode=signin');
    if (!meal?.prepperUserId) return;
    startConv.mutate(meal.prepperUserId, {
      onSuccess: (convId) => router.push(`/chat?id=${convId}&name=${encodeURIComponent(meal.prepper)}`),
    });
  }

  // A cart holds one prepper at a time (each prepper cooks & fulfils its own order).
  const cartPrepperId = cart?.items[0]?.prepperId ?? null;
  const cartPrepperName = cart?.items[0]?.prepper ?? 'another kitchen';
  const conflicts = !!meal && !!cartPrepperId && !!meal.prepperId && cartPrepperId !== meal.prepperId;

  function doAdd(replace: boolean) {
    if (!user || !meal) return;
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
        onError: () => feedback.error(),
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

  // ─── Gallery (hero + thumbnail strip) ───────────────────────────────────────
  const galleryEl = (
    <>
        {/* Hero */}
        <View style={{ height: twoCol ? 440 : 320, backgroundColor: Palette.brandTint, borderRadius: twoCol ? 24 : 0, overflow: twoCol ? 'hidden' : 'visible' }}>
          {isLoading ? (
            <Skeleton width="100%" height={320} radius={0} />
          ) : meal?.images.length ? (
            <>
              <Pressable onPress={() => { feedback.tap(); setLightboxIdx(heroIdx); setLightboxOpen(true); }} accessibilityRole="button" accessibilityLabel="View full-screen photo" style={{ flex: 1 }}>
                <Image source={imgUrl(meal.images[heroIdx], 1000)} style={{ flex: 1 }} contentFit="cover" transition={250} />
              </Pressable>
              {meal.images.length > 1 ? (
                <>
                  <Pressable onPress={() => setHeroIdx(i => Math.max(0, i - 1))} style={{ position: 'absolute', left: 0, top: 60, bottom: 60, width: '33%' }} accessibilityLabel="Previous photo" />
                  <Pressable onPress={() => setHeroIdx(i => Math.min(meal.images.length - 1, i + 1))} style={{ position: 'absolute', right: 0, top: 60, bottom: 60, width: '33%' }} accessibilityLabel="Next photo" />
                  <View style={{ position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 5 }} pointerEvents="none">
                    {meal.images.map((_, i) => (
                      <MotiView key={i} animate={{ width: i === heroIdx ? 14 : 5, backgroundColor: i === heroIdx ? '#fff' : 'rgba(255,255,255,0.55)' }} transition={{ type: 'timing', duration: 200 }} style={{ height: 5, borderRadius: 3 }} />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          ) : null}
          <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
            <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/'); } }} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color={INK} />
            </PressableScale>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PressableScale onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share this meal" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}>
                <Share2 size={17} color={INK} />
              </PressableScale>
              {meal?.images.length ? (
                <PressableScale onPress={() => { feedback.tap(); setLightboxIdx(heroIdx); setLightboxOpen(true); }} accessibilityRole="button" accessibilityLabel="View full-screen photo" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}>
                  <Maximize2 size={17} color={INK} />
                </PressableScale>
              ) : null}
              {cart && cart.count > 0 ? (
                <PressableScale onPress={() => { feedback.tap(); router.push('/cart'); }} accessibilityRole="button" accessibilityLabel={`Cart, ${cart.count} items`} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}>
                  <ShoppingBag size={19} color={INK} />
                  <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: '#fff' }}>{cart.count}</Text>
                  </View>
                </PressableScale>
              ) : null}
              {id ? <FavoriteButton id={`meal:${id}`} size={42} /> : null}
            </View>
          </SafeAreaView>
        </View>

        {/* Thumbnail strip — only when meal has 2+ images */}
        {meal?.images && meal.images.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 8, backgroundColor: Palette.surface }}>
            {meal.images.map((img, i) => (
              <PressableScale key={i} onPress={() => { feedback.tap(); setHeroIdx(i); }} accessibilityRole="button" accessibilityLabel={`Photo ${i + 1}`}>
                <MotiView animate={{ borderColor: i === heroIdx ? ORANGE : Palette.border }} transition={{ type: 'timing', duration: 200 }} style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', borderWidth: 2.5 }}>
                  <Image source={img} style={{ flex: 1 }} contentFit="cover" transition={150} />
                </MotiView>
              </PressableScale>
            ))}
          </ScrollView>
        ) : null}
    </>
  );

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
            <Text style={{ fontFamily: Font.medium, fontSize: 15, color: Palette.danger }}>Couldn&apos;t load this meal. Please try again.</Text>
          ) : (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
              {meal.isLimited ? (
                <MotiView
                  from={{ opacity: 0, translateY: -4 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 240 }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#f5f3ff', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Zap size={13} color="#8b5cf6" fill="#8b5cf6" />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: '#8b5cf6' }}>
                    limited drop{dropTimeLeft(meal.expiresAt) ? ` · ${dropTimeLeft(meal.expiresAt)}` : ''}
                  </Text>
                </MotiView>
              ) : null}

              <Text style={{ fontFamily: Font.display, fontSize: 28, color: INK, letterSpacing: -0.6 }}>{meal.title}</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <PressableScale
                  onPress={() => { if (meal.prepperId) { feedback.tap(); router.push(`/prepper?id=${meal.prepperId}`); } }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.inkSoft }}>by {meal.prepper}</Text>
                  {meal.prepperVerified ? <BadgeCheck size={16} color={ORANGE} fill={ORANGE} stroke="#fff" /> : null}
                </PressableScale>
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

              <View style={{ gap: 8, marginTop: 4 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}>pairs well with</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {['Fresh lemonade', 'Ginger beer', 'Hibiscus punch', 'Sparkling water'].map((d) => (
                    <View key={d} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: Palette.canvas, borderWidth: 1, borderColor: Palette.border }}>
                      <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: Palette.inkSoft }}>{d}</Text>
                    </View>
                  ))}
                </View>
              </View>

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
            <View style={{ width: '44%', maxWidth: 480 }}>{galleryEl}</View>
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
            {galleryEl}
            {bodyEl}
          </ScrollView>
          {ctaContent ? (
            <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: Palette.surface, borderTopWidth: 1, borderTopColor: Palette.border }}>
              {ctaContent}
            </SafeAreaView>
          ) : null}
        </>
      )}

      {/* Fullscreen image lightbox — shows all gallery images with prev/next navigation */}
      <Modal visible={lightboxOpen} transparent animationType="fade" onRequestClose={() => setLightboxOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
          {meal?.images[lightboxIdx] ? (
            <Image source={imgUrl(meal.images[lightboxIdx], 1400)} style={{ width: '100%', height: '80%' }} contentFit="contain" />
          ) : null}
          {/* Close */}
          <PressableScale
            onPress={() => { feedback.tap(); setLightboxOpen(false); }}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
            style={{ position: 'absolute', top: 60, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <X size={22} color="#fff" />
          </PressableScale>
          {/* Prev/next navigation */}
          {(meal?.images.length ?? 0) > 1 ? (
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }} pointerEvents="box-none">
              {lightboxIdx > 0 ? (
                <PressableScale onPress={() => setLightboxIdx(i => i - 1)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                  <ChevronLeft size={22} color="#fff" />
                </PressableScale>
              ) : <View style={{ width: 44 }} />}
              {lightboxIdx < (meal?.images.length ?? 1) - 1 ? (
                <PressableScale onPress={() => setLightboxIdx(i => i + 1)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                  <ChevronRight size={22} color="#fff" />
                </PressableScale>
              ) : <View style={{ width: 44 }} />}
            </View>
          ) : null}
          {/* Dots */}
          {(meal?.images.length ?? 0) > 1 ? (
            <View style={{ position: 'absolute', bottom: 100, alignSelf: 'center', flexDirection: 'row', gap: 6 }}>
              {meal?.images.map((_, i) => (
                <MotiView key={i} animate={{ width: i === lightboxIdx ? 16 : 6, backgroundColor: i === lightboxIdx ? '#fff' : 'rgba(255,255,255,0.4)' }} transition={{ type: 'timing', duration: 200 }} style={{ height: 6, borderRadius: 3 }} />
              ))}
            </View>
          ) : null}
          {/* Caption */}
          {meal?.title ? (
            <View style={{ position: 'absolute', bottom: 56, left: 24, right: 24 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#fff', textAlign: 'center', letterSpacing: -0.4 }}>{meal.title}</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 4 }}>by {meal.prepper}</Text>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* Add-to-cart confirmation bottom sheet */}
      <Modal visible={showConfirm} transparent animationType="none" onRequestClose={() => setShowConfirm(false)}>
        <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 180 }} style={{ flex: 1 }}>
          <Pressable onPress={() => setShowConfirm(false)} style={{ flex: 1, backgroundColor: Palette.overlay }} accessibilityLabel="Dismiss" />
          <MotiView
            from={{ translateY: 340 }}
            animate={{ translateY: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 24, gap: 14 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Palette.border, alignSelf: 'center', marginBottom: 4 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MotiView from={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 280, damping: 16 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Palette.success, alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={17} color="#fff" strokeWidth={3} />
                </View>
              </MotiView>
              <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4 }}>Added to cart!</Text>
            </View>
            {meal ? (
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: Palette.canvas, borderRadius: 14, padding: 12 }}>
                {meal.images[0] ? (
                  <Image source={imgUrl(meal.images[0], 200)} style={{ width: 72, height: 72, borderRadius: 12 }} contentFit="cover" transition={150} />
                ) : null}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK, lineHeight: 20 }} numberOfLines={2}>{meal.title}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary }}>by {meal.prepper}</Text>
                  <Text style={{ fontFamily: Font.display, fontSize: 17, color: ORANGE, marginTop: 2 }}>${meal.price.toFixed(2)}</Text>
                </View>
              </View>
            ) : null}
            {cart && cart.count > 0 ? (
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, textAlign: 'center' }}>
                {cart.count} item{cart.count !== 1 ? 's' : ''} in your cart
              </Text>
            ) : null}
            <PressableScale
              onPress={() => { feedback.tap(); setShowConfirm(false); router.push('/cart'); }}
              accessibilityRole="button"
              accessibilityLabel="View cart"
              style={{ height: 52, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>View Cart</Text>
            </PressableScale>
            <PressableScale
              onPress={() => { feedback.tap(); setShowConfirm(false); }}
              accessibilityRole="button"
              accessibilityLabel="Keep browsing"
              style={{ height: 46, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.textSecondary }}>Keep browsing</Text>
            </PressableScale>
          </MotiView>
        </MotiView>
      </Modal>

      {/* Switching kitchens — one prepper per cart */}
      <Modal visible={switchPrompt} transparent animationType="fade" onRequestClose={() => setSwitchPrompt(false)}>
        <Pressable onPress={() => setSwitchPrompt(false)} style={{ flex: 1, backgroundColor: Palette.overlay, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, backgroundColor: Palette.surface, borderRadius: 22, padding: 22, gap: 10 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={22} color={ORANGE} />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 21, color: INK, letterSpacing: -0.4 }}>Start a new cart?</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14.5, lineHeight: 21, color: Palette.textSecondary }}>
              Your cart has items from {cartPrepperName}. Each preorder is from one kitchen, so adding {meal?.prepper} will clear your current cart.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <PressableScale onPress={() => { feedback.tap(); setSwitchPrompt(false); }} accessibilityRole="button" accessibilityLabel="Keep current cart" style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.textSecondary }}>Keep cart</Text>
              </PressableScale>
              <PressableScale onPress={() => { feedback.tap(); doAdd(true); }} disabled={addToCart.isPending} accessibilityRole="button" accessibilityLabel="Start a new cart" style={{ flex: 1, height: 50, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: addToCart.isPending ? 0.7 : 1 }}>
                {addToCart.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>New cart</Text>}
              </PressableScale>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
