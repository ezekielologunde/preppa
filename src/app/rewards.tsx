import { useRouter } from 'expo-router';
import { Bike, Check, ChevronLeft, Crown, Gift, Lock, MessageSquare, ShoppingBag, Sparkles, Star, Tag, UserPlus } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { feedback } from '@/lib/feedback';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { useMyOrders } from '@/lib/queries/orders';
import { TIERS, useRewards, type Tier } from '@/lib/queries/rewards';
import { useAuth } from '@/providers/auth-provider';

const ORANGE = Palette.brand;
const INK = Palette.ink;
const money = (n: number) => `$${n.toFixed(2)}`;

type Perk = {
  title: string;
  desc: string;
  pts: number;
  Icon: typeof Tag;
  color: string;
  body: string;
  cta: string;
  ctaRoute: string;
};

const PERKS: Perk[] = [
  {
    title: '20% off', desc: 'one preorder', pts: 2000, Icon: Tag, color: ORANGE,
    body: 'Get 20% off your entire next preorder. The discount applies automatically at checkout — no code needed.',
    cta: 'Start shopping', ctaRoute: '/',
  },
  {
    title: 'free delivery', desc: 'next preorder', pts: 1500, Icon: Bike, color: '#06b6d4',
    body: 'Delivery fee waived on your next eligible preorder. Just order as normal — it\'s deducted automatically.',
    cta: 'Browse meals', ctaRoute: '/',
  },
  {
    title: 'mystery meal', desc: 'chef surprise', pts: 3000, Icon: Gift, color: '#8b5cf6',
    body: "We hand-pick a chef's surprise from the top kitchens near you — something you probably wouldn't have chosen yourself.",
    cta: 'Surprise me', ctaRoute: '/explore',
  },
  {
    title: 'month of Prep+', desc: 'premium access', pts: 8000, Icon: Crown, color: '#d97706',
    body: 'Unlock one month of Preppa Pro: unlimited custom meal plans, priority prepper matching, and exclusive member drops.',
    cta: 'Explore meal plans', ctaRoute: '/meal-plans',
  },
];

