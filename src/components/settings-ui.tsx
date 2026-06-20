import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { MotiView } from 'moti';
import type { ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Shadow } from '@/constants/theme';
import { feedback } from '@/lib/feedback';

/** Back button + title + optional helper subtitle, shared by every settings sub-page. */
export function SettingsHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const router = useRouter();
  return (
    <MotiView
      from={{ opacity: 0, translateY: -8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 240 }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 16 : 8, paddingBottom: 10 }}>
      <PressableScale
        onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/profile'); } }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Palette.surface, alignItems: 'center', justifyContent: 'center', ...Shadow.card }}>
        <ChevronLeft size={22} color={Palette.ink} />
      </PressableScale>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: Font.display, fontSize: 24, color: Palette.ink, letterSpacing: -0.6 }}>{title}</Text>
        {subtitle ? <Text numberOfLines={2} style={{ fontFamily: Font.body, fontSize: 13, color: Palette.textSecondary, marginTop: 1, lineHeight: 17 }}>{subtitle}</Text> : null}
      </View>
    </MotiView>
  );
}

/** A titled card container that groups related rows with generous padding. */
export function SettingsGroup({ title, children, delay = 0 }: { title?: string; children: ReactNode; delay?: number }) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 280, delay }}
      style={{ marginHorizontal: 20 }}>
      {title ? (
        <Text style={{ fontFamily: Font.semibold, fontSize: 11.5, color: Palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8, paddingHorizontal: 4 }}>{title}</Text>
      ) : null}
      <View style={{ backgroundColor: Palette.surface, borderRadius: 20, overflow: 'hidden', ...Shadow.card }}>
        {children}
      </View>
    </MotiView>
  );
}

/** Visual-only switch — the parent row owns the press so the whole row is tappable. */
function ToggleVisual({ value }: { value: boolean }) {
  return (
    <MotiView
      animate={{ backgroundColor: value ? Palette.brand : Palette.border }}
      transition={{ type: 'timing', duration: 200 }}
      style={{ width: 44, height: 26, borderRadius: 13, justifyContent: 'center', paddingHorizontal: 3 }}>
      <MotiView
        animate={{ translateX: value ? 18 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: Palette.surface }}
      />
    </MotiView>
  );
}

export type RowRight =
  | { type: 'chevron' }
  | { type: 'toggle'; value: boolean; onToggle: () => void }
  | { type: 'value'; label: string };

/**
 * The canonical settings row: left icon, label + optional microcopy, and a
 * right affordance (chevron to drill down, a value, or a switch). 60px tall
 * for a comfortable, misclick-resistant touch target.
 */
export function SettingsRow({
  Icon,
  label,
  sub,
  right = { type: 'chevron' },
  onPress,
  danger = false,
  accent = false,
  isLast = false,
}: {
  Icon: LucideIcon;
  label: string;
  sub?: string;
  right?: RowRight;
  onPress?: () => void;
  danger?: boolean;
  accent?: boolean;
  isLast?: boolean;
}) {
  const iconBg = danger ? Palette.danger + '1A' : accent ? Palette.brandTint : Palette.chip;
  const iconColor = danger ? Palette.danger : accent ? Palette.brand : Palette.textSecondary;
  const labelColor = danger ? Palette.danger : accent ? Palette.brand : Palette.ink;

  const handlePress = () => {
    feedback.tap();
    if (right.type === 'toggle') right.onToggle();
    else onPress?.();
  };

  return (
    <>
      <PressableScale
        onPress={handlePress}
        accessibilityRole={right.type === 'toggle' ? 'switch' : 'button'}
        accessibilityLabel={sub ? `${label}. ${sub}` : label}
        accessibilityState={right.type === 'toggle' ? { checked: right.value } : undefined}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, minHeight: 60 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={19} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: Font.heading, fontSize: 15, color: labelColor }}>{label}</Text>
          {sub ? <Text numberOfLines={2} style={{ fontFamily: Font.body, fontSize: 12.5, color: Palette.textSecondary, marginTop: 1, lineHeight: 17 }}>{sub}</Text> : null}
        </View>
        {right.type === 'chevron' ? <ChevronRight size={18} color={Palette.textSecondary} /> : null}
        {right.type === 'value' ? <Text style={{ fontFamily: Font.medium, fontSize: 13, color: Palette.textSecondary }}>{right.label}</Text> : null}
        {right.type === 'toggle' ? <ToggleVisual value={right.value} /> : null}
      </PressableScale>
      {!isLast ? <View style={{ height: 1, backgroundColor: Palette.border, marginLeft: 70 }} /> : null}
    </>
  );
}
