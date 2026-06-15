import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ChevronLeft, Maximize2, Share2, ShoppingBag } from 'lucide-react-native';
import { useState } from 'react';
import { MotiView } from 'moti';
import { Platform, Pressable, ScrollView, Share, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MealLightboxModal } from '@/components/meal-modals';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { imgUrl } from '@/lib/img';
import { BP } from '@/lib/layout';
import type { MealDetail } from '@/lib/queries/meals';

const INK = Palette.ink;
const ORANGE = Palette.brand;

type GalleryProps = {
  meal: MealDetail | undefined | null;
  isLoading: boolean;
  cart: { count: number } | undefined | null;
  id: string | undefined;
};

export function MealGallery({ meal, isLoading, cart, id }: GalleryProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const twoCol = Platform.OS === 'web' && width >= BP.desktop;
  const [heroIdx, setHeroIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  async function handleShare() {
    feedback.tap();
    try {
      await Share.share({
        title: meal?.title ?? 'Check this out on Preppa',
        message: `${meal?.title ?? 'A great meal'} by ${meal?.prepper ?? 'a prepper'} — preorder on Preppa: https://app.preppa.live/meal?id=${id}`,
      });
    } catch { /* share sheet closed */ }
  }

  return (
    <>
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

      <MealLightboxModal
        visible={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={meal?.images ?? []}
        lightboxIdx={lightboxIdx}
        onPrev={() => setLightboxIdx(i => i - 1)}
        onNext={() => setLightboxIdx(i => i + 1)}
        title={meal?.title}
        prepper={meal?.prepper}
      />
    </>
  );
}
