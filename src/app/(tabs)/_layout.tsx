import { Tabs } from 'expo-router';
import { Compass, House, Ticket, User, Video } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette, Shadow, TouchTarget } from '@/constants/theme';

const TABS = [
  { name: 'index',       label: 'home',        Icon: House },
  { name: 'explore',     label: 'explore',     Icon: Compass },
  { name: 'feeds',       label: 'live',        Icon: Video, flag: 'live_feeds' },
  { name: 'experiences', label: 'events',  Icon: Ticket, flag: 'experiences' },
  { name: 'profile',     label: 'me',      Icon: User },
] as const;

type TabBarProps = {
  state: { index: number; routes: { name: string; key: string }[] };
  navigation: { navigate: (name: string) => void };
};

function PreppaTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  // Tab sizing scales with screen width — larger targets on wider devices.
  const iconSize = width >= 768 ? 22 : width >= 480 ? 21 : 20;
  const labelSize = width >= 768 ? 12 : width >= 480 ? 11 : 10.5;
  const pillW = width >= 768 ? 60 : 46;
  const pillH = width >= 768 ? 36 : 30;
  const tabPadV = width >= 768 ? 10 : 8;

  return (
    <View
      style={{
        backgroundColor: Palette.surface,
        paddingTop: tabPadV,
        paddingBottom: Math.max(insets.bottom, tabPadV),
        borderTopLeftRadius: isTablet ? 0 : 20,
        borderTopRightRadius: isTablet ? 0 : 20,
        borderTopWidth: 1,
        borderTopColor: Palette.border,
        ...Shadow.navBar,
      }}>
      <View style={{ flexDirection: 'row', maxWidth: isTablet ? 600 : undefined, alignSelf: isTablet ? 'center' : undefined, width: isTablet ? '100%' : undefined }}>
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

              <Text style={{ fontFamily: focused ? Font.semibold : Font.medium, fontSize: labelSize, color, letterSpacing: 0.1 }}>
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
