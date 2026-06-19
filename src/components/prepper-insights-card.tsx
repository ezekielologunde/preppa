import { useRouter } from 'expo-router';
import { ChevronRight, Star } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { usePrepperInsights } from '@/lib/queries/analytics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = { prepperId?: string | null };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function percentileLabel(
  pct: number,
): { text: string; color: string } | null {
  if (pct >= 90) return { text: '🏆 Top 10% of kitchens', color: Palette.success };
  if (pct >= 75) return { text: 'Top 25% of kitchens', color: Palette.brand };
  if (pct >= 50) return { text: 'Above average kitchens', color: Palette.brand };
  return null;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function InsightsSkeleton() {
  return (
    <View style={{ gap: 10 }}>
      <Skeleton height={18} radius={6} style={{ width: '55%' }} />
      <Skeleton height={14} radius={6} style={{ width: '80%' }} />
      <Skeleton height={14} radius={6} style={{ width: '65%' }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

export function PrepperInsightsCard({ prepperId }: Props) {
  const router = useRouter();
  const { data, isLoading } = usePrepperInsights(prepperId);

  const INK = '#FFFFFF';
  const MUTED = Palette.textMuted;

  return (
    <View
      style={{
        backgroundColor: Palette.prepperCard,
        borderRadius: 18,
        padding: 20,
        borderLeftWidth: 3,
        borderLeftColor: Palette.brand,
        gap: 14,
      }}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: Font.display, fontSize: 15, color: '#E5E7EB', letterSpacing: -0.3 }}>
          your performance
        </Text>
        <View
          style={{
            backgroundColor: Palette.brand + '22',
            borderRadius: Radius.pill,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.brand }}>
            this week
          </Text>
        </View>
      </View>

      {/* Content */}
      {isLoading || !data ? (
        <InsightsSkeleton />
      ) : (
        <View style={{ gap: 12 }}>
          {/* Rating + percentile */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Star size={18} color={Palette.brand} fill={Palette.brand} />
            <Text
              style={{
                fontFamily: Font.display,
                fontSize: 22,
                color: Palette.brand,
                letterSpacing: -0.5,
                fontVariant: ['tabular-nums'],
              }}
            >
              {data.avgRating > 0 ? data.avgRating.toFixed(1) : '—'}
            </Text>
            {(() => {
              const label = percentileLabel(data.percentileRating);
              if (!label) return null;
              return (
                <View
                  style={{
                    backgroundColor: label.color + '22',
                    borderRadius: Radius.pill,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}
                >
                  <Text style={{ fontFamily: Font.semibold, fontSize: 12, color: label.color }}>
                    {label.text}
                  </Text>
                </View>
              );
            })()}
          </View>

          {/* Stat chips */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>
              ${data.weeklyRevenue.toFixed(0)} this week
            </Text>
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: MUTED }}> · </Text>
            <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: MUTED }}>
              {data.repeatRate}% repeat customers
            </Text>
          </View>

          {/* Streak */}
          {data.streak >= 2 ? (
            <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: INK }}>
              {'🔥 '}
              {data.streak}-day streak!
              {data.streak >= 7 ? '  Keep it up! 🎉' : ''}
            </Text>
          ) : null}

          {/* CTA */}
          <PressableScale
            onPress={() => { feedback.tap(); router.push('/prepper-analytics' as any); }}
            accessibilityRole="button"
            accessibilityLabel="View full analytics"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
          >
            <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.brand }}>
              Full analytics
            </Text>
            <ChevronRight size={15} color={Palette.brand} />
          </PressableScale>
        </View>
      )}
    </View>
  );
}
