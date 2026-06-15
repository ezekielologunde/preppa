import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  BadgeCheck,
  Bell,
  CalendarCheck,
  ChefHat,
  ChevronRight,
  Clock,
  Crown,
  Leaf,
  Pencil,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DarkCard, RewardsCard } from '@/components/profile-sections';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { useConversations } from '@/lib/queries/messages';
import { useCustomerMembership } from '@/lib/queries/memberships';
import { useMySubscriptions } from '@/lib/queries/meal-plans';
import { useNotifications } from '@/lib/queries/notifications';
import { useFollowedPreppers, useMyPrepperApplication } from '@/lib/queries/preppers';
import { useRewards } from '@/lib/queries/rewards';
import { useAuth } from '@/providers/auth-provider';

// ─── Operational shortcut card ───────────────────────────────────────────────

function ShortcutCard({
  Icon,
  tint,
  title,
  sub,
  meta,
  warning,
  onPress,
  delay,
}: {
  Icon: LucideIcon;
  tint: string;
  title: string;
  sub: string;
  meta?: string;
  warning?: string;
  onPress: () => void;
  delay: number;
}) {
  return (
    <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay }}>
      <PressableScale
        onPress={() => { feedback.tap(); onPress(); }}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${sub}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Palette.surface, borderRadius: 20, padding: 16, ...Shadow.card }}>
        <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: tint + '1A', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={23} color={tint} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: Palette.ink, letterSpacing: -0.2 }}>{title}</Text>
            {meta ? (
              <View style={{ paddingHorizontal: 8, height: 20, borderRadius: Radius.pill, backgroundColor: tint + '1A', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: tint }}>{meta}</Text>
              </View>
            ) : null}
            {warning ? (
              <View style={{ paddingHorizontal: 7, height: 20, borderRadius: Radius.pill, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: '#D97706' }}>{warning}</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textMuted, marginTop: 2, lineHeight: 17 }}>{sub}</Text>
        </View>
        <ChevronRight size={19} color={Palette.textSecondary} />
      </PressableScale>
    </MotiView>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, isAdmin } = useAuth();
  const go = (route: string) => router.push(route as never);

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

  const activeSubs = (subs ?? []).filter((s) => s.status === 'active').length;
  const pausedSubs = (subs ?? []).filter((s) => s.status === 'paused').length;
  const followed = followedPreppers?.length ?? 0;
  const _dm = user?.user_metadata ?? {};
  const dietaryCount =
    ((_dm.dietary as string[] | undefined) ?? []).length +
    ((_dm.allergies as string[] | undefined) ?? []).length +
    ((_dm.cuisines as string[] | undefined) ?? []).length;
  const dietaryMeta = dietaryCount > 0 ? String(dietaryCount) + ' set' : undefined;
  const totalUnread = (notifications ?? []).filter((n) => !n.read).length + (conversations ?? []).filter((c) => c.unread).length;
  const displayName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'guest';
  const tierName = rewards.tier.name.toLowerCase();

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
        <Text style={{ flex: 1, fontFamily: Font.display, fontSize: 26, color: Palette.ink, letterSpacing: -0.6 }}>profile</Text>
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
      </View>
    </MotiView>
  );

  // ─── User core card ─────────────────────────────────────────────────────────
  const coreCardEl = (
    <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 300 }}>
      <PressableScale
        onPress={() => { feedback.tap(); router.push('/edit-profile'); }}
        accessibilityRole="button"
        accessibilityLabel="Edit your profile"
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

  // ─── Rewards ────────────────────────────────────────────────────────────────
  const rewardsEl = (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 60 }}>
      <RewardsCard rewards={rewards} isLoading={rewards.isLoading} onPress={() => { feedback.tap(); go('/rewards'); }} />
    </MotiView>
  );

  // ─── Operational shortcuts ──────────────────────────────────────────────────
  const shortcutsEl = (
    <View style={{ marginHorizontal: 20, gap: 12 }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, paddingHorizontal: 4 }}>your food, your way</Text>
      <ShortcutCard
        Icon={CalendarCheck}
        tint={Palette.brand}
        title="My Subscriptions"
        meta={activeSubs > 0 ? `${activeSubs} active` : undefined}
        warning={pausedSubs > 0 ? `${pausedSubs} paused` : undefined}
        sub="Manage multi-chef plans, pause meals, adjust your delivery calendar"
        onPress={() => go('/meal-plans')}
        delay={120}
      />
      <ShortcutCard
        Icon={Leaf}
        tint="#16A34A"
        title="Dietary & Allergen Profile"
        meta={dietaryMeta}
        sub="Updates your curated ‘Recommended for You’ engine"
        onPress={() => go('/dietary-preferences')}
        delay={170}
      />
      <ShortcutCard
        Icon={Users}
        tint="#7C3AED"
        title="Chef Network"
        meta={followed > 0 ? `${followed}` : undefined}
        sub="Your favourite local kitchens and the chefs you’ve ordered from"
        onPress={() => go('/following')}
        delay={220}
      />
    </View>
  );

  // ─── Settings gateway ───────────────────────────────────────────────────────
  const gatewayEl = (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 280 }}>
      <PressableScale
        onPress={() => { feedback.tap(); router.push('/settings'); }}
        accessibilityRole="button"
        accessibilityLabel="Account settings and support"
        style={{ marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Palette.surface, borderRadius: 20, padding: 16, ...Shadow.card }}>
        <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
          <Settings size={23} color={Palette.inkSoft} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 15.5, color: Palette.ink, letterSpacing: -0.2 }}>Account Settings & Support</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textMuted, marginTop: 2, lineHeight: 17 }}>Profile, payment, help center, privacy & more</Text>
        </View>
        <ChevronRight size={19} color={Palette.textSecondary} />
      </PressableScale>
    </MotiView>
  );

  // ─── Role cards (marketplace) ───────────────────────────────────────────────
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
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.amber, marginTop: 1 }}>we’ll notify you within 48h</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  // ─── Sign out ───────────────────────────────────────────────────────────────
  const signOutEl = (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 320 }}>
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
          {rewardsEl}
          {shortcutsEl}
          {gatewayEl}
          {roleCardsEl}
          {signOutEl}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
