import { Tabs, usePathname, useRouter } from 'expo-router';
import { ChefHat, CircleUser, House, Inbox, MessageSquare, Rss, ShoppingBag } from 'lucide-react-native';
import { MotiView } from 'moti';
import type React from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrepperWelcomeOverlay } from '@/components/prepper-welcome-overlay';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { BP } from '@/lib/layout';
import { useConversations, useConversationsRealtime } from '@/lib/queries/messages';
import { usePrepperOrders, useOrdersRealtime } from '@/lib/queries/orders';
import { useNotifications, useNotificationsRealtime } from '@/lib/queries/notifications';
import { useWorkspace } from '@/lib/workspace';
import { useAuth } from '@/providers/auth-provider';

type TabDef = {
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  routeName?: string;    // tab screen name — navigate() when provided
  pushPath?: string;     // standalone path — router.push() when provided
  focusMatch?: string;   // pathname prefix for active detection on pushed routes
};

const CUSTOMER_TABS: TabDef[] = [
  { label: 'Home',    Icon: House,         routeName: 'index' },
  { label: 'Feed',    Icon: Rss,           routeName: 'feed' },
  { label: 'Orders',  Icon: ShoppingBag,   routeName: 'orders' },
  { label: 'Profile', Icon: CircleUser,    routeName: 'profile' },
];

const KITCHEN_TABS: TabDef[] = [
  { label: 'Kitchen',  Icon: ChefHat,        routeName: 'kitchen' },
  { label: 'Orders',   Icon: ShoppingBag,    pushPath: '/prepper-orders',  focusMatch: '/prepper-orders' },
  { label: 'Gigs',     Icon: Inbox,          pushPath: '/opportunities',   focusMatch: '/opportunities' },
  { label: 'Messages', Icon: MessageSquare,  pushPath: '/messages',        focusMatch: '/messages' },
  { label: 'Profile',  Icon: CircleUser,     routeName: 'profile' },
];

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
      }}>
      {label}
    </Text>
  );
}

type TabBarProps = {
  state: { index: number; routes: { name: string; key: string }[] };
  navigation: { navigate: (name: string) => void };
};

function PreppaTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { workspace, prepperId } = useWorkspace();

  useNotificationsRealtime(user?.id);
  useConversationsRealtime(user?.id);
  useOrdersRealtime('customer_id', user?.id);

  const { data: notifications } = useNotifications(user?.id);
  const { data: conversations } = useConversations(user?.id);
  const { data: pendingOrders } = usePrepperOrders(
    workspace === 'kitchen' ? (prepperId ?? undefined) : undefined,
    'pending',
  );

  const unreadNotifs = (notifications ?? []).filter((n) => !n.read).length;
  const unreadMessages = (conversations ?? []).filter((c) => c.unread).length;
  const profileBadge = unreadNotifs + unreadMessages;
  const kitchenBadge = pendingOrders?.length ?? 0;

  if (width >= BP.tablet) return null;

  const compact = width < 360;
  const tabs = workspace === 'kitchen' ? KITCHEN_TABS : CUSTOMER_TABS;

  function isFocused(tab: TabDef): boolean {
    if (tab.focusMatch) {
      return pathname.startsWith(tab.focusMatch);
    }
    if (tab.routeName) {
      const routeIdx = state.routes.findIndex((r) => r.name === tab.routeName);
      return routeIdx >= 0 && state.index === routeIdx;
    }
    return false;
  }

  function handlePress(tab: TabDef) {
    feedback.tap();
    if (tab.pushPath) {
      router.push(tab.pushPath as never);
    } else if (tab.routeName) {
      navigation.navigate(tab.routeName);
    }
  }

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
        const focused = isFocused(tab);
        const badge =
          tab.label === 'Profile' ? profileBadge :
          tab.label === 'Kitchen' ? kitchenBadge :
          tab.label === 'Messages' ? unreadMessages :
          0;

        return (
          <View key={tab.label} style={{ flex: 1, minWidth: 0 }}>
            <PressableScale
              onPress={() => handlePress(tab)}
              accessibilityRole="tab"
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
                {badge > 0 ? (
                  <View style={{
                    position: 'absolute', top: -4, right: -8,
                    minWidth: 16, height: 16, borderRadius: 8,
                    backgroundColor: tab.label === 'Profile' ? Palette.danger : Palette.brand,
                    paddingHorizontal: 3,
                    alignItems: 'center', justifyContent: 'center',
                    borderWidth: 1.5, borderColor: Palette.surface,
                  }}>
                    <Text style={{ fontFamily: Font.semibold, fontSize: 9.5, color: '#fff', lineHeight: 13 }}>
                      {badge > 9 ? '9+' : badge}
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
  const { user } = useAuth();
  return (
    <>
      <Tabs
        tabBar={(props) => <PreppaTabBar {...(props as unknown as TabBarProps)} />}
        backBehavior="history"
        screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="explore" options={{ href: null }} />
        <Tabs.Screen name="feed" />
        <Tabs.Screen name="orders" />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="kitchen" />
      </Tabs>
      <PrepperWelcomeOverlay userId={user?.id} />
    </>
  );
}
