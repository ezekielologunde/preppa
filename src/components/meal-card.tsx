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
  /** ISO timestamp — limited drops only. Drives live countdown badge. */
  expiresAt?: string | null;
};

function computeCountdown(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMins = Math.floor(ms / 60_000);
  if (totalMins > 60 * 24 * 7) return null;
  if (totalMins > 60 * 24) {
    const days = Math.floor(totalMins / (60 * 24));
    const hrs = Math.floor((totalMins % (60 * 24)) / 60);
    return `${days}d ${hrs}h left`;
  }
  if (totalMins > 60) {
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hrs}h ${mins}m left`;
  }
  return `${totalMins}m left`;
}

function urgencyColor(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms < 3_600_000) return '#ef4444';
  if (ms < 86_400_000) return Palette.brand;
  return '#8b5cf6';
}

function useCountdown(expiresAt?: string | null): string | null {
  const [label, setLabel] = useState<string | null>(() => computeCountdown(expiresAt));
  useEffect(() => {
    setLabel(computeCountdown(expiresAt));
    if (!expiresAt) return;
    const id = setInterval(() => setLabel(computeCountdown(expiresAt)), 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return label;
}

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
    <View style={{ height, backgroundColor: Palette.brandTint, overflow: 'hidden' }}>
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
            <MotiView
              key={i}
              animate={{ width: i === idx ? 14 : 5, backgroundColor: i === idx ? '#fff' : 'rgba(255,255,255,0.6)' }}
              transition={{ type: 'timing', duration: 200 }}
              style={{ height: 5, borderRadius: 3 }}
            />
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
  const expiresAt = meal.expiresAt ?? null;
  const countdown = useCountdown(expiresAt);
  const displayBadge = countdown && expiresAt
    ? { label: countdown, color: urgencyColor(expiresAt), solid: true }
    : meal.badge
    ? { label: meal.badge.label, color: meal.badge.color, solid: false }
    : null;
  // Hero card scales with screen — taller on larger devices.
  const imgHeight = big
    ? Math.min(280, Math.max(176, Math.floor(screenWidth * 0.5)))
    : Math.min(160, Math.max(110, Math.floor((typeof width === 'number' ? width : screenWidth * 0.44) * 0.68)));

  return (
    <PressableScale
      onPress={() => { feedback.tap(); router.push(`/meal?id=${meal.id}`); }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      style={width === null ? { width: '100%' } : { width }}
      accessibilityLabel={`${meal.title} by ${meal.prepper}, $${meal.price.toFixed(2)}`}>
      <View style={{ borderRadius: big ? 24 : 20, overflow: 'hidden', backgroundColor: Palette.surface, ...Shadow.card }}>
        <View style={{ position: 'relative' }}>
          <CardGallery images={images} hovered={hovered} height={imgHeight} />
          {displayBadge ? (
            <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: displayBadge.solid ? displayBadge.color : '#fff', borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' }}>
              {!displayBadge.solid ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: displayBadge.color, marginRight: 5 }} /> : null}
              <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: displayBadge.solid ? '#fff' : Palette.ink }}>{displayBadge.label}</Text>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: big ? 0 : 6, justifyContent: big ? undefined : 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Star size={12} color={Palette.amber} fill={Palette.amber} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.inkSoft }}>{meal.rating.toFixed(1)}</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textMuted }}>· {meal.time}</Text>
            </View>
            {!big ? (
              <Text style={{ fontFamily: Font.display, fontSize: 15, color: Palette.brand, letterSpacing: -0.2, fontVariant: ['tabular-nums'] }}>${meal.price.toFixed(2)}</Text>
            ) : null}
          </View>
          {big ? (
            <Text style={{ fontFamily: Font.display, fontSize: 14, color: Palette.brand, letterSpacing: -0.2, fontVariant: ['tabular-nums'], marginTop: 2 }}>${meal.price.toFixed(2)}</Text>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}
