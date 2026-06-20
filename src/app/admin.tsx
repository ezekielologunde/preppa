import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  ChevronLeft,
  Download,
  LayoutDashboard,
  Lock,
  Receipt,
  Store,
  ToggleLeft,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { MotiView } from 'moti';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminCustomers } from '@/components/admin/customers';
import { AdminDisputes } from '@/components/admin/disputes';
import { AdminEarnings } from '@/components/admin/earnings';
import { AdminExports } from '@/components/admin/exports';
import { AdminFeatures } from '@/components/admin/features';
import { AdminOrders } from '@/components/admin/orders';
import { AdminOverview } from '@/components/admin/overview';
import { AdminPreppers } from '@/components/admin/preppers';
import { AdminUsers } from '@/components/admin/users';
import { AdminFeedBanner, LiveDot, useAdminRealtimeFeed } from '@/components/admin/realtime-feed';
import { Admin } from '@/components/admin/ui';
import { PressableScale } from '@/components/ui/pressable-scale';
import { feedback } from '@/lib/feedback';
import { useBreakpoint } from '@/lib/layout';
import { Font } from '@/constants/fonts';
import { Radius } from '@/constants/theme';
import { useAdminDisputes, usePlatformStats } from '@/lib/queries/admin';
import { useAuth } from '@/providers/auth-provider';

