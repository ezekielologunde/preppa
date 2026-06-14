import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { ComponentType } from 'react';
import {
  ChevronRight, Coffee, Gift, LayoutGrid, Leaf, MapPin,
  Moon, Play, Sparkles, Sprout, Star, UtensilsCrossed, Zap,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import type { Meal } from '@/components/meal-card';
import { MealCard } from '@/components/meal-card';
import { PrepperCard } from '@/components/prepper-card';
import { CardRowSkeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { imgUrl } from '@/lib/img';
import { useCarouselCardWidth, useContentWidth, usePagePadding, gridCardWidth } from '@/lib/layout';
import { useMealPlans, useMySubscriptions } from '@/lib/queries/meal-plans';
import { useFollowedPreppers, useTopPreppers } from '@/lib/queries/preppers';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const MUTED = Palette.textMuted;
const ACID = '#d8ff3e';
const ABS = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
const ONBOARDING_KEY = 'preppa_onboarded';

const HOME_CATS: { key: string; label: string; Icon: ComponentType<{ size?: number; color?: string }>; color: string }[] = [
  { key: 'breakfast', label: 'breakfast', Icon: Coffee, color: Palette.amber },
  { key: 'lunch', label: 'lunch', Icon: UtensilsCrossed, color: Palette.success },
  { key: 'dinner', label: 'dinner', Icon: Moon, color: ORANGE },
  { key: 'healthy', label: 'healthy', Icon: Leaf, color: '#22C55E' },
  { key: 'vegan', label: 'vegan', Icon: Sprout, color: '#8B5CF6' },
  { key: 'more', label: 'more', Icon: LayoutGrid, color: MUTED },
];

const ONBOARDING_STEPS = [
  { Icon: MapPin, color: ORANGE, title: 'local kitchens, nearby', desc: 'Discover home chefs and meal preppers within miles of you.' },
  { Icon: UtensilsCrossed, color: Palette.amber, title: 'drops or weekly plans', desc: 'Order single meals or subscribe to recurring prep — your pace.' },
  { Icon: Sparkles, color: Palette.success, title: 'fresh, real food', desc: 'Restaurant quality without the markup. Delivered or pickup.' },
];

const CHEF_PALETTES: [string, string][] = [
  ['#1a0a00', '#5c2a0f'],
  ['#0d1a1a', '#0f4040'],
  ['#1a1020', '#3d1a50'],
  ['#0d1a0d', '#1a4020'],
  ['#1a0d00', '#4a2800'],
  ['#0d0d1a', '#1a1a4a'],
];

// ─── SectionHeader ────────────────────────────────────────────────────────────

export function SectionHeader({ title, linkLabel, onLink }: { title: string; linkLabel?: string; onLink?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 8, marginBottom: 10 }}>
      <Text style={{ fontFamily: Font.display, fontSize: 18, color: INK, letterSpacing: -0.4 }}>{title}</Text>
      {onLink ? (
        <PressableScale onPress={onLink} accessibilityRole="button" accessibilityLabel={linkLabel ?? 'See all'}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>{linkLabel ?? 'see all'}</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

// ─── CategoryIconsRow ─────────────────────────────────────────────────────────

export function CategoryIconsRow() {
  const router = useRouter();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingVertical: 10 }}>
      {HOME_CATS.map((c, i) => (
        <MotiView key={c.key} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200, delay: 50 + i * 50 }}>
          <PressableScale
            onPress={() => { feedback.tap(); router.push(c.key === 'more' ? '/explore' : `/category?key=${c.key}&label=${c.label}`); }}
            accessibilityRole="button" accessibilityLabel={`Browse ${c.label}`}
            style={{ alignItems: 'center', gap: 6 }}>
            <View style={{ width: 60, height: 60, borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
              <c.Icon size={26} color={c.color} />
            </View>
            <Text style={{ fontFamily: Font.medium, fontSize: 11, color: Palette.textSecondary }}>{c.label}</Text>
          </PressableScale>
        </MotiView>
      ))}
    </ScrollView>
  );
}

// ─── RewardsBanner ────────────────────────────────────────────────────────────

export function RewardsBanner() {
  const router = useRouter();
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 200 }}>
      <PressableScale
        onPress={() => { feedback.tap(); router.push('/rewards'); }}
        accessibilityRole="button" accessibilityLabel="View your rewards"
        style={{ marginHorizontal: 20, backgroundColor: '#EDFBF1', borderRadius: Radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#C6F0D4' }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: Palette.success, alignItems: 'center', justifyContent: 'center' }}>
          <Gift size={19} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>earn rewards on every preorder</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 2 }}>unlock discounts & free meals</Text>
        </View>
        <ChevronRight size={16} color={Palette.success} />
      </PressableScale>
    </MotiView>
  );
}

