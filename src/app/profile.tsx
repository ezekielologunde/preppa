import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  Bell,
  Bookmark,
  CalendarCheck,
  Camera,
  ChefHat,
  ChevronRight,
  Clock,
  Compass,
  CreditCard,
  Crown,
  Gift,
  Heart,
  HelpCircle,
  Leaf,
  MapPin,
  MessageCircle,
  Moon,
  Pencil,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Linking, Platform, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustomerBadgeShelf } from '@/components/badge-shelf';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { useFavoritesCount } from '@/lib/favorites';
import { useRecentlyViewedCount } from '@/lib/recently-viewed';
import { useRewards } from '@/lib/queries/rewards';
import { feedback } from '@/lib/feedback';
import { useAddresses } from '@/lib/queries/addresses';
import { useCustomerMembership } from '@/lib/queries/memberships';
import { useMySubscriptions } from '@/lib/queries/meal-plans';
import { usePaymentMethods } from '@/lib/queries/payment-methods';
import { useCustomerBadges, useMyPrepperApplication } from '@/lib/queries/preppers';
import { toggleDarkMode, useDarkMode } from '@/lib/theme-mode';
import { useAuth } from '@/providers/auth-provider';

const quickLinks = [
  { label: 'favorites', sub: '0 meals', Icon: Heart, color: Palette.danger, bg: '#FEE2E2' },
  { label: 'saved', sub: '0 items', Icon: Bookmark, color: Palette.amber, bg: '#FEF3C7' },
  { label: 'recently viewed', sub: '0 meals', Icon: Clock, color: Palette.success, bg: '#DCFCE7' },
  { label: 'following', sub: '0 preppers', Icon: Users, color: '#8b5cf6', bg: '#EDE9FE' },
  { label: 'referrals', sub: 'invite', Icon: Ticket, color: Palette.amber, bg: '#FEF3C7' },
];

const STATIC_HUB: { label: string; sub: string; Icon: LucideIcon; accent?: boolean; route?: string }[] = [
  { label: 'your orders', sub: 'track & reorder', Icon: Receipt, route: '/orders' },
  { label: 'messages', sub: 'chat with preppers', Icon: MessageCircle, route: '/messages?tab=messages' },
  { label: 'addresses', sub: 'saved', Icon: MapPin, route: '/addresses' },
  { label: 'payment methods', sub: 'manage', Icon: CreditCard, route: '/payment-methods' },
  { label: 'notifications', sub: 'email, sms, push', Icon: Bell },
  { label: 'help center', sub: 'faq & support', Icon: HelpCircle },
  { label: 'dietary preferences', sub: 'manage', Icon: Leaf },
  { label: 'invite friends', sub: 'earn rewards', Icon: UserPlus },
];

function SmallBadge({ Icon, label, color }: { Icon: LucideIcon; label: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Palette.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
      <Icon size={14} color={color} />
      <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.inkSoft }}>{label}</Text>
    </View>
  );
}

type HubItem = { label: string; sub: string; Icon: LucideIcon; accent?: boolean; route?: string };

