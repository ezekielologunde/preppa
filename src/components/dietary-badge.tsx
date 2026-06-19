import { Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import { DIETARY_TAGS, dietaryTagColor } from '@/constants/dietary';

/** Small colored chip: "Halal", "Vegan", etc.
 *  Looks up the tag in DIETARY_TAGS by key; falls back to a neutral chip for unknown keys. */
export function DietaryBadge({ tag }: { tag: string }) {
  const meta = DIETARY_TAGS.find((t) => t.key === tag);
  const label = meta ? `${meta.emoji} ${meta.label}` : tag;
  const color = dietaryTagColor(tag);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: color + '1A', // 10% opacity
        borderRadius: 8,
        paddingHorizontal: 7,
        paddingVertical: 3,
      }}
      accessibilityLabel={meta?.label ?? tag}>
      <Text style={{ fontFamily: Font.semibold, fontSize: 11, color }}>{label}</Text>
    </View>
  );
}
