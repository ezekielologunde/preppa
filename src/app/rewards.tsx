import { useRouter } from 'expo-router';
import { Check, ChevronLeft, Gift, Lock, Sparkles, Star } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { feedback } from '@/lib/feedback';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { useMyOrders } from '@/lib/queries/orders';
import { TIERS, useRewards, type Tier } from '@/lib/queries/rewards';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const money = (n: number) => `$${n.toFixed(2)}`;

function TierCard({ tier, reached, current }: { tier: Tier; reached: boolean; current: boolean }) {
  return (
    <View
      style={{
        backgroundColor: current ? tier.color : Palette.surface,
        borderRadius: Radius.lg,
        padding: 16,
        gap: 10,
        borderWidth: current ? 0 : 1,
        borderColor: Palette.border,
        opacity: reached || current ? 1 : 0.75,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: current ? 'rgba(255,255,255,0.25)' : tier.color + '1A', alignItems: 'center', justifyContent: 'center' }}>
          {reached && !current ? <Check size={16} color={tier.color} strokeWidth={3} /> : <Star size={15} color={current ? '#fff' : tier.color} fill={current ? '#fff' : 'none'} />}
        </View>
        <Text style={{ fontFamily: Font.heading, fontSize: 16, color: current ? '#fff' : INK }}>{tier.name}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: current ? 'rgba(255,255,255,0.9)' : Palette.textMuted }}>
          {tier.min === 0 ? 'starter' : `${money(tier.min)} spent`}
        </Text>
      </View>
      {tier.perks.map((p) => (
        <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {reached || current ? <Check size={14} color={current ? '#fff' : Palette.success} strokeWidth={2.6} /> : <Lock size={13} color={Palette.textMuted} />}
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: current ? '#fff' : reached ? Palette.textSecondary : Palette.textMuted }}>{p}</Text>
        </View>
      ))}
    </View>
  );
}

export default function RewardsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const r = useRewards(user?.id);
  const { refetch } = useMyOrders(user?.id);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await refetch(); setRefreshing(false); }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>rewards</Text>
        </View>

        {!user ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <Gift size={28} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Sign in to start earning points on every order.</Text>
            <PressableScale onPress={() => router.push('/auth?mode=signin')} accessibilityRole="button" accessibilityLabel="Sign in" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Sign in</Text>
            </PressableScale>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 130 }}>
            {/* Points hero */}
            <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
            <View style={{ backgroundColor: r.tier.color, borderRadius: Radius.lg, padding: 22, gap: 6, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Sparkles size={16} color="#fff" />
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: 'rgba(255,255,255,0.92)' }}>{r.tier.name} member</Text>
              </View>
              <Text style={{ fontFamily: Font.display, fontSize: 44, color: '#fff', letterSpacing: -1, fontVariant: ['tabular-nums'] }}>{r.points.toLocaleString()}</Text>
              <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: 'rgba(255,255,255,0.92)' }}>points · {money(r.lifetimeSpend)} spent over {r.orders} order{r.orders === 1 ? '' : 's'}</Text>

              {r.nextTier ? (
                <View style={{ marginTop: 12, gap: 6 }}>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' }}>
                    <View style={{ width: `${Math.round(r.progress * 100)}%`, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
                  </View>
                  <Text style={{ fontFamily: Font.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.92)' }}>
                    {money(r.toNext)} more to {r.nextTier.name}
                  </Text>
                </View>
              ) : (
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#fff', marginTop: 8 }}>You&apos;ve reached the top tier 🎉</Text>
              )}
            </View>

            </MotiView>
            {/* How it works */}
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 80 }}>
            <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                <Gift size={19} color={ORANGE} />
              </View>
              <Text style={{ flex: 1, fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, lineHeight: 19 }}>
                Earn <Text style={{ fontFamily: Font.semibold, color: INK }}>10 points</Text> for every $1 on completed orders. Spend more to unlock better perks.
              </Text>
            </View>

            </MotiView>
            {/* Tiers */}
            <Text style={{ fontFamily: Font.display, fontSize: 18, color: INK, letterSpacing: -0.4, marginTop: 2 }}>your tiers</Text>
            {TIERS.map((t, i) => (
              <MotiView key={t.key} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 160 + i * 60 }}>
                <TierCard tier={t} reached={r.lifetimeSpend >= t.min} current={t.key === r.tier.key} />
              </MotiView>
            ))}

            <PressableScale onPress={() => { feedback.tap(); router.push('/'); }} accessibilityRole="button" accessibilityLabel="Browse meals to earn points" style={{ height: 52, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Order to earn points</Text>
            </PressableScale>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
