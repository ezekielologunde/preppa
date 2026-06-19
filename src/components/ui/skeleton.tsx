import { MotiView } from 'moti';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { Palette, Radius } from '@/constants/theme';

/** Shimmer placeholder — Moti-based opacity loop (unified animation system). */
export function Skeleton({
  width,
  height,
  radius = 8,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <MotiView
      from={{ opacity: 0.4 }}
      animate={{ opacity: 0.85 }}
      transition={{ loop: true, type: 'timing', duration: 700, repeatReverse: true }}
      style={[{ width, height, borderRadius: radius, backgroundColor: Palette.chip }, style]}
    />
  );
}

/** MealCard-dimension placeholder — matches the normal (non-big) MealCard exactly. */
export function MealCardSkeleton({ width = 200 }: { width?: number }) {
  return (
    <View style={{ width, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Palette.surface }}>
      {/* Image area — same height as MealCard normal imgHeight */}
      <Skeleton width={width} height={180} radius={0} />
      <View style={{ padding: 12, gap: 0 }}>
        {/* Title line */}
        <Skeleton width="70%" height={14} radius={7} />
        {/* Price line */}
        <View style={{ marginTop: 6 }}>
          <Skeleton width="40%" height={12} radius={6} />
        </View>
        {/* Chef line */}
        <View style={{ marginTop: 4 }}>
          <Skeleton width="55%" height={10} radius={5} />
        </View>
      </View>
    </View>
  );
}

/** Meal/prepper card placeholder used while carousels load. */
export function CardSkeleton({ width = 200 }: { width?: number }) {
  return (
    <View style={{ width, borderRadius: 12, overflow: 'hidden', backgroundColor: Palette.surface, padding: 0 }}>
      <Skeleton width={width} height={130} radius={0} />
      <View style={{ padding: 12, gap: 8 }}>
        <Skeleton width="80%" height={14} radius={6} />
        <Skeleton width="50%" height={12} radius={6} />
        <Skeleton width="40%" height={12} radius={6} />
      </View>
    </View>
  );
}

/** A horizontal row of MealCard skeletons (matches carousel cards). */
export function CardRowSkeleton({ count = 3, width = 200 }: { count?: number; width?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 20 }}>
      {Array.from({ length: count }).map((_, i) => (
        <MealCardSkeleton key={i} width={width} />
      ))}
    </View>
  );
}

/** Stacked full-width row placeholders for list screens (cart, orders, inbox). */
export function ListSkeleton({ count = 3, rowHeight = 96 }: { count?: number; rowHeight?: number }) {
  return (
    <View style={{ gap: 12, paddingHorizontal: 20, paddingTop: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ backgroundColor: Palette.surface, borderRadius: 12, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
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
