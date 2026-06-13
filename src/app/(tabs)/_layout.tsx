import { Tabs } from 'expo-router';
import { CircleUser, Compass, House, MonitorPlay, Ticket } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Platform, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { feedback } from '@/lib/feedback';
import { Palette } from '@/constants/theme';

const TABS = [
  { name: 'index',       label: 'home',        Icon: House },
  { name: 'explore',     label: 'explore',     Icon: Compass },
  { name: 'feeds',       label: 'feeds',       Icon: MonitorPlay },
  { name: 'experiences', label: 'experiences', Icon: Ticket },
  { name: 'profile',     label: 'profile',     Icon: CircleUser },
] as const;

type TabBarProps = {
  state: { index: number; routes: { name: string; key: string }[] };
  navigation: { navigate: (name: string) => void };
};

function PreppaTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  if (Platform.OS === 'web' && width >= 768) return null;

  return (
    <View style={{
      backgroundColor: Palette.surface,
      borderTopWidth: 1,
      borderTopColor: Palette.border,
      paddingBottom: Math.max(insets.bottom + 4, 16),
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
              style={{ flex: 1, alignItems: 'center', paddingTop: 12, gap: 5 }}>

              {/* Top pill indicator — flush with the tab bar's border */}
              <MotiView
                animate={{ width: focused ? 28 : 0, opacity: focused ? 1 : 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                style={{ position: 'absolute', top: 0, height: 3, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: Palette.brand }}
              />

              <MotiView
                animate={{ scale: focused ? 1.08 : 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                <tab.Icon
                  size={24}
                  color={color}
                  strokeWidth={focused ? 2.2 : 1.6}
                />
              </MotiView>

              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={{
                  fontFamily: focused ? Font.semibold : Font.medium,
                  fontSize: 10.5,
                  color,
                  letterSpacing: 0.2,
                }}>
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
