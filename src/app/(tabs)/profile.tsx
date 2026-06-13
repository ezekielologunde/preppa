import { useRouter } from 'expo-router';
import {
  BadgeCheck,
  Bell,
  CalendarCheck,
  Camera,
  ChefHat,
  Clock,
  CreditCard,
  Gift,
  HelpCircle,
  Leaf,
  MapPin,
  MessageCircle,
  Pencil,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserPlus,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Linking, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustomerBadgeShelf } from '@/components/badge-shelf';
import {
  DarkCard,
  DarkModeRow,
  MealPlansSection,
  RewardsCard,
  RowItem,
  SectionCard,
  StatChip,
} from '@/components/profile-sections';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { useFavoritesCount } from '@/lib/favorites';
import { feedback } from '@/lib/feedback';
import { useAddresses } from '@/lib/queries/addresses';
import { useConversations } from '@/lib/queries/messages';
import { useCustomerMembership } from '@/lib/queries/memberships';
import { useMySubscriptions } from '@/lib/queries/meal-plans';
import { useNotifications } from '@/lib/queries/notifications';
import { useMyOrders } from '@/lib/queries/orders';
import { usePaymentMethods } from '@/lib/queries/payment-methods';
import { useCustomerBadges, useMyPrepperApplication } from '@/lib/queries/preppers';
import { useRewards } from '@/lib/queries/rewards';
import { useDarkMode } from '@/lib/theme-mode';
import { useAuth } from '@/providers/auth-provider';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, isAdmin } = useAuth();
  const go = (route: string) => router.push(route as never);

  const { data: subs, refetch: refetchSubs } = useMySubscriptions(user?.id);
  const { data: membership, refetch: refetchMembership } = useCustomerMembership(user?.id);
  const isPlus = membership?.isPlus === true;
  const { data: earnedBadges, refetch: refetchBadges } = useCustomerBadges(user?.id);
  const { data: myPrepper, refetch: refetchPrepper } = useMyPrepperApplication(user?.id);
  const isApprovedPrepper = myPrepper?.status === 'approved';
  const isPendingPrepper = myPrepper?.status === 'pending';

  const { data: addresses, refetch: refetchAddresses } = useAddresses(user?.id);
  const { data: pmData, refetch: refetchPm } = usePaymentMethods();
  const { data: orders, refetch: refetchOrders } = useMyOrders(user?.id);
  const addrCount = addresses?.length ?? 0;
  const defaultCard = pmData?.methods.find((m) => m.isDefault);
  const favMeals = useFavoritesCount('meal:');
  const followed = useFavoritesCount('prepper:');
  const orderCount = orders?.length ?? 0;

  const rewards = useRewards(user?.id);
  const { data: notifications } = useNotifications(user?.id);
  const { data: conversations } = useConversations(user?.id);
  const unreadNotifCount = (notifications ?? []).filter((n) => !n.read).length;
  const unreadMsgCount = (conversations ?? []).filter((c) => c.unread).length;
  const totalUnread = unreadNotifCount + unreadMsgCount;

  const displayName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'guest';
  const bio = (user?.user_metadata?.bio as string | undefined) || 'good food. good mood. always.';

  const dark = useDarkMode();
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchSubs(), refetchMembership(), refetchBadges(), refetchPrepper(), refetchAddresses(), refetchPm(), refetchOrders()]);
    setRefreshing(false);
  }

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast((t) => (t === msg ? null : t)), 2400); };
  const soon = (label: string) => { feedback.warning(); flash(`${label} — coming soon`); };

  const activityRows: RowItem[] = [
    { label: 'orders & history', sub: 'track & repeat', Icon: Receipt, onPress: () => { feedback.tap(); go('/orders'); } },
    { label: 'meal plans', sub: 'subscriptions', Icon: CalendarCheck, onPress: () => { feedback.tap(); go('/meal-plans'); } },
    { label: 'messages', sub: 'chat with preppers', Icon: MessageCircle, onPress: () => { feedback.tap(); go('/messages?tab=messages'); } },
    { label: 'my stats', sub: 'food insights & trends', Icon: TrendingUp, onPress: () => { feedback.tap(); go('/insights'); } },
  ];

  const walletRows: RowItem[] = [
    { label: 'payment methods', sub: defaultCard ? `${defaultCard.brand} ···· ${defaultCard.last4}` : 'none saved', Icon: CreditCard, onPress: () => { feedback.tap(); go('/payment-methods'); } },
    { label: 'addresses', sub: addrCount === 0 ? 'none saved' : `${addrCount} saved`, Icon: MapPin, onPress: () => { feedback.tap(); go('/addresses'); } },
    { label: 'rewards & credits', sub: `${rewards.points.toLocaleString()} pts`, Icon: Gift, onPress: () => { feedback.tap(); go('/rewards'); } },
  ];

  const prefsRows: RowItem[] = [
    { label: 'dietary preferences', sub: 'manage', Icon: Leaf, onPress: () => { feedback.tap(); go('/dietary-preferences'); } },
    { label: 'notifications', sub: 'email, sms, push', Icon: Bell, onPress: () => { feedback.tap(); go('/messages'); } },
  ];

  const accountRows: RowItem[] = [
    { label: 'prep+ membership', sub: isPlus ? 'member · active ✦' : 'perks & discounts', Icon: Sparkles, accent: isPlus, onPress: () => { feedback.tap(); go('/prep-plus'); } },
    { label: 'invite friends', sub: 'earn rewards', Icon: UserPlus, onPress: () => { feedback.tap(); go('/referral'); } },
    { label: 'help center', sub: 'faq & support', Icon: HelpCircle, onPress: () => { feedback.tap(); Linking.openURL('mailto:support@preppa.live?subject=Preppa%20support').catch(() => soon('Help center')); } },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />}
          contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 16 : 8, paddingBottom: 32, gap: 16 }}>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 10 }}>
            <Text style={{ flex: 1, fontFamily: Font.display, fontSize: 26, color: Palette.ink, letterSpacing: -0.6 }}>profile</Text>
            <PressableScale onPress={() => { feedback.tap(); go('/messages'); }} accessibilityRole="button"
              accessibilityLabel={`Inbox${totalUnread > 0 ? `, ${totalUnread} unread` : ''}`}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={19} color={Palette.ink} />
              {totalUnread > 0 ? (
                <View style={{ position: 'absolute', top: 7, right: 7, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: Palette.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Palette.canvas }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 8, color: '#fff', lineHeight: 11 }}>{totalUnread > 9 ? '9+' : String(totalUnread)}</Text>
                </View>
              ) : null}
            </PressableScale>
            <PressableScale onPress={() => { feedback.tap(); router.push('/settings'); }} accessibilityRole="button" accessibilityLabel="Settings"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={19} color={Palette.ink} />
            </PressableScale>
          </View>

          {/* Identity */}
          <MotiView from={{ opacity: 0, translateY: 14 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320 }}>
            <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
              <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: Palette.brand, padding: 3 }}>
                <Avatar name={displayName} url={user?.user_metadata?.avatar_url as string | undefined} size={84} />
                <PressableScale onPress={() => soon('Change photo')} accessibilityRole="button" accessibilityLabel="Change photo"
                  style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Palette.canvas }}>
                  <Camera size={14} color={Palette.surface} />
                </PressableScale>
              </View>
              <PressableScale onPress={() => { feedback.tap(); router.push('/edit-profile'); }} accessibilityRole="button" accessibilityLabel="Edit profile"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <Text style={{ fontFamily: Font.display, fontSize: 24, color: Palette.ink, letterSpacing: -0.6 }}>{displayName}</Text>
                <Pencil size={16} color={Palette.brand} />
              </PressableScale>
              {isApprovedPrepper ? (
                <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.brandTint, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 4 }}>
                  <BadgeCheck size={12} color={Palette.brand} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.brand }}>prepper</Text>
                </View>
              ) : isAdmin ? (
                <View style={{ marginTop: 6, backgroundColor: '#EDE9FE', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 4 }}>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#7C3AED' }}>admin</Text>
                </View>
              ) : null}
              <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, marginTop: 6, textAlign: 'center' }}>{bio}</Text>
              <PressableScale onPress={() => { feedback.tap(); go('/addresses'); }} accessibilityRole="button" accessibilityLabel="Manage your addresses"
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                <MapPin size={13} color={Palette.textMuted} />
                <Text style={{ fontFamily: Font.medium, fontSize: 13, color: addresses?.[0]?.city ? Palette.textSecondary : Palette.brand }}>
                  {addresses?.[0]?.city ?? 'add your location'}
                </Text>
              </PressableScale>
              {earnedBadges?.length ? <View style={{ marginTop: 14, maxWidth: '100%' }}><CustomerBadgeShelf badges={earnedBadges} /></View> : null}
            </View>
          </MotiView>

          {/* Stats row */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
            <View style={{ flexDirection: 'row', marginHorizontal: 20, gap: 10 }}>
              <StatChip value={orderCount} label="orders" onPress={() => { feedback.tap(); go('/orders'); }} />
              <StatChip value={favMeals} label="favorites" onPress={() => { feedback.tap(); go('/favorites'); }} />
              <StatChip value={followed} label="following" onPress={() => { feedback.tap(); go('/following'); }} />
            </View>
          </MotiView>

          {/* Rewards card */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
            <RewardsCard rewards={rewards} onPress={() => { feedback.tap(); go('/rewards'); }} />
          </MotiView>

          {/* Meal plans */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 200 }}>
            <MealPlansSection subs={subs} onViewAll={() => { feedback.tap(); go('/meal-plans'); }} onPress={() => { feedback.tap(); go('/meal-plans'); }} />
          </MotiView>

          {/* My Kitchen */}
          {isApprovedPrepper ? (
            <DarkCard Icon={ChefHat} title="my kitchen" sub="meals, orders, earnings & go live"
              onPress={() => { feedback.tap(); router.push('/dashboard'); }} accessibilityLabel="Open my kitchen" />
          ) : null}

          {/* Account sections */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 260 }}>
            <View style={{ marginHorizontal: 20, gap: 12 }}>
              <View>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>activity</Text>
                <SectionCard rows={activityRows} />
              </View>
              <View>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>wallet</Text>
                <SectionCard rows={walletRows} />
              </View>
              <View>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>preferences</Text>
                <View style={{ backgroundColor: Palette.surface, borderRadius: 20 }}>
                  <SectionCard rows={prefsRows} />
                  <DarkModeRow dark={dark} />
                </View>
              </View>
              <View>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.textMuted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>account</Text>
                <SectionCard rows={accountRows} />
              </View>
            </View>
          </MotiView>

          {/* Admin console */}
          {isAdmin ? (
            <DarkCard Icon={ShieldCheck} title="admin console" sub="approvals, orders, earnings & features"
              onPress={() => { feedback.tap(); router.push('/admin'); }} accessibilityLabel="Open admin console" />
          ) : null}

          {/* Become a prepper / pending */}
          {!isApprovedPrepper && !isPendingPrepper ? (
            <DarkCard Icon={ChefHat} title="become a prepper" sub="start earning with your cooking"
              onPress={() => { feedback.tap(); router.push('/become-prepper'); }} accessibilityLabel="Become a prepper, start earning with your cooking" />
          ) : isPendingPrepper ? (
            <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: Palette.amber + '1A', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: Palette.amber + '26', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={20} color={Palette.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>application pending</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.amber, marginTop: 1 }}>we'll notify you within 48h</Text>
              </View>
            </View>
          ) : null}

          {/* Sign out / Sign in */}
          <PressableScale onPress={() => { feedback.tap(); user ? signOut() : router.push('/auth?mode=signin'); }}
            accessibilityRole="button" accessibilityLabel={user ? 'Sign out' : 'Sign in or create account'}
            style={{ marginHorizontal: 20, alignItems: 'center', paddingVertical: 15, borderRadius: 16, backgroundColor: user ? Palette.surface : Palette.brand }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: user ? Palette.danger : Palette.surface }}>
              {user ? 'sign out' : 'sign in / create account'}
            </Text>
          </PressableScale>

        </ScrollView>

        {toast ? (
          <MotiView from={{ opacity: 0, translateY: 14 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 200 }}
            style={{ position: 'absolute', left: 20, right: 20, bottom: 24, backgroundColor: Palette.ink, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, ...Shadow.floating }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.surface, textAlign: 'center' }}>{toast}</Text>
          </MotiView>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