function RedeemSheet({ perk, canRedeem, userPoints, onClose, onCta }: { perk: Perk | null; canRedeem: boolean; userPoints: number; onClose: () => void; onCta: (route: string) => void }) {
  if (!perk) return null;
  const { Icon, color, title, desc, pts, body, cta, ctaRoute } = perk;
  return (
    <Modal visible={!!perk} transparent animationType="none" onRequestClose={onClose}>
      <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 180 }} style={{ flex: 1 }}>
        <Pressable onPress={onClose} accessibilityRole="button" style={{ flex: 1, backgroundColor: Palette.overlay }} accessibilityLabel="Dismiss" />
        <MotiView
          from={{ translateY: 320 }}
          animate={{ translateY: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          style={{ backgroundColor: Palette.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 16 }}>
          <View style={{ width: 48, height: 4, borderRadius: 2, backgroundColor: Palette.border, alignSelf: 'center', marginBottom: 4 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={24} color={color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.4 }}>{title}</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary }}>{desc}</Text>
            </View>
            <View style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: Radius.pill, backgroundColor: canRedeem ? color + '18' : Palette.chip }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: canRedeem ? color : Palette.textMuted, fontVariant: ['tabular-nums'] }}>{pts.toLocaleString()} pts</Text>
            </View>
          </View>
          <Text style={{ fontFamily: Font.body, fontSize: 14.5, color: Palette.textSecondary, lineHeight: 22 }}>{body}</Text>
          {canRedeem ? (
            <PressableScale
              onPress={() => { feedback.success(); onCta(ctaRoute); }}
              accessibilityRole="button"
              accessibilityLabel={cta}
              style={{ height: 54, borderRadius: Radius.pill, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{cta}</Text>
            </PressableScale>
          ) : (
            <View style={{ gap: 10 }}>
              <View style={{ height: 54, borderRadius: Radius.pill, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Palette.textMuted }}>
                  Need {Math.max(0, pts - userPoints).toLocaleString()} more points
                </Text>
              </View>
              <PressableScale
                onPress={() => { feedback.tap(); onCta('/'); }}
                accessibilityRole="button"
                accessibilityLabel="Browse meals to earn points"
                style={{ height: 46, borderRadius: Radius.pill, borderWidth: 1, borderColor: Palette.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.textSecondary }}>Browse to earn points</Text>
              </PressableScale>
            </View>
          )}
        </MotiView>
      </MotiView>
    </Modal>
  );
}

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
  const { refetch: refetchOrders } = useMyOrders(user?.id);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPerk, setSelectedPerk] = useState<Perk | null>(null);
  async function handleRefresh() { setRefreshing(true); await Promise.all([refetchOrders(), r.refetch()]); setRefreshing(false); }

  function handlePerkCta(route: string) {
    setSelectedPerk(null);
    router.push(route as Parameters<typeof router.push>[0]);
  }

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
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Sign in to start earning points on every preorder.</Text>
            <PressableScale onPress={() => { feedback.tap(); router.push('/auth?mode=signin'); }} accessibilityRole="button" accessibilityLabel="Sign in" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Sign in</Text>
            </PressableScale>
          </View>
        ) : r.isLoading ? (
          <View style={{ padding: 20, gap: 14 }}>
            <Skeleton width="100%" height={160} radius={20} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Skeleton height={72} radius={16} style={{ flex: 1 }} />
              <Skeleton height={72} radius={16} style={{ flex: 1 }} />
            </View>
            <Skeleton width={140} height={18} radius={6} />
            {[0, 1, 2, 3].map(i => <Skeleton key={i} width="100%" height={64} radius={16} />)}
          </View>
        ) : r.isError ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <Gift size={28} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>couldn't load rewards</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Check your connection and try again.</Text>
            <PressableScale onPress={() => { feedback.tap(); void r.refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading rewards"
              style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>retry</Text>
            </PressableScale>
          </MotiView>
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
              <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: 'rgba(255,255,255,0.92)' }}>points · {money(r.lifetimeSpend)} spent over {r.orders} preorder{r.orders === 1 ? '' : 's'}</Text>

              {r.nextTier ? (
                <View style={{ marginTop: 12, gap: 6 }}>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' }}>
                    <MotiView
                      from={{ width: '0%' }}
                      animate={{ width: `${Math.round(r.progress * 100)}%` }}
                      transition={{ type: 'timing', duration: 700, delay: 300 }}
                      style={{ height: 8, borderRadius: 4, backgroundColor: '#fff' }}
                    />
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
                Earn <Text style={{ fontFamily: Font.semibold, color: INK }}>10 points</Text> for every $1 on completed preorders. Spend more to unlock better perks.
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
              {PERKS.map((perk) => {
                const { title, desc, pts, Icon, color } = perk;
                const canRedeem = r.points >= pts;
                return (
                  <PressableScale key={title} onPress={() => { feedback.tap(); setSelectedPerk(perk); }} accessibilityRole="button" accessibilityLabel={`Redeem ${pts} points for ${title}`}
                    style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: Palette.surface, borderRadius: 16, padding: 14, gap: 8, opacity: canRedeem ? 1 : 0.72, borderWidth: 1, borderColor: canRedeem ? color + '30' : Palette.border }}>
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
                { label: 'place a preorder', pts: '10 pts per $1', Icon: ShoppingBag },
                { label: 'write a review', pts: '25 pts', Icon: MessageSquare },
                { label: 'refer a friend', pts: '500 pts', Icon: UserPlus },
                { label: 'first preorder bonus', pts: '100 pts', Icon: Sparkles },
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
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 400 }}>
            <PressableScale onPress={() => { feedback.tap(); router.push('/referral'); }} accessibilityRole="button" accessibilityLabel="Refer friends to earn 500 points each"
              style={{ backgroundColor: Palette.ink, borderRadius: Radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: ORANGE + '22', alignItems: 'center', justifyContent: 'center' }}>
                <UserPlus size={20} color={ORANGE} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>refer a friend</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Earn 500 points for every friend who preorders</Text>
              </View>
              <Sparkles size={18} color={ORANGE} />
            </PressableScale>
            </MotiView>

            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 460 }}>
            <Button
              title="Preorder to earn points"
              variant="primary"
              onPress={() => router.push('/')}
              style={{ marginTop: 4 }}
              accessibilityLabel="Browse meals to earn points"
            />
            </MotiView>
          </ScrollView>
        )}
      </SafeAreaView>
      <RedeemSheet
        perk={selectedPerk}
        canRedeem={selectedPerk ? r.points >= selectedPerk.pts : false}
        userPoints={r.points}
        onClose={() => setSelectedPerk(null)}
        onCta={handlePerkCta}
      />
    </View>
  );
}
