import { Text, View } from 'react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { compressSchedule, nextOpenTime, type CookSchedule } from '@/lib/queries/schedule';

type Props = { schedule: CookSchedule; isOpen?: boolean };

export function KitchenHoursCard({ schedule, isOpen = true }: Props) {
  const rows = compressSchedule(schedule).filter((r) => r.hours !== 'Closed');
  if (!rows.length) return null;
  const nextOpen = !isOpen ? nextOpenTime(schedule) : null;
  return (
    <View style={{ marginHorizontal: 16, marginTop: 14, backgroundColor: Palette.surface, borderRadius: Radius.lg, paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={{ fontSize: 9, color: isOpen ? '#10B981' : '#EF4444', lineHeight: 13 }}>{'●'}</Text>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: isOpen ? '#10B981' : '#EF4444' }}>
            {isOpen ? 'Open now' : 'Closed'}
          </Text>
        </View>
        <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Palette.inkSoft, textTransform: 'lowercase', letterSpacing: 0.3 }}>· hours</Text>
      </View>
      {!isOpen && nextOpen ? (
        <Text style={{ fontFamily: Font.body, fontSize: 11, color: Palette.textSecondary, marginBottom: 8 }}>{nextOpen}</Text>
      ) : null}
      <View style={{ height: 1, backgroundColor: Palette.border, marginBottom: 8 }} />
      {rows.map(({ label, hours }) => (
        <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
          <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.inkSoft }}>{label}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.ink }}>{hours}</Text>
        </View>
      ))}
    </View>
  );
}
