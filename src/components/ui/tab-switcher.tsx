import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Shadow } from '@/constants/theme';

type Tab = { key: string; label: string };

type Props = {
  tabs: readonly Tab[];
  selected: string;
  onSelect: (key: string) => void;
};

export function TabSwitcher({ tabs, selected, onSelect }: Props) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {tabs.map((t) => (
        <TouchableOpacity
          key={t.key}
          onPress={() => onSelect(t.key)}
          activeOpacity={0.7}
          style={[styles.btn, selected === t.key && styles.btnActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: selected === t.key }}
          accessibilityLabel={t.label}
        >
          <Text style={[styles.label, selected === t.key && styles.labelActive]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', backgroundColor: Palette.chip, borderRadius: Radius.md, padding: 3 },
  btn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  btnActive: { backgroundColor: Palette.surface, ...Shadow.card },
  label: { fontFamily: Font.semibold, fontSize: 10, color: Palette.textSecondary },
  labelActive: { color: Palette.ink },
});
