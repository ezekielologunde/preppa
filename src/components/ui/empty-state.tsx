import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Font } from '@/constants/fonts';
import { Palette, Radius, Space, Type } from '@/constants/theme';

type Props = {
  icon?: React.ReactNode;
  title: string;
  sub?: string;
  action?: { label: string; onPress: () => void };
};

export function EmptyState({ icon, title, sub, action }: Props) {
  return (
    <View style={styles.root}>
      {icon}
      <Text style={styles.title}>{title}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      {action ? (
        <TouchableOpacity
          onPress={action.onPress}
          style={styles.btn}
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <Text style={styles.btnText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  title: { fontFamily: Font.display, fontSize: Type.title, color: Palette.ink, letterSpacing: -0.3 },
  sub: { fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary, textAlign: 'center' },
  btn: { marginTop: 4, backgroundColor: Palette.brand, borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { fontFamily: Font.display, fontSize: Type.label, color: Palette.surface },
});