function HubGrid({ hub, dark, onHub }: { hub: HubItem[]; dark: boolean; onHub: (h: HubItem) => void }) {
  return (
    <View style={{ marginHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {hub.map((h) => (
        <PressableScale
          key={h.label}
          onPress={() => onHub(h)}
          accessibilityRole="button"
          accessibilityLabel={`${h.label}, ${h.sub}`}
          style={{ flexGrow: 1, flexBasis: '46%', backgroundColor: Palette.surface, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: h.accent ? Palette.brandTint : Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
            <h.Icon size={17} color={h.accent ? Palette.brand : Palette.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 13.5, color: h.accent ? Palette.brand : Palette.ink }}>{h.label}</Text>
            <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textMuted, marginTop: 1 }}>{h.sub}</Text>
          </View>
          <ChevronRight size={15} color={Palette.divider} />
        </PressableScale>
      ))}
      <PressableScale onPress={() => { feedback.tap(); toggleDarkMode(); }} accessibilityRole="switch" accessibilityState={{ checked: dark }} accessibilityLabel="Dark mode"
        style={{ flexGrow: 1, flexBasis: '46%', backgroundColor: Palette.surface, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: Palette.chip, alignItems: 'center', justifyContent: 'center' }}>
          <Moon size={17} color={Palette.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 13.5, color: Palette.ink }}>dark mode</Text>
          <Text numberOfLines={1} style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textMuted, marginTop: 1 }}>{dark ? 'on' : 'off'}</Text>
        </View>
        <MotiView
          animate={{ backgroundColor: dark ? Palette.brand : Palette.border }}
          transition={{ type: 'timing', duration: 200 }}
          style={{ width: 40, height: 24, borderRadius: 12, justifyContent: 'center', paddingHorizontal: 3 }}>
          <MotiView
            animate={{ translateX: dark ? 16 : 0 }}
            transition={{ type: 'spring', damping: 14, stiffness: 200 }}
            style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: Palette.surface }} />
        </MotiView>
      </PressableScale>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, isAdmin } = useAuth();
  const { data: subs, refetch: refetchSubs } = useMySubscriptions(user?.id);
  const { data: membership, refetch: refetchMembership } = useCustomerMembership(user?.id);
  const isPlus = membership?.isPlus === true;
  const { data: earnedBadges, refetch: refetchBadges } = useCustomerBadges(user?.id);
  const { data: myPrepper, refetch: refetchPrepper } = useMyPrepperApplication(user?.id);
  const isApprovedPrepper = myPrepper?.status === 'approved';
  const isPendingPrepper = myPrepper?.status === 'pending';

  const { data: addresses, refetch: refetchAddresses } = useAddresses(user?.id);
  const { data: pmData, refetch: refetchPm } = usePaymentMethods();
  const addrCount = addresses?.length ?? 0;
  const defaultCard = pmData?.methods.find((m) => m.isDefault);
  const [refreshing, setRefreshing] = useState(false);
  async function handleRefresh() { setRefreshing(true); await Promise.all([refetchSubs(), refetchMembership(), refetchBadges(), refetchPrepper(), refetchAddresses(), refetchPm()]); setRefreshing(false); }

  const hub: HubItem[] = [
    ...STATIC_HUB.map((item) => {
      if (item.label === 'addresses') {
        return { ...item, sub: addrCount === 0 ? 'none saved' : `${addrCount} saved` };
      }
      if (item.label === 'payment methods') {
        return { ...item, sub: defaultCard ? `${defaultCard.brand} ···· ${defaultCard.last4}` : 'none saved' };
      }
      return item;
    }),
    { label: 'prep+', sub: isPlus ? 'member · active ✦' : 'perks & discounts', Icon: Sparkles, accent: isPlus, route: '/prep-plus' },
    ...(isApprovedPrepper ? [{ label: 'my kitchen', sub: 'dashboard & earnings', Icon: ChefHat, accent: true, route: '/dashboard' }] : []),
  ];
  const favMeals = useFavoritesCount('meal:');
  const followed = useFavoritesCount('prepper:');
  const recentCount = useRecentlyViewedCount();
  const rewards = useRewards(user?.id);
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'guest';
  const bio = (user?.user_metadata?.bio as string | undefined) || 'good food. good mood. always.';

  const [toast, setToast] = useState<string | null>(null);
  const dark = useDarkMode();

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2400);
  };
  const soon = (label: string) => {
    feedback.warning();
    flash(`${label} — coming soon`);
  };
  const go = (route: string) => router.push(route as never);

  const onQuick = (label: string) => {
    if (label === 'favorites') { feedback.tap(); return go('/favorites'); }
    if (label === 'saved') { feedback.tap(); return go('/favorites'); }
    if (label === 'recently viewed') { feedback.tap(); return go('/recently-viewed'); }
    if (label === 'following') { feedback.tap(); return go('/following'); }
    if (label === 'referrals') { feedback.tap(); return go('/referral'); }
    return soon(label.replace(/\b\w/, (c) => c.toUpperCase()));
  };
  const onHub = (h: HubItem) => {
    if (h.accent) { feedback.tap(); return go('/dashboard'); }
    if (h.route) { feedback.tap(); return go(h.route); }
    if (h.label === 'notifications') { feedback.tap(); return go('/notifications'); }
    if (h.label === 'help center') {
      feedback.tap();
      Linking.openURL('mailto:support@preppa.live?subject=Preppa%20support').catch(() => soon('Help center'));
      return;
    }
    if (h.label === 'invite friends') { feedback.tap(); return go('/referral'); }
    if (h.label === 'dietary preferences') { feedback.tap(); return go('/dietary-preferences'); }
    return soon(h.label.replace(/\b\w/g, (c) => c.toUpperCase()));
  };

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Palette.brand} colors={[Palette.brand]} />} contentContainerStyle={{ paddingTop: Platform.OS === 'web' ? 16 : 8, paddingBottom: 130 }}>
          {/* Top actions */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, gap: 10 }}>
            <PressableScale onPress={() => { feedback.tap(); router.push('/settings'); }} accessibilityRole="button" accessibilityLabel="Settings" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Settings size={19} color={Palette.ink} />
            </PressableScale>
            <PressableScale onPress={() => { feedback.tap(); go('/notifications'); }} accessibilityRole="button" accessibilityLabel="Notifications" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={19} color={Palette.ink} />
            </PressableScale>
          </View>

          {/* Identity */}
          <MotiView from={{ opacity: 0, translateY: 14 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 320 }}>
          <View style={{ alignItems: 'center', paddingHorizontal: 20, marginTop: 6 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: Palette.brand, padding: 3 }}>
              <Avatar name={displayName} url={user?.user_metadata?.avatar_url as string | undefined} size={84} />
              <PressableScale onPress={() => soon('Change photo')} accessibilityRole="button" accessibilityLabel="Change photo" style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: Palette.brand, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Palette.canvas }}>
                <Camera size={14} color={Palette.surface} />
              </PressableScale>
            </View>
            <PressableScale onPress={() => { feedback.tap(); router.push('/edit-profile'); }} accessibilityRole="button" accessibilityLabel="Edit profile" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 26, color: Palette.ink, letterSpacing: -0.6 }}>{displayName}</Text>
              <Pencil size={16} color={Palette.brand} />
            </PressableScale>

            {/* Role badge */}
            {isApprovedPrepper ? (
              <View style={{ marginTop: 6, backgroundColor: Palette.brandTint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: Palette.brand }}>prepper ✓</Text>
              </View>
            ) : isAdmin ? (
              <View style={{ marginTop: 6, backgroundColor: '#EDE9FE', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
                <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: '#7C3AED' }}>admin</Text>
              </View>
            ) : null}

            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Palette.textSecondary, marginTop: 6 }}>{bio}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <MapPin size={13} color={Palette.textMuted} />
              <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>New York, NY</Text>
            </View>
            {earnedBadges?.length ? (
              <View style={{ marginTop: 14, maxWidth: '100%' }}>
                <CustomerBadgeShelf badges={earnedBadges} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <SmallBadge Icon={Sparkles} label="foodie" color={Palette.amber} />
                <SmallBadge Icon={Compass} label="explorer" color="#8b5cf6" />
                <SmallBadge Icon={Heart} label="plan lover" color={Palette.danger} />
              </View>
            )}
          </View>
          </MotiView>

          {/* Rewards / tier */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
          <PressableScale onPress={() => { feedback.tap(); go('/rewards'); }} accessibilityRole="button" accessibilityLabel="View your rewards" style={{ marginHorizontal: 20, marginTop: 22 }}>
            <LinearGradient colors={['#FFE9D6', '#FFDDBE']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.body, fontSize: 13, color: '#7c5a42' }}>your balance</Text>
                <Text style={{ fontFamily: Font.display, fontSize: 28, color: Palette.brand, letterSpacing: -0.5 }}>
                  {rewards.points.toLocaleString()} <Text style={{ fontSize: 15 }}>pts</Text>
                </Text>
                <Text style={{ fontFamily: Font.medium, fontSize: 12, color: '#7c5a42', marginTop: 2 }}>
                  ${(rewards.points * 0.01).toFixed(2)} in rewards ›
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                  <Crown size={15} color="#d97706" />
                  <Text style={{ fontFamily: Font.heading, fontSize: 14, color: Palette.ink }}>{rewards.tier.name.toLowerCase()} member</Text>
                  {rewards.nextTier ? (
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#7c5a42' }}>
                      · {Math.round(rewards.toNext * 10).toLocaleString()} pts to go
                    </Text>
                  ) : (
                    <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#7c5a42' }}>· top tier 🎉</Text>
                  )}
                </View>
                <View style={{ height: 7, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.08)', marginTop: 8, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.round(rewards.progress * 100)}%`, height: 7, borderRadius: 4, backgroundColor: Palette.brand }} />
                </View>
              </View>
              <Gift size={56} color="#d97706" />
            </LinearGradient>
          </PressableScale>
          </MotiView>

          {/* My Kitchen — approved preppers */}
          {isApprovedPrepper ? (
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/dashboard'); }}
              accessibilityRole="button"
              accessibilityLabel="Open my kitchen"
              style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: Palette.prepperBg, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(241,95,34,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                <ChefHat size={20} color={Palette.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.surface }}>my kitchen</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#9AA1AD', marginTop: 1 }}>meals, orders, earnings & go live</Text>
              </View>
              <ChevronRight size={18} color="#6B7280" />
            </PressableScale>
          ) : null}

          {/* Admin console */}
          {isAdmin ? (
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/admin'); }}
              accessibilityRole="button"
              accessibilityLabel="Open admin console"
              {...({ dataSet: { noinvert: 'true' } } as object)}
              style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: Palette.prepperBg, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(241,95,34,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={20} color={Palette.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.surface }}>admin console</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#9AA1AD', marginTop: 1 }}>approvals, orders, earnings & features</Text>
              </View>
              <ChevronRight size={18} color="#6B7280" />
            </PressableScale>
          ) : null}

          {/* Quick links */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 260, delay: 140 }}>
          <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: Palette.surface, borderRadius: 20, padding: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
            {quickLinks.map((q) => (
              <PressableScale key={q.label} onPress={() => onQuick(q.label)} accessibilityRole="button" accessibilityLabel={q.label} style={{ alignItems: 'center', gap: 7, flex: 1 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: q.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <q.Icon size={19} color={q.color} />
                </View>
                <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: Palette.inkSoft }}>{q.label}</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 10, color: Palette.textMuted }}>
                  {q.label === 'favorites'
                    ? `${favMeals} meal${favMeals === 1 ? '' : 's'}`
                    : q.label === 'following'
                    ? `${followed} prepper${followed === 1 ? '' : 's'}`
                    : q.label === 'saved'
                    ? `${favMeals + followed} items`
                    : q.label === 'recently viewed'
                    ? `${recentCount} meal${recentCount === 1 ? '' : 's'}`
                    : q.sub}
                </Text>
              </PressableScale>
            ))}
          </View>
          </MotiView>

          {/* Meal plans & subscriptions */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginTop: 28, marginBottom: 12 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.5 }}>meal plans &amp; subscriptions</Text>
            <PressableScale onPress={() => { feedback.tap(); go('/meal-plans'); }} accessibilityRole="button" accessibilityLabel="View all meal plans">
              <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Palette.brand }}>view all</Text>
            </PressableScale>
          </View>
          {subs && subs.length > 0 ? (
            <View style={{ marginHorizontal: 20, gap: 10 }}>
              {subs.map((s) => {
                const active = s.status === 'active';
                const badge = active ? { bg: '#DCFCE7', fg: '#15803d' } : s.status === 'paused' ? { bg: '#FEF3C7', fg: '#b45309' } : { bg: Palette.chip, fg: Palette.textSecondary };
                const next = s.next_billing_at ? new Date(s.next_billing_at) : null;
                const nextLabel = next && !isNaN(next.getTime()) ? next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
                return (
                  <PressableScale key={s.id} onPress={() => { feedback.tap(); go('/meal-plans'); }} accessibilityRole="button" accessibilityLabel={`${s.plan_name}, ${s.status}`}
                    style={{ backgroundColor: Palette.surface, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                      <CalendarCheck size={24} color={Palette.brand} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }} numberOfLines={1}>{s.plan_name}</Text>
                      {s.prepper?.display_name ? <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textMuted }}>by {s.prepper.display_name}</Text> : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <View style={{ paddingHorizontal: 9, height: 22, borderRadius: 999, backgroundColor: badge.bg, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontFamily: Font.semibold, fontSize: 11, color: badge.fg, textTransform: 'capitalize' }}>{s.status}</Text>
                        </View>
                        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, textTransform: 'capitalize' }}>
                          {nextLabel ? `next: ${nextLabel} · ` : ''}{s.frequency}
                        </Text>
                      </View>
                    </View>
                    <ChevronRight size={18} color={Palette.divider} />
                  </PressableScale>
                );
              })}
            </View>
          ) : (
            <PressableScale onPress={() => { feedback.tap(); go('/meal-plans'); }} accessibilityRole="button" accessibilityLabel="Discover meal plans"
              style={{ marginHorizontal: 20, backgroundColor: Palette.surface, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: Palette.brandTint, alignItems: 'center', justifyContent: 'center' }}>
                <CalendarCheck size={22} color={Palette.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>Subscribe & save</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textMuted, marginTop: 1 }}>Weekly meal plans from your favorite kitchens, on repeat.</Text>
              </View>
              <ChevronRight size={18} color={Palette.divider} />
            </PressableScale>
          )}

          {/* Hub */}
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 240, delay: 200 }}>
          <Text style={{ fontFamily: Font.display, fontSize: 22, color: Palette.ink, letterSpacing: -0.5, paddingHorizontal: 20, marginTop: 28, marginBottom: 12 }}>your hub</Text>
          <HubGrid hub={hub} dark={dark} onHub={onHub} />
          </MotiView>

          {/* Become a prepper — only for non-approved, non-pending users */}
          {!isApprovedPrepper && !isPendingPrepper ? (
            <PressableScale
              onPress={() => { feedback.tap(); router.push('/become-prepper'); }}
              accessibilityRole="button"
              accessibilityLabel="Become a prepper, start earning with your cooking"
              style={{ marginHorizontal: 20, marginTop: 10, backgroundColor: Palette.prepperBg, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(241,95,34,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                <ChefHat size={20} color={Palette.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.surface }}>become a prepper</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#9AA1AD', marginTop: 1 }}>start earning with your cooking</Text>
              </View>
              <ChevronRight size={18} color="#6B7280" />
            </PressableScale>
          ) : isPendingPrepper ? (
            <View style={{ marginHorizontal: 20, marginTop: 10, backgroundColor: '#FEF3C7', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(245,158,11,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={20} color={Palette.amber} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Font.heading, fontSize: 15, color: Palette.ink }}>application pending</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#92400E', marginTop: 1 }}>we'll notify you within 48h</Text>
              </View>
            </View>
          ) : null}

          <PressableScale
            onPress={() => { feedback.tap(); user ? signOut() : router.push('/auth?mode=signin'); }}
            accessibilityRole="button"
            accessibilityLabel={user ? 'Sign out' : 'Sign in or create account'}
            style={{ marginHorizontal: 20, marginTop: 16, alignItems: 'center', paddingVertical: 15, borderRadius: 16, backgroundColor: user ? Palette.surface : Palette.brand }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: user ? Palette.danger : Palette.surface }}>
              {user ? 'sign out' : 'sign in / create account'}
            </Text>
          </PressableScale>
        </ScrollView>

        {toast ? (
          <MotiView
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 200 }}
            style={{ position: 'absolute', left: 20, right: 20, bottom: 24, backgroundColor: Palette.ink, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}>
            <Text style={{ fontFamily: Font.medium, fontSize: 13.5, color: Palette.surface, textAlign: 'center' }}>{toast}</Text>
          </MotiView>
        ) : null}
      </SafeAreaView>
    </View>
  );
}
