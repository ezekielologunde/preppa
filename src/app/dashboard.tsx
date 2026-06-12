import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import { useState } from 'react';
import {
  Bell,
  Boxes,
  Briefcase,
  ChefHat,
  ChevronRight,
  Check,
  Crown,
  Gift,
  Home,
  MessageSquare,
  Plus,
  Search,
  ShoppingBag,
  Star,
  TrendingUp,
  User,
  Users,
  UtensilsCrossed,
  Video,
  type LucideIcon,
} from 'lucide-react-native';
import { Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { PrepperBadgeShelf } from '@/components/badge-shelf';
import { ProfileHealthCard } from '@/components/profile-health-card';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { greeting } from '@/lib/greeting';
import { useBreakpoint } from '@/lib/layout';
import { usePrepperMembership } from '@/lib/queries/memberships';
import { useAdvanceOrder, usePrepperOrders, type OrderSummary } from '@/lib/queries/orders';
import { useMyPrepperApplication, usePrepperBadges, usePrepperProfile, useToggleAvailability } from '@/lib/queries/preppers';
import { usePrepperReviews } from '@/lib/queries/reviews';
import { useAuth } from '@/providers/auth-provider';
import type { OrderStatus } from '@/types/database.types';

const ORANGE = Palette.brand;
const GREEN = Palette.success;
const PURPLE = '#a78bfa';
const YELLOW = Palette.amber;
const PINK = '#f472b6';
const CARD = Palette.surface;
const BG = Palette.canvas;
const INK = Palette.ink;
const MUTED = Palette.textMuted;

const money = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);

const NEXT: Partial<Record<OrderStatus, { next: OrderStatus; cta: string }>> = {
  pending: { next: 'confirmed', cta: 'confirm order' },
  confirmed: { next: 'preparing', cta: 'start preparing' },
  preparing: { next: 'ready', cta: 'mark ready' },
  ready: { next: 'completed', cta: 'mark delivered' },
  out_for_delivery: { next: 'completed', cta: 'mark delivered' },
};

