import { useRouter } from 'expo-router';
import {
  Bell,
  ChevronLeft,
  DollarSign,
  Gift,
  Handshake,
  MessageSquare,
  ShoppingBag,
  Star,
  UserPlus,
  Video,
  Zap,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import {
  useMarkNotificationsRead,
  useNotifications,
  type AppNotification,
} from '@/lib/queries/notifications';
import { useBreakpoint } from '@/lib/layout';
import { useAuth } from '@/providers/auth-provider';

const ICON_MAP = {
  order: ShoppingBag,
  payment: DollarSign,
  chat: MessageSquare,
  follow: UserPlus,
  review: Star,
  promotion: Gift,
  drop: Zap,
  live: Video,
  bid: Handshake,
  bid_accepted: Handshake,
} as const;

const COLOR_MAP = {
  order: Palette.brand,
  payment: Palette.success,
  chat: '#60a5fa',
  follow: '#a78bfa',
  review: Palette.amber,
  promotion: '#f472b6',
  drop: Palette.amber,
  live: Palette.danger,
  bid: Palette.brand,
  bid_accepted: Palette.success,
} as const;

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function dateGroup(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return 'This week';
  return 'Earlier';
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This week', 'Earlier'];

function NotifRow({ n, onPress }: { n: AppNotification; onPress: () => void }) {
  const Icon = ICON_MAP[n.type] ?? Bell;
  const color = COLOR_MAP[n.type] ?? Palette.brand;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={n.title}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 14,
          paddingHorizontal: 20,
          paddingVertical: 14,
          backgroundColor: n.read ? 'transparent' : Palette.brandTint,
        }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: color + '20',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
          <Icon size={18} color={color} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.ink, flex: 1 }}
              numberOfLines={1}>
              {n.title}
            </Text>
            {!n.read ? (
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 3.5,
                  backgroundColor: Palette.brand,
                  flexShrink: 0,
                }}
              />
            ) : null}
          </View>
          {n.body ? (
            <Text
              style={{
                fontFamily: Font.body,
                fontSize: 13,
                color: Palette.textSecondary,
                lineHeight: 18,
              }}
              numberOfLines={2}>
              {n.body}
            </Text>
          ) : null}
          <Text
            style={{
              fontFamily: Font.body,
              fontSize: 11.5,
              color: Palette.textMuted,
              marginTop: 2,
            }}>
            {relativeTime(n.created_at)}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isDesktop = useBreakpoint() === 'desktop';
  const { data: notifs, isLoading, isError, refetch } = useNotifications(user?.id);
  const markRead = useMarkNotificationsRead(user?.id);
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function handlePress(n: AppNotification) {
    feedback.tap();
    if (!n.read) markRead.mutate(n.id, { onError: () => feedback.error() });
    if (n.type === 'order' || n.type === 'payment') router.push('/orders');
    else if (n.type === 'chat') router.push('/messages');
    else if (n.type === 'review') router.push('/reviews');
    else if (n.type === 'live' || n.type === 'drop') router.push('/explore');
    else if (n.type === 'follow') router.push('/dashboard');
    else if (n.type === 'bid') router.push('/experiences');
    else if (n.type === 'bid_accepted') router.push('/prepper-orders');
    else if (n.type === 'promotion') router.push('/specials');
  }

  const unread = (notifs ?? []).filter((n) => !n.read).length;

  const grouped = (notifs ?? []).reduce<Record<string, AppNotification[]>>((acc, n) => {
    const g = dateGroup(n.created_at);
    (acc[g] ??= []).push(n);
    return acc;
  }, {});
  const groupKeys = GROUP_ORDER.filter((g) => grouped[g]?.length);

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={isDesktop ? { flex: 1, maxWidth: 680, alignSelf: 'center', width: '100%' } : { flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 12,
          }}>
          <PressableScale
            onPress={() => {
              feedback.tap();
              if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); }
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: Palette.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <ChevronLeft size={22} color={Palette.ink} />
          </PressableScale>
          <Text
            style={{
              fontFamily: Font.display,
              fontSize: 26,
              color: Palette.ink,
              letterSpacing: -0.8,
              flex: 1,
            }}>
            notifications
          </Text>
          {unread > 0 ? (
            <PressableScale
              onPress={() => {
                feedback.tap();
                markRead.mutate(undefined, { onSuccess: () => feedback.success(), onError: () => feedback.error() });
              }}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: Radius.pill,
                backgroundColor: Palette.surface,
              }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: Palette.brand }}>
                mark all read
              </Text>
            </PressableScale>
          ) : null}
        </View>

        {/* Unread count chip */}
        {unread > 0 ? (
          <View style={{ paddingHorizontal: 20, marginBottom: 8 }}>
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: Palette.brandTint,
                borderRadius: Radius.pill,
                paddingHorizontal: 12,
                paddingVertical: 5,
              }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.brand }}>
                {unread} unread
              </Text>
            </View>
          </View>
        ) : null}

        {isLoading ? (
          <ListSkeleton count={5} rowHeight={72} />
        ) : isError ? (
          <MotiView from={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 260 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 }}>
            <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={30} color={Palette.textMuted} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 18, color: Palette.ink }}>couldn't load notifications</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 20 }}>Check your connection and try again.</Text>
            <PressableScale onPress={() => { feedback.tap(); void refetch(); }} accessibilityRole="button" accessibilityLabel="Retry loading notifications"
              style={{ marginTop: 4, height: 44, paddingHorizontal: 20, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>retry</Text>
            </PressableScale>
          </MotiView>
        ) : !notifs?.length ? (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 260 }}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: 32,
            }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 24,
                backgroundColor: Palette.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Bell size={30} color={Palette.textMuted} />
            </View>
            <Text style={{ fontFamily: Font.heading, fontSize: 18, color: Palette.ink }}>
              all caught up
            </Text>
            <Text
              style={{
                fontFamily: Font.body,
                fontSize: 14,
                color: Palette.textSecondary,
                textAlign: 'center',
                maxWidth: 260,
                lineHeight: 20,
              }}>
              Preorder updates, new meal drops, and messages will appear here.
            </Text>
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/'); }}
              accessibilityRole="button"
              accessibilityLabel="Browse meals"
              style={{ marginTop: 4, height: 44, paddingHorizontal: 20, borderRadius: Radius.pill, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>Browse meals</Text>
            </PressableScale>
          </MotiView>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={Palette.brand}
                colors={[Palette.brand]}
              />
            }>
            {groupKeys.map((group) => (
              <View key={group}>
                <MotiView
                  from={{ opacity: 0, translateX: -6 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: 'timing', duration: 200 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 }}>
                    {group}
                  </Text>
                </MotiView>
                <View style={{ backgroundColor: Palette.surface, marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' }}>
                  {(grouped[group] ?? []).map((n, i) => {
                    const groupList = grouped[group] ?? [];
                    return (
                      <MotiView
                        key={n.id}
                        from={{ opacity: 0, translateY: 5 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 220, delay: Math.min(i * 28, 200) }}>
                        <NotifRow n={n} onPress={() => handlePress(n)} />
                        {i < groupList.length - 1 ? (
                          <View style={{ height: 1, backgroundColor: Palette.border, marginLeft: 74 }} />
                        ) : null}
                      </MotiView>
                    );
                  })}
                </View>
              </View>
            ))}
            <View style={{ height: 48 }} />
          </ScrollView>
        )}
        </View>
      </SafeAreaView>
    </View>
  );
}
