import { useRouter } from 'expo-router';
import { Bell, Flame, Gift, Sparkles, X, type LucideIcon } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { getTopAlert, type AlertType } from '@/lib/marketing';
import { useAuth } from '@/providers/auth-provider';

const ICONS: Record<AlertType, LucideIcon> = {
  rush_hour: Flame,
  holiday: Gift,
  weekly_digest: Sparkles,
  seasonal: Sparkles,
  milestone: Bell,
  new_prepper: Bell,
};

const COLORS: Record<AlertType, string> = {
  rush_hour: Palette.brand,
  holiday: '#8b5cf6',
  weekly_digest: '#6d28d9',
  seasonal: Palette.success,
  milestone: '#0891b2',
  new_prepper: Palette.success,
};

export function MarketingBanner() {
  const router = useRouter();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const role = (user?.user_metadata?.role === 'prepper' ? 'prepper' : 'buyer') as 'buyer' | 'prepper';
  const alert = getTopAlert({ prefs: {}, lastFiredByType: {}, role });

  if (!alert || dismissed) return null;

  const Icon = ICONS[alert.type] ?? Bell;
  const color = COLORS[alert.type] ?? Palette.brand;

  return (
    <MotiView
      from={{ opacity: 0, translateY: -6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 260 }}>
      <PressableScale
        onPress={() => { feedback.tap(); router.push(alert.route as any); }}
        accessibilityRole="button"
        accessibilityLabel={alert.title}
        style={{
          marginHorizontal: 20,
          marginTop: 10,
          backgroundColor: color + '14',
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderWidth: 1,
          borderColor: color + '30',
        }}>
        <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 13.5, color: Palette.ink }} numberOfLines={1}>{alert.title}</Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Palette.textSecondary, marginTop: 1 }} numberOfLines={1}>{alert.body}</Text>
        </View>
        <PressableScale
          onPress={() => { feedback.tap(); setDismissed(true); }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={8}
          style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center' }}>
          <X size={14} color={Palette.textSecondary} />
        </PressableScale>
      </PressableScale>
    </MotiView>
  );
}