// ─── MyPlansSection ───────────────────────────────────────────────────────────

export function MyPlansSection({ userId }: { userId: string }) {
  const router = useRouter();
  const { data: subs } = useMySubscriptions(userId);

  if (!subs?.length) {
    return (
      <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
        <SectionHeader title="your plans" />
        <PressableScale
          onPress={() => { feedback.tap(); router.push('/meal-plans'); }}
          accessibilityRole="button" accessibilityLabel="Subscribe to a weekly meal plan"
          style={{ marginHorizontal: 20, backgroundColor: Palette.brandTint, borderRadius: Radius.lg, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK }}>subscribe to a weekly plan</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary }}>real meals, on repeat — no hassle</Text>
          </View>
          <ChevronRight size={16} color={ORANGE} />
        </PressableScale>
      </MotiView>
    );
  }

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
      <SectionHeader title="your plans" linkLabel="manage →" onLink={() => { feedback.tap(); router.push('/meal-plans'); }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
        {subs.map((sub, i) => {
          const nextDate = sub.next_billing_at ? new Date(sub.next_billing_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
          const isActive = sub.status === 'active';
          return (
            <MotiView key={sub.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
              <PressableScale
                onPress={() => { feedback.tap(); router.push('/meal-plans'); }}
                accessibilityRole="button" accessibilityLabel={`${sub.plan_name} plan, ${sub.status}`}
                style={{ width: 200, backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 14, gap: 6, ...Shadow.card }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 14, color: INK, flex: 1 }}>{sub.plan_name}</Text>
                  <View style={{ backgroundColor: isActive ? Palette.success + '22' : Palette.surface, borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: isActive ? Palette.success : MUTED }}>{sub.status}</Text>
                  </View>
                </View>
                <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 12, color: MUTED }}>{sub.prepper?.display_name ?? 'kitchen'}</Text>
                {nextDate ? <Text style={{ fontFamily: Font.medium, fontSize: 12, color: Palette.textSecondary }}>next: {nextDate}</Text> : null}
              </PressableScale>
            </MotiView>
          );
        })}
      </ScrollView>
    </MotiView>
  );
}

// ─── FollowingKitchensSection ─────────────────────────────────────────────────

export function FollowingKitchensSection({ userId }: { userId: string }) {
  const router = useRouter();
  const { data: preppers } = useFollowedPreppers(userId);
  if (!preppers?.length) return null;
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
      <SectionHeader title="kitchens you follow" linkLabel="see all →" onLink={() => { feedback.tap(); router.push('/following'); }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
        {preppers.map((prepper, i) => (
          <MotiView key={prepper.id} from={{ opacity: 0, translateX: 10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
            <PrepperCard prepper={prepper} />
          </MotiView>
        ))}
      </ScrollView>
    </MotiView>
  );
}

// ─── NearbyPreppersSection ────────────────────────────────────────────────────

export function NearbyPreppersSection() {
  const router = useRouter();
  const { data: preppers, isLoading } = useTopPreppers(8);
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 100 }}>
      <SectionHeader title="local kitchens near you" linkLabel="see all →" onLink={() => { feedback.tap(); router.push('/explore'); }} />
      {isLoading ? <CardRowSkeleton count={3} /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
          {(preppers ?? []).map((prepper, i) => (
            <MotiView key={prepper.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
              <PrepperCard prepper={prepper} showRank />
            </MotiView>
          ))}
        </ScrollView>
      )}
    </MotiView>
  );
}

// ─── TrendingSection ──────────────────────────────────────────────────────────

export function TrendingSection({ meals, isLoading, isTablet }: { meals: Meal[] | undefined; isLoading: boolean; isTablet: boolean }) {
  const router = useRouter();
  const contentWidth = useContentWidth();
  const pad = usePagePadding();
  const carouselCardWidth = useCarouselCardWidth();
  const list = meals ?? [];
  const [hero, ...rest] = list;

  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 150 }}>
      <SectionHeader title="trending near you" linkLabel="see all →" onLink={() => { feedback.tap(); router.push('/search'); }} />
      {isLoading ? <CardRowSkeleton count={3} /> : isTablet ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: pad, paddingBottom: 4 }}>
          {list.map((m, i) => (
            <MotiView key={m.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200, delay: i * 50 }}>
              <MealCard meal={m} width={gridCardWidth(contentWidth, pad)} />
            </MotiView>
          ))}
        </View>
      ) : (
        <>
          {hero ? (
            <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }} style={{ paddingHorizontal: 20, marginBottom: 12 }}>
              <MealCard meal={hero} width={null} variant="big" />
            </MotiView>
          ) : null}
          {rest.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
              {rest.map((m, i) => (
                <MotiView key={m.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
                  <MealCard meal={m} width={carouselCardWidth} />
                </MotiView>
              ))}
            </ScrollView>
          ) : null}
        </>
      )}
    </MotiView>
  );
}

