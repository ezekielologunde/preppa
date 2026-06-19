import { Tabs, useRouter } from 'expo-router';
import { ChefHat, CircleUser, Compass, House, MonitorPlay, Ticket } from 'lucide-react-native';
import { MotiView } from 'moti';
import type React from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { BP } from '@/lib/layout';
import { useConversations } from '@/lib/queries/messages';
import { usePrepperOrders } from '@/lib/queries/orders';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useNotifications } from '@/lib/queries/notifications';
import { useAuth } from '@/providers/auth-provider';

type TabDef = {
  name: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

const BASE_TABS: TabDef[] = [
  { name: 'index',       label: 'Home',        Icon: House },
  { name: 'explore',     label: 'Explore',     Icon: Compass },
  { name: 'feeds',       label: 'Feed',        Icon: MonitorPlay },
  { name: 'experiences', label: 'Experiences', Icon: Ticket },
  { name: 'profile',     label: 'Profile',     Icon: CircleUser },
];

type TabBarProps = {
  state: { index: number; routes: { name: string; key: string }[] };
  navigation: { navigate: (name: string) => void };
};

function TabBarIcon({ Icon, focused }: { Icon: TabDef['Icon']; focused: boolean }) {
  return (
    <MotiView
      animate={{ scale: focused ? 1.08 : 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
      <Icon
        size={24}
        color={focused ? Palette.brand : Palette.textSecondary}
        strokeWidth={focused ? 2.2 : 1.6}
      />
    </MotiView>
  );
}

function TabBarLabel({ label, focused, compact }: { label: string; focused: boolean; compact?: boolean }) {
  return (
    <Text
      numberOfLines={1}
      style={{
        fontFamily: focused ? Font.semibold : Font.medium,
        fontSize: compact ? 10.5 : 11.5,
        color: focused ? Palette.brand : Palette.textSecondary,
        letterSpacing: 0,
      }}>
      {label}
    </Text>
  );
}

function PreppaTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { user } = useAuth();
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const isPrepper = prepper?.status === 'approved';
  const { data: pendingOrders } = usePrepperOrders(isPrepper ? prepper?.id : undefined, 'pending');
  const pendingCount = pendingOrders?.length ?? 0;
  const { data: notifications } = useNotifications(user?.id);
  const unreadBids = (notifications ?? []).filter((n) => !n.read && n.type === 'bid').length;
  const unreadNotifs = (notifications ?? []).filter((n) => !n.read).length;
  const { data: conversations } = useConversations(user?.id);
  const unreadMessages = (conversations ?? []).filter((c) => c.unread).length;
  const profileBadge = unreadNotifs + unreadMessages;

  // Tablet+ uses the AppSidebar rail; hide the bottom bar there.
  if (width >= BP.tablet) return null;

  const compact = width < 360;

  // Approved preppers see "My Hub" in the feeds slot — launcher for the kitchen dashboard.
  const tabs: TabDef[] = BASE_TABS.map((tab) =>
    tab.name === 'feeds' && isPrepper
      ? { name: 'feeds', label: 'My Hub', Icon: ChefHat }
      : tab,
  );

  return (
    <View style={{
      width: '100%',
      flexDirection: 'row',
      alignItems: 'stretch',
      backgroundColor: Palette.surface,
      borderTopWidth: 1,
      borderTopColor: Palette.border,
      paddingBottom: Math.max(insets.bottom + 4, 12),
    }}>
      {tabs.map((tab) => {
        const isHubTab = tab.name === 'feeds' && isPrepper;
        const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
        const focused = routeIndex >= 0 && state.index === routeIndex;

        return (
          <View key={tab.name} style={{ flex: 1, minWidth: 0 }}>
            <PressableScale
              onPress={() => {
                feedback.tap();
                if (isHubTab) {
                  router.push('/dashboard');
                } else {
                  navigation.navigate(tab.name);
                }
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              style={{ width: '100%', minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingTop: 10, paddingHorizontal: 2, gap: 4 }}>

              <MotiView
                animate={{ width: focused ? 26 : 0, opacity: focused ? 1 : 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  height: 3,
                  borderBottomLeftRadius: 2,
                  borderBottomRightRadius: 2,
                  backgroundColor: Palette.brand,
                }}
              />

              <View style={{ position: 'relative' }}>
                <TabBarIcon Icon={tab.Icon} focused={focused} />
                {isHubTab && pendingCount > 0 ? (
                  <View style={{
                    position: 'absolute', top: -4, right: -8,
                    minWidth: 16, height: 16, borderRadius: 8,
                    backgroundColor: Palette.brand, paddingHorizontal: 3,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5, borderColor: Palette.surface,
                  }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 9.5, color: '#fff', lineHeight: 13 }}>
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </Text>
                  </View>
                ) : null}
                {tab.name === 'experiences' && unreadBids > 0 ? (
                  <View style={{
                    position: 'absolute', top: -4, right: -8,
                    minWidth: 16, height: 16, borderRadius: 8,
                    backgroundColor: Palette.brand, paddingHorizontal: 3,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5, borderColor: Palette.surface,
                  }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 9.5, color: '#fff', lineHeight: 13 }}>
                      {unreadBids > 9 ? '9+' : unreadBids}
                    </Text>
                  </View>
                ) : null}
                {tab.name === 'profile' && profileBadge > 0 ? (
                  <View style={{
                    position: 'absolute', top: -4, right: -8,
                    minWidth: 16, height: 16, borderRadius: 8,
                    backgroundColor: Palette.danger, paddingHorizontal: 3,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5, borderColor: Palette.surface,
                  }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 9.5, color: '#fff', lineHeight: 13 }}>
                      {profileBadge > 9 ? '9+' : profileBadge}
                    </Text>
                  </View>
                ) : null}
              </View>

              <TabBarLabel label={tab.label} focused={focused} compact={compact} />
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <PreppaTabBar {...(props as unknown as TabBarProps)} />}
      backBehavior="history"
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="feeds" />
      <Tabs.Screen name="experiences" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
