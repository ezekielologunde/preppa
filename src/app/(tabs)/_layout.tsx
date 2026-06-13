import { Tabs } from 'expo-router';
import { CircleUser, Compass, House, MonitorPlay, Ticket } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { BP } from '@/lib/layout';
import { Palette } from '@/constants/theme';

const TABS = [
  { name: 'index',       label: 'Home',        Icon: House },
  { name: 'explore',     label: 'Explore',     Icon: Compass },
  { name: 'feeds',       label: 'Feeds',       Icon: MonitorPlay },
  { name: 'experiences', label: 'Experiences', Icon: Ticket },
  { name: 'profile',     label: 'Profile',     Icon: CircleUser },
] as const;

type TabBarProps = {
  state: { index: number; routes: { name: string; key: string }[] };
  navigation: { navigate: (name: string) => void };
};

function TabBarIcon({ tab, focused }: { tab: (typeof TABS)[number]; focused: boolean }) {
  const color = focused ? Palette.brand : Palette.textSecondary;

  return (
    <MotiView
      animate={{ scale: focused ? 1.08 : 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
      <tab.Icon
        size={24}
        color={color}
        strokeWidth={focused ? 2.2 : 1.6}
      />
    </MotiView>
  );
}

function TabBarLabel({ label, focused, compact }: { label: string; focused: boolean; compact?: boolean }) {
  const color = focused ? Palette.brand : Palette.textSecondary;

  return (
    <Text
      numberOfLines={1}
      style={{
        fontFamily: focused ? Font.semibold : Font.medium,
        fontSize: compact ? 10.5 : 11.5,
        color,
        letterSpacing: 0,
      }}>
      {label}
    </Text>
  );
}

function PreppaTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Tablet+ (any platform) uses the AppSidebar rail; hide the bottom bar there.
  if (width >= BP.tablet) return null;

  // One clean bar: 5 equal-width tabs that fit any phone from 320px up.
  // (No hamburger / horizontal-scroll — those pushed tabs off-screen.)
  const compact = width < 360; // tighten spacing on the smallest phones

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
      {TABS.map((tab) => {
        const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
        const focused = routeIndex >= 0 && state.index === routeIndex;

        // The flex item is THIS wrapper View — each tab gets an equal 1/5 of the
        // bar. (PressableScale applies its style to an inner MotiView, so putting
        // `flex:1` on it does nothing; the flex must live on a real flex child.)
        return (
          <View key={tab.name} style={{ flex: 1, minWidth: 0 }}>
            <PressableScale
              onPress={() => { feedback.tap(); navigation.navigate(tab.name); }}
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

              <TabBarIcon tab={tab} focused={focused} />
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
