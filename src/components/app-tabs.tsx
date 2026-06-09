import { Tabs } from 'expo-router';
import { Clapperboard, Compass, House, Ticket, User } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Font } from '@/constants/fonts';
import { useFeatureFlags } from '@/lib/queries/feature-flags';
import { Palette, Shadow, TouchTarget } from '@/constants/theme';

const TABS = [
  { name: 'index', label: 'home', Icon: House },
  { name: 'explore', label: 'explore', Icon: Compass },
  { name: 'feeds', label: 'feeds', Icon: Clapperboard, flag: 'live_feeds' },
  { name: 'experiences', label: 'experiences', Icon: Ticket, flag: 'experiences' },
  { name: 'profile', label: 'profile', Icon: User },
] as const;

type TabBarProps = {
  state: { index: number; routes: { name: string; key: string }[] };
  navigation: { navigate: (name: string) => void };
};

function PreppaTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { data: flags } = useFeatureFlags();
  // Full-screen modes (prepper dashboard, auth) hide the customer tab bar.
  const active = state.routes[state.index]?.name;
  if (active === 'dashboard' || active === 'auth' || active === 'meal' || active === 'search' || active === 'category' || active === 'admin' || active === 'become-prepper' || active === 'experience-request' || active === 'meal-plans' || active === 'messages' || active === 'chat') return null;
  // Admin-toggleable tabs disappear when their flag is explicitly off.
  const visibleTabs = TABS.filter((t) => !('flag' in t) || flags?.[t.flag] !== false);
  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        backgroundColor: Palette.surface,
        paddingTop: 10,
        paddingBottom: Math.max(insets.bottom, 12),
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        ...Shadow.navBar,
      }}>
      {visibleTabs.map((tab) => {
        const index = state.routes.findIndex((r) => r.name === tab.name);
        const focused = index >= 0 && state.index === index;
        // Inactive uses textSecondary (AA), not the decorative muted grey.
        const color = focused ? Palette.brand : Palette.textSecondary;
        return (
          <Pressable
            key={tab.name}
            onPress={() => navigation.navigate(tab.name)}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: TouchTarget }}>
            <tab.Icon size={23} color={color} strokeWidth={focused ? 2.4 : 2} />
            <Text style={{ fontFamily: Font.medium, fontSize: 11, color }}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tabs
      tabBar={(props) => <PreppaTabBar {...(props as unknown as TabBarProps)} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="feeds" />
      <Tabs.Screen name="experiences" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="dashboard" options={{ href: null }} />
      <Tabs.Screen name="auth" options={{ href: null }} />
      <Tabs.Screen name="meal" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="category" options={{ href: null }} />
      <Tabs.Screen name="admin" options={{ href: null }} />
      <Tabs.Screen name="become-prepper" options={{ href: null }} />
      <Tabs.Screen name="experience-request" options={{ href: null }} />
      <Tabs.Screen name="meal-plans" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
    </Tabs>
  );
}
