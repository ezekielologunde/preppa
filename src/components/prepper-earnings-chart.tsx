import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { Skeleton } from '@/components/ui/skeleton';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { usePrepperEarningsChart } from '@/lib/queries/payouts';

const CARD      = Palette.surface;
const BRAND     = Palette.brand;
const INK       = Palette.ink;
const BAR_MAX_H = 90;
const TEXT_MUTED = Palette.textSecondary;

type Props = { prepperId?: string | null };

export function PrepperEarningsChart({ prepperId }: Props) {
  const { data, isLoading } = usePrepperEarningsChart(prepperId);

  const total = (data ?? []).reduce((s, w) => s + w.amount, 0);
  const maxAmount = Math.max(...(data ?? []).map((w) => w.amount), 1);

  function formatTotal(v: number): string {
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
    return `$${Math.round(v)}`;
  }

  return (
    <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 16, gap: 12, shadowColor: Palette.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: TEXT_MUTED }}>
          earnings · 8 weeks
        </Text>
        <Text style={{ fontFamily: Font.display, fontSize: 20, color: INK, fontVariant: ['tabular-nums'] }}>
          {isLoading ? '—' : formatTotal(total)}
        </Text>
      </View>

      {/* Chart area */}
      {isLoading ? (
        <View style={{ height: BAR_MAX_H + 20, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: BAR_MAX_H, gap: 3 }}>
            {[42, 60, 28, 75, 50, 85, 65, 90].map((h, i) => (
              <Skeleton key={i} height={h} radius={4} style={{ flex: 1 }} />
            ))}
          </View>
          <Skeleton height={10} radius={3} />
        </View>
      ) : !data || data.every((w) => w.amount === 0) ? (
        <View style={{ height: BAR_MAX_H + 20, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: TEXT_MUTED }}>
            No completed orders yet
          </Text>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          {/* Bars */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: BAR_MAX_H, gap: 2 }}>
            {data.map((item, i) => {
              const isCurrent = i === data.length - 1;
              const barH = item.amount === 0
                ? 3
                : Math.max(8, (item.amount / maxAmount) * (BAR_MAX_H - 8));
              const fill = item.amount === 0
                ? (isCurrent ? BRAND + '30' : BRAND + '18')
                : (isCurrent ? BRAND : BRAND + '55');
              return (
                <MotiView
                  key={item.label}
                  from={{ height: 0, opacity: 0 }}
                  animate={{ height: barH, opacity: 1 }}
                  transition={{ type: 'timing', duration: 320, delay: i * 38 }}
                  style={{ flex: 1, backgroundColor: fill, borderRadius: 4, marginHorizontal: 1 }}
                />
              );
            })}
          </View>

          {/* X-axis labels */}
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {data.map((item, i) => {
              const isCurrent = i === data.length - 1;
              return (
                <View key={item.label} style={{ flex: 1, alignItems: 'center' }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: Font.body,
                      fontSize: 9,
                      color: isCurrent ? BRAND : TEXT_MUTED,
                      textAlign: 'center',
                    }}
                  >
                    {item.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
