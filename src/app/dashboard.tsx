import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  Bell,
  Boxes,
  Briefcase,
  ChefHat,
  DollarSign,
  Flame,
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
import { Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Shadow } from '@/constants/theme';
import { greeting } from '@/lib/greeting';
import { useBreakpoint } from '@/lib/layout';
import { useAdvanceOrder, usePrepperOrders, type OrderSummary } from '@/lib/queries/orders';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { usePrepperReviews } from '@/lib/queries/reviews';
import { useAuth } from '@/providers/auth-provider';
import type { OrderStatus } from '@/types/database.types';

const ORANGE = Palette.brand;
const GREEN = '#34d399';
const PURPLE = '#a78bfa';
const YELLOW = '#fbbf24';
const PINK = '#f472b6';
const BLUE = '#60a5fa';
const CARD = Palette.prepperCard;
const BG = Palette.prepperBg;
const MUTED = '#9ca3af';

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
      <Circle cx={center} cy={center} r={r} stroke="#252a34" strokeWidth={stroke} fill="none" />
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

function StatCard({ Icon, value, label, trend, color, spark }: { Icon: LucideIcon; value: string; label: string; trend: string; color: string; spark: number[] }) {
  return (
    <View style={{ width: 150, backgroundColor: CARD, borderRadius: 22, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: color + '24', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={19} color={color} />
        </View>
        <Text style={{ fontFamily: Font.semibold, fontSize: 12, color }}>{trend}</Text>
      </View>
      <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: MUTED }}>{label}</Text>
      <Text style={{ fontFamily: Font.display, fontSize: 26, color: '#fff', letterSpacing: -0.6 }}>{value}</Text>
      <Sparkline color={color} data={spark} />
    </View>
  );
}

