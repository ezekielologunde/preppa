import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bell, Bike, CalendarCheck, ChefHat, ChevronLeft, CircleCheck, CircleX, Heart, MessageCircle, MessageSquareQuote, Package, Star, UtensilsCrossed } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListSkeleton } from '@/components/ui/skeleton';
import { PressableScale } from '@/components/ui/pressable-scale';
import { feedback } from '@/lib/feedback';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { useConversations, type Conversation } from '@/lib/queries/messages';
import { useNotifications, useMarkNotificationsRead, type AppNotification } from '@/lib/queries/notifications';
import { useMyOrders, type OrderSummary } from '@/lib/queries/orders';
import { useAuth } from '@/providers/auth-provider';
import type { OrderStatus } from '@/types/database.types';

const ORANGE = Palette.brand;
const INK = Palette.ink;
type LucideIcon = typeof Bell;

function timeAgo(iso: string | null) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

// Map an order's current status to a customer-facing notification.
function notify(o: OrderSummary): { Icon: LucideIcon; color: string; bg: string; title: string; sub: string } {
  const item = o.items[0]?.title ?? 'your order';
  const by = o.prepper;
  const map: Partial<Record<OrderStatus, { Icon: LucideIcon; color: string; bg: string; title: string }>> = {
    pending: { Icon: Package, color: Palette.amber, bg: Palette.amber + '1A', title: 'Order placed' },
    confirmed: { Icon: CircleCheck, color: Palette.success, bg: Palette.success + '1A', title: `${by} accepted your order` },
    preparing: { Icon: ChefHat, color: ORANGE, bg: Palette.brandTint, title: 'Your food is being prepared' },
    ready: { Icon: UtensilsCrossed, color: ORANGE, bg: Palette.brandTint, title: 'Your order is ready' },
    out_for_delivery: { Icon: Bike, color: '#8b5cf6', bg: '#EDE9FE', title: 'Your order is on the way' },
    completed: { Icon: Star, color: Palette.amber, bg: Palette.amber + '1A', title: 'Complete — leave a review' },
    cancelled: { Icon: CircleX, color: Palette.danger, bg: Palette.danger + '1A', title: 'Order cancelled & refunded' },
  };
  const m = map[o.status] ?? map.pending!;
  return { ...m, sub: `${item} · by ${by}` };
}

