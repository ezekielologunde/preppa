import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BadgeCheck, Check, ChevronLeft, Clock, MessageCircle, ShoppingBag, Star, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { MotiView } from 'moti';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FavoriteButton } from '@/components/ui/favorite-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { imgUrl } from '@/lib/img';
import { useAddToCart, useCart } from '@/lib/queries/cart';
import { useFeatureEnabled } from '@/lib/queries/feature-flags';
import { useMeal } from '@/lib/queries/meals';
import { useStartConversation } from '@/lib/queries/messages';
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
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#F4F4F6', borderRadius: 14, paddingVertical: 12 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 18, color: INK, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ fontFamily: Font.body, fontSize: 11, color: '#9ca3af' }}>{label}</Text>
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
  const startConv = useStartConversation();
  const addToCart = useAddToCart();
  const { data: cart } = useCart(user?.id);
  const { data: reviews } = usePrepperReviews(meal?.prepperId);
  const orderingOn = useFeatureEnabled('ordering');

  function messagePrepper() {
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
          feedback.success();
          setTimeout(() => setAdded(false), 1800);
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

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View style={{ height: 320, backgroundColor: '#FCE9DD' }}>
          {isLoading ? (
            <Skeleton width="100%" height={320} radius={0} />
          ) : meal?.images[0] ? (
            <Image source={imgUrl(meal.images[0], 1000)} style={{ flex: 1 }} contentFit="cover" transition={250} />
          ) : null}
          <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
            <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color={INK} />
            </PressableScale>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {cart && cart.count > 0 ? (
                <PressableScale onPress={() => router.push('/cart')} accessibilityRole="button" accessibilityLabel={`Cart, ${cart.count} items`} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}>
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

        {/* Body */}
        <View style={{ padding: 20, gap: 14 }}>
          {isLoading ? (
            <>
              <Skeleton width="70%" height={26} radius={8} />
              <Skeleton width="40%" height={16} radius={6} />
              <Skeleton width="100%" height={60} radius={10} />
            </>
          ) : isError || !meal ? (
            <Text style={{ fontFamily: Font.medium, fontSize: 15, color: '#ef4444' }}>Couldn&apos;t load this meal. Please try again.</Text>
          ) : (
            <>
              {meal.isLimited ? (
                <MotiView
                  from={{ opacity: 0, translateY: -4 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 240 }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#f5f3ff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Zap size={13} color="#8b5cf6" fill="#8b5cf6" />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: '#8b5cf6' }}>
                    limited drop{dropTimeLeft(meal.expiresAt) ? ` · ${dropTimeLeft(meal.expiresAt)}` : ''}
                  </Text>
                </MotiView>
              ) : null}

              <Text style={{ fontFamily: Font.display, fontSize: 28, color: INK, letterSpacing: -0.6 }}>{meal.title}</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <PressableScale
                  onPress={() => meal.prepperId && router.push(`/prepper?id=${meal.prepperId}`)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#374151' }}>by {meal.prepper}</Text>
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
                  <Star size={15} color="#f59e0b" fill="#f59e0b" />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>{meal.rating.toFixed(1)}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: '#9ca3af' }}>({meal.reviews})</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Clock size={15} color="#9ca3af" />
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: '#6b7280' }}>{meal.time}</Text>
                </View>
              </View>

              {meal.description ? (
                <Text style={{ fontFamily: Font.body, fontSize: 15, lineHeight: 23, color: '#4b5563' }}>{meal.description}</Text>
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
                <View style={{ backgroundColor: '#FAF7F4', borderRadius: 16, padding: 14, marginTop: 4 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 13, color: INK, marginBottom: 4 }}>about the prepper</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, lineHeight: 20, color: '#6b7280' }}>{meal.prepperBio}</Text>
                </View>
              ) : null}

              {reviews && reviews.length > 0 ? (
                <View style={{ gap: 12, marginTop: 6 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK }}>reviews ({reviews.length})</Text>
                  {reviews.slice(0, 4).map((rv) => (
                    <View key={rv.id} style={{ gap: 5 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: INK }}>{rv.author}</Text>
                        <View style={{ flexDirection: 'row', gap: 1 }}>
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star key={n} size={12} color="#f59e0b" fill={n <= rv.rating ? '#f59e0b' : 'transparent'} />
                          ))}
                        </View>
                      </View>
                      {rv.body ? <Text style={{ fontFamily: Font.body, fontSize: 13.5, lineHeight: 20, color: '#4b5563' }}>{rv.body}</Text> : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      {meal ? (
        <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
          {/* Delightful add confirmation — springs up, offers a fast path to cart */}
          {added && orderingOn ? (
            <MotiView
              from={{ opacity: 0, translateY: 14, scale: 0.92 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              transition={{ type: 'spring', damping: 15, stiffness: 240 }}
              pointerEvents="box-none"
              style={{ position: 'absolute', top: -54, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: INK, borderRadius: 999, paddingLeft: 8, paddingRight: 14, height: 44, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: Palette.success, alignItems: 'center', justifyContent: 'center' }}>
                <Check size={15} color="#fff" strokeWidth={3} />
              </View>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: '#fff' }}>Added to cart</Text>
              <Pressable onPress={() => router.push('/cart')} hitSlop={8} accessibilityRole="button" accessibilityLabel="View cart">
                <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: ORANGE }}>View →</Text>
              </Pressable>
            </MotiView>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12 }}>
            <View>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#9ca3af' }}>price</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, fontVariant: ['tabular-nums'] }}>${meal.price.toFixed(2)}</Text>
            </View>
            <PressableScale
              onPress={handleAddToCart}
              disabled={addToCart.isPending || !orderingOn}
              accessibilityRole="button"
              accessibilityLabel={!orderingOn ? 'Ordering paused' : user ? 'Add to cart' : 'Sign in to order'}
              style={{ flex: 1, height: 54, borderRadius: 16, backgroundColor: !orderingOn ? Palette.textMuted : added ? Palette.success : ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, opacity: addToCart.isPending ? 0.7 : 1 }}>
              {added && orderingOn ? <Check size={18} color="#fff" strokeWidth={3} /> : null}
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
                {!orderingOn ? 'Ordering paused' : added ? 'Added to cart' : user ? 'Add to cart' : 'Sign in to order'}
              </Text>
            </PressableScale>
          </View>
        </SafeAreaView>
      ) : null}

      {isLoading ? (
        <View style={{ position: 'absolute', bottom: 40, alignSelf: 'center' }}>
          <ActivityIndicator color={ORANGE} />
        </View>
      ) : null}

      {/* Switching kitchens — one prepper per cart */}
      <Modal visible={switchPrompt} transparent animationType="fade" onRequestClose={() => setSwitchPrompt(false)}>
        <Pressable onPress={() => setSwitchPrompt(false)} style={{ flex: 1, backgroundColor: 'rgba(17,24,39,0.5)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 22, padding: 22, gap: 10 }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={22} color={ORANGE} />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 21, color: INK, letterSpacing: -0.4 }}>Start a new cart?</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14.5, lineHeight: 21, color: Palette.textSecondary }}>
              Your cart has items from {cartPrepperName}. Each order is from one kitchen, so adding {meal?.prepper} will clear your current cart.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <PressableScale onPress={() => setSwitchPrompt(false)} accessibilityRole="button" accessibilityLabel="Keep current cart" style={{ flex: 1, height: 50, borderRadius: 14, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.textSecondary }}>Keep cart</Text>
              </PressableScale>
              <PressableScale onPress={() => doAdd(true)} disabled={addToCart.isPending} accessibilityRole="button" accessibilityLabel="Start a new cart" style={{ flex: 1, height: 50, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: addToCart.isPending ? 0.7 : 1 }}>
                {addToCart.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>New cart</Text>}
              </PressableScale>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
