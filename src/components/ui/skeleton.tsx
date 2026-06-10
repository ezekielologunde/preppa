import { MotiView } from 'moti';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

/** Pulsing placeholder — opacity-only so it stays at 60fps. */
export function Skeleton({
  width,
  height,
  radius = 12,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <MotiView
      from={{ opacity: 0.45 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 850, loop: true, repeatReverse: true }}
      style={[{ width, height, borderRadius: radius, backgroundColor: '#E7E7EA' }, style]}
    />
  );
}

/** Meal/prepper card placeholder used while carousels load. */
export function CardSkeleton({ width = 200 }: { width?: number }) {
  return (
    <View style={{ width, borderRadius: 20, overflow: 'hidden', backgroundColor: '#fff', padding: 0 }}>
      <Skeleton width={width} height={130} radius={0} />
      <View style={{ padding: 12, gap: 8 }}>
        <Skeleton width="80%" height={14} radius={6} />
        <Skeleton width="50%" height={12} radius={6} />
        <Skeleton width="40%" height={12} radius={6} />
      </View>
    </View>
  );
}

/** A horizontal row of card skeletons. */
export function CardRowSkeleton({ count = 3, width = 200 }: { count?: number; width?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 20 }}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} width={width} />
      ))}
    </View>
  );
}

/** Stacked full-width row placeholders for list screens (cart, orders, inbox). */
export function ListSkeleton({ count = 3, rowHeight = 96 }: { count?: number; rowHeight?: number }) {
  return (
    <View style={{ gap: 12, paddingHorizontal: 20, paddingTop: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ backgroundColor: '#fff', borderRadius: 20, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Skeleton width={60} height={60} radius={14} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="65%" height={14} radius={6} />
            <Skeleton width="40%" height={12} radius={6} />
            <Skeleton width="30%" height={Math.max(rowHeight - 84, 10)} radius={6} />
          </View>
        </View>
      ))}
    </View>
  );
}
