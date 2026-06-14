import { AlertTriangle, ClipboardList, DollarSign, Repeat, ShoppingBag, Store, TrendingUp, Users } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { useMarketplaceFit, usePlatformStats } from '@/lib/queries/admin';
import { Admin, Card, money, compact, SectionState, StatCard } from './ui';

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

export function AdminOverview({ onReviewPreppers, onNavigate, openDisputeCount }: { onReviewPreppers: () => void; onNavigate?: (section: 'preppers' | 'customers' | 'orders' | 'earnings' | 'disputes') => void; openDisputeCount?: number }) {
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
                  <Text onPress={onReviewPreppers} style={{ fontFamily: Font.semibold, fontSize: 13, color: Admin.warn, marginTop: 2 }}>
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
                  <Text onPress={() => onNavigate?.('disputes')} style={{ fontFamily: Font.semibold, fontSize: 13, color: Admin.danger, marginTop: 2 }}>
                    Review disputes →
                  </Text>
                </View>
              </View>
            </Card>
            </MotiView>
          ) : null}

          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <TrendingUp size={16} color={Admin.success} />
              <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Admin.text }}>Platform health</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Admin.text, fontVariant: ['tabular-nums'] }}>
                  {s.total_orders > 0 && s.gmv > 0 ? money(s.gmv / s.total_orders) : '—'}
                </Text>
                <Text style={{ fontFamily: Font.body, fontSize: 11, color: Admin.textDim, marginTop: 1 }}>avg order value</Text>
              </View>
              <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: Admin.border, paddingLeft: 12 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Admin.text, fontVariant: ['tabular-nums'] }}>{compact(s.open_orders)}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 11, color: Admin.textDim, marginTop: 1 }}>in-flight orders</Text>
              </View>
              <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: Admin.border, paddingLeft: 12 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Admin.text, fontVariant: ['tabular-nums'] }}>{compact(s.approved_preppers)}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 11, color: Admin.textDim, marginTop: 1 }}>active kitchens</Text>
              </View>
            </View>
            {s.gmv === 0 ? (
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim, lineHeight: 18, marginTop: 10 }}>
                No completed sales yet — revenue appears here once orders complete.
              </Text>
            ) : null}
          </Card>
        </>
      ) : null}
    </View>
  );
}
