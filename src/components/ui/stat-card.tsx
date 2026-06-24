import { StyleSheet, Text, View } from 'react-native';
import { Font } from '@/constants/fonts';
import { Palette, Shadow, Type } from '@/constants/theme';

type Props = {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
};

export function StatCard({ label, value, sub, accent }: Props) {
  return (
    <View
      style={[styles.card, accent && styles.cardAccent]}
      accessibilityLabel={`${label}: ${value}${sub ? `, ${sub}` : ''}`}
    >
      <Text style={[styles.value, accent && styles.valueAccent]}>{value}</Text>
      <Text style={[styles.label, accent && styles.labelAccent]}>{label}</Text>
      {sub ? <Text style={[styles.sub, accent && styles.labelAccent]}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: Palette.surface, borderRadius: 16, padding: 14, alignItems: 'center', ...Shadow.card },
  cardAccent: { backgroundColor: Palette.brand },
  value: { fontFamily: Font.display, fontSize: Type.title, color: Palette.ink },
  valueAccent: { color: Palette.surface },
  label: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary, marginTop: 2 },
  labelAccent: { color: Palette.brandTint },
  sub: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textMuted, marginTop: 1 },
});
