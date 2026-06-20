import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  CalendarCheck, ChevronLeft, Eye, Link2, MessageCircle,
  ShieldCheck, Star, Zap, type LucideIcon,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PaymentRedirectOverlay } from '@/components/payment-redirect-overlay';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useCustomerMembership } from '@/lib/queries/memberships';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

const VIOLET = '#7C3AED';
const INK = Palette.ink;

const MONTHLY = 4.99;
const YEARLY = 39;
const YEARLY_SAVING = Math.round(100 - (YEARLY / (MONTHLY * 12)) * 100);

type Benefit = { Icon: LucideIcon; label: string; sub: string; color: string };
const BENEFITS: Benefit[] = [
  { Icon: Eye,           label: 'See accepted bid details',  sub: 'Chef name, quote and personal message revealed on acceptance', color: VIOLET },
  { Icon: MessageCircle, label: 'Message your chef',         sub: 'Chat directly to align on date, menu and preferences',        color: '#2563EB' },
  { Icon: CalendarCheck, label: 'Full booking confirmation', sub: 'Event details, timeline and a confirmation summary sent to you', color: Palette.success },
  { Icon: ShieldCheck,   label: 'Verified chefs only',       sub: 'Every matched prepper has passed our quality review',          color: '#0891B2' },
  { Icon: Zap,           label: 'Instant bid alerts',        sub: 'Get notified the moment a prepper quotes your request',        color: Palette.amber },
  { Icon: Star,          label: 'Priority matching',         sub: 'Your requests appear higher in the prepper feed',              color: '#EC4899' },
];

function BenefitRow({ item, i }: { item: Benefit; i: number }) {
  return (
    <MotiView from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 240, delay: 200 + i * 40 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: 1, borderColor: Palette.border }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: item.color + '18', alignItems: 'center', justifyContent: 'center' }}>
          <item.Icon size={18} color={item.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>{item.label}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1 }}>{item.sub}</Text>
        </View>
      </View>
    </MotiView>
  );
}

