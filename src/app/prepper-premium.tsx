import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  BarChart2, Check, CheckCircle2, ChevronLeft, Crown, Flame, Lock, Search, Sparkles, Star, TrendingUp, Users, Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrepperPlanComparison } from '@/components/prepper-plan-comparison';
import { PaymentRedirectOverlay } from '@/components/payment-redirect-overlay';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { usePrepperMembership } from '@/lib/queries/memberships';
import { supabase } from '@/lib/supabase';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const CARD   = '#FFFFFF';
const BG     = '#F8F6F3';
const INK    = '#1A1714';
const MUTED  = '#78716C';
const BORDER = '#EDE9E4';

// ─── Pricing ────────────────────────────────────────────────────────────────
const PRO_MONTHLY = 29;
const ELITE_MONTHLY = 79;
const ANNUAL_DISCOUNT = 0.2;

function annualMonthly(base: number) { return Math.round(base * (1 - ANNUAL_DISCOUNT)); }
function annualTotal(base: number)   { return annualMonthly(base) * 12; }

// ─── Plan definitions ────────────────────────────────────────────────────────
type PlanId = 'starter' | 'pro' | 'elite';
type Plan = {
  id: PlanId;
  name: string;
  basePrice: number;
  badge?: string;
  stripeType?: string;
  features: string[];
  ctaLabel: string;
  highlighted: boolean;
};

const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    basePrice: 0,
    features: ['List up to 5 meals', 'Basic analytics', 'Standard discovery'],
    ctaLabel: 'Current plan',
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    basePrice: PRO_MONTHLY,
    badge: 'Most popular',
    stripeType: 'prepper_pro',
    features: ['Unlimited meals', 'Go Live streaming', 'Rush-hour specials', 'Priority in search', 'Full analytics dashboard', 'Custom meal plans'],
    ctaLabel: 'Upgrade to Pro',
    highlighted: true,
  },
  {
    id: 'elite',
    name: 'Elite',
    basePrice: ELITE_MONTHLY,
    badge: 'Top preppers',
    stripeType: 'prepper_elite',
    features: ['Everything in Pro', 'Verified badge on profile', 'Featured on home page', 'Dedicated account manager', 'Early access to new features'],
    ctaLabel: 'Upgrade to Elite',
    highlighted: false,
  },
];

// ─── Social proof ────────────────────────────────────────────────────────────
type StatPill = { value: string; label: string };
const PROOF_STATS: StatPill[] = [
  { value: '3.4×', label: 'more monthly revenue' },
  { value: '2.1×', label: 'more repeat buyers' },
  { value: '47%', label: 'faster to 1st 10 orders' },
];

const TESTIMONIALS = [
  { quote: "Switched to Pro in January. By March I was making double.", name: 'Amara O.', city: 'Atlanta' },
  { quote: "The analytics alone are worth it — I finally know which meals to push on weekends.", name: 'Kwame T.', city: 'Houston' },
  { quote: "Boosted visibility got me my first 20 customers in two weeks.", name: 'Blessing A.', city: 'Chicago' },
];

// ─── Sub-components ──────────────────────────────────────────────────────────
type ProFeature = { Icon: LucideIcon; label: string; sub: string };
const PRO_FEATURES: ProFeature[] = [
  { Icon: TrendingUp, label: 'Boosted visibility', sub: 'Appear first in local search' },
  { Icon: BarChart2, label: 'Analytics dashboard', sub: 'Sales, views & conversion data' },
  { Icon: Flame, label: 'Livestream tools', sub: 'Cook live, sell in real time' },
  { Icon: Star, label: 'Priority listing', sub: 'Homepage & featured feed placement' },
  { Icon: Zap, label: 'AI captions', sub: 'Auto-generate meal descriptions' },
  { Icon: Users, label: 'Customer insights', sub: 'Preorder patterns & repeat buyers' },
  { Icon: Lock, label: 'Advanced scheduling', sub: 'Calendar & fulfillment-day management' },
  { Icon: Sparkles, label: 'Custom storefront', sub: 'Your own branded kitchen page' },
  { Icon: Search, label: 'Promoted meals', sub: 'Boost meals to the top of search' },
];

