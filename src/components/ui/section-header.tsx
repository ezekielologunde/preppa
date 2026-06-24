import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Font } from '@/constants/fonts';
import { Palette, Type } from '@/constants/theme';

type Props = {
  label: string;
  onSeeAll?: () => void;
};

export function SectionHeader({ label, onSeeAll }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {onSeeAll ? (
        <TouchableOpacity onPress={onSeeAll} accessibilityRole="button" accessibilityLabel={`See all ${label}`}>
          <Text style={styles.seeAll}>see all</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  label: { fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  seeAll: { fontFamily: Font.semibold, fontSize: Type.micro, color: Palette.brand },
});
