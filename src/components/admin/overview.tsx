import { AlertTriangle, BarChart2, ClipboardList, DollarSign, Repeat, ShoppingBag, Star, Store, TrendingUp, Users } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { useAdminGmvChart, useAdminTopPreppers, useMarketplaceFit, usePlatformStats } from '@/lib/queries/admin';
import { Admin, Card, money, compact, SectionState, StatCard } from './ui';
import { AdminGmvChart } from './gmv-chart';

/**
 * The one signal that separates a marketplace from a fragile one-time app:
 * do customers reorder from the SAME kitchen? Shown front-and-centre.
 */
function MarketplaceFitCard() {
  const { data: f } = useMarketplaceFit();
  if (!f) return null;
  const rate = f.repeat_buyer_rate;
  const enoughData = f.completed_orders >= 10 && f.buyers >= 5;
  const strong = (rate ?? 0) >= 30;
  const heroColor = !enoughData ? Admin.textDim : strong ? Admin.success : Admin.warn;
  return (
    <Card style={{ borderColor: heroColor + '40', backgroundColor: heroColor + '0E' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Repeat size={16} color={heroColor} />
        <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Admin.text }}>Marketplace fit — do customers reorder?</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
        <Text style={{ fontFamily: Font.display, fontSize: 40, color: heroColor, lineHeight: 44, fontVariant: ['tabular-nums'] }}>
          {rate == null ? '—' : `${rate}%`}
        </Text>
        <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Admin.textDim, flex: 1, marginBottom: 5, lineHeight: 17 }}>
          of buyers reordered from the same kitchen
          {f.buyers > 0 ? ` (${compact(f.repeat_buyers)}/${compact(f.buyers)})` : ''}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 18, marginTop: 10 }}>
        <View>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Admin.text, fontVariant: ['tabular-nums'] }}>{f.repeat_order_share == null ? '—' : `${f.repeat_order_share}%`}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 11, color: Admin.textDim }}>of orders are repeats</Text>
        </View>
        <View>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Admin.text, fontVariant: ['tabular-nums'] }}>{compact(f.active_preppers_30d)}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 11, color: Admin.textDim }}>kitchens active (30d)</Text>
        </View>
      </View>
      <Text style={{ fontFamily: Font.body, fontSize: 11.5, color: Admin.textDim, lineHeight: 17, marginTop: 10 }}>
        {!enoughData
          ? 'Not enough completed orders yet to read the signal — this is the number to watch as supply and demand grow.'
          : strong
            ? 'Customers are coming back to the same kitchens — the marketplace flywheel is turning.'
            : 'Repeat rate is low — focus on retention before scaling, or growth just amplifies churn.'}
      </Text>
    </Card>
  );
}

function PlatformHealthRow({ s }: { s: { orders_today: number; approved_preppers: number; total_orders: number; gmv: number } }) {
  const avgOrder = s.total_orders > 0 && s.gmv > 0 ? money(s.gmv / s.total_orders) : '—';
  const items = [
    { label: "today's orders", value: compact(s.orders_today) },
    { label: 'active kitchens', value: compact(s.approved_preppers) },
    { label: 'avg order value', value: avgOrder },
  ];
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <TrendingUp size={16} color={Admin.success} />
        <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Admin.text }}>Platform health</Text>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {items.map(({ label, value }, i) => (
          <View
            key={label}
            style={[
              { flex: 1 },
              i > 0 && { borderLeftWidth: 1, borderLeftColor: Admin.border, paddingLeft: 12 },
            ]}
          >
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Admin.text, fontVariant: ['tabular-nums'] }}>
              {value}
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 11, color: Admin.textDim, marginTop: 1 }}>{label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function GmvSection() {
  const { data = [] } = useAdminGmvChart();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <BarChart2 size={16} color={Admin.brand} />
        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Admin.text }}>GMV (last 8 weeks)</Text>
      </View>
      <AdminGmvChart data={data} />
    </Card>
  );
}