function Sparkline({ color, data, w = 116, h = 30 }: { color: string; data: number[]; w?: number; h?: number }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(' ');
  return (
    <Svg width={w} height={h}>
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

function Ring({ pct, color, size = 96, stroke = 9 }: { pct: number; color: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(Math.max(pct, 0), 100) / 100);
  const center = size / 2;
  return (
    <Svg width={size} height={size}>
      <Circle cx={center} cy={center} r={r} stroke={Palette.border} strokeWidth={stroke} fill="none" />
      <Circle
        cx={center}
        cy={center}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
    </Svg>
  );
}

function StatCard({ Icon, value, label, trend, color, spark, onPress, flex }: { Icon: LucideIcon; value: string; label: string; trend: string; color: string; spark: number[]; onPress?: () => void; flex?: boolean }) {
  return (
    <PressableScale onPress={onPress ? () => { feedback.tap(); onPress(); } : undefined} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={flex ? { flexBasis: '47%', flexGrow: 1, backgroundColor: CARD, borderRadius: 20, padding: 14, gap: 6 } : { width: 150, backgroundColor: CARD, borderRadius: 22, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: color + '24', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={19} color={color} />
        </View>
        <Text style={{ fontFamily: Font.semibold, fontSize: 12, color }}>{trend}</Text>
      </View>
      <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: MUTED }}>{label}</Text>
      <Text style={{ fontFamily: Font.display, fontSize: 26, color: INK, letterSpacing: -0.6 }}>{value}</Text>
      <Sparkline color={color} data={spark} />
    </PressableScale>
  );
}


export default function DashboardScreen() {
  const router = useRouter();
  const desktop = useBreakpoint() === 'desktop';
  const { user } = useAuth();
  const { data: prepper, refetch: refetchPrepper } = useMyPrepperApplication(user?.id);
  const { data: prepperProfile } = usePrepperProfile(prepper?.id);
  const { data: prepperMembership, refetch: refetchMembership } = usePrepperMembership(prepper?.id);
  const isPro = prepperMembership?.isPro === true;
  const { data: prepperBadges, refetch: refetchBadges } = usePrepperBadges(prepper?.id);
  const { data: orders, refetch: refetchOrders } = usePrepperOrders(prepper?.id);
  const { data: reviews, refetch: refetchReviews } = usePrepperReviews(prepper?.id);
  const advance = useAdvanceOrder();
  const toggleAvailability = useToggleAvailability(prepper?.id);
  const [accepting, setAccepting] = useState<boolean | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await Promise.all([refetchPrepper(), refetchMembership(), refetchBadges(), refetchOrders(), refetchReviews()]); setRefreshing(false); }
  const isOpen = accepting !== null ? accepting : ((prepper as unknown as { accepting_orders?: boolean })?.accepting_orders !== false);

  const list: OrderSummary[] = orders ?? [];
  const newCount = list.filter((o) => o.status === 'pending').length;
  const revenue = list.filter((o) => o.status === 'completed').reduce((s, o) => s + o.total, 0);
  const subscribers = new Set(list.map((o) => o.customer)).size;
  const reviewCount = reviews?.length ?? 0;
  const avgRating = reviewCount ? reviews!.reduce((s, r) => s + r.rating, 0) / reviewCount : 0;

  // Oldest still-active order = the one to act on next.
  const active = list.filter((o) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'preparing' || o.status === 'ready');
  const next = active.length ? active[active.length - 1] : null;
  const step = next ? NEXT[next.status] : undefined;

  // Today's-goal ring: completed revenue toward a $2,000 day (display-only target).
  const goalPct = Math.min(Math.round((revenue / 2000) * 100), 100);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />} contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 16 : 8, paddingBottom: 150 }}>
          {/* Header */}
          <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 }}>
            <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); } }} accessibilityRole="button" accessibilityLabel="Back to customer view" style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Avatar
                name={prepper?.display_name ?? (user?.user_metadata?.full_name as string | undefined) ?? 'chef'}
                url={user?.user_metadata?.avatar_url as string | undefined}
                size={46}
              />
            </PressableScale>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }}>{greeting()}, chef</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 22, color: INK, letterSpacing: -0.6 }}>my kitchen</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                <PressableScale
                  onPress={() => {
                    feedback.tap();
                    const next = !isOpen;
                    setAccepting(next);
                    toggleAvailability.mutate(next, { onError: () => setAccepting(!next) });
                  }}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: isOpen }}
                  accessibilityLabel={isOpen ? 'Kitchen is open — tap to close' : 'Kitchen is closed — tap to open'}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isOpen ? GREEN + '22' : Palette.chip, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isOpen ? GREEN : MUTED }} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: isOpen ? GREEN : Palette.textSecondary }}>{isOpen ? 'Open' : 'Closed'}</Text>
                </PressableScale>
              </View>
            </View>
            <PressableScale onPress={() => { feedback.tap(); router.push('/search'); }} accessibilityRole="button" accessibilityLabel="Search" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
              <Search size={19} color={INK} />
            </PressableScale>
            <PressableScale onPress={() => { feedback.tap(); router.push('/prepper-orders'); }} accessibilityRole="button" accessibilityLabel="New orders" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
              <Bell size={19} color={INK} />
              {newCount > 0 ? (
                <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: '#fff' }}>{newCount}</Text>
                </View>
              ) : null}
            </PressableScale>
          </View>
          </MotiView>

          {/* Next order — most urgent operational info, shown first */}
          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320, delay: 80 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginTop: 12, marginBottom: 10 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 15, color: INK, letterSpacing: -0.3 }}>next order</Text>
            {next ? (
              <View style={{ backgroundColor: ORANGE + '26', borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: ORANGE }}>{next.status === 'pending' ? 'new' : next.status}</Text>
              </View>
            ) : null}
          </View>
          {next ? (
            <View style={{ marginHorizontal: 20, backgroundColor: CARD, borderRadius: 22, padding: 16, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                {next.items[0]?.image ? (
                  <Image source={next.items[0].image} style={{ width: 76, height: 76, borderRadius: 18 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 76, height: 76, borderRadius: 18, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
                    <UtensilsCrossed size={26} color={MUTED} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }} numberOfLines={1}>{next.customer}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }} numberOfLines={1}>
                    {next.items[0]?.title ?? 'order'}{next.items.length > 1 ? ` +${next.items.length - 1}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: next.paymentStatus === 'paid' ? GREEN + '24' : Palette.chip, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
                      {next.paymentStatus === 'paid' ? <Check size={11} color={GREEN} strokeWidth={2.5} /> : null}
                      <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: next.paymentStatus === 'paid' ? GREEN : MUTED }}>{next.paymentStatus === 'paid' ? 'paid' : 'unpaid'}</Text>
                    </View>
                    <Text style={{ fontFamily: Font.display, fontSize: 16, color: INK, fontVariant: ['tabular-nums'] }}>${next.total.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
              {step ? (
                <PressableScale
                  onPress={() => { feedback.tap(); advance.mutate({ orderId: next.id, next: step.next }); }}
                  disabled={advance.isPending}
                  accessibilityRole="button"
                  accessibilityLabel={step.cta}
                  style={{ height: 50, borderRadius: 15, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, opacity: advance.isPending ? 0.7 : 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{step.cta}</Text>
                </PressableScale>
              ) : null}
            </View>
          ) : (
            <View style={{ marginHorizontal: 20, backgroundColor: CARD, borderRadius: 22, padding: 24, alignItems: 'center', gap: 8 }}>
              <ShoppingBag size={26} color={Palette.textSecondary} />
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: MUTED, textAlign: 'center' }}>No active orders right now. New orders land here instantly.</Text>
            </View>
          )}
          </MotiView>

          {/* Stat cards — KPI row on desktop, 2x2 grid on mobile */}
          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320, delay: 140 }}>
          {desktop ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, gap: 10 }}>
              <StatCard Icon={ShoppingBag} value={money(revenue)} label="total sales" trend={revenue > 0 ? 'earned' : '—'} color={ORANGE} spark={[3, 5, 4, 6, 5, 8, 7, 9]} onPress={() => router.push('/earnings')} />
              <StatCard Icon={Boxes} value={String(list.length)} label="orders" trend={`${newCount} new`} color={GREEN} spark={[2, 3, 3, 4, 6, 5, 7, 8]} onPress={() => router.push('/prepper-orders')} />
              <StatCard Icon={Users} value={String(subscribers)} label="customers" trend="unique" color={PURPLE} spark={[1, 2, 2, 3, 4, 4, 5, 6]} onPress={() => router.push('/customers')} />
              <StatCard Icon={Star} value={avgRating ? avgRating.toFixed(1) : '—'} label="rating" trend={`${reviewCount} reviews`} color={YELLOW} spark={[4, 4, 5, 5, 4, 5, 5, 5]} onPress={() => router.push('/prepper-analytics')} />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10, paddingTop: 14, paddingBottom: 6 }}>
              <StatCard Icon={ShoppingBag} value={money(revenue)} label="total sales" trend={revenue > 0 ? 'earned' : '—'} color={ORANGE} spark={[3, 5, 4, 6, 5, 8, 7, 9]} onPress={() => router.push('/earnings')} flex />
              <StatCard Icon={Boxes} value={String(list.length)} label="orders" trend={`${newCount} new`} color={GREEN} spark={[2, 3, 3, 4, 6, 5, 7, 8]} onPress={() => router.push('/prepper-orders')} flex />
              <StatCard Icon={Users} value={String(subscribers)} label="customers" trend="unique" color={PURPLE} spark={[1, 2, 2, 3, 4, 4, 5, 6]} onPress={() => router.push('/customers')} flex />
              <StatCard Icon={Star} value={avgRating ? avgRating.toFixed(1) : '—'} label="rating" trend={`${reviewCount} reviews`} color={YELLOW} spark={[4, 4, 5, 5, 4, 5, 5, 5]} onPress={() => router.push('/prepper-analytics')} flex />
            </View>
          )}
          </MotiView>

          {/* Goal + this week */}
          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320, delay: 180 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginHorizontal: 20, marginTop: 4, marginBottom: 4, backgroundColor: CARD, borderRadius: 20, padding: 16 }}>
            <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, flexShrink: 0 }}>
              <Ring pct={goalPct} color={ORANGE} size={64} stroke={7} />
              <View style={{ position: 'absolute', alignItems: 'center' }}>
                <Text style={{ fontFamily: Font.display, fontSize: 14, color: INK }}>{goalPct}%</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED }}>today's goal</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.4, fontVariant: ['tabular-nums'] }}>{money(revenue)}</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: MUTED }}>of $2k</Text>
            </View>
            <View style={{ alignItems: 'center', paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: Palette.chip }}>
              <Text style={{ fontFamily: Font.display, fontSize: 24, color: ORANGE, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>{Math.min(list.length, 30)}</Text>
              <Text style={{ fontFamily: Font.semibold, fontSize: 10.5, color: MUTED, marginBottom: 6 }}>this week</Text>
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <View key={i} style={{ width: 18, height: 18, borderRadius: 4, backgroundColor: i < 5 ? ORANGE + '22' : Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 9, color: i < 5 ? ORANGE : MUTED }}>{d}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          </MotiView>

          {/* Badges earned */}
          {prepperBadges && prepperBadges.length > 0 ? (
            <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
              <PrepperBadgeShelf badges={prepperBadges} />
            </View>
          ) : null}

          {/* Pro upgrade nudge — shown only on free tier */}
          {!isPro ? (
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 220 }}>
              <PressableScale onPress={() => { feedback.tap(); router.push('/prepper-premium'); }} accessibilityRole="button" accessibilityLabel="Upgrade to Prepper Pro"
                style={{ marginHorizontal: 20, marginBottom: 10, backgroundColor: CARD, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: ORANGE + '28' }}>
                <Crown size={15} color={ORANGE} />
                <Text style={{ flex: 1, fontFamily: Font.medium, fontSize: 13, color: MUTED }}>Go Pro — boosts, livestream & AI tools · $29/mo</Text>
                <ChevronRight size={14} color={ORANGE} />
              </PressableScale>
            </MotiView>
          ) : null}

          {/* Profile health score */}
          {prepperProfile ? (
            <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 260 }}>
              <ProfileHealthCard profile={prepperProfile} />
            </MotiView>
          ) : null}

        </ScrollView>

        {/* Floating action bar (add meal · go live · + · new drop · opportunity) */}
        <View style={[{ position: 'absolute', left: 16, right: 16, bottom: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CARD, borderRadius: 26, paddingVertical: 12, paddingHorizontal: 18, ...Shadow.floating }, desktop && { left: undefined, right: undefined, alignSelf: 'center', width: 520 }]}>
          <ActionItem Icon={TrendingUp} label="earnings" color={Palette.inkSoft} onPress={() => router.push('/earnings')} />
          <ActionItem Icon={Video} label="go live" color={PINK} onPress={() => router.push('/post-video')} />
          <PressableScale accessibilityRole="button" accessibilityLabel="Add new meal" onPress={() => { feedback.tap(); router.push('/meal-editor'); }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: -26, backgroundColor: ORANGE, ...Shadow.floating, shadowColor: ORANGE, shadowOpacity: 0.45 }}>
              <Plus size={28} color="#fff" />
            </View>
          </PressableScale>
          <ActionItem Icon={Gift} label="new drop" color={PURPLE} onPress={() => router.push('/meal-editor?drop=1')} />
          <ActionItem Icon={Briefcase} label="opportunity" color={ORANGE} onPress={() => router.push('/opportunities')} />
        </View>

        {/* Prepper tab nav (dark) */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: Palette.surface, paddingTop: 10, paddingBottom: 22, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...Shadow.navBar }}>
          <NavTab Icon={Home} label="home" onPress={() => router.push('/')} />
          <NavTab Icon={ShoppingBag} label="orders" badge={newCount || undefined} onPress={() => router.push('/prepper-orders')} />
          <NavTab Icon={ChefHat} label="kitchen" active />
          <NavTab Icon={MessageSquare} label="messages" onPress={() => router.push('/messages')} />
          <NavTab Icon={User} label="profile" onPress={() => router.push('/profile')} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function ActionItem({ Icon, label, color, onPress }: { Icon: LucideIcon; label: string; color: string; onPress?: () => void }) {
  return (
    <PressableScale onPress={onPress ? () => { feedback.tap(); onPress(); } : undefined} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: 'center', gap: 5, width: 58 }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: color === Palette.inkSoft ? Palette.border : color + '66', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={color} />
      </View>
      <Text style={{ fontFamily: Font.medium, fontSize: 10, color: Palette.textMuted }} numberOfLines={1}>{label}</Text>
    </PressableScale>
  );
}

function NavTab({ Icon, label, active, badge, onPress }: { Icon: LucideIcon; label: string; active?: boolean; badge?: number; onPress?: () => void }) {
  const color = active ? ORANGE : Palette.textSecondary;
  return (
    <PressableScale onPress={onPress ? () => { feedback.tap(); onPress(); } : undefined} accessibilityRole="button" accessibilityState={{ selected: !!active }} accessibilityLabel={label} style={{ alignItems: 'center', gap: 3 }}>
      <View>
        <Icon size={22} color={color} strokeWidth={active ? 2.4 : 2} />
        {badge ? (
          <View style={{ position: 'absolute', top: -5, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 9, color: '#fff' }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontFamily: Font.medium, fontSize: 10, color }}>{label}</Text>
    </PressableScale>
  );
}