function ConversationRow({ c, onPress }: { c: Conversation; onPress: () => void }) {
  return (
    <PressableScale onPress={() => { feedback.tap(); onPress(); }} accessibilityRole="button" accessibilityLabel={`Chat with ${c.otherName}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 }}>
      {c.otherAvatar ? (
        <Image source={c.otherAvatar} style={{ width: 52, height: 52, borderRadius: 26 }} contentFit="cover" />
      ) : (
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 17, color: ORANGE }}>{initials(c.otherName)}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 15, color: INK, flex: 1 }} numberOfLines={1}>{c.otherName}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>{timeAgo(c.lastAt)}</Text>
        </View>
        <Text style={{ fontFamily: c.unread ? Font.semibold : Font.body, fontSize: 13.5, color: c.unread ? INK : Palette.textSecondary, marginTop: 2 }} numberOfLines={1}>
          {c.lastMessage ?? 'Say hello'}
        </Text>
      </View>
      {c.unread ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: ORANGE }} /> : null}
    </PressableScale>
  );
}

function NotificationRow({ o, onPress }: { o: OrderSummary; onPress: () => void }) {
  const n = notify(o);
  return (
    <PressableScale onPress={() => { feedback.tap(); onPress(); }} accessibilityRole="button" accessibilityLabel={n.title}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12 }}>
      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: n.bg, alignItems: 'center', justifyContent: 'center' }}>
        <n.Icon size={21} color={n.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK, flex: 1 }} numberOfLines={1}>{n.title}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>{timeAgo(o.created_at)}</Text>
        </View>
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 2 }} numberOfLines={1}>{n.sub}</Text>
      </View>
    </PressableScale>
  );
}

const NOTIF_STYLE: Record<AppNotification['type'], { Icon: LucideIcon; color: string; bg: string }> = {
  order: { Icon: MessageSquareQuote, color: ORANGE, bg: Palette.brandTint },
  payment: { Icon: Package, color: Palette.success, bg: Palette.success + '1A' },
  chat: { Icon: MessageCircle, color: '#8b5cf6', bg: '#EDE9FE' },
  follow: { Icon: Heart, color: Palette.danger, bg: Palette.danger + '1A' },
  review: { Icon: Star, color: Palette.amber, bg: Palette.amber + '1A' },
  promotion: { Icon: CalendarCheck, color: ORANGE, bg: Palette.brandTint },
  drop: { Icon: Package, color: ORANGE, bg: Palette.brandTint },
  live: { Icon: Bell, color: Palette.danger, bg: Palette.danger + '1A' },
};

function NotificationItemRow({ n, onPress }: { n: AppNotification; onPress: () => void }) {
  const s = NOTIF_STYLE[n.type] ?? NOTIF_STYLE.order;
  return (
    <PressableScale onPress={() => { feedback.tap(); onPress(); }} accessibilityRole="button" accessibilityLabel={n.title}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: n.read ? 'transparent' : Palette.brandTint + '40' }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: s.bg, alignItems: 'center', justifyContent: 'center' }}>
        <s.Icon size={20} color={s.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: INK, flex: 1 }} numberOfLines={1}>{n.title}</Text>
          {!n.read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE }} /> : null}
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>{timeAgo(n.created_at)}</Text>
        </View>
        {n.body ? <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 2 }} numberOfLines={2}>{n.body}</Text> : null}
      </View>
    </PressableScale>
  );
}

function Empty({ Icon, title, sub }: { Icon: LucideIcon; title: string; sub: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={28} color={Palette.textMuted} />
      </View>
      <Text style={{ fontFamily: Font.heading, fontSize: 16, color: INK }}>{title}</Text>
      <Text style={{ fontFamily: Font.body, fontSize: 13.5, color: Palette.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 19 }}>{sub}</Text>
    </View>
  );
}

function TabButton({ active, label, count, onPress }: { active: boolean; label: string; count?: number; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={label}
      style={{ flex: 1, height: 40, borderRadius: Radius.pill, backgroundColor: active ? ORANGE : 'transparent', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: active ? '#fff' : Palette.textSecondary }}>{label}</Text>
      {count ? (
        <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: active ? 'rgba(255,255,255,0.25)' : Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 10.5, color: active ? '#fff' : ORANGE }}>{count}</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<'updates' | 'messages'>(tabParam === 'messages' ? 'messages' : 'updates');
  const { data: conversations, isLoading: convLoading, refetch: refetchConv } = useConversations(user?.id);
  const { data: orders, isLoading: ordersLoading, refetch: refetchOrders } = useMyOrders(user?.id);
  const { data: notifications, refetch: refetchNotifs } = useNotifications(user?.id);
  const markRead = useMarkNotificationsRead(user?.id);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchConv(), refetchOrders(), refetchNotifs()]);
    setRefreshing(false);
  }

  // Opening the inbox clears the unread notification badge.
  const hasUnread = (notifications ?? []).some((n) => !n.read);
  useEffect(() => {
    if (tab === 'updates' && hasUnread) markRead.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, hasUnread]);

  function routeNotification(n: AppNotification) {
    feedback.tap();
    if (n.type === 'order' && n.data?.request_id) return router.push('/experience-request');
    if (n.type === 'review') return router.push('/dashboard');
    if (n.type === 'follow') return router.push('/dashboard');
    return router.push('/orders');
  }

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) { router.back(); } else { router.replace('/'); }
  }

  const unreadNotifCount = (notifications ?? []).filter((n) => !n.read).length;
  const unreadMsgCount = (conversations ?? []).filter((c) => c.unread).length;

  return (
    <View style={{ flex: 1, backgroundColor: Palette.surface }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={INK} />
          </PressableScale>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: INK, letterSpacing: -0.6 }}>inbox</Text>
        </View>

        {!user ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <Bell size={28} color={Palette.textMuted} />
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>Sign in to see your updates and messages.</Text>
            <PressableScale onPress={() => { feedback.tap(); router.push('/auth?mode=signin'); }} accessibilityRole="button" accessibilityLabel="Sign in" style={{ marginTop: 4, paddingHorizontal: 22, height: 48, borderRadius: Radius.sm, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Sign in</Text>
            </PressableScale>
          </View>
        ) : (
          <>
            {/* Tabs */}
            <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 6, backgroundColor: Palette.canvas, borderRadius: Radius.pill, padding: 4 }}>
              <TabButton active={tab === 'updates'} label="Updates" count={unreadNotifCount || undefined} onPress={() => { feedback.tap(); setTab('updates'); }} />
              <TabButton active={tab === 'messages'} label="Messages" count={unreadMsgCount || undefined} onPress={() => { feedback.tap(); setTab('messages'); }} />
            </View>

            {tab === 'updates' ? (
              ordersLoading ? (
                <ListSkeleton count={5} />
              ) : !orders?.length && !notifications?.length ? (
                <Empty Icon={Bell} title="No updates yet" sub="Order updates, new bids, reviews and renewals will show up here." />
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 8 : 4, paddingBottom: 32 }}>
                  {(notifications?.length ?? 0) > 0 ? (
                    <>
                      {(orders?.length ?? 0) > 0 ? (
                        <Text style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 6, fontFamily: Font.semibold, fontSize: 11, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                          activity
                        </Text>
                      ) : null}
                      {notifications!.map((n, i) => (
                        <MotiView key={n.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 200, delay: i * 35 }}>
                          <NotificationItemRow n={n} onPress={() => routeNotification(n)} />
                        </MotiView>
                      ))}
                    </>
                  ) : null}
                  {(orders?.length ?? 0) > 0 ? (
                    <>
                      {(notifications?.length ?? 0) > 0 ? (
                        <Text style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 6, fontFamily: Font.semibold, fontSize: 11, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                          recent orders
                        </Text>
                      ) : null}
                      {orders!.map((o, i) => (
                        <MotiView key={o.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 200, delay: ((notifications?.length ?? 0) + i) * 35 }}>
                          <NotificationRow o={o} onPress={() => router.push('/orders')} />
                        </MotiView>
                      ))}
                    </>
                  ) : null}
                </ScrollView>
              )
            ) : convLoading ? (
              <ListSkeleton count={5} />
            ) : !conversations?.length ? (
              <Empty Icon={MessageCircle} title="No messages yet" sub="Message a prepper from a meal or experience to start a conversation." />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} colors={[ORANGE]} />} contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 8 : 4, paddingBottom: 32 }}>
                {conversations.map((c, i) => (
                  <MotiView key={c.id} from={{ opacity: 0, translateX: -8 }} animate={{ opacity: 1, translateX: 0 }} transition={{ type: 'timing', duration: 200, delay: i * 40 }}>
                    <ConversationRow c={c} onPress={() => router.push(`/chat?id=${c.id}&name=${encodeURIComponent(c.otherName)}`)} />
                  </MotiView>
                ))}
              </ScrollView>
            )}
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
