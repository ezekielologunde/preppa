/**
 * KitchenStatChips — 3-chip stat row: followers, meals, rating.
 * Spring stagger entrance. Extracted to keep prepper.tsx under 500 lines.
 */
import { Star, Users, UtensilsCrossed } from 'lucide-react-native';
import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';

interface Chip {
  icon: React.ReactNode;
  value: string;
  label: string;
}

function StatChip({ icon, value, label, delay }: Chip & { delay: number }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 8, scale: 0.94 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: 'spring', damping: 16, stiffness: 200, delay }}
      style={{
        flex: 1,
        backgroundColor: Palette.surface,
        borderRadius: Radius.md,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        gap: 4,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      }}>
      {icon}
      <Text style={{
        fontFamily: Font.display, fontSize: 18, color: Palette.ink,
        fontVariant: ['tabular-nums'],
      }}>
        {value}
      </Text>
      <Text style={{
        fontFamily: Font.medium, fontSize: 10.5, color: Palette.textSecondary, textAlign: 'center',
      }}>
        {label}
      </Text>
    </MotiView>
  );
}

interface KitchenStatChipsProps {
  followers: number;
  mealCount: number;
  rating: number;
  reviews: number;
  isLoading: boolean;
}

export function KitchenStatChips({
  followers,
  mealCount,
  rating,
  reviews,
  isLoading,
}: KitchenStatChipsProps) {
  if (isLoading) {
    return (
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16 }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={undefined} height={84} radius={20} style={{ flex: 1 }} />
        ))}
      </View>
    );
  }

  function compact(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}k`;
    return String(n);
  }

  const chips: (Chip & { delay: number })[] = [
    {
      icon: <Users size={18} color={Palette.brand} />,
      value: compact(followers),
      label: 'followers',
      delay: 60,
    },
    {
      icon: <UtensilsCrossed size={18} color={Palette.success} />,
      value: String(mealCount),
      label: 'meals',
      delay: 120,
    },
    {
      icon: <Star size={18} color={Palette.amber} fill={Palette.amber} />,
      value: reviews > 0 ? rating.toFixed(1) : '—',
      label: reviews > 0 ? `${reviews} reviews` : 'no reviews yet',
      delay: 180,
    },
  ];

  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16 }}>
      {chips.map((chip) => (
        <StatChip key={chip.label} {...chip} />
      ))}
    </View>
  );
}
