/**
 * Tablet two-column layout for the prepper dashboard.
 * Left column (40%): stat chips + quick actions.
 * Right column (60%): next order panel + daily progress.
 *
 * The parent (dashboard.tsx) renders this when useBreakpoint() === 'tablet'
 * and keeps the single-column layout for mobile.
 */
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  Boxes,
  ChevronRight,
  Check,
  Clock,
  Crown,
  Gift,
  Pencil,
  Share2,
  ShoppingBag,
  Star,
  Truck,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Ring, Sparkline, StatCard } from '@/components/dashboard-widgets';
import { PrepperBadgeShelf } from '@/components/badge-shelf';
import { ProfileHealthCard } from '@/components/profile-health-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import type { FulfillmentType, OrderStatus, PrepperBadgeKey } from '@/types/database.types';
import type { OrderSummary } from '@/lib/queries/orders';
import type { PrepperProfile } from '@/lib/queries/preppers';

// ── local token shortcuts ─────────────────────────────────────────────────────
const ORANGE = Palette.brand;
const GREEN = Palette.success;
const PURPLE = '#a78bfa';
const YELLOW = Palette.amber;
const CARD = Palette.surface;
const INK = Palette.ink;
const MUTED = Palette.textSecondary;

const money = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);

export const FULFILLMENT_COLOR: Record<FulfillmentType, string> = {
  pickup: Palette.amber, delivery: '#06b6d4', meetup: '#a78bfa', home_cook: '#22c55e',
};
export const FULFILLMENT_LABEL: Record<FulfillmentType, string> = {
  pickup: 'pickup', delivery: 'delivery', meetup: 'meetup', home_cook: 'home cook',
};

// ── types ─────────────────────────────────────────────────────────────────────

export type DashboardColumnsProps = {
  isPro: boolean;
  prepper: { id: string } | null;
  // Stat data
  revenue: number;
  orderCount: number;
  subscribers: number;
  avgRating: number;
  reviewCount: number;
  newCount: number;
  revenueSpark: number[];
  ordersSpark: number[];
  customersSpark: number[];
  ratingSpark: number[];
  // Progress ring
  todayRevenue: number;
  dailyGoal: number;
  goalPct: number;
  weekCount: number;
  weekDays: boolean[];
  // Orders
  next: OrderSummary | null;
  active: OrderSummary[];
  statsLoading: boolean;
  advancePending: boolean;
  advanceErr: string | null;
  // Callbacks
  onAdvanceNext: (nextStatus: OrderStatus) => void;
  onShareKitchen: () => void;
  onDismissAdvanceErr: () => void;
  // Badges & health
  prepperBadges?: PrepperBadgeKey[];
  prepperProfile?: PrepperProfile | null;
};

const NEXT_STATUS: Partial<Record<OrderStatus, { next: OrderStatus; cta: string }>> = {
  pending: { next: 'confirmed', cta: 'confirm preorder' },
  confirmed: { next: 'preparing', cta: 'start prepping' },
  preparing: { next: 'ready', cta: 'mark ready' },
  ready: { next: 'completed', cta: 'mark complete' },
  out_for_delivery: { next: 'completed', cta: 'mark complete' },
};

// ── sub-components ────────────────────────────────────────────────────────────