export default function ConnectPremiumScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: membership } = useCustomerMembership(user?.id);
  const [yearly, setYearly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const price = yearly ? `$${YEARLY}` : `$${MONTHLY.toFixed(2)}`;
  const period = yearly ? 'year' : 'month';
  const isActive = membership?.isUnlocked === true;

  async function handleSubscribe() {
    if (!user) { router.push('/auth?mode=signup'); return; }
    if (isActive || loading) return;
    feedback.tap();
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-subscribe', {
        body: { type: 'customer_connect', period: yearly ? 'yearly' : 'monthly' },
      });
      if (error || !data?.url) throw new Error(error?.message ?? 'Checkout failed');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = data.url;
      } else {
        await WebBrowser.openBrowserAsync(data.url);
      }
    } catch {
      feedback.error();
      setErr('Could not start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) router.back(); else router.replace('/'); }}
            accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>connect</Text>
          {isActive ? (
            <View style={{ marginLeft: 'auto', backgroundColor: VIOLET + '1A', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 4 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: VIOLET }}>active ✦</Text>
            </View>
          ) : null}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 140 }}>
          {/* Hero gradient card */}
          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
            <LinearGradient colors={['#6D28D9', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, padding: 24, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
                  <Link2 size={22} color="#fff" />
                </View>
                <View>
                  <Text style={{ fontFamily: Font.display, fontSize: 28, color: '#fff', letterSpacing: -0.5 }}>Connect</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: 'rgba(255,255,255,0.8)' }}>Unlock your chef match.</Text>
                </View>
              </View>
              <Text style={{ fontFamily: Font.display, fontSize: 36, color: '#fff', letterSpacing: -0.8 }}>
                {price}<Text style={{ fontSize: 16, fontFamily: Font.medium }}>/{period}</Text>
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                {isActive ? 'Your Connect membership is active.' : 'Post a request. Get bids. Connect for real.'}
              </Text>
            </LinearGradient>
          </MotiView>

          {/* Billing toggle */}
          {!isActive ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
              <View style={{ flexDirection: 'row', backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 4, gap: 4 }}>
                <MotiView animate={{ backgroundColor: !yearly ? VIOLET : Palette.surface }} transition={{ type: 'timing', duration: 200 }}
                  style={{ flex: 1, borderRadius: Radius.sm, overflow: 'hidden' }}>
                  <PressableScale onPress={() => { feedback.tap(); setYearly(false); }}
                    accessibilityRole="button" accessibilityLabel="Monthly billing, $4.99 per month"
                    accessibilityState={{ selected: !yearly }}
                    style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: !yearly ? '#fff' : Palette.textSecondary }}>Monthly · $4.99</Text>
                  </PressableScale>
                </MotiView>
                <MotiView animate={{ backgroundColor: yearly ? VIOLET : Palette.surface }} transition={{ type: 'timing', duration: 200 }}
                  style={{ flex: 1, borderRadius: Radius.sm, overflow: 'hidden' }}>
                  <PressableScale onPress={() => { feedback.tap(); setYearly(true); }}
                    accessibilityRole="button" accessibilityLabel={`Yearly billing, $39 per year, save ${YEARLY_SAVING}%`}
                    accessibilityState={{ selected: yearly }}
                    style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: yearly ? '#fff' : Palette.textSecondary }}>Yearly · $39</Text>
                    {!yearly ? (
                      <View style={{ backgroundColor: Palette.success, borderRadius: Radius.pill, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: '#fff' }}>-{YEARLY_SAVING}%</Text>
                      </View>
                    ) : null}
                  </PressableScale>
                </MotiView>
              </View>
            </MotiView>
          ) : null}

          {/* Benefits */}
          <View>
            <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>what you unlock</Text>
            <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, paddingHorizontal: 16, paddingTop: 4 }}>
              {BENEFITS.map((b, i) => <BenefitRow key={b.label} item={b} i={i} />)}
            </View>
          </View>

          {/* How it works */}
          <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 320 }}>
            <View style={{ backgroundColor: VIOLET + '10', borderRadius: Radius.md, padding: 16, gap: 12, borderWidth: 1, borderColor: VIOLET + '22' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13, color: VIOLET }}>how connect works</Text>
              {[
                { n: '1', t: 'Post any request — free', b: 'Catering, private chef, cooking class and more' },
                { n: '2', t: 'Review all bids',         b: 'See every chef quote, amount and star rating' },
                { n: '3', t: 'Accept & unlock',         b: 'Subscribe to reveal your chef and start chatting' },
              ].map((s) => (
                <View key={s.n} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: VIOLET, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#fff' }}>{s.n}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: INK }}>{s.t}</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1 }}>{s.b}</Text>
                  </View>
                </View>
              ))}
            </View>
          </MotiView>
        </ScrollView>

        {/* Sticky CTA */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Palette.canvas, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 20, gap: 8 }}>
          {err ? <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.danger, textAlign: 'center' }}>{err}</Text> : null}
          {isActive ? (
            <View style={{ height: 56, borderRadius: Radius.pill, backgroundColor: VIOLET, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Connect Active ✦</Text>
            </View>
          ) : (
            <PressableScale onPress={handleSubscribe} disabled={loading}
              accessibilityRole="button" accessibilityLabel="Subscribe to Connect"
              style={{ height: 56, borderRadius: Radius.pill, backgroundColor: VIOLET, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: loading ? 0.7 : 1 }}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : (
                  <>
                    <Link2 size={18} color="#fff" />
                    <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Connect · {price}/{period}</Text>
                  </>
                )}
            </PressableScale>
          )}
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, textAlign: 'center' }}>
            Cancel anytime · Stripe-secured billing
          </Text>
        </View>
      </SafeAreaView>
      <PaymentRedirectOverlay visible={loading} />
    </View>
  );
}
