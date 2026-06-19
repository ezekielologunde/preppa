import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import type { WeeklyRevenue } from '@/lib/queries/analytics';

type Props = { data: WeeklyRevenue[] };

export function RevenueBarChart({ data }: Props) {
  if (!data.length) {
    return (
      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textMuted }}>
          No completed orders in the last 8 weeks.
        </Text>
      </View>
    );
  }

  const maxAmount = Math.max(...data.map((d) => d.amount), 1);
  const peakIdx = data.reduce((best, d, i) => (d.amount > data[best].amount ? i : best), 0);

  const yLabels = [
    { value: maxAmount, label: formatY(maxAmount) },
    { value: maxAmount / 2, label: formatY(maxAmount / 2) },
    { value: 0, label: '$0' },
  ];

  const CHART_HEIGHT = 140;
  const Y_AXIS_WIDTH = 36;

  return (
    <View style={{ paddingTop: 4 }}>
      <View style={{ flexDirection: 'row' }}>
        {/* Y-axis labels */}
        <View style={{ width: Y_AXIS_WIDTH, height: CHART_HEIGHT, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6, paddingBottom: 0 }}>
          {yLabels.map(({ label }, i) => (
            <Text key={i} style={{ fontFamily: Font.body, fontSize: 9, color: Palette.textMuted }}>
              {label}
            </Text>
          ))}
        </View>

        {/* Bars */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: CHART_HEIGHT }}>
          {data.map((item, i) => {
            const isPeak = i === peakIdx;
            const barH = maxAmount > 0 ? Math.max(4, (item.amount / maxAmount) * (CHART_HEIGHT - 20)) : 4;
            return (
              <MotiView
                key={item.label}
                from={{ height: 0, opacity: 0 }}
                animate={{ height: barH, opacity: 1 }}
                transition={{ type: 'timing', duration: 340, delay: i * 40 }}
                style={{
                  flex: 1,
                  backgroundColor: isPeak ? Palette.brand : Palette.brand + '40',
                  borderRadius: 4,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  overflow: 'hidden',
                }}
              />
            );
          })}
        </View>
      </View>

      {/* X-axis labels */}
      <View style={{ flexDirection: 'row', marginLeft: Y_AXIS_WIDTH, marginTop: 6, gap: 5 }}>
        {data.map((item, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: Font.body,
                fontSize: 8,
                color: i === peakIdx ? Palette.brand : Palette.textMuted,
                textAlign: 'center',
              }}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function formatY(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
}
