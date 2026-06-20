import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  BadgeCheck, Bell, BellRing, Bookmark, CalendarCheck, Camera, ChefHat, ChevronRight, Clock, Copy, CreditCard, Crown,
  Gift, Heart, LifeBuoy, MapPin, Package, Settings, ShieldCheck, Share2, Sparkles, Ticket,
  TrendingUp, Users, Video, Wallet,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Alert, Platform, Pressable, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DarkCard, DarkModeRow, MealPlansSection, RewardsCard, SectionCard, StatChip } from '@/components/profile-sections';
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
import { usePaymentMethods } from '@/lib/queries/payment-methods';
import { useMyReferralCode } from '@/lib/queries/referral';
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
  const { data: notifications, refetch: refetchNotifications } = useNotifications(user?.id);
  const { data: conversations, refetch: refetchConversations } = useConversations(user?.id);
  const { data: orders } = useMyOrders(user?.id);
  const savedCount = useFavoritesCount('meal:');

  const activeSubs = (subs ?? []).filter((s) => s.status === 'active').length;
  const followed = followedPreppers?.length ?? 0;
  const totalOrders = (orders ?? []).length;
  const unreadNotifs = (notifications ?? []).filter((n) => !n.read).length;
  const totalUnread = unreadNotifs + (conversations ?? []).filter((c) => c.unread).length;
  const displayName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'guest';
  const bio = (user?.user_metadata?.bio as string | undefined) ?? undefined;
  const tierName = rewards.tier.name.toLowerCase();

  const _dm = user?.user_metadata ?? {};
  const _dietary = (_dm.dietary as string[] | undefined) ?? [];
  const _cuisines = (_dm.cuisines as string[] | undefined) ?? [];

  function buildPrefSummary(): string | undefined {
    const parts: string[] = [];
    if (_dietary.length > 0) parts.push(_dietary.slice(0, 2).join(', '));
    if (_cuisines.length > 0) parts.push(_cuisines.slice(0, 2).join(', '));
    return parts.length > 0 ? parts.join(' · ') : undefined;
  }

  const dietaryMeta = buildPrefSummary();

  const { data: paymentMethodsData } = usePaymentMethods();
  const defaultCard = paymentMethodsData?.methods.find((m) => m.isDefault) ?? null;
  const paymentMethodSub = defaultCard
    ? `${defaultCard.brand !== 'other' ? defaultCard.brand.charAt(0).toUpperCase() + defaultCard.brand.slice(1) : 'Card'} ···· ${defaultCard.last4}`
    : 'Cards, Apple Pay & more';

  const { data: referralCode } = useMyReferralCode(user?.id);
  const [refCopied, setRefCopied] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([refetchSubs(), refetchMembership(), refetchPrepper(), refetchFollowed(), rewards.refetch(), refetchNotifications(), refetchConversations()]);
    setRefreshing(false);
  }

  function handleSignOut() {
    feedback.tap();
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => { feedback.tap(); signOut(); },
        },
      ],
    );
  }

  // ─── Top nav bar ─────────────────────────────────────────────────────────────
  const navBarEl = (
    <MotiView from={{ opacity: 0, translateY: -6 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 10 }}>
        <View style={{ flex: 1 }} />
        <PressableScale onPress={() => { feedback.tap(); go('/notifications'); }} accessibilityRole="button"
          accessibilityLabel={`Notifications${totalUnread > 0 ? `, ${totalUnread} unread` : ''}`}
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

  // ─── Hero header ─────────────────────────────────────────────────────────────
  const heroEl = (
    <MotiView
      from={{ opacity: 0, translateY: 16 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0 }}
      style={{ alignItems: 'center', gap: 8, paddingHorizontal: 20 }}>
      {/* Avatar with brand ring */}
      <PressableScale onPress={() => { feedback.tap(); router.push('/edit-profile'); }}
        accessibilityRole="button" accessibilityLabel="Edit your profile">
        <View style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 2.5, borderColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Avatar name={displayName} url={user?.user_metadata?.avatar_url as string | undefined} size={80} />
          {!user?.user_metadata?.avatar_url && (
            <View style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: Palette.brand,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: Palette.canvas,
            }}>
              <Camera size={12} color="#fff" />
            </View>
          )}
        </View>
      </PressableScale>

      {/* Display name */}
      <Text
        numberOfLines={1}
        style={{ fontFamily: Font.display, fontSize: 24, color: Palette.ink, letterSpacing: -0.5, textAlign: 'center', marginTop: 4 }}>
        {displayName}
      </Text>

      {/* Badges row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: rewards.tier.color + '18', borderRadius: Radius.pill, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Crown size={12} color={rewards.tier.color} />
          <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: rewards.tier.color }}>{tierName} member</Text>
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

      {/* Bio / tagline */}
      {bio ? (
        <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, textAlign: 'center' }}>
          {bio}
        </Text>
      ) : (
        <Pressable
          onPress={() => router.push('/edit-profile' as never)}
          accessibilityRole="button"
          accessibilityLabel="Add bio">
          <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.brand, fontStyle: 'italic' }}>
            + add a bio
          </Text>
        </Pressable>
      )}

      {/* Edit profile pill */}
      <PressableScale onPress={() => { feedback.tap(); router.push('/edit-profile'); }}
        accessibilityRole="button" accessibilityLabel="Edit profile"
        style={{ height: 32, borderRadius: 16, backgroundColor: Palette.surface, borderWidth: 1, borderColor: Palette.border, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft }}>Edit profile</Text>
      </PressableScale>
    </MotiView>
  );

  // ─── Quick stats ─────────────────────────────────────────────────────────────
  const statsEl = (
    <View style={{ marginHorizontal: 20, flexDirection: 'row', gap: 8 }}>
      <StatChip value={totalOrders} label="orders"    Icon={Package}       color={Palette.brand}   onPress={() => go('/orders')}     index={0} />
      <StatChip value={savedCount}  label="saved"     Icon={Heart}         color="#EF4444"         onPress={() => go('/favorites')}  index={1} />
      <StatChip value={activeSubs}  label="plans"     Icon={CalendarCheck} color="#8B5CF6"         onPress={() => go('/meal-plans')} index={2} />
      <StatChip value={followed}    label="following" Icon={Users}         color={Palette.success} onPress={() => go('/following')}  index={3} />
    </View>
  );

  // ─── Role cards (positioned after stats, before settings) ────────────────────
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

  // ─── My Kitchen (approved preppers only) ─────────────────────────────────────
  const KITCHEN_ROWS = [
    { label: 'Kitchen profile', sub: 'Manage your public kitchen page', Icon: ChefHat,     route: '/kitchen-settings'   },
    { label: 'Preorders',       sub: 'View and manage preorders',       Icon: Package,     route: '/prepper-orders'      },
    { label: 'Payouts',         sub: 'Balance, bank & withdrawals',     Icon: Wallet,      route: '/prepper-payouts'     },
    { label: 'Earnings',        sub: 'Sales, reach & performance',      Icon: TrendingUp,  route: '/earnings'            },
    { label: 'Post a video',    sub: 'Share a kitchen clip',            Icon: Video,       route: '/post-video'          },
  ];
  const kitchenEl = isApprovedPrepper ? (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 60 }}>
      <View style={{ marginHorizontal: 20, gap: 8, marginBottom: 12 }}>
        <Text style={{ fontFamily: Font.display, fontSize: 15, color: Palette.ink, letterSpacing: -0.3 }}>my kitchen</Text>
        <View style={{ backgroundColor: Palette.surface, borderRadius: 14, overflow: 'hidden' }}>
          {KITCHEN_ROWS.map((row, i) => (
            <PressableScale key={row.label} onPress={() => { feedback.tap(); go(row.route); }}
              accessibilityRole="button" accessibilityLabel={`${row.label}, ${row.sub}`}
              style={{ height: 52, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, marginTop: i === 0 ? 0 : 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: Palette.chip }}>
              <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
                <row.Icon size={17} color={Palette.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.ink }}>{row.label}</Text>
                <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary, marginTop: 1 }}>{row.sub}</Text>
              </View>
              <ChevronRight size={15} color={Palette.textSecondary} />
            </PressableScale>
          ))}
        </View>
      </View>
    </MotiView>
  ) : null;

  // ─── My Activity ─────────────────────────────────────────────────────────────
  const activityEl = (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
      <View style={{ marginHorizontal: 20, gap: 8, marginBottom: 12 }}>
        <Text style={{ fontFamily: Font.display, fontSize: 15, color: Palette.ink, letterSpacing: -0.3 }}>my activity</Text>
        <SectionCard rows={[
          { label: 'My Orders',    sub: 'Track & history',               Icon: Package,      onPress: () => { feedback.tap(); go('/orders'); }         },
          { label: 'Saved Meals',  sub: 'Your bookmarked meals',         Icon: Bookmark,     onPress: () => { feedback.tap(); go('/saved-meals'); }     },
          { label: 'Favorites',    sub: 'Saved meals & kitchens',        Icon: Heart,        onPress: () => { feedback.tap(); go('/favorites'); }       },
          { label: 'Meal Plans',   sub: activeSubs > 0 ? `${activeSubs} active plan${activeSubs > 1 ? 's' : ''}` : 'Weekly subscriptions', Icon: CalendarCheck, accent: activeSubs > 0, onPress: () => { feedback.tap(); go('/meal-plans'); } },
          { label: 'Experiences',  sub: 'Private chefs, classes & more', Icon: Ticket,       onPress: () => { feedback.tap(); go('/experiences'); }     },
        ]} />
      </View>
    </MotiView>
  );

  // ─── Meal plans preview ─────────────────────────────────────────────────────
  const mealPlansEl = (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 100 }}>
      <MealPlansSection
        subs={subs}
        onViewAll={() => { feedback.tap(); go('/meal-plans'); }}
        onPress={() => { feedback.tap(); go('/meal-plans'); }}
      />
    </MotiView>
  );

  // ─── Rewards ────────────────────────────────────────────────────────────────
  const rewardsEl = (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 120 }}>
      <RewardsCard rewards={rewards} isLoading={rewards.isLoading} onPress={() => { feedback.tap(); go('/rewards'); }} />
    </MotiView>
  );

  // ─── Invite friends (referral) ───────────────────────────────────────────────
  const displayCode = referralCode ?? (user ? 'PREP-' + user.id.replace(/-/g, '').slice(0, 6).toUpperCase() : '------');
  const referralLink = `https://preppa.live/join?ref=${displayCode}`;

  function handleRefCopy() {
    feedback.success();
    try {
      (navigator as unknown as { clipboard?: { writeText?: (s: string) => void } })
        ?.clipboard?.writeText?.(referralLink);
    } catch { /* clipboard unavailable */ }
    setRefCopied(true);
    setTimeout(() => setRefCopied(false), 1500);
  }

  async function handleRefShare() {
    feedback.tap();
    await Share.share({
      message: `Join Preppa — home-cooked meals from local kitchens! Use my code ${displayCode} for $5 off your first order: ${referralLink}`,
    });
  }

  const referralEl = user ? (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
      <View style={{ marginHorizontal: 20, marginBottom: 12 }}>
        <View style={{ backgroundColor: Palette.surface, borderRadius: 20, padding: 16, borderLeftWidth: 4, borderLeftColor: Palette.brand, gap: 12 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
              <Gift size={17} color={Palette.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 14.5, color: Palette.ink }}>invite friends</Text>
              <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1 }}>Give $5, Get $5</Text>
            </View>
            <PressableScale onPress={() => { feedback.tap(); go('/referral'); }} accessibilityRole="button" accessibilityLabel="View full referral page">
              <ChevronRight size={16} color={Palette.textSecondary} />
            </PressableScale>
          </View>

          {/* Description */}
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, lineHeight: 18 }}>
            Share your code and your friend gets $5 off their first order. You get $5 credit when they complete their order.
          </Text>

          {/* Code display + copy */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1, backgroundColor: Palette.canvas, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary, marginBottom: 2 }}>your code</Text>
              <Text style={{ fontFamily: Font.display, fontSize: 20, color: Palette.brand, letterSpacing: 2 }}>{displayCode}</Text>
            </View>
            <PressableScale
              onPress={handleRefCopy}
              accessibilityRole="button"
              accessibilityLabel="Copy referral code"
              style={{ height: 52, paddingHorizontal: 16, borderRadius: 12, backgroundColor: refCopied ? Palette.success + '1A' : Palette.canvas, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <Copy size={15} color={refCopied ? Palette.success : Palette.textSecondary} />
              <Text style={{ fontFamily: Font.semibold, fontSize: 10.5, color: refCopied ? Palette.success : Palette.textSecondary }}>
                {refCopied ? 'copied!' : 'copy'}
              </Text>
            </PressableScale>
          </View>

          {/* Share button */}
          <PressableScale
            onPress={() => { void handleRefShare(); }}
            accessibilityRole="button"
            accessibilityLabel="Share invite link"
            style={{ height: 44, borderRadius: 12, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
            <Share2 size={15} color="#fff" />
            <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: '#fff' }}>share invite link</Text>
          </PressableScale>
        </View>
      </View>
    </MotiView>
  ) : null;

  // ─── Account (with dark mode toggle inline) ──────────────────────────────────
  const ACCOUNT_ROWS = [
    { label: 'Dietary Profile',    sub: dietaryMeta ?? 'Set allergies & preferences',  Icon: CalendarCheck, route: '/preferences' },
    { label: 'Payment Methods',    sub: paymentMethodSub,                               Icon: CreditCard,    route: '/payment-methods'      },
    { label: 'Addresses',          sub: 'Home, work & delivery spots',                 Icon: MapPin,        route: '/addresses'            },
    { label: 'Gift Cards',         sub: 'Send & redeem gift cards',                    Icon: Gift,          route: '/gift-cards'           },
    { label: 'My Kitchen Network', sub: followed > 0 ? `Following ${followed} kitchen${followed > 1 ? 's' : ''}` : 'Follow your favourite chefs', Icon: Users, route: '/following' },
  ];
  const accountEl = (
    <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 160 }}>
      <View style={{ marginHorizontal: 20, gap: 8, marginBottom: 12 }}>
        <Text style={{ fontFamily: Font.display, fontSize: 15, color: Palette.ink, letterSpacing: -0.3 }}>account</Text>
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
                <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 11.5, color: Palette.textSecondary, marginTop: 1 }}>{row.sub}</Text>
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
      <View style={{ marginHorizontal: 20, gap: 8, marginBottom: 12 }}>
        <Text style={{ fontFamily: Font.display, fontSize: 15, color: Palette.ink, letterSpacing: -0.3 }}>settings & support</Text>
        <SectionCard rows={[
          { label: 'View Notifications', sub: unreadNotifs > 0 ? `${unreadNotifs} unread` : 'Activity, orders & social', Icon: BellRing, accent: unreadNotifs > 0, onPress: () => { feedback.tap(); go('/notifications'); } },
          { label: 'Notification Settings', sub: 'Push alerts, orders, social & promotions', Icon: Bell, onPress: () => { feedback.tap(); go('/notification-preferences'); } },
          { label: 'Account Settings', sub: 'Profile, security & privacy',    Icon: Settings, onPress: () => { feedback.tap(); go('/settings'); }      },
          { label: 'Help Center',      sub: 'Guides, FAQ & contact support',  Icon: LifeBuoy, onPress: () => { feedback.tap(); go('/settings-help'); }  },
        ]} />
      </View>
    </MotiView>
  );

  // ─── Sign out ────────────────────────────────────────────────────────────────
  const signOutEl = (
    <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 260 }}>
      <View style={{ marginTop: 8, paddingHorizontal: 20 }}>
        {user ? (
          <PressableScale onPress={handleSignOut}
            accessibilityRole="button" accessibilityLabel="Sign out"
            style={{ height: 50, borderRadius: 14, backgroundColor: 'transparent', borderWidth: 1, borderColor: Palette.danger, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: Palette.danger }}>sign out</Text>
          </PressableScale>
        ) : (
          <PressableScale onPress={() => { feedback.tap(); router.push('/auth?mode=signin'); }}
            accessibilityRole="button" accessibilityLabel="Sign in or create account"
            style={{ height: 50, borderRadius: 14, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>sign in / create account</Text>
          </PressableScale>
        )}
      </View>
    </MotiView>
  );

  const isWide = Platform.OS === 'web';

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />}
          contentContainerStyle={{ paddingTop: isWide ? 16 : 8, paddingBottom: 120, gap: 16, ...(isWide ? { maxWidth: 600, alignSelf: 'center', width: '100%' } : {}) }}>
          {navBarEl}
          {heroEl}
          {statsEl}
          {roleCardsEl}
          {kitchenEl}
          {activityEl}
          {mealPlansEl}
          {rewardsEl}
          {referralEl}
          {accountEl}
          {settingsEl}
          {signOutEl}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
