import { StyleSheet, View, ViewProps } from 'react-native';
import { Divider as DividerToken } from '@/constants/theme';

export function Divider({ style, ...rest }: ViewProps) {
  return <View style={[styles.divider, style]} {...rest} />;
}

const styles = StyleSheet.create({
  divider: DividerToken.standard,
});
