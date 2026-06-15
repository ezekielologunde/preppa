import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  BadgeCheck, Bell, CalendarCheck, ChefHat, ChevronRight, Clock, CreditCard, Crown,
  Heart, LifeBuoy, MapPin, Package, Pencil, Settings, ShieldCheck, Sparkles, Ticket, Users,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DarkCard, DarkModeRow, RewardsCard, SectionCard, StatChip } from '@/components/profile-sections';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useFavoritesCount } from '@/lib/favorites';
import { useConversations } from '@/lib/queries/messages';
import { useCustomerMembership } from '@/lib/queries/memberships';
import { useMySubscriptions } from '@/lib/queries/meal-plans';
import { useNotifications } from '@/lib/queries/notifications';
import { useMyOrders } from '@/lib/queries/orders';
import { useFollowedPreppers, useMyPrepperApplication } from '@/lib/queries/preppers';
import { useRewards } from '@/lib/queries/rewards';
import { useDarkMode } from '@/lib/theme-mode';
import { useAuth } from '@/providers/auth-provider';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, isAdmin } = useAuth();
  const go = (route: string) => router.push(route as never);
  const dark = useDarkMode();

  const { data: subs, refetch: refetchSubs } = useMySubscriptions(user?.id);
  const { data: membership, refetch: refetchMembership } = useCustomerMembership(user?.id);
  const isPlus = membership?.isPlus === true;
  const { data: myPrepper, refetch: refetchPrepper } = useMyPrepperApplication(user?.id);
  const isApprovedPrepper = myPrepper?.status === 'approved';
  const isPendingPrepper = myPrepper?.status === 'pending';
  const { data: followedPreppers, refetch: refetchFollowed } = useFollowedPreppers(user?.id);
  const rewards = useRewards(user?.id);
  const { data: notifications } = useNotifications(user?.id);
  const { data: conversations } = useConversations(user?.id);
  const { data: orders } = useMyOrders(user?.id);
  const savedCount = useFavoritesCount('meal:');

  const activeSubs = (subs ?? []).filter((s) => s.status === 'active').length;
  const followed = followedPreppers?.length ?? 0;
  const totalOrders = (orders ?? []).length;
  const totalUnread = (notifications ?? []).filter((n) => !n.read).length + (conversations ?? []).filter((c) => c.unread).length;
  const displayName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'guest';
  const firstName = displayName.split(/\s+/)[0];
  const tierName = rewards.tier.name.toLowerCase();

  const _dm = user?.user_metadata ?? {};
  const dietaryCount =
    ((_dm.dietary as string[] | undefined) ?? []).length +
    ((_dm.allergies as string[] | undefined) ?? []).length +
    ((_dm.cuisines as string[] | undefined) ?? []).length;
  const dietaryMeta = dietaryCount > 0 ? `${dietaryCount} set` : undefined;

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchSubs(), refetchMembership(), refetchPrepper(), refetchFollowed(), rewards.refetch()]);
    setRefreshing(false);
  }

  // ─── Header ─────────────────────────────────────────────────────────────────
  const headerEl = (
    <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 10 }}>
        <Text style={{ flex: 1, fontFamily: Font.display, fontSize: 26, color: Palette.ink, letterSpacing: -0.6 }}>{firstName}</Text>
        <PressableScale onPress={() => { feedback.tap(); go('/messages'); }} accessibilityRole="button"
          accessibilityLabel={`Inbox${totalUnread > 0 ? `, ${totalUnread} unread` : ''}`}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
          <Bell size={19} color={Palette.ink} />
          {totalUnread > 0 ? (
            <View style={{ position: 'absolute', top: 7, right: 7, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: Palette.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: Palette.canvas }}>
              <Text style={{ fontFamily: Font.semibold, fontSize: 8, color: '#fff', lineHeight: 11 }}>{totalUnread > 9 ? '9+' : String(totalUnread)}</Text>
            </View>
          ) : null}
        </PressableScale>
        <PressableScale onPress={() => { feedback.tap(); go('/settings'); }} accessibilityRole="button" accessibilityLabel="Settings"
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
          <Settings size={19} color={Palette.ink} />
        </PressableScale>
      </View>
    </MotiView>
  );

  // ─── User core card ─────────────────────────────────────────────────────────
  const coreCardEl = (
    <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
      <PressableScale onPress={() => { feedback.tap(); router.push('/edit-profile'); }}
        accessibilityRole="button" accessibilityLabel="Edit your profile"
        style={{ marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: Palette.surface, borderRadius: 24, padding: 18, ...Shadow.card }}>
        <LinearGradient colors={['#FF9A5A', Palette.brand]} style={{ width: 72, height: 72, borderRadius: 36, padding: 2.5, alignItems: 'center', justifyContent: 'center' }}>
          <Avatar name={displayName} url={user?.user_metadata?.avatar_url as string | undefined} size={64} />
        </LinearGradient>
        <View style={{ flex: 1, gap: 6 }}>
          <Text numberOfLines={1} style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.5 }}>{displayName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF3C7', borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
              <Crown size={12} color="#D97706" />
              <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: '#B45309' }}>{tierName} member</Text>
            </View>
            {isPlus ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.brandTint, borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
                <Sparkles size={11} color={Palette.brand} />
                <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.brand }}>Prep+</Text>
              </View>
            ) : null}
            {isApprovedPrepper ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Palette.success + '1A', borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
                <BadgeCheck size={11} color={Palette.success} />
                <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.success }}>prepper</Text>
              </View>
            ) : null}
            {isAdmin ? (
              <View style={{ backgroundColor: '#EDE9FE', borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: '#7C3AED' }}>admin</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Pencil size={17} color={Palette.brand} />
      </PressableScale>
    </MotiView>
  );

  // ─── Quick stats ─────────────────────────────────────────────────────────────
  const statsEl = (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 40 }}>
      <View style={{ marginHorizontal: 20, flexDirection: 'row', gap: 10 }}>
        <StatChip value={totalOrders} label="orders"    onPress={() => go('/orders')}    />
        <StatChip value={activeSubs}  label="plans"     onPress={() => go('/meal-plans')} />
        <StatChip value={savedCount}  label="saved"     onPress={() => go('/favorites')} />
        <StatChip value={followed}    label="following" onPress={() => go('/following')} />
      </View>
    </MotiView>
  );

  // ─── My Activity ─────────────────────────────────────────────────────────────
  const activityEl = (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
      <View style={{ marginHorizontal: 20, gap: 12 }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, paddingHorizontal: 4 }}>my activity</Text>
        <SectionCard rows={[
          { label: 'My Orders',    sub: 'Track & history',               Icon: Package,      onPress: () => { feedback.tap(); go('/orders'); }      },
          { label: 'Favorites',    sub: 'Saved meals & kitchens',        Icon: Heart,        onPress: () => { feedback.tap(); go('/favorites'); }    },
          { label: 'Meal Plans',   sub: activeSubs > 0 ? `${activeSubs} active plan${activeSubs > 1 ? 's' : ''}` : 'Weekly subscriptions', Icon: CalendarCheck, accent: activeSubs > 0, onPress: () => { feedback.tap(); go('/meal-plans'); } },
          { label: 'Experiences',  sub: 'Private chefs, classes & more', Icon: Ticket,       onPress: () => { feedback.tap(); go('/experiences'); }  },
        ]} />
      </View>
    </MotiView>
  );

  // ─── Rewards ────────────────────────────────────────────────────────────────
  const rewardsEl = (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 120 }}>
      <RewardsCard rewards={rewards} isLoading={rewards.isLoading} onPress={() => { feedback.tap(); go('/rewards'); }} />
    </MotiView>
  );

  // ─── Account (with dark mode toggle inline) ──────────────────────────────────
  const ACCOUNT_ROWS = [
    { label: 'Dietary Profile',    sub: dietaryMeta ?? 'Set allergies & preferences',  Icon: CalendarCheck, route: '/dietary-preferences' },
    { label: 'Payment Methods',    sub: 'Cards, Apple Pay & more',                     Icon: CreditCard,    route: '/payment-methods'      },
    { label: 'Addresses',          sub: 'Home, work & delivery spots',                 Icon: MapPin,        route: '/addresses'            },
    { label: 'My Kitchen Network', sub: followed > 0 ? `Following ${followed} kitchen${followed > 1 ? 's' : ''}` : 'Follow your favourite chefs', Icon: Users, route: '/following' },
  ];
  const accountEl = (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 160 }}>
      <View style={{ marginHorizontal: 20, gap: 12 }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, paddingHorizontal: 4 }}>account</Text>
        <View style={{ backgroundColor: Palette.surface, borderRadius: 20, overflow: 'hidden' }}>
          {ACCOUNT_ROWS.map((row, i) => (
            <PressableScale key={row.label} onPress={() => { feedback.tap(); go(row.route); }}
              accessibilityRole="button" accessibilityLabel={`${row.label}, ${row.sub}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.chip }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                <row.Icon size={17} color={Palette.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.ink }}>{row.label}</Text>
                <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textMuted, marginTop: 1 }}>{row.sub}</Text>
              </View>
              <ChevronRight size={15} color={Palette.textSecondary} />
            </PressableScale>
          ))}
          <DarkModeRow dark={dark} />
        </View>
      </View>
    </MotiView>
  );

  // ─── Settings & support ──────────────────────────────────────────────────────
  const settingsEl = (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
      <View style={{ marginHorizontal: 20, gap: 12 }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, paddingHorizontal: 4 }}>settings & support</Text>
        <SectionCard rows={[
          { label: 'Account Settings', sub: 'Profile, security & privacy',    Icon: Settings, onPress: () => { feedback.tap(); go('/settings'); }      },
          { label: 'Help Center',      sub: 'Guides, FAQ & contact support',  Icon: LifeBuoy, onPress: () => { feedback.tap(); go('/settings-help'); }  },
        ]} />
      </View>
    </MotiView>
  );

  // ─── Role cards ──────────────────────────────────────────────────────────────
  const roleCardsEl = (
    <View>
      {isApprovedPrepper ? (
        <DarkCard Icon={ChefHat} title="my kitchen" sub="meals, preorders, earnings & go live"
          onPress={() => { feedback.tap(); router.push('/dashboard'); }} accessibilityLabel="Open my kitchen" />
      ) : null}
      {isAdmin ? (
        <DarkCard Icon={ShieldCheck} title="admin console" sub="approvals, orders, earnings & features"
          onPress={() => { feedback.tap(); router.push('/admin'); }} accessibilityLabel="Open admin console" />
      ) : null}
      {!isApprovedPrepper && !isPendingPrepper ? (
        <DarkCard Icon={ChefHat} title="become a prepper" sub="start earning with your cooking"
          onPress={() => { feedback.tap(); router.push('/become-prepper'); }} accessibilityLabel="Become a prepper" />
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
    </View>
  );

  // ─── Sign out ────────────────────────────────────────────────────────────────
  const signOutEl = (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 260 }}>
      <PressableScale onPress={() => { feedback.tap(); user ? signOut() : router.push('/auth?mode=signin'); }}
        accessibilityRole="button" accessibilityLabel={user ? 'Sign out' : 'Sign in or create account'}
        style={{ marginHorizontal: 20, alignItems: 'center', paddingVertical: 15, borderRadius: Radius.pill, backgroundColor: user ? Palette.surface : Palette.brand, ...(user ? Shadow.card : {}) }}>
        <Text style={{ fontFamily: Font.heading, fontSize: 15, color: user ? Palette.danger : '#fff' }}>
          {user ? 'sign out' : 'sign in / create account'}
        </Text>
      </PressableScale>
    </MotiView>
  );

  const isWide = Platform.OS === 'web';

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />}
          contentContainerStyle={{ paddingTop: isWide ? 16 : 8, paddingBottom: 36, gap: 16, ...(isWide ? { maxWidth: 600, alignSelf: 'center', width: '100%' } : {}) }}>
          {headerEl}
          {coreCardEl}
          {statsEl}
          {activityEl}
          {rewardsEl}
          {accountEl}
          {settingsEl}
          {roleCardsEl}
          {signOutEl}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
