import { StyleSheet, View, ViewProps } from 'react-native';
import { Palette, Radius, Shadow } from '@/constants/theme';

export function Card({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Palette.surface, borderRadius: Radius.card, ...Shadow.card },
});
