import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Star } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { Platform, Text, useWindowDimensions, View } from 'react-native';

import { FavoriteButton } from '@/components/ui/favorite-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { imgUrl } from '@/lib/img';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

export type Meal = {
  id: string;
  title: string;
  prepper: string;
  rating: number;
  reviews: number;
  price: number;
  time: string;
  image: string;
  /** Full gallery (image is images[0]); enables hover auto-scroll. */
  images?: string[];
  /** Category key for personalization (breakfast/lunch/dinner/…). */
  category?: string | null;
  badge?: { label: string; color: string };
};

/** Crossfading gallery — auto-cycles on native, hover-driven on web. */
function CardGallery({ images, hovered, height }: { images: string[]; hovered: boolean; height: number }) {
  const [cycle, setCycle] = useState(0);
  const isNative = Platform.OS !== 'web';
  const active = isNative ? images.length > 1 : hovered;

  const [prevHovered, setPrevHovered] = useState(hovered);
  if (!isNative && hovered !== prevHovered) {
    setPrevHovered(hovered);
    if (hovered) setCycle(0);
  }

  useEffect(() => {
    if (!active || images.length <= 1) return;
    const interval = isNative ? 2400 : 1100;
    const timer = setInterval(() => setCycle((i) => i + 1), interval);
    return () => clearInterval(timer);
  }, [active, images.length, isNative]);

  const idx = active && images.length > 1 ? cycle % images.length : 0;

  return (
    <View style={{ height, backgroundColor: '#FCE9DD', overflow: 'hidden' }}>
      {images.map((src, i) => (
        <MotiView
          key={src + i}
          animate={{ opacity: i === idx ? 1 : 0, scale: !isNative && hovered && i === idx ? 1.06 : 1 }}
          transition={{ opacity: { type: 'timing', duration: 450 }, scale: { type: 'timing', duration: 1100 } }}
          style={{ ...StyleSheetAbsolute }}>
          <Image source={imgUrl(src, 700)} style={{ flex: 1 }} contentFit="cover" transition={150} />
        </MotiView>
      ))}
      {images.length > 1 ? (
        <View style={{ position: 'absolute', bottom: 8, alignSelf: 'center', flexDirection: 'row', gap: 4 }}>
          {images.map((_, i) => (
            <View key={i} style={{ width: i === idx ? 14 : 5, height: 5, borderRadius: 3, backgroundColor: i === idx ? '#fff' : 'rgba(255,255,255,0.6)' }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const StyleSheetAbsolute = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

/**
 * Meal card. `variant="big"` is a wide hero tile for the mixed grid; the
 * default is the standard carousel card. Hovering (web) auto-scrolls the photo
 * gallery and gently zooms.
 */
/** `width: null` makes the card fluid — it fills its container. */
export function MealCard({ meal, width = 200, variant = 'normal' }: { meal: Meal; width?: number | null; variant?: 'normal' | 'big' }) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [hovered, setHovered] = useState(false);
  const images = meal.images && meal.images.length ? meal.images : meal.image ? [meal.image] : [];
  const big = variant === 'big';
  // Hero card scales with screen — taller on larger devices.
  const imgHeight = big
    ? Math.min(280, Math.max(176, Math.floor(screenWidth * 0.5)))
    : Math.min(160, Math.max(110, Math.floor((typeof width === 'number' ? width : screenWidth * 0.44) * 0.68)));

  return (
    <PressableScale
      onPress={() => { feedback.tap(); router.push(`/meal?id=${meal.id}`); }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={width === null ? { width: '100%' } : { width }}
      accessibilityLabel={`${meal.title} by ${meal.prepper}, $${meal.price.toFixed(2)}`}>
      <View style={{ borderRadius: big ? 24 : 20, overflow: 'hidden', backgroundColor: Palette.surface, ...Shadow.card }}>
        <View style={{ position: 'relative' }}>
          <CardGallery images={images} hovered={hovered} height={imgHeight} />
          {meal.badge ? (
            <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: '#fff', borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: meal.badge.color, marginRight: 5 }} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.ink }}>{meal.badge.label}</Text>
            </View>
          ) : null}
          <View style={{ position: 'absolute', top: 10, right: 10 }}>
            <FavoriteButton id={`meal:${meal.id}`} />
          </View>
          {big ? (
            <View style={{ position: 'absolute', bottom: 12, left: 14, right: 14 }}>
              <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 18, color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 }}>{meal.title}</Text>
              <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.92)', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 }}>by {meal.prepper}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ padding: 12, gap: 3 }}>
          {!big ? (
            <>
              <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>{meal.title}</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>by {meal.prepper}</Text>
            </>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: big ? 0 : 4, gap: 6 }}>
            <Star size={13} color={Palette.amber} fill={Palette.amber} />
            <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.inkSoft }}>{meal.rating.toFixed(1)}</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, fontVariant: ['tabular-nums'] }}>· {meal.time} · ${meal.price.toFixed(2)}</Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}
