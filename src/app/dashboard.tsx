import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  BarChart3, ChefHat, ChevronLeft, Clock, Home,
  MessageSquare, Package, PlusCircle, ShieldX, Utensils,
  Wallet,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import {
  ActivityIndicator, Modal, RefreshControl, ScrollView,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useMyEarnings } from '@/lib/queries/earnings';
import { usePrepperMembership } from '@/lib/queries/memberships';
import { useAdvanceOrder, useOrdersRealtime, usePrepperOrders } from '@/lib/queries/orders';
import { useMyPrepperApplication, useToggleAvailability } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';
import type { OrderStatus } from '@/types/database.types';

// ── Design tokens (light kitchen theme) ──────────────────────────────────────
const BG     = '#F8F6F3';
const CARD   = '#FFFFFF';
const BORDER = '#EDE9E4';
const INK    = '#1A1714';
const MUTED  = Palette.textSecondary;
const ORANGE = Palette.brand;
const S1     = { shadowColor: '#1A1714', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 };
const S2     = { shadowColor: '#1A1714', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 };

// ── Order status helpers ──────────────────────────────────────────────────────
const ADVANCE: Partial<Record<OrderStatus, { next: OrderStatus; cta: string }>> = {
  pending:   { next: 'confirmed',  cta: 'Accept order'  },
  confirmed: { next: 'preparing',  cta: 'Start prepping' },
  preparing: { next: 'ready',      cta: 'Mark ready'    },
  ready:     { next: 'completed',  cta: 'Hand off'      },
};
const STATUS_COLOR: Partial<Record<OrderStatus, string>> = {
  pending:   '#D97706',
  confirmed: ORANGE,
  preparing: ORANGE,
  ready:     Palette.success,
};
const STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: 'New', confirmed: 'Confirmed', preparing: 'Prepping', ready: 'Ready!',
};
const money = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;