function TopPreppersSection({ onPressPrepperRow }: { onPressPrepperRow?: () => void }) {
  const { data = [] } = useAdminTopPreppers(10);
  if (!data.length) return null;
  return (
    <Card>
      <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Admin.text, marginBottom: 12 }}>
        top kitchens by revenue
      </Text>
      <View style={{ gap: 0 }}>
        {data.map((p, i) => {
          const isEven = i % 2 === 0;
          return (
            <PressableScale
              key={p.prepperId}
              onPress={() => { feedback.tap(); onPressPrepperRow?.(); }}
              accessibilityRole="button"
              accessibilityLabel={`${p.displayName}, rank ${i + 1}`}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 9,
                  paddingHorizontal: 8,
                  borderRadius: 8,
                  backgroundColor: isEven ? 'transparent' : Admin.border + '55',
                }}
              >
                {/* Rank */}
                <Text style={{ fontFamily: Font.display, fontSize: 16, color: Admin.textDim, width: 28, textAlign: 'center', fontVariant: ['tabular-nums'] }}>
                  {i + 1}
                </Text>

                {/* Name */}
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Admin.text, flex: 1 }} numberOfLines={1}>
                  {p.displayName}
                </Text>

                {/* Revenue */}
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Admin.brand, width: 72, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                  {money(p.totalRevenue)}
                </Text>

                {/* Order count */}
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim, width: 54, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                  {compact(p.orderCount)} orders
                </Text>

                {/* Rating */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, width: 36, justifyContent: 'flex-end' }}>
                  <Star size={12} color={Admin.warn} fill={Admin.warn} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Admin.text, fontVariant: ['tabular-nums'] }}>
                    {p.avgRating > 0 ? p.avgRating.toFixed(1) : '—'}
                  </Text>
                </View>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </Card>
  );
}

export function AdminOverview({ onReviewPreppers, onNavigate, onSectionChange, openDisputeCount }: { onReviewPreppers: () => void; onNavigate?: (section: 'preppers' | 'customers' | 'orders' | 'earnings' | 'disputes') => void; onSectionChange?: (section: 'preppers' | 'customers' | 'orders' | 'earnings' | 'features' | 'disputes' | 'overview') => void; openDisputeCount?: number }) {
  const { data, isLoading, isError } = usePlatformStats();
  const s = data;

  return (
    <View style={{ gap: 12 }}>
      <SectionState loading={isLoading} error={isError} empty={!s} emptyText="No platform data yet." />
      {s ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {[
              { nav: 'earnings' as const, label: 'Total revenue', value: money(s.gmv), sub: `${money(s.gmv_today)} today`, Icon: DollarSign, tone: 'success' as const },
              { nav: 'orders' as const, label: 'Orders', value: compact(s.total_orders), sub: `${compact(s.orders_today)} today · ${compact(s.open_orders)} open`, Icon: ShoppingBag, tone: 'brand' as const },
              { nav: 'customers' as const, label: 'Customers', value: compact(s.total_users), Icon: Users, tone: 'brand' as const },
              { nav: 'preppers' as const, label: 'Preppers', value: compact(s.approved_preppers), sub: `${compact(s.total_preppers)} total`, Icon: Store, tone: 'success' as const },
            ].map(({ nav, ...props }, i) => (
              <MotiView key={nav} from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: i * 55 }} style={{ flex: 1, minWidth: 150 }}>
                <PressableScale onPress={() => { feedback.tap(); onNavigate?.(nav); }} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`Go to ${props.label}`}>
                  <StatCard {...props} />
                </PressableScale>
              </MotiView>
            ))}
          </View>

          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 200 }}>
            <MarketplaceFitCard />
          </MotiView>

          {s.pending_preppers > 0 ? (
            <Card style={{ borderColor: Admin.warn + '55', backgroundColor: Admin.warn + '14' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Admin.warn + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <ClipboardList size={20} color={Admin.warn} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Admin.text }}>
                    {s.pending_preppers} prepper{s.pending_preppers === 1 ? '' : 's'} awaiting approval
                  </Text>
                  <Text onPress={() => { onSectionChange?.('preppers'); onReviewPreppers(); }} accessibilityRole="button" accessibilityLabel="Review prepper applications" style={{ fontFamily: Font.semibold, fontSize: 13, color: Admin.warn, marginTop: 2 }}>
                    Review applications →
                  </Text>
                </View>
              </View>
            </Card>
          ) : null}

          {openDisputeCount != null && openDisputeCount > 0 ? (
            <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 220 }}>
            <Card style={{ borderColor: Admin.danger + '55', backgroundColor: Admin.danger + '12' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: Admin.danger + '22', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={20} color={Admin.danger} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Admin.text }}>
                    {openDisputeCount} open dispute{openDisputeCount === 1 ? '' : 's'} need attention
                  </Text>
                  <Text onPress={() => { onSectionChange?.('disputes'); onNavigate?.('disputes'); }} accessibilityRole="button" accessibilityLabel="Review disputes" style={{ fontFamily: Font.semibold, fontSize: 13, color: Admin.danger, marginTop: 2 }}>
                    Review disputes →
                  </Text>
                </View>
              </View>
            </Card>
            </MotiView>
          ) : null}

          <PlatformHealthRow s={s} />

          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 280 }}>
            <GmvSection />
          </MotiView>

          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 340 }}>
            <TopPreppersSection onPressPrepperRow={() => onSectionChange?.('preppers')} />
          </MotiView>
        </>
      ) : null}
    </View>
  );
}
