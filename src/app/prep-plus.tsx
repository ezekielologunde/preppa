import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Bell, ChevronLeft, Crown, Gift, Star, Ticket, Truck, Tv2, Zap,
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
import { useCustomerMembership } from '@/lib/queries/memberships';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;

const MONTHLY = 9.99;
const YEARLY = 89;
const YEARLY_SAVING = Math.round(100 - (YEARLY / (MONTHLY * 12)) * 100);

type Benefit = { Icon: LucideIcon; label: string; sub: string; color: string };
const BENEFITS: Benefit[] = [
  { Icon: Ticket, label: 'Reduced fees', sub: 'Save on every preorder placed through the app', color: ORANGE },
  { Icon: Star, label: 'Exclusive meals', sub: 'First access to limited drops before anyone else', color: Palette.amber },
  { Icon: Gift, label: 'Surprise discounts', sub: 'Random perks and credits each week', color: '#ec4899' },
  { Icon: Zap, label: 'Early access', sub: 'New preppers and drops the moment they go live', color: '#8b5cf6' },
  { Icon: Crown, label: 'Loyalty multiplier', sub: '2× points earned on every preorder', color: Palette.amber },
  { Icon: Truck, label: 'Delivery credits', sub: '$5 credit toward delivery each billing cycle', color: Palette.success },
  { Icon: Tv2, label: 'Premium livestreams', sub: 'Q&A access and exclusive chef sessions', color: '#60a5fa' },
  { Icon: Bell, label: 'Priority support', sub: 'Jump the queue — real humans, fast responses', color: ORANGE },
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

export default function PrepPlusScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: membership } = useCustomerMembership(user?.id);
  const [yearly, setYearly] = useState(false);
  const [loading, setLoading] = useState(false);
  const price = yearly ? `$${YEARLY}` : `$${MONTHLY.toFixed(2)}`;
  const period = yearly ? 'year' : 'month';
  const isPlus = membership?.isPlus === true;

  async function handleJoin() {
    if (!user) { router.push('/auth?mode=signup'); return; }
    if (isPlus || loading) return;
    feedback.tap();
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-subscribe', {
        body: { type: 'customer_plus', period: yearly ? 'yearly' : 'monthly' },
      });
      if (error || !data?.url) throw new Error(error?.message ?? 'Checkout failed');
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = data.url;
      } else {
        Linking.openURL(data.url);
      }
    } catch (e) {
      feedback.error();
      console.error('stripe-subscribe error', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); } }} accessibilityRole="button" accessibilityLabel="Go back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>prep+</Text>
          {isPlus ? (
            <View style={{ marginLeft: 'auto', backgroundColor: Palette.brandTint, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 4 }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: ORANGE }}>active ✦</Text>
            </View>
          ) : null}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 140 }}>
          {/* Hero gradient card */}
          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
            <LinearGradient colors={['#E8611A', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, padding: 24, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                  <Crown size={22} color="#fff" />
                </View>
                <View>
                  <Text style={{ fontFamily: Font.display, fontSize: 28, color: '#fff', letterSpacing: -0.5 }}>Prep+</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: 'rgba(255,255,255,0.8)' }}>More perks. Less friction.</Text>
                </View>
              </View>
              <Text style={{ fontFamily: Font.display, fontSize: 36, color: '#fff', letterSpacing: -0.8 }}>
                {price}
                <Text style={{ fontSize: 16, fontFamily: Font.medium }}>/{period}</Text>
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                {isPlus ? 'Your membership is active.' : 'Join thousands of members already saving.'}
              </Text>
            </LinearGradient>
          </MotiView>

          {/* Billing toggle */}
          {!isPlus ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
              <View style={{ flexDirection: 'row', backgroundColor: Palette.surface, borderRadius: Radius.md, padding: 4, gap: 4 }}>
                <MotiView
                  animate={{ backgroundColor: !yearly ? ORANGE : Palette.surface }}
                  transition={{ type: 'timing', duration: 200 }}
                  style={{ flex: 1, borderRadius: Radius.sm, overflow: 'hidden' }}>
                  <PressableScale onPress={() => { feedback.tap(); setYearly(false); }}
                    accessibilityRole="button" accessibilityState={{ selected: !yearly }}
                    style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: !yearly ? '#fff' : Palette.textSecondary }}>Monthly · $9.99</Text>
                  </PressableScale>
                </MotiView>
                <MotiView
                  animate={{ backgroundColor: yearly ? ORANGE : Palette.surface }}
                  transition={{ type: 'timing', duration: 200 }}
                  style={{ flex: 1, borderRadius: Radius.sm, overflow: 'hidden' }}>
                  <PressableScale onPress={() => { feedback.tap(); setYearly(true); }}
                    accessibilityRole="button" accessibilityState={{ selected: yearly }}
                    style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: yearly ? '#fff' : Palette.textSecondary }}>Yearly · $89</Text>
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
            <Text style={{ fontFamily: Font.heading, fontSize: 13, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>member benefits</Text>
            <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, paddingHorizontal: 16, paddingTop: 4 }}>
              {BENEFITS.map((b, i) => <BenefitRow key={b.label} item={b} i={i} />)}
            </View>
          </View>

          {/* Social proof */}
          <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 380 }}>
            <View style={{ backgroundColor: Palette.brandTint, borderRadius: Radius.md, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flexDirection: 'row' }}>
                {['#E8611A', '#f59e0b', '#8b5cf6', '#ec4899'].map((c, i) => (
                  <View key={c} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c, borderWidth: 2, borderColor: Palette.canvas, marginLeft: i > 0 ? -8 : 0 }} />
                ))}
              </View>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.inkSoft, flex: 1 }}>
                <Text style={{ fontFamily: Font.heading }}>12,000+ members</Text> already saving on every preorder.
              </Text>
            </View>
          </MotiView>
        </ScrollView>

        {/* Sticky CTA */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Palette.canvas, paddingTop: 12, paddingBottom: 32, paddingHorizontal: 20, gap: 8 }}>
          {isPlus ? (
            <View style={{ height: 56, borderRadius: Radius.md, backgroundColor: Palette.success, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Prep+ Active ✦</Text>
            </View>
          ) : (
            <PressableScale onPress={handleJoin} disabled={loading}
              accessibilityRole="button" accessibilityLabel="Join Prep+"
              style={{ height: 56, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: loading ? 0.7 : 1 }}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Crown size={18} color="#fff" />
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Join Prep+ · {price}/{period}</Text>
                </>
              )}
            </PressableScale>
          )}
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted, textAlign: 'center' }}>
            Cancel anytime · Stripe-secured billing
          </Text>
        </View>
      </SafeAreaView>
      <PaymentRedirectOverlay visible={loading} />
    </View>
  );
}