// ── Application status gate ───────────────────────────────────────────────────
function StatusGate({ prepper, router }: { prepper: any; router: ReturnType<typeof useRouter> }) {
  const cfg = prepper?.status === 'pending'
    ? { Icon: Clock,    color: '#D97706', title: 'Under review',          body: "We're reviewing your kitchen — usually 48 hours." }
    : prepper?.status === 'rejected'
      ? { Icon: ShieldX, color: Palette.danger, title: 'Not approved',          body: prepper.rejection_note ?? 'Contact support or reapply.' }
      : prepper?.status === 'suspended'
        ? { Icon: ShieldX, color: MUTED,    title: 'Kitchen paused',         body: 'Contact support to reactivate your account.' }
        : { Icon: ChefHat, color: ORANGE,   title: 'Start cooking on Preppa', body: 'Apply to list your meals and earn on your schedule.' };
  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <TouchableOpacity onPress={() => { feedback.tap(); router.canGoBack() ? router.back() : router.replace('/profile'); }}
          accessibilityRole="button" accessibilityLabel="Go back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ margin: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', ...S1 }}>
          <ChevronLeft size={22} color={INK} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
          <View style={{ width: 88, height: 88, borderRadius: 28, backgroundColor: cfg.color + '15', alignItems: 'center', justifyContent: 'center' }}>
            <cfg.Icon size={40} color={cfg.color} />
          </View>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, textAlign: 'center', letterSpacing: -0.6 }}>{cfg.title}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 15, color: MUTED, textAlign: 'center', lineHeight: 22, maxWidth: 300 }}>{cfg.body}</Text>
          <PressableScale onPress={() => { feedback.tap(); router.replace('/become-prepper'); }}
            accessibilityRole="button" accessibilityLabel={prepper ? 'View application status' : 'Apply to become a prepper'}
            style={{ marginTop: 4, height: 54, paddingHorizontal: 32, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{prepper ? 'View status' : 'Apply now'}</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { data: prepper, isLoading, refetch: refetchPrepper }  = useMyPrepperApplication(user?.id);
  const { data: membership, refetch: refetchMembership }        = usePrepperMembership(prepper?.id);
  const { data: orders, refetch: refetchOrders }                = usePrepperOrders(prepper?.id);
  const { data: earnings }                                      = useMyEarnings();
  useOrdersRealtime('prepper_id', prepper?.id);
  const advanceOrder       = useAdvanceOrder();
  const toggleAvailability = useToggleAvailability(prepper?.id);

  const [confirmToggle, setConfirmToggle] = useState(false);
  const [localOpen, setLocalOpen]         = useState<boolean | null>(null);
  const [refreshing, setRefreshing]       = useState(false);
  const [busyId, setBusyId]               = useState<string | null>(null);
  const [kitchenToast, setKitchenToast]   = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchPrepper(), refetchMembership(), refetchOrders()]);
    setRefreshing(false);
  }

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={ORANGE} /></View>;
  }
  if (!prepper || prepper.status !== 'approved') {
    return <StatusGate prepper={prepper} router={router} />;
  }

  const isOpen      = localOpen !== null ? localOpen : ((prepper as any)?.accepting_orders !== false);
  const list        = orders ?? [];
  const today       = new Date().toDateString();
  const active      = list.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status));
  const todayDone   = list.filter(o => o.status === 'completed' && new Date(o.created_at).toDateString() === today).length;
  const newCount    = list.filter(o => o.status === 'pending').length;
  const kitchenName = (prepper.display_name ?? (user?.user_metadata?.full_name as string) ?? 'Chef').toString();
  const avatarUrl   = user?.user_metadata?.avatar_url as string | undefined;
  const isPro       = membership?.isPro === true;

  function commitToggle(toOpen: boolean) {
    setLocalOpen(toOpen);
    setConfirmToggle(false);
    feedback.impact();
    toggleAvailability.mutate({ accepting_orders: toOpen } as never, {
      onSuccess: () => {
        feedback.success();
        const msg = toOpen ? 'Kitchen open. Takes effect in ~30 seconds.' : 'Kitchen paused. Takes effect in ~30 seconds.';
        setKitchenToast(msg);
        setTimeout(() => setKitchenToast(null), 3500);
      },
      onError: () => { feedback.error(); setLocalOpen(!toOpen); },
    });
  }

  const QUICK = [
    { label: 'Orders',    Icon: Package,   color: '#2563EB', route: '/prepper-orders',   badge: newCount as number | undefined },
    { label: 'Menu',      Icon: Utensils,  color: Palette.success, route: '/meal-editor',       badge: undefined },
    { label: 'Earnings',  Icon: Wallet,    color: '#D97706', route: '/prepper-payouts',   badge: undefined },
    { label: 'Analytics', Icon: BarChart3, color: '#8B5CF6', route: '/prepper-analytics', badge: undefined },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>

        {/* ── Toggle Confirmation Modal ──────────────────────────────── */}
        <Modal visible={confirmToggle} transparent animationType="fade" onRequestClose={() => setConfirmToggle(false)}>
          <TouchableOpacity activeOpacity={1} onPress={() => setConfirmToggle(false)} accessibilityLabel="Dismiss"
            style={{ flex: 1, backgroundColor: 'rgba(26,23,20,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <MotiView from={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 22 }}
              style={{ backgroundColor: CARD, borderRadius: 24, padding: 28, width: '100%', maxWidth: 360, gap: 16, ...S2 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, textAlign: 'center', letterSpacing: -0.4 }}>
                {isOpen ? 'Pause kitchen?' : 'Open kitchen?'}
              </Text>
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 21 }}>
                {isOpen ? 'No new orders until you reopen. Active orders are unaffected.' : 'Your kitchen will appear in Explore and accept new orders.'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                <TouchableOpacity onPress={() => { feedback.tap(); setConfirmToggle(false); }}
                  accessibilityRole="button" accessibilityLabel="Cancel"
                  style={{ flex: 1, height: 52, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: MUTED }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => commitToggle(!isOpen)}
                  accessibilityRole="button" accessibilityLabel={isOpen ? 'Confirm pause kitchen' : 'Confirm open kitchen'}
                  style={{ flex: 1, height: 52, borderRadius: Radius.pill, backgroundColor: isOpen ? Palette.danger : Palette.success, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>{isOpen ? 'Pause' : 'Open'}</Text>
                </TouchableOpacity>
              </View>
            </MotiView>
          </TouchableOpacity>
        </Modal>

        <ScrollView showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}>

          {/* ── Header ────────────────────────────────────────────────── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: CARD, overflow: 'hidden', borderWidth: 2, borderColor: ORANGE + '55', ...S1 }}>
              {avatarUrl
                ? <Image source={avatarUrl} style={{ width: 46, height: 46 }} contentFit="cover" accessibilityLabel="Kitchen avatar" />
                : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 18, color: ORANGE }}>{kitchenName[0]?.toUpperCase() ?? 'C'}</Text>
                  </View>
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: MUTED }}>kitchen hub</Text>
              <Text style={{ fontFamily: Font.heading, fontSize: 17, color: INK, letterSpacing: -0.2 }} numberOfLines={1}>{kitchenName}</Text>
            </View>
            <TouchableOpacity onPress={() => { feedback.tap(); setConfirmToggle(true); }}
              accessibilityRole="switch" accessibilityLabel={isOpen ? 'Kitchen open — tap to pause' : 'Kitchen paused — tap to open'}
              accessibilityState={{ checked: isOpen }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, height: 36, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: isOpen ? Palette.success + '55' : BORDER, backgroundColor: isOpen ? Palette.success + '12' : CARD, minWidth: 44 }}>
              <MotiView animate={{ backgroundColor: isOpen ? Palette.success : MUTED }} transition={{ type: 'timing', duration: 220 }}
                style={{ width: 8, height: 8, borderRadius: 4 }} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: isOpen ? Palette.success : MUTED }}>{isOpen ? 'Open' : 'Paused'}</Text>
            </TouchableOpacity>
          </View>

          {/* ── Kitchen toggle toast ──────────────────────────────────── */}
          {kitchenToast && (
            <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }}
              style={{ marginHorizontal: 20, marginBottom: 8, backgroundColor: Palette.success + '18', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: Palette.success + '44' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.success, textAlign: 'center' }}>{kitchenToast}</Text>
            </MotiView>
          )}

          {/* ── At-a-glance stats ─────────────────────────────────────── */}
          <MotiView from={{ opacity: 0, translateY: 6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240 }}
            style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 32, backgroundColor: CARD, borderRadius: 16, ...S1 }}>
            {([
              { label: 'Active',          value: active.length,                     hot: active.length > 0 as boolean | undefined },
              { label: 'Done today',      value: todayDone,                         hot: undefined },
              { label: 'This week (net)', value: money(earnings?.net_week ?? 0),    hot: undefined },
            ]).map((s, i) => (
              <View key={s.label} style={{ flex: 1, paddingVertical: 18, alignItems: 'center', borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: BORDER }}>
                <Text style={{ fontFamily: Font.display, fontSize: 22, color: s.hot ? ORANGE : INK, letterSpacing: -0.4 }}>{s.value}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 11, color: MUTED, marginTop: 2 }}>{s.label}</Text>
              </View>
            ))}
          </MotiView>

          {/* ── Needs action ──────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 20, marginBottom: 32 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.5, flex: 1 }}>needs action</Text>
              {active.length > 0 && (
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 13, color: '#fff' }}>{active.length}</Text>
                </View>
              )}
            </View>

            {active.length === 0 ? (
              <MotiView from={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ type: 'timing', duration: 300 }}
                style={{ backgroundColor: CARD, borderRadius: 16, padding: 28, alignItems: 'center', gap: 10, ...S1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 17, color: INK }}>All caught up</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20 }}>No orders waiting right now.</Text>
                <PressableScale onPress={() => { feedback.tap(); router.push('/prepper-orders' as never); }}
                  accessibilityRole="button" accessibilityLabel="View order history"
                  style={{ marginTop: 4, height: 44, paddingHorizontal: 24, borderRadius: Radius.pill, borderWidth: 1.5, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: MUTED }}>View history</Text>
                </PressableScale>
              </MotiView>
            ) : (
              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                <View style={{ gap: 12 }}>
                  {active.map((order, idx) => {
                    const step  = ADVANCE[order.status];
                    const color = STATUS_COLOR[order.status] ?? MUTED;
                    const label = STATUS_LABEL[order.status] ?? order.status;
                    const parts = (order.customer ?? '').trim().split(/\s+/);
                    const name  = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : (parts[0] ?? 'Customer');
                    return (
                      <MotiView key={order.id} from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: idx * 40 }}
                        style={{ backgroundColor: CARD, borderRadius: 16, overflow: 'hidden', borderLeftWidth: 4, borderLeftColor: color, ...S2 }}>
                        <View style={{ padding: 16, gap: 14 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <View>
                              <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: INK }}>{name}</Text>
                              <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED, marginTop: 2 }}>{order.items?.length ?? 0} items · {money(order.total)}</Text>
                            </View>
                            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: color + '18' }}>
                              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color }}>{label}</Text>
                            </View>
                          </View>
                          {step && (
                            <TouchableOpacity
                              onPress={() => {
                                feedback.impact();
                                setBusyId(order.id);
                                advanceOrder.mutate({ orderId: order.id, next: step.next }, {
                                  onSuccess: () => setBusyId(null),
                                  onError:   () => setBusyId(null),
                                });
                              }}
                              disabled={busyId === order.id}
                              accessibilityRole="button" accessibilityLabel={step.cta}
                              style={{ height: 52, borderRadius: 12, backgroundColor: color, alignItems: 'center', justifyContent: 'center', opacity: busyId === order.id ? 0.65 : 1 }}>
                              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>{step.cta}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </MotiView>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>

          {/* ── Quick access 2×2 ──────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, letterSpacing: -0.5, marginBottom: 16 }}>quick access</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {QUICK.map(({ label, Icon, color, route, badge }) => (
                <PressableScale key={label} onPress={() => { feedback.tap(); router.push(route as never); }}
                  accessibilityRole="button" accessibilityLabel={label}
                  style={{ width: '47%', aspectRatio: 1.65, backgroundColor: CARD, borderRadius: 16, alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, ...S1 }}>
                  <View style={{ position: 'relative' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} color={color} />
                    </View>
                    {!!badge && badge > 0 && (
                      <View style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontFamily: Font.heading, fontSize: 9, color: '#fff' }}>{badge > 9 ? '9+' : badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: INK }}>{label}</Text>
                </PressableScale>
              ))}
            </View>
          </View>

          {/* ── Add meal CTA ──────────────────────────────────────────── */}
          <View style={{ paddingHorizontal: 20 }}>
            <PressableScale onPress={() => { feedback.impact(); router.push('/meal-editor' as never); }}
              accessibilityRole="button" accessibilityLabel="Add a new meal to your menu"
              style={{ height: 56, borderRadius: 16, backgroundColor: ORANGE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <PlusCircle size={20} color="#fff" />
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Add a meal</Text>
            </PressableScale>
            {!isPro && (
              <TouchableOpacity onPress={() => { feedback.tap(); router.push('/prepper-premium' as never); }}
                accessibilityRole="button" accessibilityLabel="Upgrade to Pro"
                style={{ marginTop: 12, height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: ORANGE + '44', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: ORANGE }}>Upgrade to Pro — unlock priority placement</Text>
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>

        {/* ── Bottom navigation ─────────────────────────────────────────── */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: CARD, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16), shadowColor: '#1A1714', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 8 }}>
          {([
            { label: 'Home',    Icon: Home,          route: '/',                active: false, badge: undefined as number | undefined },
            { label: 'Orders',  Icon: Package,       route: '/prepper-orders',  active: false, badge: newCount as number | undefined },
            { label: 'Kitchen', Icon: ChefHat,       route: '/dashboard',       active: true,  badge: undefined as number | undefined },
            { label: 'Messages',Icon: MessageSquare, route: '/messages',        active: false, badge: undefined as number | undefined },
            { label: 'Earnings',Icon: Wallet,        route: '/prepper-payouts', active: false, badge: undefined as number | undefined },
          ]).map(({ label, Icon, route, active: isActive, badge }) => (
            <TouchableOpacity key={label} onPress={() => { feedback.tap(); router.push(route as never); }}
              accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: isActive }}
              style={{ flex: 1, alignItems: 'center', gap: 4, minHeight: 44 }}>
              <View style={{ position: 'relative' }}>
                <Icon size={22} color={isActive ? ORANGE : MUTED} strokeWidth={isActive ? 2.4 : 1.8} />
                {!!badge && badge > 0 && (
                  <View style={{ position: 'absolute', top: -4, right: -7, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                    <Text style={{ fontFamily: Font.heading, fontSize: 9, color: '#fff' }}>{badge > 9 ? '9+' : badge}</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontFamily: isActive ? Font.semibold : Font.body, fontSize: 10.5, color: isActive ? ORANGE : MUTED }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </SafeAreaView>
    </View>
  );
}