function AnimatedStat({ value, label, delay }: StatPill & { delay: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 340, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 340, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, opacity, translateY]);
  return (
    <Animated.View style={{ flex: 1, alignItems: 'center', opacity, transform: [{ translateY }] }}>
      <Text style={{ fontFamily: Font.display, fontSize: 28, color: ORANGE, letterSpacing: -0.8, lineHeight: 32 }}>{value}</Text>
      <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: MUTED, textAlign: 'center', marginTop: 3, lineHeight: 15 }}>{label}</Text>
    </Animated.View>
  );
}

function SocialProofBlock() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % TESTIMONIALS.length), 4200);
    return () => clearInterval(id);
  }, []);
  const t = TESTIMONIALS[idx];
  return (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300, delay: 100 }}>
      <View style={{ backgroundColor: CARD, borderRadius: Radius.lg, padding: 18, gap: 18, borderWidth: 1, borderColor: ORANGE + '18' }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {PROOF_STATS.map((s, i) => (
            <View key={s.label} style={{ flex: 1, alignItems: 'center', backgroundColor: ORANGE + '12', borderRadius: Radius.md, paddingVertical: 12, paddingHorizontal: 6 }}>
              <AnimatedStat value={s.value} label={s.label} delay={160 + i * 90} />
            </View>
          ))}
        </View>
        <MotiView key={idx} from={{ opacity: 0, translateY: 4 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320 }} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {[0, 1, 2, 3, 4].map((s) => <Star key={s} size={11} color={ORANGE} fill={ORANGE} />)}
          </View>
          <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: '#44403C', lineHeight: 20, fontStyle: 'italic' }}>"{t?.quote}"</Text>
          <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: MUTED }}>— {t?.name}, {t?.city}</Text>
        </MotiView>
        <View style={{ flexDirection: 'row', gap: 6, alignSelf: 'center' }}>
          {TESTIMONIALS.map((_, i) => (
            <MotiView key={i} animate={{ backgroundColor: i === idx ? ORANGE : ORANGE + '38', width: i === idx ? 16 : 6 }} transition={{ type: 'timing', duration: 220 }} style={{ height: 6, borderRadius: 3 }} />
          ))}
        </View>
      </View>
    </MotiView>
  );
}

function FeatureRow({ item, i }: { item: ProFeature; i: number }) {
  return (
    <MotiView from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 240, delay: 240 + i * 35 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: BORDER }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: ORANGE + '1A', alignItems: 'center', justifyContent: 'center' }}>
          <item.Icon size={17} color={ORANGE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>{item.label}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 1 }}>{item.sub}</Text>
        </View>
        <Check size={16} color={ORANGE} strokeWidth={3} />
      </View>
    </MotiView>
  );
}

