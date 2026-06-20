import { useRouter } from 'expo-router';
import {
  Boxes,
  ShoppingBag,
  Star,
  Users,
} from 'lucide-react-native';
import { View, Text } from 'react-native';

import { StatCard } from '@/components/dashboard-widgets';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';

const ORANGE = Palette.brand;
const GREEN = Palette.success;
const PURPLE = Palette.violet;
const YELLOW = Palette.amber;
const INK = Palette.ink;

const money = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);

export interface PrepperStatCardsProps {
  statsLoading: boolean;
  isDesktop: boolean;
  revenue: number;
  orderCount: number;
  newCount: number;
  subscribers: number;
  avgRating: number;
  reviewCount: number;
  revenueSpark: number[];
  ordersSpark: number[];
  customersSpark: number[];
  ratingSpark: number[];
  router: ReturnType<typeof useRouter>;
}

export function PrepperStatCards({
  statsLoading,
  isDesktop,
  revenue,
  orderCount,
  newCount,
  subscribers,
  avgRating,
  reviewCount,
  revenueSpark,
  ordersSpark,
  customersSpark,
  ratingSpark,
  router,
}: PrepperStatCardsProps) {
  return (
    <>
      <Text
        style={{
          fontFamily: Font.display,
          fontSize: 15,
          color: INK,
          paddingHorizontal: 20,
          marginTop: 16,
          marginBottom: 8,
          letterSpacing: -0.3,
        }}
      >
        your stats
      </Text>

      {statsLoading ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: 20,
            gap: 10,
            paddingTop: 8,
            paddingBottom: 6,
          }}
        >
          <Skeleton height={88} radius={16} style={{ flex: 1, minWidth: '40%' }} />
          <Skeleton height={88} radius={16} style={{ flex: 1, minWidth: '40%' }} />
          <Skeleton height={88} radius={16} style={{ flex: 1, minWidth: '40%' }} />
          <Skeleton height={88} radius={16} style={{ flex: 1, minWidth: '40%' }} />
        </View>
      ) : isDesktop ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 10,
            gap: 10,
          }}
        >
          <StatCard
            Icon={ShoppingBag}
            value={money(revenue)}
            label="total sales"
            trend={revenue > 0 ? 'earned' : '—'}
            color={ORANGE}
            spark={revenueSpark}
            onPress={() => router.push('/prepper-analytics')}
          />
          <StatCard
            Icon={Boxes}
            value={String(orderCount)}
            label="preorders"
            trend={`${newCount} new`}
            color={GREEN}
            spark={ordersSpark}
            onPress={() => router.push('/prepper-orders')}
          />
          <StatCard
            Icon={Users}
            value={String(subscribers)}
            label="customers"
            trend="unique"
            color={PURPLE}
            spark={customersSpark}
            onPress={() => router.push('/prepper-analytics')}
          />
          <StatCard
            Icon={Star}
            value={avgRating ? avgRating.toFixed(1) : '—'}
            label="rating"
            trend={`${reviewCount} reviews`}
            color={YELLOW}
            spark={ratingSpark}
            onPress={() => router.push('/reviews')}
          />
        </View>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: 20,
            gap: 10,
            paddingTop: 8,
            paddingBottom: 6,
          }}
        >
          <StatCard
            Icon={ShoppingBag}
            value={money(revenue)}
            label="total sales"
            trend={revenue > 0 ? 'earned' : '—'}
            color={ORANGE}
            spark={revenueSpark}
            onPress={() => router.push('/prepper-analytics')}
            flex
          />
          <StatCard
            Icon={Boxes}
            value={String(orderCount)}
            label="orders"
            trend={`${newCount} new`}
            color={GREEN}
            spark={ordersSpark}
            onPress={() => router.push('/prepper-orders')}
            flex
          />
          <StatCard
            Icon={Users}
            value={String(subscribers)}
            label="customers"
            trend="unique"
            color={PURPLE}
            spark={customersSpark}
            onPress={() => router.push('/prepper-analytics')}
            flex
          />
          <StatCard
            Icon={Star}
            value={avgRating ? avgRating.toFixed(1) : '—'}
            label="rating"
            trend={`${reviewCount} reviews`}
            color={YELLOW}
            spark={ratingSpark}
            onPress={() => router.push('/reviews')}
            flex
          />
        </View>
      )}
    </>
  );
}
