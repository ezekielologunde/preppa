import { MotiView } from 'moti';
import { Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import { Admin } from './ui';
import type { GmvWeek } from '@/lib/queries/admin';

const CHART_HEIGHT = 120;
const Y_AXIS_WIDTH = 38;

function formatY(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
}

type Props = { data: GmvWeek[] };

export function AdminGmvChart({ data }: Props) {
  if (!data.length) {
    return (
      <View style={{ paddingVertical: 20, alignItems: 'center' }}>
        <Text style={{ fontFamily: Font.body, fontSize: 13, color: Admin.textDim }}>
          No completed orders in the last 8 weeks.
        </Text>
      </View>
    );
  }

  const maxGmv = Math.max(...data.map((d) => d.gmv), 1);
  const peakIdx = data.reduce((best, d, i) => (d.gmv > data[best].gmv ? i : best), 0);

  const yLabels = [
    formatY(maxGmv),
    formatY(maxGmv / 2),
    '$0',
  ];

  return (
    <View style={{ paddingTop: 4 }}>
      <View style={{ flexDirection: 'row' }}>
        {/* Y-axis */}
        <View style={{ width: Y_AXIS_WIDTH, height: CHART_HEIGHT, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6 }}>
          {yLabels.map((label, i) => (
            <Text key={i} style={{ fontFamily: Font.body, fontSize: 9, color: Admin.textDim }}>
              {label}
            </Text>
          ))}
        </View>

        {/* Bars */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: CHART_HEIGHT }}>
          {data.map((item, i) => {
            const isCurrent = i === data.length - 1;
            const isPeak = i === peakIdx;
            const barH = maxGmv > 0 ? Math.max(4, (item.gmv / maxGmv) * (CHART_HEIGHT - 16)) : 4;
            const fill = isCurrent || isPeak ? Admin.brand : Admin.brand + '38';
            return (
              <MotiView
                key={item.label}
                from={{ height: 0, opacity: 0 }}
                animate={{ height: barH, opacity: 1 }}
                transition={{ type: 'timing', duration: 320, delay: i * 38 }}
                style={{ flex: 1, backgroundColor: fill, borderRadius: 4, overflow: 'hidden' }}
              />
            );
          })}
        </View>
      </View>

      {/* X-axis labels */}
      <View style={{ flexDirection: 'row', marginLeft: Y_AXIS_WIDTH, marginTop: 6, gap: 5 }}>
        {data.map((item, i) => {
          const highlight = i === data.length - 1 || i === peakIdx;
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <Text
                style={{ fontFamily: Font.body, fontSize: 8, color: highlight ? Admin.brand : Admin.textDim, textAlign: 'center' }}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
