import { useRouter } from 'expo-router';
import {
  BarChart2, Check, ChevronLeft, Crown, Flame, Lock, Search, Sparkles, Star, TrendingUp, Users, Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaymentRedirectOverlay } from '@/components/payment-redirect-overlay';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const CARD = Palette.prepperCard;
const BG = Palette.prepperBg;
const MUTED = Palette.textMuted;

const MONTHLY = 29;
const YEARLY = 249;
const YEARLY_SAVING = Math.round(100 - (YEARLY / (MONTHLY * 12)) * 100);

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

const FREE_FEATURES = [
  'Up to 5 meal listings',
  'Standard search ranking',
  'Preorder management',
  'Basic sales summary',
];

function FeatureRow({ item, i }: { item: ProFeature; i: number }) {
  return (
    <MotiView from={{ opacity: 0, translateX: -10 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 240, delay: 240 + i * 35 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#1e2330' }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: ORANGE + '1A', alignItems: 'center', justifyContent: 'center' }}>
          <item.Icon size={17} color={ORANGE} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 14, color: '#fff' }}>{item.label}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, marginTop: 1 }}>{item.sub}</Text>
        </View>
        <Check size={16} color={ORANGE} strokeWidth={3} />
      </View>
    </MotiView>
  );
}

export default function PrepperPremiumScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: myPrepper } = useMyPrepperApplication(user?.id);
  const [yearly, setYearly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [upgradeErr, setUpgradeErr] = useState<string | null>(null);
  const price = yearly ? YEARLY : MONTHLY;
  const period = yearly ? 'year' : 'month';

  async function handleUpgrade() {
    if (!user) { router.push('/auth?mode=signup'); return; }
    if (!myPrepper?.id || loading) return;
    feedback.tap();
    setLoading(true);
    setUpgradeErr(null);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-subscribe', {
        body: { type: 'prepper_pro', period: yearly ? 'yearly' : 'monthly', prepperId: myPrepper.id },
      });
      if (error || !data?.url) throw new Error(error?.message ?? 'Checkout failed');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = data.url;
      } else {
        Linking.openURL(data.url);
      }
    } catch {
      feedback.error();
      setUpgradeErr('Could not start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); } }} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color="#fff" />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 22, color: '#fff', letterSpacing: -0.5 }}>upgrade to pro</Text>
          <View style={{ marginLeft: 'auto', backgroundColor: ORANGE + '24', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Crown size={13} color={ORANGE} />
            <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: ORANGE }}>Pro</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 140 }}>
          {/* Hero */}
          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
            <View style={{ alignItems: 'center', paddingVertical: 8, gap: 10 }}>
              <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: ORANGE + '20', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: ORANGE + '40' }}>
                <Crown size={34} color={ORANGE} />
              </View>
              <Text style={{ fontFamily: Font.display, fontSize: 38, color: '#fff', letterSpacing: -1, textAlign: 'center' }}>
                go pro.{'\n'}<Text style={{ color: ORANGE }}>earn more.</Text>
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 21, maxWidth: 300 }}>
                The tools serious home cooks use to turn cooking into a real business.
              </Text>
            </View>
          </MotiView>

          {/* Billing toggle */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
            <View style={{ flexDirection: 'row', backgroundColor: CARD, borderRadius: Radius.md, padding: 4, gap: 4 }}>
              <MotiView
                animate={{ backgroundColor: !yearly ? ORANGE : CARD }}
                transition={{ type: 'timing', duration: 200 }}
                style={{ flex: 1, borderRadius: Radius.sm, overflow: 'hidden' }}>
                <PressableScale onPress={() => { feedback.tap(); setYearly(false); }}
                  accessibilityRole="button" accessibilityState={{ selected: !yearly }}
                  style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: !yearly ? '#fff' : MUTED }}>Monthly</Text>
                </PressableScale>
              </MotiView>
              <MotiView
                animate={{ backgroundColor: yearly ? ORANGE : CARD }}
                transition={{ type: 'timing', duration: 200 }}
                style={{ flex: 1, borderRadius: Radius.sm, overflow: 'hidden' }}>
                <PressableScale onPress={() => { feedback.tap(); setYearly(true); }}
                  accessibilityRole="button" accessibilityState={{ selected: yearly }}
                  style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: yearly ? '#fff' : MUTED }}>Yearly</Text>
                  {!yearly ? (
                    <View style={{ backgroundColor: Palette.success, borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: '#fff' }}>save {YEARLY_SAVING}%</Text>
                    </View>
                  ) : null}
                </PressableScale>
              </MotiView>
            </View>
          </MotiView>

          {/* Price */}
          <MotiView from={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260, delay: 120 }}>
            <View style={{ backgroundColor: CARD, borderRadius: Radius.lg, padding: 22, alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: ORANGE + '30' }}>
              <Text style={{ fontFamily: Font.display, fontSize: 48, color: '#fff', letterSpacing: -1 }}>
                ${price}
                <Text style={{ fontSize: 18, color: MUTED, letterSpacing: 0 }}>/{period}</Text>
              </Text>
              {yearly ? (
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: '#34d399' }}>
                  saves ${MONTHLY * 12 - YEARLY}/year vs monthly
                </Text>
              ) : (
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }}>switch to yearly and save ${MONTHLY * 12 - YEARLY}</Text>
              )}
            </View>
          </MotiView>

          {/* Pro features */}
          <View>
            <Text style={{ fontFamily: Font.heading, fontSize: 13, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>everything in pro</Text>
            <View style={{ backgroundColor: CARD, borderRadius: Radius.lg, paddingHorizontal: 16, paddingTop: 4 }}>
              {PRO_FEATURES.map((f, i) => <FeatureRow key={f.label} item={f} i={i} />)}
            </View>
          </View>

          {/* Free tier summary */}
          <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 300 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 13, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>always free</Text>
            <View style={{ backgroundColor: '#111318', borderRadius: Radius.md, padding: 16, gap: 10 }}>
              {FREE_FEATURES.map((f) => (
                <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Check size={14} color={MUTED} />
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }}>{f}</Text>
                </View>
              ))}
            </View>
          </MotiView>
        </ScrollView>

        {/* Sticky CTA */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: BG, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 20, gap: 8 }}>
          {upgradeErr ? (
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.danger, textAlign: 'center' }}>{upgradeErr}</Text>
          ) : null}
          <PressableScale onPress={handleUpgrade} disabled={loading}
            accessibilityRole="button" accessibilityLabel="Upgrade to Pro"
            style={{ height: 56, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: loading ? 0.7 : 1 }}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Crown size={18} color="#fff" />
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Upgrade to Pro · ${price}/{period}</Text>
              </>
            )}
          </PressableScale>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, textAlign: 'center' }}>
            Cancel anytime · Stripe-secured billing
          </Text>
        </View>
      </SafeAreaView>
      <PaymentRedirectOverlay visible={loading} />
    </View>
  );
}
