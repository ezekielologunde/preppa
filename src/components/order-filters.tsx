import { Search, X } from 'lucide-react-native';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

export type StatusFilter = 'all' | 'active' | 'completed' | 'cancelled';

const CHIPS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (s: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}

export function OrderFilters({ searchQuery, onSearchChange, statusFilter, onStatusChange, counts }: Props) {
  return (
    <View style={{ gap: 8, marginBottom: 4 }}>
      {/* Search bar */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Palette.surface,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Palette.divider,
        height: 42,
        paddingHorizontal: 14,
        marginHorizontal: 16,
        gap: 8,
      }}>
        <Search size={16} color={Palette.textMuted} strokeWidth={2} />
        <TextInput
          value={searchQuery}
          onChangeText={onSearchChange}
          placeholder="Search orders..."
          placeholderTextColor={Palette.textMuted}
          style={{
            flex: 1,
            fontFamily: Font.body,
            fontSize: 14,
            color: Palette.ink,
            paddingVertical: 0,
          }}
          returnKeyType="search"
          clearButtonMode="never"
          accessibilityLabel="Search orders"
        />
        {searchQuery.length > 0 ? (
          <PressableScale
            onPress={() => { feedback.tap(); onSearchChange(''); }}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            style={{ padding: 2 }}>
            <X size={14} color={Palette.textMuted} strokeWidth={2.5} />
          </PressableScale>
        ) : null}
      </View>

      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {CHIPS.map(({ key, label }) => {
          const active = statusFilter === key;
          const count = counts[key];
          return (
            <PressableScale
              key={key}
              onPress={() => { feedback.tap(); onStatusChange(key); }}
              accessibilityRole="button"
              accessibilityLabel={`Filter by ${label}`}
              style={{
                height: 32,
                paddingHorizontal: 14,
                borderRadius: 20,
                backgroundColor: active ? Palette.brand + '20' : Palette.surface,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
              }}>
              <Text style={{
                fontFamily: Font.semibold,
                fontSize: 12,
                color: active ? Palette.brand : Palette.textSecondary,
              }}>
                {label}
              </Text>
              {count > 0 ? (
                <View style={{
                  minWidth: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: active ? Palette.brand + '30' : Palette.canvas,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 3,
                }}>
                  <Text style={{
                    fontFamily: Font.semibold,
                    fontSize: 10,
                    color: active ? Palette.brand : Palette.textMuted,
                  }}>
                    {count}
                  </Text>
                </View>
              ) : null}
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}