function QuickAction({ Icon, label, color, badge, onPress }: { Icon: LucideIcon; label: string; color: string; badge?: number; onPress?: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: 'center', gap: 8, width: 72 }}>
      <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, borderColor: color + '4D', backgroundColor: color + '14', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={23} color={color} />
        {badge ? (
          <View style={{ position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: '#fff' }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ fontFamily: Font.medium, fontSize: 11.5, color: '#d1d5db' }}>{label}</Text>
    </PressableScale>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const desktop = useBreakpoint() === 'desktop';
  const { user } = useAuth();
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const { data: orders } = usePrepperOrders(prepper?.id);
  const { data: reviews } = usePrepperReviews(prepper?.id);
  const advance = useAdvanceOrder();

  const list: OrderSummary[] = orders ?? [];
  const newCount = list.filter((o) => o.status === 'pending').length;
  const revenue = list.filter((o) => o.status === 'completed').reduce((s, o) => s + o.total, 0);
  const subscribers = new Set(list.map((o) => o.customer)).size;
  const reviewCount = reviews?.length ?? 0;
  const avgRating = reviewCount ? reviews!.reduce((s, r) => s + r.rating, 0) / reviewCount : 0;
  const firstName = prepper?.display_name?.split(' ')[0]?.toLowerCase() ?? 'chef';

  // Oldest still-active order = the one to act on next.
  const active = list.filter((o) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'preparing' || o.status === 'ready');
  const next = active.length ? active[active.length - 1] : null;
  const step = next ? NEXT[next.status] : undefined;

  // Today's-goal ring: completed revenue toward a $2,000 day (display-only target).
  const goalPct = Math.min(Math.round((revenue / 2000) * 100), 100);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 16 : 8, paddingBottom: 150 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 12 }}>
            <PressableScale onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} accessibilityRole="button" accessibilityLabel="Back to customer view" style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 2, borderColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Image source="https://images.unsplash.com/photo-1583394293214-28a5b0f5a5b8?auto=format&fit=crop&w=120&q=60" style={{ width: 46, height: 46, borderRadius: 23 }} contentFit="cover" />
            </PressableScale>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }}>{greeting()}, chef 👋</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 27, color: '#fff', letterSpacing: -0.8 }}>my kitchen</Text>
                <Flame size={20} color={ORANGE} fill={ORANGE} />
              </View>
              <View style={{ flexDirection: 'row', gap: 5, marginTop: 1 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>cook.</Text>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: GREEN }}>earn.</Text>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: PURPLE }}>inspire.</Text>
              </View>
            </View>
            <PressableScale onPress={() => router.push('/search')} accessibilityRole="button" accessibilityLabel="Search" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
              <Search size={19} color="#fff" />
            </PressableScale>
            <PressableScale accessibilityRole="button" accessibilityLabel="Notifications" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={19} color="#fff" />
              {newCount > 0 ? (
                <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: '#fff' }}>{newCount}</Text>
                </View>
              ) : null}
            </PressableScale>
          </View>

          {/* Stat cards — KPI row on desktop, swipeable on phones */}
          {(() => {
            const cards = (
              <>
                <StatCard Icon={ShoppingBag} value={money(revenue)} label="total sales" trend={revenue > 0 ? 'earned' : '—'} color={ORANGE} spark={[3, 5, 4, 6, 5, 8, 7, 9]} />
                <StatCard Icon={Boxes} value={String(list.length)} label="orders" trend={`${newCount} new`} color={GREEN} spark={[2, 3, 3, 4, 6, 5, 7, 8]} />
                <StatCard Icon={Users} value={String(subscribers)} label="customers" trend="unique" color={PURPLE} spark={[1, 2, 2, 3, 4, 4, 5, 6]} />
                <StatCard Icon={Star} value={avgRating ? avgRating.toFixed(1) : '—'} label="rating" trend={`${reviewCount} reviews`} color={YELLOW} spark={[4, 4, 5, 5, 4, 5, 5, 5]} />
              </>
            );
            return desktop ? (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 20, gap: 12 }}>{cards}</View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingVertical: 20 }}>{cards}</ScrollView>
            );
          })()}

          {/* Desktop: operations on the left, performance on the right */}
          <View style={desktop ? { flexDirection: 'row', alignItems: 'flex-start' } : undefined}>
          <View style={desktop ? { flex: 3 } : undefined}>
          {/* Next order */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#fff', letterSpacing: -0.5 }}>next order</Text>
            {next ? (
              <View style={{ backgroundColor: ORANGE + '26', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
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
                  <View style={{ width: 76, height: 76, borderRadius: 18, backgroundColor: '#252a34', alignItems: 'center', justifyContent: 'center' }}>
                    <UtensilsCrossed size={26} color={MUTED} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }} numberOfLines={1}>{next.customer}</Text>
                  <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }} numberOfLines={1}>
                    {next.items[0]?.title ?? 'order'}{next.items.length > 1 ? ` +${next.items.length - 1}` : ''}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: next.paymentStatus === 'paid' ? GREEN + '24' : '#252a34', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: next.paymentStatus === 'paid' ? GREEN : MUTED }}>{next.paymentStatus === 'paid' ? '✓ paid' : 'unpaid'}</Text>
                    </View>
                    <Text style={{ fontFamily: Font.display, fontSize: 16, color: '#fff', fontVariant: ['tabular-nums'] }}>${next.total.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
              {step ? (
                <PressableScale
                  onPress={() => advance.mutate({ orderId: next.id, next: step.next })}
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
              <ShoppingBag size={26} color="#5b6170" />
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: MUTED, textAlign: 'center' }}>No active orders right now. New orders land here instantly.</Text>
            </View>
          )}

          {/* Today at a glance */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 26, marginBottom: 14 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#fff', letterSpacing: -0.5 }}>at a glance</Text>
            <PressableScale onPress={() => router.push('/prepper-orders')} accessibilityRole="button" accessibilityLabel="View all orders">
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>view all</Text>
            </PressableScale>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}>
            <QuickAction Icon={ShoppingBag} label="orders" color={ORANGE} badge={newCount || undefined} onPress={() => router.push('/prepper-orders')} />
            <QuickAction Icon={UtensilsCrossed} label="menu" color={GREEN} onPress={() => router.push('/meal-editor')} />
            <QuickAction Icon={Boxes} label="inventory" color={BLUE} />
            <QuickAction Icon={DollarSign} label="earnings" color={GREEN} onPress={() => router.push('/earnings')} />
            <QuickAction Icon={Users} label="customers" color={PURPLE} onPress={() => router.push('/customers')} />
            <QuickAction Icon={TrendingUp} label="insights" color={BLUE} />
          </ScrollView>
          </View>

          {/* Goal + streak */}
          <View style={desktop ? { flex: 2 } : undefined}>
          <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: desktop ? 0 : 22 }}>
            <View style={{ flex: 1, backgroundColor: CARD, borderRadius: 22, padding: 16, gap: 12 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: '#fff' }}>today&apos;s goal</Text>
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Ring pct={goalPct} color={ORANGE} />
                <View style={{ position: 'absolute', alignItems: 'center' }}>
                  <Text style={{ fontFamily: Font.display, fontSize: 22, color: '#fff' }}>{goalPct}%</Text>
                </View>
              </View>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED, textAlign: 'center' }}>{money(revenue)} of $2k goal</Text>
            </View>

            <View style={{ flex: 1, backgroundColor: ORANGE, borderRadius: 22, padding: 16, justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Flame size={15} color="#fff" fill="#fff" />
                <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: '#fff' }}>you&apos;re on fire!</Text>
              </View>
              <View>
                <Text style={{ fontFamily: Font.display, fontSize: 30, color: '#fff', letterSpacing: -0.5 }}>{Math.min(list.length, 30)}</Text>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: 'rgba(255,255,255,0.9)' }}>orders this week</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 5, marginTop: 6 }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                  <View key={i} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: i < 5 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 10, color: i < 5 ? ORANGE : '#fff' }}>{d}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          </View>
          </View>
        </ScrollView>

        {/* Floating action bar (add meal · go live · + · new drop · opportunity) */}
        <View style={[{ position: 'absolute', left: 16, right: 16, bottom: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: CARD, borderRadius: 26, paddingVertical: 12, paddingHorizontal: 18, ...Shadow.floating }, desktop && { left: undefined, right: undefined, alignSelf: 'center', width: 520 }]}>
          <ActionItem Icon={UtensilsCrossed} label="add meal" color="#fff" />
          <ActionItem Icon={Video} label="go live" color={PINK} />
          <PressableScale accessibilityRole="button" accessibilityLabel="Add new meal">
            <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: -26, backgroundColor: ORANGE, ...Shadow.floating, shadowColor: ORANGE, shadowOpacity: 0.45 }}>
              <Plus size={28} color="#fff" />
            </View>
          </PressableScale>
          <ActionItem Icon={Gift} label="new drop" color="#fff" />
          <ActionItem Icon={Briefcase} label="opportunity" color={ORANGE} onPress={() => router.push('/opportunities')} />
        </View>

        {/* Prepper tab nav (dark) */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#15181f', paddingTop: 10, paddingBottom: 22, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
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
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: 'center', gap: 5, width: 58 }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: color === '#fff' ? '#3f4451' : color + '66', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={color} />
      </View>
      <Text style={{ fontFamily: Font.medium, fontSize: 10, color: '#9ca3af' }} numberOfLines={1}>{label}</Text>
    </PressableScale>
  );
}

function NavTab({ Icon, label, active, badge, onPress }: { Icon: LucideIcon; label: string; active?: boolean; badge?: number; onPress?: () => void }) {
  const color = active ? ORANGE : '#6b7280';
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }} accessibilityLabel={label} style={{ alignItems: 'center', gap: 3 }}>
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
