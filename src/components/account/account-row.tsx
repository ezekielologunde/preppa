import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';

export function SectionLabel({ label }: { label: string }) {
  return (
    <Text
      style={{
        fontFamily: Font.semibold,
        fontSize: 11,
        color: Palette.textSecondary,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 8,
        marginLeft: 4,
      }}>
      {label}
    </Text>
  );
}

export function Divider() {
  return (
    <View
      style={{ height: 1, backgroundColor: Palette.border, marginLeft: 56 }}
    />
  );
}

export function StatusBadge({
  label,
  type,
}: {
  label: string;
  type: 'green' | 'orange' | 'gray';
}) {
  const colors = {
    green: { bg: Palette.success + '1A', fg: Palette.success },
    orange: { bg: Palette.brandTint, fg: Palette.brandPressed },
    gray: { bg: Palette.chip, fg: Palette.textSecondary },
  };
  const c = colors[type];
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: Radius.pill,
        backgroundColor: c.bg,
      }}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: c.fg }}>
        {label}
      </Text>
    </View>
  );
}

export function Row({
  icon,
  label,
  right,
  onPress,
  accessLabel,
}: {
  icon: React.ReactNode;
  label: string;
  right: React.ReactNode;
  onPress?: () => void;
  accessLabel: string;
}) {
  const inner = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        minHeight: 52,
      }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          backgroundColor: Palette.chip,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {icon}
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: Font.medium,
          fontSize: 15,
          color: Palette.ink,
        }}>
        {label}
      </Text>
      {right}
    </View>
  );

  if (!onPress) return inner;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessLabel}>
      {inner}
    </PressableScale>
  );
}
