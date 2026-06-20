import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Calendar, Crown, Star } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import { Platform, Text, useWindowDimensions, View } from 'react-native';

import { MealCardActionSheet } from '@/components/meal-card-action-sheet';
import { compressDays } from '@/components/day-picker';
import { DietaryBadge } from '@/components/dietary-badge';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { imgUrl } from '@/lib/img';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

const SWIPE_HINT_KEY = 'preppa.swipe-hint-seen.v1';

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
  /** False when limited_qty has been exhausted — disables add-to-cart. */
  inStock?: boolean;
  /** Prepper's city — used for local feed filtering. */
  prepperCity?: string | null;
  /** Is the prepper a Pro? Shows crown badge. */
  isPro?: boolean;
  /** Days this meal is available — null/undefined = always available. */
  availableDays?: string[] | null;
  /** Dietary tags (halal, vegan, gluten-free, …). Max 3 shown on card. */
  dietaryTags?: string[] | null;
  /**
   * Remaining portions today from meal_stock. null/undefined = no stock set (unlimited).
   * 0 = sold out. Passed from parent screen after calling useTodayStock().
   */
  stockRemaining?: number | null;
  /** Whether the prepper offers delivery for this meal. */
  delivers?: boolean;
  /** Whether the prepper offers pickup for this meal. */
  pickup?: boolean;
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
  if (ms < 3_600_000) return Palette.danger;
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
          <Image source={imgUrl(src, 700)} style={{ flex: 1 }} contentFit="cover" cachePolicy="memory-disk" transition={200} />
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

function useSwipeHint(): boolean {
  const [show, setShow] = useState(false);
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    AsyncStorage.getItem(SWIPE_HINT_KEY)
      .then((val) => {
        if (!val) {
          setShow(true);
          AsyncStorage.setItem(SWIPE_HINT_KEY, '1').catch(() => {});
        }
      })
      .catch(() => {});
  }, []);
  return show;
}

/** Renders the daily stock badge below the meal title. Returns null when qty_total is 0/null (unlimited). */
function StockBadge({ stockRemaining }: { stockRemaining: number | null | undefined }) {
  if (stockRemaining == null) return null;

  if (stockRemaining <= 0) {
    return (
      <View style={{ alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: Palette.cancelledTint }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.danger }}>Sold out</Text>
      </View>
    );
  }
  if (stockRemaining <= 3) {
    return (
      <View style={{ alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: Palette.amberTint }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#D97706' }}>Only {stockRemaining} left!</Text>
      </View>
    );
  }
  if (stockRemaining <= 10) {
    return (
      <View style={{ alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: Palette.surface }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.textSecondary }}>{stockRemaining} remaining</Text>
      </View>
    );
  }
  return null;
}

/**
 * Meal card — clean stacked layout.
 * `variant="big"` is a wide hero tile for the mixed grid; default is carousel card.
 * Long-press opens an action sheet with Add to Cart / Save / View Kitchen.
 * Hovering (web) auto-scrolls the photo gallery and gently zooms.
 * `width: null` makes the card fluid — it fills its container.
 */
