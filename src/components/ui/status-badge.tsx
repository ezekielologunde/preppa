import { StyleSheet, Text, View } from 'react-native';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import type { OrderStatus } from '@/types/database.types';

type StatusConfig = { label: string; bg: string; text: string };

const STATUS_MAP: Record<OrderStatus, StatusConfig> = {
  pending:   { label: 'pending',    bg: Palette.amberTint,      text: Palette.amberDeep      },
  confirmed: { label: 'confirmed',  bg: Palette.confirmedTint,  text: Palette.confirmedDark  },
  preparing: { label: 'preparing',  bg: Palette.preparingTint,  text: Palette.preparingDark  },
  ready:     { label: 'ready',      bg: Palette.successTint,    text: Palette.successDark     },
  in_transit:{ label: 'in transit', bg: Palette.brandTint,      text: Palette.brandPressed   },
  delivered: { label: 'delivered',  bg: Palette.successTint,    text: Palette.successDark     },
  cancelled: { label: 'cancelled',  bg: Palette.cancelledTint,  text: Palette.textSecondary  },
  refunded:  { label: 'refunded',   bg: Palette.chip,           text: Palette.textSecondary  },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return (
    <View
      style={[styles.badge, { backgroundColor: cfg.bg }]}
      accessibilityLabel={cfg.label}
      accessibilityRole="text"
    >
      <Text style={[styles.label, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, alignSelf: 'flex-start' },
  label: { fontFamily: Font.semibold, fontSize: 10 },
});