type SectionKey = 'overview' | 'preppers' | 'customers' | 'orders' | 'earnings' | 'features' | 'disputes' | 'users' | 'exports';
const SECTIONS: { key: SectionKey; label: string; Icon: LucideIcon }[] = [
  { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { key: 'preppers', label: 'Preppers', Icon: Store },
  { key: 'customers', label: 'Customers', Icon: Users },
  { key: 'orders', label: 'Preorders', Icon: Receipt },
  { key: 'earnings', label: 'Earnings', Icon: Wallet },
  { key: 'features', label: 'Features', Icon: ToggleLeft },
  { key: 'disputes', label: 'Disputes', Icon: AlertTriangle },
  { key: 'users', label: 'Users', Icon: UserCog },
  { key: 'exports', label: 'Exports', Icon: Download },
];

// ---------------------------------------------------------------------------
// Desktop sidebar nav
// ---------------------------------------------------------------------------

type SidebarProps = {
  section: SectionKey;
  onSelect: (k: SectionKey) => void;
  openDisputeCount: number;
  pendingPrepperCount: number;
};

function AdminSidebar({ section, onSelect, openDisputeCount, pendingPrepperCount }: SidebarProps) {
  return (
    <View style={{ width: 220, backgroundColor: Admin.card, borderRightWidth: 1, borderRightColor: Admin.border, paddingTop: 24, paddingBottom: 32, paddingHorizontal: 12, gap: 4 }}>
      <Text style={{ fontFamily: Font.medium, fontSize: 10, color: Admin.textMuted, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 10, marginBottom: 8 }}>Navigation</Text>
      {SECTIONS.map((s) => {
        const active = section === s.key;
        const badge =
          s.key === 'disputes' ? openDisputeCount :
          s.key === 'preppers' ? pendingPrepperCount : 0;
        return (
          <MotiView
            key={s.key}
            animate={{ backgroundColor: active ? Admin.brand + '1A' : 'transparent' }}
            transition={{ type: 'timing', duration: 160 }}
            style={{ borderRadius: Radius.sm, overflow: 'hidden' }}>
            <PressableScale
              onPress={() => { feedback.tap(); onSelect(s.key); }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={s.label}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 10 }}>
              <s.Icon size={16} color={active ? Admin.brand : Admin.textDim} />
              <Text style={{ flex: 1, fontFamily: active ? Font.heading : Font.body, fontSize: 14, color: active ? Admin.brand : Admin.textDim }}>{s.label}</Text>
              {badge > 0 ? (
                <View style={{ minWidth: 18, height: 18, borderRadius: 9, backgroundColor: s.key === 'disputes' ? Admin.danger : Admin.warn, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Text style={{ fontFamily: Font.heading, fontSize: 10, color: '#fff' }}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              ) : null}
            </PressableScale>
          </MotiView>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function AdminScreen() {
  const router = useRouter();
  const { isAdmin, loading } = useAuth();
  const [section, setSection] = useState<SectionKey>('overview');
  const [feedEvent, setFeedEvent] = useState<Parameters<typeof AdminFeedBanner>[0]['event']>(null);
  const { data: openDisputes } = useAdminDisputes('open');
  const { data: platformStats } = usePlatformStats();
  const openDisputeCount = openDisputes?.length ?? 0;
  const pendingPrepperCount = platformStats?.pending_preppers ?? 0;
  const bp = useBreakpoint();
  const isDesktop = bp === 'desktop';

  const handleFeedEvent = useCallback((evt: Parameters<typeof AdminFeedBanner>[0]['event']) => {
    setFeedEvent(evt);
  }, []);

  const dismissFeed = useCallback(() => setFeedEvent(null), []);

  const handleFeedNavigate = useCallback((evt: Parameters<typeof AdminFeedBanner>[0]['event']) => {
    if (!evt) return;
    if (evt.type === 'order') setSection('orders');
    else if (evt.type === 'dispute') setSection('disputes');
    else if (evt.type === 'application') setSection('preppers');
    setFeedEvent(null);
  }, []);

  // Subscribe to realtime events — only when admin is confirmed
  useAdminRealtimeFeed(isAdmin ? handleFeedEvent : () => undefined);

  function goBack() {
    feedback.tap();
    if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); }
  }

  function navigate(key: SectionKey) {
    feedback.tap();
    setSection(key);
  }

  // Access guard — only granted admins see the console.
  if (!loading && !isAdmin) {
    return (
      <View style={{ flex: 1, backgroundColor: Admin.bg }}>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <MotiView from={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 18, stiffness: 220 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: Admin.card, alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={28} color={Admin.textDim} />
            </View>
          </MotiView>
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: Admin.text }}>Admin only</Text>
          </MotiView>
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 140 }}>
            <Text style={{ fontFamily: Font.body, fontSize: 14, color: Admin.textDim, textAlign: 'center', lineHeight: 20 }}>
              This area is restricted to platform administrators. Ask an existing admin to grant you access.
            </Text>
          </MotiView>
          <MotiView from={{ opacity: 0, translateY: 8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 200 }}>
            <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ marginTop: 8, paddingHorizontal: 22, height: 48, borderRadius: Radius.sm, backgroundColor: Admin.brand, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Back to app</Text>
            </PressableScale>
          </MotiView>
        </SafeAreaView>
      </View>
    );
  }

  // Desktop: two-column layout with sidebar + content
  if (isDesktop) {
    return (
      <View style={{ flex: 1, backgroundColor: Admin.bg }}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          {/* Desktop header bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: Admin.border }}>
            <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Admin.card, alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={20} color={Admin.text} />
            </PressableScale>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: Font.display, fontSize: 20, color: Admin.text, letterSpacing: -0.5 }}>Admin console</Text>
            </View>
            <LiveDot />
          </View>

          {/* Feed banner */}
          {feedEvent ? (
            <View style={{ paddingTop: 8 }}>
              <AdminFeedBanner event={feedEvent} onDismiss={dismissFeed} onNavigate={handleFeedNavigate} />
            </View>
          ) : null}

          {/* Two-column body */}
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <AdminSidebar
              section={section}
              onSelect={setSection}
              openDisputeCount={openDisputeCount}
              pendingPrepperCount={pendingPrepperCount}
            />
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 24, paddingBottom: 60 }}
              style={{ flex: 1 }}>
              <MotiView
                key={section}
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 200 }}>
                {section === 'overview' && <AdminOverview onReviewPreppers={() => setSection('preppers')} onNavigate={navigate} onSectionChange={navigate} openDisputeCount={openDisputeCount} />}
                {section === 'preppers' && <AdminPreppers />}
                {section === 'customers' && <AdminCustomers />}
                {section === 'orders' && <AdminOrders />}
                {section === 'earnings' && <AdminEarnings />}
                {section === 'features' && <AdminFeatures />}
                {section === 'disputes' && <AdminDisputes />}
                {section === 'users' && <AdminUsers />}
                {section === 'exports' && <AdminExports />}
              </MotiView>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Mobile / tablet: scrollable tab strip layout
  return (
    <View style={{ flex: 1, backgroundColor: Admin.bg }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
          <PressableScale onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: Admin.card, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color={Admin.text} />
          </PressableScale>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: Font.display, fontSize: 22, color: Admin.text, letterSpacing: -0.5 }}>Admin console</Text>
            <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim }}>Preppa platform control</Text>
          </View>
          <LiveDot />
        </View>

        {/* Realtime feed banner */}
        {feedEvent ? <AdminFeedBanner event={feedEvent} onDismiss={dismissFeed} onNavigate={handleFeedNavigate} /> : null}

        {/* Section nav */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 14 }} style={{ flexGrow: 0 }}>
          {SECTIONS.map((s) => {
            const active = section === s.key;
            return (
              <MotiView
                key={s.key}
                animate={{ backgroundColor: active ? Admin.brand : Admin.card, borderColor: active ? Admin.brand : Admin.border }}
                transition={{ type: 'timing', duration: 180 }}
                style={{ borderRadius: Radius.pill, borderWidth: 1, overflow: 'hidden' }}>
                <PressableScale
                  onPress={() => { feedback.tap(); setSection(s.key); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={s.label}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, height: 40 }}>
                  <s.Icon size={15} color={active ? '#fff' : Admin.textDim} />
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: active ? '#fff' : Admin.textDim }}>{s.label}</Text>
                  {s.key === 'disputes' && openDisputeCount > 0 && !active ? (
                    <View style={{ minWidth: 16, height: 16, borderRadius: 8, backgroundColor: Admin.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                      <Text style={{ fontFamily: Font.heading, fontSize: 9, color: '#fff' }}>{openDisputeCount > 9 ? '9+' : openDisputeCount}</Text>
                    </View>
                  ) : null}
                  {s.key === 'preppers' && pendingPrepperCount > 0 && !active ? (
                    <View style={{ minWidth: 16, height: 16, borderRadius: 8, backgroundColor: Admin.warn, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                      <Text style={{ fontFamily: Font.heading, fontSize: 9, color: '#fff' }}>{pendingPrepperCount > 9 ? '9+' : pendingPrepperCount}</Text>
                    </View>
                  ) : null}
                </PressableScale>
              </MotiView>
            );
          })}
        </ScrollView>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 60 }}>
          <MotiView
            key={section}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 220 }}>
            {section === 'overview' && <AdminOverview onReviewPreppers={() => setSection('preppers')} onNavigate={navigate} onSectionChange={navigate} openDisputeCount={openDisputeCount} />}
            {section === 'preppers' && <AdminPreppers />}
            {section === 'customers' && <AdminCustomers />}
            {section === 'orders' && <AdminOrders />}
            {section === 'earnings' && <AdminEarnings />}
            {section === 'features' && <AdminFeatures />}
            {section === 'disputes' && <AdminDisputes />}
            {section === 'users' && <AdminUsers />}
            {section === 'exports' && <AdminExports />}
          </MotiView>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
