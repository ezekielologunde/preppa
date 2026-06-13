import { useRouter } from 'expo-router';
import { Bike, Check, ChevronLeft, Crown, Gift, Lock, MessageSquare, ShoppingBag, Sparkles, Star, Tag, UserPlus } from 'lucide-react-native';
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
    feedback.tap();
    if (router.canGoBack()) { router.back(); } else { router.replace('/'); }
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
            <PressableScale onPress={() => { feedback.tap(); router.push('/auth?mode=signin'); }} accessibilityRole="button" accessibilityLabel="Sign in" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Sign in</Text>
            </PressableScale>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 32 }}>
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
            <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, marginTop: 2 }}>your tiers</Text>
            {TIERS.map((t, i) => (
              <MotiView key={t.key} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 160 + i * 45 }}>
                <TierCard tier={t} reached={r.lifetimeSpend >= t.min} current={t.key === r.tier.key} />
              </MotiView>
            ))}

            {/* Redeemable perks */}
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 280 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, marginTop: 6, marginBottom: 12 }}>redeem points</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {([
                { title: '20% off', desc: 'one order', pts: 2000, Icon: Tag, color: ORANGE },
                { title: 'free delivery', desc: 'next order', pts: 1500, Icon: Bike, color: '#06b6d4' },
                { title: 'mystery meal', desc: 'chef surprise', pts: 3000, Icon: Gift, color: '#8b5cf6' },
                { title: 'month of Prep+', desc: 'premium access', pts: 8000, Icon: Crown, color: '#d97706' },
              ] as const).map(({ title, desc, pts, Icon, color }) => {
                const canRedeem = r.points >= pts;
                return (
                  <PressableScale key={title} onPress={() => feedback.tap()} accessibilityRole="button" accessibilityLabel={`Redeem ${pts} points for ${title}`}
                    style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: Palette.surface, borderRadius: 16, padding: 14, gap: 8, opacity: canRedeem ? 1 : 0.6, borderWidth: 1, borderColor: canRedeem ? color + '30' : Palette.border }}>
                    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={17} color={color} />
                    </View>
                    <Text style={{ fontFamily: Font.heading, fontSize: 14, color: INK }}>{title}</Text>
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>{desc}</Text>
                    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: Radius.pill, backgroundColor: canRedeem ? color + '18' : Palette.chip }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: canRedeem ? color : Palette.textMuted, fontVariant: ['tabular-nums'] }}>{pts.toLocaleString()} pts</Text>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
            </MotiView>

            {/* Ways to earn more */}
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 340 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3, marginTop: 8 }}>earn more points</Text>
            <View style={{ backgroundColor: Palette.surface, borderRadius: Radius.lg, overflow: 'hidden', marginTop: 12 }}>
              {([
                { label: 'place an order', pts: '10 pts per $1', Icon: ShoppingBag },
                { label: 'write a review', pts: '25 pts', Icon: MessageSquare },
                { label: 'refer a friend', pts: '500 pts', Icon: UserPlus },
                { label: 'first order bonus', pts: '100 pts', Icon: Sparkles },
              ] as const).map(({ label, pts, Icon }, i) => (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.divider }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={15} color={ORANGE} />
                  </View>
                  <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 14, color: INK }}>{label}</Text>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>{pts}</Text>
                </View>
              ))}
            </View>
            </MotiView>

            {/* Refer CTA */}
            <PressableScale onPress={() => { feedback.tap(); router.push('/referral'); }} accessibilityRole="button" accessibilityLabel="Refer friends to earn 500 points each"
              style={{ backgroundColor: Palette.ink, borderRadius: Radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus size={20} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>refer a friend</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Earn 500 points for every friend who orders</Text>
              </View>
              <Sparkles size={18} color={ORANGE} />
            </PressableScale>

            <PressableScale onPress={() => { feedback.tap(); router.push('/'); }} accessibilityRole="button" accessibilityLabel="Browse meals to earn points" style={{ height: 52, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: '#fff' }}>Preorder to earn points</Text>
            </PressableScale>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}
