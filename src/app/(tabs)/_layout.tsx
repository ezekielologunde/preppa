import { Tabs } from 'expo-router';
import { House, CircleUser } from 'lucide-react-native';

import { Palette } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Palette.brand,
        tabBarInactiveTintColor: Palette.textSecondary,
        tabBarStyle: { borderTopColor: Palette.border },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <House size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <CircleUser size={22} color={color} /> }}
      />
    </Tabs>
  );
}
