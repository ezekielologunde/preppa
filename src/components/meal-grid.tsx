import { Image } from 'expo-image';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Font } from '@/constants/fonts';
import { Gradients, Palette, Radius, Shadow, Space, Type } from '@/constants/theme';
import { formatMoney } from '@/lib/currency';
import { useResponsive } from '@/hooks/use-responsive';
import type { ListingWithCover } from '@/lib/search-service';

// Deterministic gradient per listing so cards without a photo aren't identical.
const GRADIENTS = [
  Gradients.brand,
  Gradients.mealWarm,
  Gradients.mealGold,
  Gradients.mealGreen,
  Gradients.mealBlue,
] as const;

function pickGradient(id: string): readonly [string, string] {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return GRADIENTS[hash % GRADIENTS.length];
}

// ── Card ───────────────────────────────────────────────────────────────────

export function MealCard({
  listing,
  onPress,
  width,
}: {
  listing: ListingWithCover;
  onPress: () => void;
  width?: number | `${number}%`;
}) {
  const price = formatMoney(listing.price_pence);
  const tag = listing.dietary_tags?.[0];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={[styles.card, width !== undefined && { width }]}
      accessibilityRole="button"
      accessibilityLabel={`${listing.name}${listing.kitchen_name ? `, by ${listing.kitchen_name}` : ''}, ${price}`}
    >
      <View style={styles.photo}>
        {listing.cover_url ? (
          <Image source={listing.cover_url} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} />
        ) : (
          <LinearGradient
            colors={pickGradient(listing.id)}
            start={{ x: 0.3, y: 0.2 }}
            end={{ x: 0.8, y: 0.8 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {tag ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{listing.name}</Text>
        {listing.kitchen_name ? (
          <Text style={styles.kitchen} numberOfLines={1}>by {listing.kitchen_name}</Text>
        ) : null}
        <View style={styles.meta}>
          <Text style={styles.servings}>{listing.servings} serving{listing.servings === 1 ? '' : 's'}</Text>
          <Text style={styles.price}>{price}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Grid ───────────────────────────────────────────────────────────────────
// Phone: horizontal carousel (fixed-width cards).
// Tablet/desktop: wrapped multi-column grid that fills the available width.

export function MealGrid({
  listings,
  onPressItem,
}: {
  listings: ListingWithCover[];
  onPressItem: (listing: ListingWithCover) => void;
}) {
  const { isPhone, gridColumns } = useResponsive();

  if (isPhone) {
    return (
      <FlatList
        data={listings}
        keyExtractor={(l) => l.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
        renderItem={({ item }) => (
          <MealCard listing={item} onPress={() => onPressItem(item)} width={176} />
        )}
      />
    );
  }

  // Percentage width keeps the grid fluid; the gap is handled by row/card margin.
  const colPercent = `${100 / gridColumns - 2}%` as const;

  return (
    <View style={styles.grid}>
      {listings.map((item) => (
        <MealCard
          key={item.id}
          listing={item}
          onPress={() => onPressItem(item)}
          width={colPercent}
        />
      ))}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  carousel: { paddingLeft: Space.xl, paddingRight: Space.xl, gap: 12 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.lg,
    paddingHorizontal: Space.xl,
  },

  card: {
    borderRadius: Radius.card,
    backgroundColor: Palette.surface,
    overflow: 'hidden',
    ...Shadow.card,
  },
  photo: { height: 130, overflow: 'hidden', position: 'relative' },
  tag: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(0,0,0,0.48)', borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  tagText: { fontFamily: Font.display, fontSize: 11, color: Palette.surface },
  info: { padding: 12, gap: 3 },
  name: { fontFamily: Font.display, fontSize: 14, color: Palette.ink, lineHeight: 18 },
  kitchen: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary },
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  servings: { fontFamily: Font.body, fontSize: Type.micro, color: Palette.textSecondary },
  price: { fontFamily: Font.display, fontSize: Type.label, color: Palette.brand },
});
