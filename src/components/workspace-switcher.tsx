import { useRouter } from 'expo-router';
import { ChefHat, CircleUser } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { type Workspace, useWorkspace } from '@/lib/workspace';

export function WorkspaceSwitcher() {
  const router = useRouter();
  const { workspace, switchWorkspace, canUseKitchen } = useWorkspace();

  if (!canUseKitchen) return null;

  function press(w: Workspace) {
    feedback.tap();
    switchWorkspace(w);
    if (w === 'kitchen') router.push('/dashboard' as never);
  }

  return (
    <View style={{
      flexDirection: 'row',
      alignSelf: 'center',
      backgroundColor: Palette.border,
      borderRadius: Radius.pill,
      padding: 3,
      gap: 2,
    }}>
      <Option
        label="Customer"
        Icon={CircleUser}
        active={workspace === 'customer'}
        onPress={() => press('customer')}
      />
      <Option
        label="My Kitchen"
        Icon={ChefHat}
        active={workspace === 'kitchen'}
        onPress={() => press('kitchen')}
      />
    </View>
  );
}

function Option({
  label, Icon, active, onPress,
}: {
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${label}`}
      accessibilityState={{ selected: active }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 13,
        paddingVertical: 7,
        borderRadius: Radius.pill,
        backgroundColor: active ? Palette.surface : 'transparent',
        shadowColor: active ? Palette.ink : 'transparent',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: active ? 0.07 : 0,
        shadowRadius: 3,
        elevation: active ? 2 : 0,
      }}>
      <Icon
        size={13}
        color={active ? Palette.brand : Palette.textSecondary}
        strokeWidth={active ? 2.2 : 1.8}
      />
      <Text style={{
        fontFamily: active ? Font.semibold : Font.medium,
        fontSize: 12.5,
        color: active ? Palette.ink : Palette.textSecondary,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}
