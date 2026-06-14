import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { ComponentType } from 'react';
import {
  ChevronRight, Coffee, Gift, LayoutGrid, Leaf, Moon, Sparkles, Sprout, UtensilsCrossed, Zap,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useMySubscriptions } from '@/lib/queries/meal-plans';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const MUTED = Palette.textMuted;

const ONBOARDING_KEY = 'preppa_onboarded';

const HOME_CATS: {
  key: string; label: string;
  Icon: ComponentType<{ size?: number; color?: string }>; color: string;
}[] = [
  { key: 'breakfast', label: 'breakfast',  Icon: Coffee,         color: Palette.amber },
  { key: 'lunch',     label: 'lunch',      Icon: UtensilsCrossed, color: Palette.success },
  { key: 'dinner',    label: 'dinner',     Icon: Moon,           color: ORANGE },
  { key: 'healthy',   label: 'healthy',    Icon: Leaf,           color: '#22C55E' },
  { key: 'vegan',     label: 'vegan',      Icon: Sprout,         color: '#8B5CF6' },
  { key: 'more',      label: 'more',       Icon: LayoutGrid,     color: MUTED },
];

const ONBOARDING_STEPS = [
  {
    emoji: '👩‍🍳',
    color: ORANGE,
    title: 'browse local chefs',
    desc: 'Discover home chefs and meal preppers right in your neighborhood.',
  },
  {
    emoji: '🍱',
    color: Palette.amber,
    title: 'mix & match meals',
    desc: 'Build a custom plan from any kitchen — your macros, your pace.',
  },
  {
    emoji: '🚀',
    color: Palette.success,
    title: 'enjoy flexibly',
    desc: 'Pause, swap, or cancel anytime. No contracts, no commitments.',
  },
];

// ─── SectionHeader ────────────────────────────────────────────────────────────

export function SectionHeader({
  title, linkLabel, onLink,
}: { title: string; linkLabel?: string; onLink?: () => void }) {
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingVertical: 10 }}>
      {HOME_CATS.map((c, i) => (
        <MotiView key={c.key} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 200, delay: 50 + i * 50 }}>
          <PressableScale
            onPress={() => {
              feedback.tap();
              router.push(c.key === 'more' ? '/explore' : `/category?key=${c.key}&label=${c.label}`);
            }}
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
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: 200 }}>
      <PressableScale onPress={() => { feedback.tap(); router.push('/rewards'); }}
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
      <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 260, delay: 100 }}>
        <SectionHeader title="your plans" />
        <PressableScale onPress={() => { feedback.tap(); router.push('/meal-plans'); }}
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
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: 100 }}>
      <SectionHeader title="your plans" linkLabel="manage →"
        onLink={() => { feedback.tap(); router.push('/meal-plans'); }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 4 }}>
        {subs.map((sub, i) => {
          const nextDate = sub.next_billing_at
            ? new Date(sub.next_billing_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            : null;
          const isActive = sub.status === 'active';
          return (
            <MotiView key={sub.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
              <PressableScale onPress={() => { feedback.tap(); router.push('/meal-plans'); }}
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

// ─── SurpriseMeBanner ─────────────────────────────────────────────────────────

export function SurpriseMeBanner() {
  const router = useRouter();
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: 200 }}>
      <PressableScale onPress={() => { feedback.tap(); router.push('/surprise'); }}
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
    <MotiView from={{ opacity: 0, translateY: 18 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 15, stiffness: 120, mass: 0.6 }}
      style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.card }}>
      {/* Header: label + skip */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 2 }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 11.5, color: MUTED, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          preppa in 3 steps
        </Text>
        <PressableScale onPress={dismiss} accessibilityRole="button" accessibilityLabel="Dismiss onboarding"
          style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: MUTED }}>skip</Text>
        </PressableScale>
      </View>
      {/* Progress dots */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 10, paddingBottom: 2 }}>
        {ONBOARDING_STEPS.map((s, i) => (
          <MotiView key={i}
            animate={{ width: i === page ? 22 : 6, backgroundColor: i === page ? s.color : Palette.border }}
            transition={{ type: 'spring', damping: 18, stiffness: 200 }}
            style={{ height: 6, borderRadius: 3 }} />
        ))}
      </View>
      {/* Slide content */}
      <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / cardWidth))}
        scrollEventThrottle={16}>
        {ONBOARDING_STEPS.map((step, i) => (
          <View key={i} style={{ width: cardWidth, paddingHorizontal: 24, paddingVertical: 24, alignItems: 'center', gap: 14 }}>
            <View style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: step.color + '1C', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 36 }}>{step.emoji}</Text>
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 18, color: INK, letterSpacing: -0.4, textAlign: 'center' }}>
              {step.title}
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center', lineHeight: 20 }}>
              {step.desc}
            </Text>
          </View>
        ))}
      </ScrollView>
      {/* CTA */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 18, paddingTop: 8 }}>
        {page < ONBOARDING_STEPS.length - 1 ? (
          <PressableScale
            onPress={() => { feedback.tap(); scrollRef.current?.scrollTo({ x: (page + 1) * cardWidth, animated: true }); }}
            style={{ height: 46, borderRadius: Radius.pill, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 14.5, color: '#fff' }}>next →</Text>
          </PressableScale>
        ) : (
          <PressableScale onPress={dismiss}
            style={{ height: 46, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>let's explore 🚀</Text>
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
    <MotiView from={{ opacity: 0, translateY: 14 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 15, stiffness: 120, mass: 0.6, delay: 50 }}
      style={{ marginHorizontal: 20, marginTop: 16, flexDirection: 'row', gap: 10 }}>
      {/* Card A — Build Your Dream Meal Plan */}
      <PressableScale onPress={() => { feedback.tap(); router.push('/meal-plans'); }} style={{ flex: 1 }}>
        <LinearGradient colors={['#1c1108', '#3d2410']}
          style={{ borderRadius: Radius.lg, padding: 16, minHeight: 130, justifyContent: 'space-between' }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,180,60,0.22)', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} color={Palette.amber} />
          </View>
          <View style={{ gap: 5 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff', lineHeight: 20 }}>
              build your dream meal plan
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: 'rgba(255,255,255,0.5)', lineHeight: 15 }}>
              macros tracked · weekly drops
            </Text>
          </View>
        </LinearGradient>
      </PressableScale>
      {/* Card B — Order an Immediate Drop */}
      <PressableScale onPress={() => { feedback.tap(); router.push('/search'); }} style={{ flex: 1 }}>
        <LinearGradient colors={['#F26B1D', '#c43c0d']}
          style={{ borderRadius: Radius.lg, padding: 16, minHeight: 130, justifyContent: 'space-between' }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} color="#fff" />
          </View>
          <View style={{ gap: 5 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff', lineHeight: 20 }}>
              order an immediate drop
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 10.5, color: 'rgba(255,255,255,0.65)', lineHeight: 15 }}>
              what's hot · local kitchens now
            </Text>
          </View>
        </LinearGradient>
      </PressableScale>
    </MotiView>
  );
}
