import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { usePrepperEarningsChart } from '@/lib/queries/payouts';

const CARD = Palette.prepperCard;
const BRAND = Palette.brand;
const BAR_MAX_H = 90;
const TEXT_MUTED = '#6B7280';

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
    <View style={{ backgroundColor: CARD, borderRadius: 16, padding: 16, gap: 12 }}>
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: '#9CA3AF' }}>
          Earnings (8 weeks)
        </Text>
        <Text style={{ fontFamily: Font.display, fontSize: 20, color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>
          {isLoading ? '—' : formatTotal(total)}
        </Text>
      </View>

      {/* Chart area */}
      {isLoading ? (
        <View style={{ height: BAR_MAX_H + 20, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: TEXT_MUTED }}>Loading…</Text>
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
              const barH = maxAmount > 0
                ? Math.max(4, (item.amount / maxAmount) * (BAR_MAX_H - 8))
                : 4;
              const fill = isCurrent ? BRAND : BRAND + '55';
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
