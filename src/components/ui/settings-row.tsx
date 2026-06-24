import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import { Font } from '@/constants/fonts';
import { Palette, Space, Type } from '@/constants/theme';

type Props = {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  value?: string;
  danger?: boolean;
  isSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (v: boolean) => void;
};

export function SettingsRow({
  icon, label, onPress, value, danger, isSwitch, switchValue, onSwitchChange,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={isSwitch ? 1 : 0.75}
      style={styles.row}
      disabled={isSwitch}
      accessibilityRole={isSwitch ? 'switch' : 'button'}
      accessibilityLabel={label}
      accessibilityState={isSwitch ? { checked: switchValue } : undefined}
    >
      <View style={[styles.icon, danger && styles.iconDanger]}>{icon}</View>
      <Text style={[styles.label, danger && styles.labelDanger]} numberOfLines={1}>{label}</Text>
      {isSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ true: Palette.brand, false: Palette.border }}
          thumbColor={Palette.surface}
          accessibilityLabel={label}
        />
      ) : (
        <View style={styles.right}>
          {value ? <Text style={styles.value} numberOfLines={1}>{value}</Text> : null}
          {!danger && <ChevronRight size={15} color={Palette.textMuted} strokeWidth={2} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: Space.lg, paddingVertical: 14, minHeight: 56,
  },
  icon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: Palette.brandTint,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconDanger: { backgroundColor: Palette.dangerTint },
  label: { flex: 1, fontFamily: Font.semibold, fontSize: Type.body, color: Palette.ink },
  labelDanger: { color: Palette.danger },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary, maxWidth: 140 },
});
