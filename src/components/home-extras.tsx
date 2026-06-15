import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { ComponentType } from 'react';
import {
  CalendarCheck, ChefHat, ChevronRight, Coffee, Gift, LayoutGrid, Leaf, Moon, Sparkles, Sprout, Ticket, UtensilsCrossed, Zap,
} from 'lucide-react-native';
import { imgUrl } from '@/lib/img';
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
  title, linkLabel, onLink, Icon,
}: { title: string; linkLabel?: string; onLink?: () => void; Icon?: ComponentType<{ size?: number; color?: string }> }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 12, marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {Icon ? <Icon size={17} color={ORANGE} /> : null}
        <Text style={{ fontFamily: Font.display, fontSize: 17, color: INK, letterSpacing: -0.35 }}>{title}</Text>
      </View>
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
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
              <c.Icon size={22} color={c.color} />
            </View>
            <Text style={{ fontFamily: Font.medium, fontSize: 10.5, color: Palette.textSecondary }}>{c.label}</Text>
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
        <SectionHeader title="your plans" Icon={CalendarCheck} />
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
      <SectionHeader title="your plans" linkLabel="see all →" Icon={CalendarCheck}
        onLink={() => { feedback.tap(); router.push('/meal-plans'); }} />
      <View style={{ paddingHorizontal: 20, gap: 10 }}>
        {subs.slice(0, 3).map((sub, i) => {
          const isActive = sub.status === 'active';
          return (
            <MotiView key={sub.id} from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 220, delay: i * 50 }}>
              <PressableScale onPress={() => { feedback.tap(); router.push('/meal-plans'); }}
                accessibilityRole="button" accessibilityLabel={`${sub.plan_name} plan, ${sub.status}`}
                style={{ backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...Shadow.card }}>
                <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: Palette.success + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <CalendarCheck size={19} color={Palette.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK }}>{sub.plan_name}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 2 }}>
                    {[sub.prepper?.display_name, sub.frequency].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: isActive ? Palette.success : MUTED }}>
                    {isActive ? 'Active' : sub.status}
                  </Text>
                  <ChevronRight size={15} color={MUTED} />
                </View>
              </PressableScale>
            </MotiView>
          );
        })}
      </View>
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
            accessibilityRole="button" accessibilityLabel="Next step"
            style={{ height: 46, borderRadius: Radius.pill, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 14.5, color: '#fff' }}>next →</Text>
          </PressableScale>
        ) : (
          <PressableScale onPress={dismiss}
            accessibilityRole="button" accessibilityLabel="Start exploring"
            style={{ height: 46, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>let's explore 🚀</Text>
          </PressableScale>
        )}
      </View>
    </MotiView>
  );
}

// ─── ActionSplitter ───────────────────────────────────────────────────────────

export function ActionSplitter({ planImage, dropImage }: { planImage?: string; dropImage?: string }) {
  const router = useRouter();
  const ABS = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
  return (
    <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 15, stiffness: 120, mass: 0.6, delay: 50 }}
      style={{ marginHorizontal: 20, marginTop: 12, flexDirection: 'row', gap: 10 }}>
      {/* Card A — Build your weekly plan */}
      <PressableScale onPress={() => { feedback.tap(); router.push('/meal-plans'); }}
        accessibilityRole="button" accessibilityLabel="Build your weekly plan"
        style={{ flex: 1 }}>
        <View style={{ borderRadius: Radius.lg, height: 100, overflow: 'hidden' }}>
          <LinearGradient colors={['#1c1108', '#3d2410']} style={ABS} />
          {planImage ? (
            <Image source={imgUrl(planImage, 400)}
              style={{ position: 'absolute', right: -8, top: 0, bottom: 0, width: '60%', opacity: 0.38 }}
              contentFit="cover" />
          ) : null}
          <LinearGradient colors={['#1c1108e6', '#1c110800']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ABS} />
          <View style={{ flex: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,180,60,0.22)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CalendarCheck size={16} color={Palette.amber} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13, color: '#fff', lineHeight: 18 }}>
                Build weekly plan
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                Custom meals • Save time
              </Text>
            </View>
          </View>
        </View>
      </PressableScale>
      {/* Card B — Order an immediate drop */}
      <PressableScale onPress={() => { feedback.tap(); router.push('/search'); }}
        accessibilityRole="button" accessibilityLabel="Order an immediate drop"
        style={{ flex: 1 }}>
        <View style={{ borderRadius: Radius.lg, height: 100, overflow: 'hidden' }}>
          <LinearGradient colors={['#F26B1D', '#c43c0d']} style={ABS} />
          {dropImage ? (
            <Image source={imgUrl(dropImage, 400)}
              style={{ position: 'absolute', right: -8, top: 0, bottom: 0, width: '60%', opacity: 0.38 }}
              contentFit="cover" />
          ) : null}
          <LinearGradient colors={['#F26B1De6', '#F26B1D00']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={ABS} />
          <View style={{ flex: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13, color: '#fff', lineHeight: 18 }}>
                Order now
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                What's hot • Local kitchens
              </Text>
            </View>
          </View>
        </View>
      </PressableScale>
    </MotiView>
  );
}

// ─── ExperiencesBar ───────────────────────────────────────────────────────────

const EXP_TYPES: { key: string; label: string; Icon: React.ComponentType<{ size?: number; color?: string }>; color: string }[] = [
  { key: 'private-chef', label: 'Private Chef', Icon: ChefHat,         color: '#7C3AED' },
  { key: 'cook-at-home', label: 'Cook at Mine', Icon: UtensilsCrossed, color: ORANGE    },
  { key: 'class',        label: 'Classes',      Icon: Zap,             color: '#22C55E' },
  { key: 'catering',     label: 'Catering',     Icon: CalendarCheck,   color: '#D97706' },
];

export function ExperiencesBar() {
  const router = useRouter();
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260, delay: 80 }}>
      <SectionHeader title="experiences" Icon={Ticket} linkLabel="see all →"
        onLink={() => { feedback.tap(); router.push('/experiences' as never); }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 4 }}>
        {EXP_TYPES.map((exp, i) => (
          <MotiView key={exp.key} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 200, delay: 60 + i * 45 }}>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/experiences' as never); }}
              accessibilityRole="button" accessibilityLabel={`Browse ${exp.label} experiences`}
              style={{ alignItems: 'center', gap: 6 }}>
              <View style={{ width: 60, height: 60, borderRadius: 18, backgroundColor: exp.color + '18', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: exp.color + '28' }}>
                <exp.Icon size={24} color={exp.color} />
              </View>
              <Text style={{ fontFamily: Font.medium, fontSize: 10.5, color: Palette.textSecondary, textAlign: 'center', maxWidth: 60 }}>{exp.label}</Text>
            </PressableScale>
          </MotiView>
        ))}
      </ScrollView>
    </MotiView>
  );
}