// ─── MealPlansDiscoverySection ────────────────────────────────────────────────

export function MealPlansDiscoverySection() {
  const router = useRouter();
  const { data: plans, isLoading } = useMealPlans();
  if (!isLoading && (!plans || plans.length === 0)) return null;
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 150 }}>
      <SectionHeader title="meal plans" linkLabel="explore →" onLink={() => { feedback.tap(); router.push('/meal-plans'); }} />
      {isLoading ? <CardRowSkeleton count={3} /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
          {(plans ?? []).map((plan, i) => (
            <MotiView key={plan.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
              <PressableScale
                onPress={() => { feedback.tap(); router.push('/meal-plans'); }}
                accessibilityRole="button" accessibilityLabel={`${plan.name} by ${plan.prepper}, $${plan.price} per week`}
                style={{ width: 190, backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
                <View style={{ height: 100, backgroundColor: Palette.brandTint }}>
                  {plan.image_url ? (
                    <Image source={{ uri: plan.image_url }} style={{ flex: 1 }} contentFit="cover" transition={200} />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <UtensilsCrossed size={32} color={ORANGE} />
                    </View>
                  )}
                </View>
                <View style={{ padding: 12, gap: 4 }}>
                  <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>{plan.name}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 12, color: MUTED }}>{plan.prepper}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>${plan.price.toFixed(0)}/wk</Text>
                    {plan.tags?.length ? (
                      <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 11, color: MUTED, flex: 1, textAlign: 'right' }}>{plan.tags[0]}</Text>
                    ) : null}
                  </View>
                </View>
              </PressableScale>
            </MotiView>
          ))}
        </ScrollView>
      )}
    </MotiView>
  );
}

// ─── SurpriseMeBanner ─────────────────────────────────────────────────────────

export function SurpriseMeBanner() {
  const router = useRouter();
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 200 }}>
      <PressableScale
        onPress={() => { feedback.tap(); router.push('/surprise'); }}
        accessibilityRole="button" accessibilityLabel="Chef surprise me — let us pick the perfect meal"
        style={{ marginHorizontal: 20 }}>
        <LinearGradient colors={['#FEF0E8', '#FDDFC8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ borderRadius: Radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', minHeight: 116 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 19, color: INK, letterSpacing: -0.5 }}>chef surprise me</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: '#7A5A45', marginTop: 5, lineHeight: 18 }}>
              tell us your mood,{'\n'}we'll pick the perfect meal
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, backgroundColor: INK, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start' }}>
              <Sparkles size={13} color="#fff" />
              <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: '#fff' }}>surprise me</Text>
            </View>
          </View>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}>
            <UtensilsCrossed size={36} color={ORANGE} />
          </View>
        </LinearGradient>
      </PressableScale>
    </MotiView>
  );
}

// ─── HomeOnboarding ───────────────────────────────────────────────────────────

