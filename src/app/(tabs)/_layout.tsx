import { Tabs } from 'expo-router';
import { CircleUser, Compass, House, Play, Ticket } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Platform, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette, Shadow, TouchTarget } from '@/constants/theme';

const TABS = [
  { name: 'index',       label: 'home',    Icon: House },
  { name: 'explore',     label: 'explore', Icon: Compass },
  { name: 'feeds',       label: 'feed',    Icon: Play },
  { name: 'experiences', label: 'events',  Icon: Ticket },
  { name: 'profile',     label: 'profile', Icon: CircleUser },
] as const;

type TabBarProps = {
  state: { index: number; routes: { name: string; key: string }[] };
  navigation: { navigate: (name: string) => void };
};

function PreppaTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Only hide on web ≥768px, where the WebSidebar renders inside ResponsiveFrame.
  // Native tablet (iPad) still uses the bottom tab bar — no sidebar exists there.
  const hiddenForWebSidebar = Platform.OS === 'web' && width >= 768;
  if (hiddenForWebSidebar) return null;

  const iconSize = width >= 480 ? 21 : 20;
  const labelSize = width >= 480 ? 11 : 10.5;
  const pillW = 46;
  const pillH = 30;
  const tabPadV = 8;

  return (
    <View
      style={{
        backgroundColor: Palette.surface,
        paddingTop: tabPadV,
        paddingBottom: Math.max(insets.bottom, tabPadV),
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderTopWidth: 1,
        borderTopColor: Palette.border,
        ...Shadow.navBar,
      }}>
      <View style={{ flexDirection: 'row' }}>
        {TABS.map((tab) => {
          const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
          const focused = routeIndex >= 0 && state.index === routeIndex;
          const color = focused ? Palette.brand : Palette.textSecondary;

          return (
            <PressableScale
              key={tab.name}
              onPress={() => { feedback.tap(); navigation.navigate(tab.name); }}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: TouchTarget, gap: 3, paddingTop: 2 }}>

              <View style={{ alignItems: 'center', justifyContent: 'center', width: pillW, height: pillH }}>
                <MotiView
                  animate={{ opacity: focused ? 1 : 0, scale: focused ? 1 : 0.4 }}
                  transition={{ type: 'spring', damping: 18, stiffness: 320 }}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: pillH / 2,
                    backgroundColor: Palette.brandTint,
                  }}
                />
                <tab.Icon size={iconSize} color={color} strokeWidth={focused ? 2.4 : 1.8} />
              </View>

              <Text numberOfLines={1} style={{ fontFamily: focused ? Font.semibold : Font.medium, fontSize: labelSize, color, letterSpacing: 0.1 }}>
                {tab.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
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