function ActionRow({ Icon, label, onPress, color = MUTED }: { Icon: LucideIcon; label: string; onPress: () => void; color?: string }) {
  return (
    <PressableScale
      onPress={() => { feedback.tap(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.actionRow}>
      <View style={[styles.actionIcon, { borderColor: color + '50' }]}>
        <Icon size={16} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <ChevronRight size={14} color={ORANGE} />
    </PressableScale>
  );
}

// ── main export ───────────────────────────────────────────────────────────────

export function TabletDashboardColumns(props: DashboardColumnsProps) {
  const router = useRouter();
  const {
    isPro, prepper,
    revenue, orderCount, subscribers, avgRating, reviewCount, newCount,
    revenueSpark, ordersSpark, customersSpark, ratingSpark,
    todayRevenue, dailyGoal, goalPct, weekCount, weekDays,
    next, active, statsLoading, advancePending, advanceErr,
    onAdvanceNext, onShareKitchen, onDismissAdvanceErr,
    prepperBadges, prepperProfile,
  } = props;

  const step = next ? NEXT_STATUS[next.status] : undefined;

  return (
    <View style={styles.root}>
      {/* ── LEFT COLUMN (40%): stats + quick actions ── */}
      <ScrollView style={styles.leftCol} showsVerticalScrollIndicator={false} contentContainerStyle={styles.leftContent}>

        <Text style={styles.sectionLabel}>your stats</Text>
        <View style={styles.divider} />

        <View style={styles.statsGrid}>
          <StatCard Icon={ShoppingBag} value={money(revenue)} label="total sales" trend={revenue > 0 ? 'earned' : '—'} color={ORANGE} spark={revenueSpark} onPress={() => router.push('/earnings')} flex />
          <StatCard Icon={Boxes} value={String(orderCount)} label="orders" trend={`${newCount} new`} color={GREEN} spark={ordersSpark} onPress={() => router.push('/prepper-orders')} flex />
          <StatCard Icon={Users} value={String(subscribers)} label="customers" trend="unique" color={PURPLE} spark={customersSpark} onPress={() => router.push('/customers')} flex />
          <StatCard Icon={Star} value={avgRating ? avgRating.toFixed(1) : '—'} label="rating" trend={`${reviewCount} reviews`} color={YELLOW} spark={ratingSpark} onPress={() => router.push('/prepper-analytics')} flex />
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>quick actions</Text>
        <View style={styles.divider} />

        <View style={styles.actionsBlock}>
          {!isPro ? (
            <ActionRow Icon={Crown} label="Upgrade to Prepper Pro · $29/mo" color={ORANGE} onPress={() => router.push('/prepper-premium')} />
          ) : null}
          {prepper?.id ? (
            <>
              <ActionRow Icon={Share2} label="Share your kitchen" onPress={onShareKitchen} />
              <ActionRow Icon={Pencil} label="Edit kitchen profile" onPress={() => router.push('/kitchen-settings')} />
              <ActionRow Icon={Truck} label="Delivery & pickup settings" onPress={() => router.push('/delivery-settings')} />
              <ActionRow Icon={Gift} label="New meal drop" color={PURPLE} onPress={() => router.push('/meal-editor?drop=1')} />
            </>
          ) : null}
        </View>

        {prepperBadges && prepperBadges.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>badges</Text>
            <View style={styles.divider} />
            <PrepperBadgeShelf badges={prepperBadges} />
          </>
        ) : null}

        {prepperProfile ? (
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }} style={{ marginTop: 16 }}>
            <ProfileHealthCard profile={prepperProfile} />
          </MotiView>
        ) : null}
      </ScrollView>

      {/* vertical divider */}
      <View style={styles.colDivider} />

      {/* ── RIGHT COLUMN (60%): next order + daily progress ── */}
      <ScrollView style={styles.rightCol} showsVerticalScrollIndicator={false} contentContainerStyle={styles.rightContent}>

        <Text style={styles.sectionLabel}>next preorder</Text>
        <View style={styles.divider} />

        {next ? (
          <View style={styles.orderCard}>
            <View style={styles.orderRow}>
              {next.items[0]?.image ? (
                <Image source={next.items[0].image} style={styles.orderImg} contentFit="cover" accessibilityLabel={next.items[0].title} />
              ) : (
                <View style={[styles.orderImg, styles.orderImgFallback]}>
                  <UtensilsCrossed size={26} color={MUTED} />
                </View>
              )}
              <View style={styles.orderInfo}>
                <Text style={styles.orderCustomer} numberOfLines={1}>{next.customer}</Text>
                <Text style={styles.orderItem} numberOfLines={1}>
                  {next.items[0]?.title ?? 'preorder'}{next.items.length > 1 ? ` +${next.items.length - 1}` : ''}
                </Text>
                <View style={styles.orderMeta}>
                  <View style={[styles.chip, { backgroundColor: next.paymentStatus === 'succeeded' ? GREEN + '24' : Palette.chip }]}>
                    {next.paymentStatus === 'succeeded' ? <Check size={11} color={GREEN} strokeWidth={2.5} /> : null}
                    <Text style={[styles.chipText, { color: next.paymentStatus === 'succeeded' ? GREEN : MUTED }]}>
                      {next.paymentStatus === 'succeeded' ? 'paid' : 'unpaid'}
                    </Text>
                  </View>
                  <View style={[styles.chip, { backgroundColor: FULFILLMENT_COLOR[next.fulfillment] + '22' }]}>
                    <Text style={[styles.chipText, { color: FULFILLMENT_COLOR[next.fulfillment] }]}>{FULFILLMENT_LABEL[next.fulfillment]}</Text>
                  </View>
                  <Text style={styles.orderTotal}>${next.total.toFixed(2)}</Text>
                </View>
              </View>
            </View>
            {step ? (
              <>
                <PressableScale
                  onPress={() => { feedback.tap(); onAdvanceNext(step.next); }}
                  disabled={advancePending}
                  accessibilityRole="button"
                  accessibilityLabel={step.cta}
                  style={[styles.advanceBtn, advancePending && styles.advanceBtnDisabled]}>
                  <Text style={styles.advanceBtnLabel}>{step.cta}</Text>
                </PressableScale>
                {advanceErr ? (
                  <PressableScale onPress={onDismissAdvanceErr} accessibilityRole="button" accessibilityLabel="Dismiss error">
                    <Text style={styles.advanceErr}>{advanceErr} (tap to dismiss)</Text>
                  </PressableScale>
                ) : null}
              </>
            ) : null}
            {active.length > 1 ? (
              <PressableScale onPress={() => { feedback.tap(); router.push('/prepper-orders'); }} accessibilityRole="button" accessibilityLabel={`See all ${active.length} active orders`} style={styles.seeAll}>
                <Text style={styles.seeAllText}>+{active.length - 1} more in queue — see all →</Text>
              </PressableScale>
            ) : null}
          </View>
        ) : statsLoading ? null : (
          <View style={styles.emptyOrders}>
            <View style={styles.emptyIcon}>
              <ShoppingBag size={24} color={MUTED} />
            </View>
            <Text style={styles.emptyTitle}>No active preorders</Text>
            <Text style={styles.emptyBody}>New preorders land here instantly once customers check out.</Text>
            <PressableScale onPress={() => { feedback.tap(); router.push('/prepper-orders'); }} accessibilityRole="button" accessibilityLabel="View all orders"
              style={styles.emptyBtn}>
              <Text style={styles.emptyBtnLabel}>view all orders →</Text>
            </PressableScale>
          </View>
        )}

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>today's progress</Text>
        <View style={styles.divider} />

        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            <View style={styles.ringWrap}>
              <Ring pct={goalPct} color={ORANGE} size={80} stroke={8} />
              <View style={styles.ringLabel}>
                <Text style={styles.ringPct}>{goalPct}%</Text>
              </View>
            </View>
            <View style={styles.progressInfo}>
              <Text style={styles.progressCaption}>today's goal</Text>
              <Text style={styles.progressAmount}>{money(todayRevenue)}</Text>
              <Text style={styles.progressGoal}>of {money(dailyGoal)}</Text>
            </View>
            <View style={styles.weekCountWrap}>
              <Text style={styles.weekCountNum}>{weekCount}</Text>
              <Text style={styles.weekCountLabel}>this week</Text>
            </View>
          </View>
          <View style={styles.weekRow}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <View key={i} style={[styles.weekDay, weekDays[i] && styles.weekDayActive]}>
                <Text style={[styles.weekDayLabel, weekDays[i] && styles.weekDayLabelActive]}>{d}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>8-day sparklines</Text>
          <View style={styles.divider} />
          <View style={styles.sparkRow}>
            <View style={styles.sparkItem}>
              <Text style={styles.sparkCaption}>revenue</Text>
              <Sparkline data={revenueSpark} color={ORANGE} w={120} h={36} />
            </View>
            <View style={styles.sparkItem}>
              <Text style={styles.sparkCaption}>orders</Text>
              <Sparkline data={ordersSpark} color={GREEN} w={120} h={36} />
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  leftCol: {
    flex: 4,
  },
  leftContent: {
    padding: 24,
    paddingBottom: 60,
    gap: 8,
  },
  rightCol: {
    flex: 6,
  },
  rightContent: {
    padding: 24,
    paddingBottom: 60,
  },
  colDivider: {
    width: 1,
    backgroundColor: Palette.border,
    marginVertical: 24,
  },
  sectionLabel: {
    fontFamily: Font.display,
    fontSize: 13,
    color: INK,
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: Palette.border,
    marginBottom: 12,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionsBlock: {
    gap: 6,
  },
  actionRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontFamily: Font.medium,
    fontSize: 13,
    color: MUTED,
  },
  // Order card
  orderCard: {
    backgroundColor: CARD,
    borderRadius: Radius.md,
    padding: 18,
    gap: 14,
    ...Shadow.card,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  orderImg: {
    width: 80,
    height: 80,
    borderRadius: 18,
  },
  orderImgFallback: {
    backgroundColor: Palette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderInfo: {
    flex: 1,
    gap: 4,
  },
  orderCustomer: {
    fontFamily: Font.heading,
    fontSize: 16,
    color: INK,
  },
  orderItem: {
    fontFamily: Font.body,
    fontSize: 13,
    color: MUTED,
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  chipText: {
    fontFamily: Font.semibold,
    fontSize: 11.5,
  },
  orderTotal: {
    fontFamily: Font.display,
    fontSize: 16,
    color: INK,
  },
  advanceBtn: {
    height: 52,
    borderRadius: Radius.pill,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advanceBtnDisabled: {
    opacity: 0.7,
  },
  advanceBtnLabel: {
    fontFamily: Font.heading,
    fontSize: 16,
    color: '#fff',
  },
  advanceErr: {
    fontFamily: Font.body,
    fontSize: 12.5,
    color: Palette.danger,
    textAlign: 'center',
  },
  seeAll: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  seeAllText: {
    fontFamily: Font.semibold,
    fontSize: 13,
    color: ORANGE,
  },
  // Empty orders
  emptyOrders: {
    backgroundColor: CARD,
    borderRadius: Radius.md,
    padding: 24,
    alignItems: 'center',
    gap: 10,
    ...Shadow.card,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Palette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: Font.heading,
    fontSize: 15,
    color: INK,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: Font.body,
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
  },
  emptyBtn: {
    marginTop: 4,
    backgroundColor: ORANGE,
    borderRadius: Radius.pill,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  emptyBtnLabel: {
    fontFamily: Font.semibold,
    fontSize: 13.5,
    color: '#fff',
  },
  // Progress card
  progressCard: {
    backgroundColor: CARD,
    borderRadius: Radius.md,
    padding: 20,
    gap: 14,
    ...Shadow.card,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ringWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringPct: {
    fontFamily: Font.display,
    fontSize: 14,
    color: INK,
  },
  progressInfo: {
    flex: 1,
  },
  progressCaption: {
    fontFamily: Font.body,
    fontSize: 12,
    color: MUTED,
  },
  progressAmount: {
    fontFamily: Font.display,
    fontSize: 22,
    color: INK,
    letterSpacing: -0.4,
  },
  progressGoal: {
    fontFamily: Font.body,
    fontSize: 11.5,
    color: MUTED,
  },
  weekCountWrap: {
    alignItems: 'center',
    gap: 2,
  },
  weekCountNum: {
    fontFamily: Font.display,
    fontSize: 28,
    color: ORANGE,
    letterSpacing: -0.5,
  },
  weekCountLabel: {
    fontFamily: Font.semibold,
    fontSize: 10.5,
    color: MUTED,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Palette.chip,
  },
  weekDay: {
    flex: 1,
    height: 28,
    borderRadius: 7,
    backgroundColor: Palette.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayActive: {
    backgroundColor: ORANGE + '22',
  },
  weekDayLabel: {
    fontFamily: Font.semibold,
    fontSize: 10,
    color: MUTED,
  },
  weekDayLabelActive: {
    color: ORANGE,
  },
  sparkRow: {
    flexDirection: 'row',
    gap: 20,
  },
  sparkItem: {
    flex: 1,
    gap: 4,
  },
  sparkCaption: {
    fontFamily: Font.medium,
    fontSize: 11,
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
