import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BadgeCheck, Check, ChevronLeft, Clock, Heart, MessageCircle, Star } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { useMeal } from '@/lib/queries/meals';
import { useStartConversation } from '@/lib/queries/messages';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

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
  const startConv = useStartConversation();

  function messagePrepper() {
    if (!user) return router.push('/auth?mode=signin');
    if (!meal?.prepperUserId) return;
    startConv.mutate(meal.prepperUserId, {
      onSuccess: (convId) => router.push(`/chat?id=${convId}&name=${encodeURIComponent(meal.prepper)}`),
    });
  }

  function addToCart() {
    if (!user) {
      router.push('/auth?mode=signup');
      return;
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
    // (cart write wired to create_order RPC flow next)
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <View style={{ height: 320, backgroundColor: '#FCE9DD' }}>
          {isLoading ? (
            <Skeleton width="100%" height={320} radius={0} />
          ) : meal?.images[0] ? (
            <Image source={meal.images[0]} style={{ flex: 1 }} contentFit="cover" transition={250} />
          ) : null}
          <SafeAreaView edges={['top']} style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
            <PressableScale onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color={INK} />
            </PressableScale>
            <PressableScale accessibilityRole="button" accessibilityLabel="Save" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' }}>
              <Heart size={20} color="#6b7280" />
            </PressableScale>
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
              <Text style={{ fontFamily: Font.display, fontSize: 28, color: INK, letterSpacing: -0.6 }}>{meal.title}</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <PressableScale
                  onPress={() => meal.prepperId && router.push(`/explore`)}
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
            </>
          )}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      {meal ? (
        <SafeAreaView edges={['bottom']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 12 }}>
            <View>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#9ca3af' }}>price</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, fontVariant: ['tabular-nums'] }}>${meal.price.toFixed(2)}</Text>
            </View>
            <PressableScale
              onPress={addToCart}
              accessibilityRole="button"
              accessibilityLabel={user ? 'Add to cart' : 'Sign in to order'}
              style={{ flex: 1, height: 54, borderRadius: 16, backgroundColor: added ? Palette.success : ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 }}>
              {added ? <Check size={18} color="#fff" strokeWidth={3} /> : null}
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>
                {added ? 'Added' : user ? 'Add to cart' : 'Sign in to order'}
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
    </View>
  );
}