export function HomeOnboarding() {
  const { width } = useWindowDimensions();
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const cardWidth = width - 40;

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((v) => setDismissed(v !== null));
  }, []);

  function dismiss() {
    feedback.success();
    AsyncStorage.setItem(ONBOARDING_KEY, '1');
    setDismissed(true);
  }

  if (dismissed !== false) return null;

  return (
    <MotiView from={{ opacity: 0, translateY: 16 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 15, stiffness: 120, mass: 0.6 }}
      style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 14, paddingBottom: 2 }}>
        {ONBOARDING_STEPS.map((_, i) => (
          <MotiView key={i}
            animate={{ width: i === page ? 20 : 6, backgroundColor: i === page ? Palette.brand : Palette.border }}
            transition={{ type: 'spring', damping: 18, stiffness: 200 }}
            style={{ height: 6, borderRadius: 3 }} />
        ))}
      </View>
      <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / cardWidth))}
        scrollEventThrottle={16}>
        {ONBOARDING_STEPS.map((step, i) => (
          <View key={i} style={{ width: cardWidth, padding: 22, alignItems: 'center', gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: step.color + '1A', alignItems: 'center', justifyContent: 'center' }}>
              <step.Icon size={28} color={step.color} />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 17, color: INK, letterSpacing: -0.3, textAlign: 'center' }}>{step.title}</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 }}>{step.desc}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingBottom: 18, paddingTop: 4, flexDirection: 'row', gap: 10 }}>
        {page < ONBOARDING_STEPS.length - 1 ? (
          <>
            <PressableScale onPress={dismiss}
              style={{ flex: 1, height: 44, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.textSecondary }}>skip</Text>
            </PressableScale>
            <PressableScale onPress={() => { feedback.tap(); scrollRef.current?.scrollTo({ x: (page + 1) * cardWidth, animated: true }); }}
              style={{ flex: 2, height: 44, borderRadius: Radius.pill, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>next →</Text>
            </PressableScale>
          </>
        ) : (
          <PressableScale onPress={dismiss}
            style={{ flex: 1, height: 44, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>let's explore</Text>
          </PressableScale>
        )}
      </View>
    </MotiView>
  );
}

// ─── ActionSplitter ───────────────────────────────────────────────────────────

export function ActionSplitter() {
  const router = useRouter();
  return (
    <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 15, stiffness: 120, mass: 0.6, delay: 50 }}
      style={{ marginHorizontal: 20, marginTop: 16, flexDirection: 'row', gap: 10 }}>
      <PressableScale onPress={() => { feedback.tap(); router.push('/meal-plans'); }} style={{ flex: 1 }}>
        <LinearGradient colors={['#1c1108', '#3d2410']}
          style={{ borderRadius: Radius.lg, padding: 16, minHeight: 116, justifyContent: 'space-between' }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,180,60,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} color={Palette.amber} />
          </View>
          <View style={{ gap: 3 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: '#fff' }}>plan your meals</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>weekly subscriptions</Text>
          </View>
        </LinearGradient>
      </PressableScale>
      <PressableScale onPress={() => { feedback.tap(); router.push('/search'); }} style={{ flex: 1 }}>
        <LinearGradient colors={['#F26B1D', '#c43c0d']}
          style={{ borderRadius: Radius.lg, padding: 16, minHeight: 116, justifyContent: 'space-between' }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} color="#fff" />
          </View>
          <View style={{ gap: 3 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: '#fff' }}>order a drop</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>browse individual meals</Text>
          </View>
        </LinearGradient>
      </PressableScale>
    </MotiView>
  );
}

// ─── ChefsInActionFeed ────────────────────────────────────────────────────────

export function ChefsInActionFeed() {
  const router = useRouter();
  const { data: preppers, isLoading } = useTopPreppers(6);
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 15, stiffness: 120, mass: 0.6, delay: 100 }}
      style={{ marginTop: 24 }}>
      <SectionHeader title="chefs in action" linkLabel="see all →" onLink={() => { feedback.tap(); router.push('/explore'); }} />
      {isLoading ? <CardRowSkeleton count={4} /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 4 }}>
          {(preppers ?? []).map((prepper, i) => {
            const palette = CHEF_PALETTES[i % CHEF_PALETTES.length];
            return (
              <MotiView key={prepper.id} from={{ opacity: 0, translateX: 16 }} animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'spring', damping: 15, stiffness: 120, mass: 0.6, delay: i * 50 }}>
                <PressableScale
                  onPress={() => { feedback.tap(); router.push(`/prepper?id=${prepper.id}`); }}
                  accessibilityRole="button" accessibilityLabel={`${prepper.name}, chef profile`}
                  style={{ width: 130, height: 210, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
                  {prepper.image ? (
                    <Image source={{ uri: imgUrl(prepper.image, 400) }} style={ABS} contentFit="cover" />
                  ) : (
                    <LinearGradient colors={palette} style={ABS} />
                  )}
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.78)']} style={{ ...ABS, justifyContent: 'flex-end', padding: 10 }}>
                    <View style={{ ...ABS, alignItems: 'center', justifyContent: 'center' }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                        <Play size={18} color="#fff" fill="#fff" />
                      </View>
                    </View>
                    <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 13, color: '#fff' }}>{prepper.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <Star size={11} color="#FFD24A" fill="#FFD24A" />
                      <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                        {prepper.rating > 0 ? prepper.rating.toFixed(1) : 'new'}
                      </Text>
                    </View>
                  </LinearGradient>
                  {prepper.reviews === 0 ? (
                    <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: ACID, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 9.5, color: '#1a1a0a', letterSpacing: 0.5 }}>NEW</Text>
                    </View>
                  ) : null}
                </PressableScale>
              </MotiView>
            );
          })}
        </ScrollView>
      )}
    </MotiView>
  );
}