export function MealCard({ meal, width = 200, variant = 'normal' }: { meal: Meal; width?: number | null; variant?: 'normal' | 'big' }) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [hovered, setHovered] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const showSwipeHint = useSwipeHint();

  const images = meal.images && meal.images.length ? meal.images : meal.image ? [meal.image] : [];
  const big = variant === 'big';
  const soldOut = meal.stockRemaining != null && meal.stockRemaining <= 0;
  const expiresAt = meal.expiresAt ?? null;
  const countdown = useCountdown(expiresAt);
  const displayBadge = countdown && expiresAt
    ? { label: countdown, color: urgencyColor(expiresAt), solid: true }
    : meal.badge
    ? { label: meal.badge.label, color: meal.badge.color, solid: false }
    : null;

  const imgHeight = big
    ? Math.min(280, Math.max(176, Math.floor(screenWidth * 0.5)))
    : 180;

  return (
    <>
      <PressableScale
        onPress={() => { if (soldOut) return; feedback.tap(); router.push(`/meal?id=${meal.id}`); }}
        onLongPress={() => { feedback.tap(); setSheetOpen(true); }}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        delayLongPress={380}
        accessibilityRole="button"
        style={width === null ? { width: '100%' } : { width }}
        accessibilityLabel={soldOut ? `${meal.title} — sold out` : `${meal.title} by ${meal.prepper}, $${meal.price.toFixed(2)}. Long press for options.`}>
        <View style={{ borderRadius: big ? 24 : 20, overflow: 'hidden', backgroundColor: Palette.surface, ...Shadow.card, opacity: soldOut ? 0.6 : 1 }}>
          {/* ── Image area ── */}
          <View style={{ position: 'relative' }}>
            <CardGallery images={images} hovered={hovered} height={imgHeight} />

            {/* Expiry / category badge — top left */}
            {displayBadge ? (
              <MotiView
                key={displayBadge.label}
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'timing', duration: 200 }}
                style={{ position: 'absolute', top: 10, left: 10, backgroundColor: displayBadge.solid ? displayBadge.color : '#fff', borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 4, flexDirection: 'row', alignItems: 'center' }}>
                {!displayBadge.solid ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: displayBadge.color, marginRight: 5 }} /> : null}
                <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: displayBadge.solid ? '#fff' : Palette.ink }}>{displayBadge.label}</Text>
              </MotiView>
            ) : null}

            {/* Pro badge — top right (behind fav button) */}
            {meal.isPro ? (
              <View style={{ position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Palette.amber, borderRadius: Radius.pill, paddingHorizontal: 7, paddingVertical: 3 }}>
                <Crown size={10} color="#fff" fill="#fff" />
                <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: '#fff' }}>pro</Text>
              </View>
            ) : (
              <View style={{ position: 'absolute', top: 8, right: 8 }}>
                <FavoriteButton id={`meal:${meal.id}`} />
              </View>
            )}

            {/* Hero overlay for big variant */}
            {big ? (
              <View style={{ position: 'absolute', bottom: 12, left: 14, right: 14 }}>
                <Text numberOfLines={2} style={{ fontFamily: Font.heading, fontSize: 17, color: '#fff', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8 }}>{meal.title}</Text>
                <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.92)', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 }}>by {meal.prepper}</Text>
              </View>
            ) : null}

            {/* Swipe hint — only on first render, normal cards only */}
            {!big && showSwipeHint ? (
              <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'timing', duration: 500, delay: 600 }}
                style={{ position: 'absolute', bottom: 10, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.38)', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontFamily: Font.medium, fontSize: 10.5, color: 'rgba(255,255,255,0.82)', letterSpacing: 0.2 }}>hold for options</Text>
              </MotiView>
            ) : null}
          </View>

          {/* ── Info area ── */}
          <View style={{ padding: 12, gap: 4 }}>
            {!big ? (
              <>
                {/* Title + price on same line */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <Text numberOfLines={2} style={{ flex: 1, fontFamily: Font.heading, fontSize: 15, color: Palette.ink, lineHeight: 20 }}>{meal.title}</Text>
                  <Text style={{ fontFamily: Font.display, fontSize: 17, color: Palette.brand, letterSpacing: -0.2, fontVariant: ['tabular-nums'], flexShrink: 0 }}>${meal.price.toFixed(2)}</Text>
                </View>
                {/* Daily stock badge */}
                <StockBadge stockRemaining={meal.stockRemaining} />
                {/* Rating + chef condensed */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Star size={12} color={Palette.amber} fill={Palette.amber} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.inkSoft }}>{meal.rating.toFixed(1)}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>· {meal.prepper}</Text>
                </View>
                {/* Availability chip */}
                {meal.availableDays && meal.availableDays.length > 0 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Calendar size={10} color={Palette.textSecondary} />
                    <Text style={{ fontFamily: Font.body, fontSize: 10, color: Palette.textSecondary }}>
                      {compressDays(meal.availableDays)}
                    </Text>
                  </View>
                ) : null}
                {/* Dietary badges — max 3 shown */}
                {meal.dietaryTags && meal.dietaryTags.length > 0 ? (() => {
                  const visible = meal.dietaryTags.slice(0, 3);
                  const extra = meal.dietaryTags.length - visible.length;
                  return (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                      {visible.map((tag) => <DietaryBadge key={tag} tag={tag} />)}
                      {extra > 0 ? (
                        <View style={{ backgroundColor: Palette.canvas, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, justifyContent: 'center' }}>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.textSecondary }}>+{extra} more</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })() : null}
                {/* Fulfillment indicator */}
                {(meal.delivers != null || meal.pickup != null) ? (
                  <View style={{ flexDirection: 'row', gap: 5, marginTop: 2 }}>
                    {meal.delivers ? (
                      <Text style={{ fontFamily: Font.body, fontSize: 10, color: Palette.textSecondary }}>🚗</Text>
                    ) : null}
                    {meal.pickup ? (
                      <Text style={{ fontFamily: Font.body, fontSize: 10, color: Palette.textSecondary }}>🏠</Text>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : null}

            {/* Price row for big variant */}
            {big ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Star size={12} color={Palette.amber} fill={Palette.amber} />
                <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.inkSoft }}>{meal.rating.toFixed(1)}</Text>
                <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 11.5, color: Palette.textSecondary }}>· {meal.time}</Text>
                <Text style={{ fontFamily: Font.display, fontSize: 14, color: Palette.brand, letterSpacing: -0.2, fontVariant: ['tabular-nums'] }}>${meal.price.toFixed(2)}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </PressableScale>

      <MealCardActionSheet meal={meal} visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