// ─── Plan card ───────────────────────────────────────────────────────────────
function PlanCard({
  plan, yearly, isCurrent, isDowngrade, onUpgrade, loading,
}: {
  plan: Plan;
  yearly: boolean;
  isCurrent: boolean;
  isDowngrade: boolean;
  onUpgrade: (plan: Plan) => void;
  loading: boolean;
}) {
  const isStarter = plan.id === 'starter';
  const monthlyPrice = yearly && !isStarter ? annualMonthly(plan.basePrice) : plan.basePrice;
  const originalPrice = plan.basePrice;
  const showSavings = yearly && !isStarter;

  return (
    <View style={{
      backgroundColor: CARD,
      borderRadius: 20,
      padding: 20,
      borderWidth: plan.highlighted ? 2 : 1,
      borderColor: plan.highlighted ? ORANGE : BORDER,
      gap: 14,
    }}>
      {/* Badge */}
      {plan.badge && (
        <View style={{ position: 'absolute', top: 14, right: 14, backgroundColor: plan.highlighted ? ORANGE : '#F0EDEA', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: plan.highlighted ? '#fff' : INK }}>{plan.badge}</Text>
        </View>
      )}

      {/* Name + price */}
      <View style={{ gap: 4 }}>
        <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5 }}>{plan.name}</Text>
        {isStarter ? (
          <Text style={{ fontFamily: Font.display, fontSize: 28, color: INK, letterSpacing: -0.8 }}>Free</Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
            {showSavings && (
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: MUTED, textDecorationLine: 'line-through', marginBottom: 2 }}>
                ${originalPrice}
              </Text>
            )}
            <Text style={{ fontFamily: Font.display, fontSize: 36, color: INK, letterSpacing: -1 }}>${monthlyPrice}</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: MUTED, marginBottom: 6 }}>/mo</Text>
          </View>
        )}
        {showSavings && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ backgroundColor: Palette.success + '22', borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.success }}>Save 20% · billed ${annualTotal(plan.basePrice)}/yr</Text>
            </View>
          </View>
        )}
      </View>

      {/* Feature list */}
      <View style={{ gap: 8 }}>
        {plan.features.map((f) => (
          <View key={f} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Check size={14} color={Palette.success} strokeWidth={2.5} style={{ marginTop: 2 }} />
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: '#44403C', flex: 1, lineHeight: 19 }}>{f}</Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <PressableScale
        onPress={() => !isCurrent && !isDowngrade && onUpgrade(plan)}
        disabled={isCurrent || isDowngrade || loading}
        accessibilityRole="button"
        accessibilityLabel={isCurrent ? `Current plan: ${plan.name}` : plan.ctaLabel}
        style={{
          height: 48,
          borderRadius: Radius.pill,
          backgroundColor: isCurrent || isDowngrade ? 'transparent' : (plan.highlighted ? ORANGE : ORANGE + '30'),
          borderWidth: isCurrent || isDowngrade ? 1 : 0,
          borderColor: BORDER,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: loading ? 0.7 : 1,
        }}>
        <Text style={{
          fontFamily: Font.heading,
          fontSize: 14,
          color: isCurrent ? MUTED : (isDowngrade ? MUTED : '#fff'),
        }}>
          {isCurrent ? 'Current plan' : (isDowngrade ? 'Included in your plan' : plan.ctaLabel)}
        </Text>
      </PressableScale>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function PrepperPremiumScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: myPrepper } = useMyPrepperApplication(user?.id);
  const { data: membership } = usePrepperMembership(myPrepper?.id);

  const currentTier = (membership?.tier as PlanId | undefined) ?? (membership?.isPro ? 'pro' : 'starter');
  const isAlreadyPro = currentTier === 'pro';
  const isAlreadyElite = currentTier === 'elite';

  const [yearly, setYearly] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleUpgrade(plan: Plan) {
    if (!user) { router.push('/auth?mode=signup'); return; }
    if (!myPrepper?.id || loading || !plan.stripeType) return;
    feedback.impact();

    Alert.alert(
      `Upgrade to ${plan.name}`,
      `You'll be charged $${yearly ? annualMonthly(plan.basePrice) : plan.basePrice}/mo${yearly ? ` (billed $${annualTotal(plan.basePrice)}/yr)` : ''}. Confirm upgrade?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              const { data, error } = await supabase.functions.invoke('stripe-subscribe', {
                body: { type: plan.stripeType, period: yearly ? 'yearly' : 'monthly', prepperId: myPrepper.id },
              });
              if (error || !data?.url) throw new Error(error?.message ?? 'Checkout failed');
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.location.href = data.url;
              } else {
                await WebBrowser.openBrowserAsync(data.url);
              }
            } catch {
              feedback.error();
              Alert.alert('Upgrade failed', "Couldn't complete upgrade. Contact support.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  // Already on highest tier
  if (isAlreadyElite) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
            <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) router.back(); else router.replace('/dashboard' as never); }} accessibilityRole="button" accessibilityLabel="Go back"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={22} color={INK} />
            </PressableScale>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5 }}>membership</Text>
          </View>
          <MotiView from={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 18, stiffness: 200 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36, gap: 16 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Crown size={44} color={ORANGE} />
            </View>
            <Text style={{ fontFamily: Font.display, fontSize: 26, color: INK, letterSpacing: -0.6, textAlign: 'center' }}>
              you're on Elite
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14.5, color: MUTED, textAlign: 'center', lineHeight: 22 }}>
              All Elite features are active. You're at the top.
            </Text>
            <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) router.back(); else router.replace('/dashboard' as never); }} accessibilityRole="button" accessibilityLabel="Back to hub"
              style={{ marginTop: 8, height: 52, paddingHorizontal: 32, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>back to hub</Text>
            </PressableScale>
          </MotiView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) router.back(); else router.replace('/dashboard'); }} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.5 }}>upgrade</Text>
          <View style={{ marginLeft: 'auto', backgroundColor: ORANGE + '24', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Crown size={13} color={ORANGE} />
            <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: ORANGE }}>{isAlreadyPro ? 'Pro' : 'Free'}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 40 }}>
          {/* Hero */}
          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
            <LinearGradient colors={['#FF9A5A', '#E8611A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, padding: 24, gap: 12 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 28, color: '#fff', letterSpacing: -0.8 }}>Preppa Pro & Elite</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 22 }}>
                Earn more. Cook smarter. Grow faster.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {(['3.4× revenue', '2.1× repeat buyers', '1 tap analytics'] as const).map((stat) => (
                  <View key={stat} style={{ backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#fff' }}>{stat}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </MotiView>

          {/* Billing toggle */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
            <View style={{ flexDirection: 'row', backgroundColor: '#EDE9E4', borderRadius: Radius.md, padding: 4, gap: 4 }}>
              <MotiView animate={{ backgroundColor: !yearly ? ORANGE : '#FFFFFF' }} transition={{ type: 'timing', duration: 200 }} style={{ flex: 1, borderRadius: Radius.sm, overflow: 'hidden' }}>
                <PressableScale onPress={() => { feedback.tap(); setYearly(false); }} accessibilityRole="button" accessibilityLabel="Monthly billing" accessibilityState={{ selected: !yearly }}
                  style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: !yearly ? '#fff' : MUTED }}>Monthly</Text>
                </PressableScale>
              </MotiView>
              <MotiView animate={{ backgroundColor: yearly ? ORANGE : '#FFFFFF' }} transition={{ type: 'timing', duration: 200 }} style={{ flex: 1, borderRadius: Radius.sm, overflow: 'hidden' }}>
                <PressableScale onPress={() => { feedback.tap(); setYearly(true); }} accessibilityRole="button" accessibilityLabel="Annual billing, save 20%" accessibilityState={{ selected: yearly }}
                  style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: yearly ? '#fff' : MUTED }}>Annual</Text>
                  {!yearly && (
                    <View style={{ backgroundColor: Palette.success, borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: '#fff' }}>save 20%</Text>
                    </View>
                  )}
                </PressableScale>
              </MotiView>
            </View>
          </MotiView>

          {/* Plan cards */}
          <View style={{ gap: 14 }}>
            {PLANS.map((plan, i) => {
              const tierRank: Record<PlanId, number> = { starter: 0, pro: 1, elite: 2 };
              const currentRank = tierRank[currentTier as PlanId] ?? 0;
              const isCurrent = plan.id === currentTier;
              const isDowngrade = tierRank[plan.id] < currentRank;
              return (
                <MotiView key={plan.id} from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 120 + i * 60 }}>
                  <PlanCard
                    plan={plan}
                    yearly={yearly}
                    isCurrent={isCurrent}
                    isDowngrade={isDowngrade}
                    onUpgrade={handleUpgrade}
                    loading={loading}
                  />
                </MotiView>
              );
            })}
          </View>

          {/* Social proof */}
          <SocialProofBlock />

          {/* Pro feature details */}
          <View>
            <Text style={{ fontFamily: Font.heading, fontSize: 13, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>everything in pro & elite</Text>
            <View style={{ backgroundColor: CARD, borderRadius: Radius.lg, paddingHorizontal: 16, paddingTop: 4 }}>
              {PRO_FEATURES.map((f, i) => <FeatureRow key={f.label} item={f} i={i} />)}
            </View>
          </View>

          {/* Comparison table */}
          <PrepperPlanComparison currentTier={currentTier as PlanId} />

          {/* Fine print */}
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, textAlign: 'center', lineHeight: 18 }}>
            Cancel anytime · Stripe-secured billing · Plans renew automatically
          </Text>
        </ScrollView>
      </SafeAreaView>
      <PaymentRedirectOverlay visible={loading} />
    </View>
  );
}
