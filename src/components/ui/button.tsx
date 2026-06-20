import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Text, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';

// The single source of truth for action buttons. Variants encode the
// visual hierarchy rule: exactly one `primary` (filled) CTA per view; use
// `secondary` (outlined) for the alternative action and `tertiary` (text)
// for low-emphasis links. `ink` is the dark confirm/pay CTA; `muted` is the
// inactive "complete the form first" state (full chip, not dimmed). Built on
// PressableScale, so the press-scale + tap haptic come for free — do NOT call
// feedback.tap() in onPress.

type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ink' | 'muted';
type Size = 'lg' | 'md' | 'sm';

const SIZES: Record<Size, { height: number; padX: number; font: number; icon: number }> = {
  lg: { height: 52, padX: 22, font: 16, icon: 18 },
  md: { height: 46, padX: 18, font: 15, icon: 17 },
  sm: { height: 38, padX: 14, font: 13.5, icon: 15 },
};

function paint(variant: Variant): { bg: string; fg: string; border?: ViewStyle } {
  switch (variant) {
    case 'secondary':
      return { bg: Palette.surface, fg: Palette.ink, border: { borderWidth: 1.5, borderColor: Palette.border } };
    case 'tertiary':
      return { bg: 'transparent', fg: Palette.brand };
    case 'danger':
      return { bg: Palette.danger, fg: '#fff' };
    case 'ink':
      return { bg: Palette.ink, fg: '#fff' };
    case 'muted':
      return { bg: Palette.chip, fg: Palette.textSecondary };
    default:
      return { bg: Palette.brand, fg: '#fff' };
  }
}

export type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  /** Leading icon (lucide component). */
  Icon?: LucideIcon;
  /** Trailing icon, e.g. a chevron on a "Continue →" / "Create →" CTA. */
  TrailingIcon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the parent's width (default). Set false for content-width
   *  buttons; in a row, pass `style={{ flex: 1 }}` on the one that expands. */
  fullWidth?: boolean;
  /** Custom fill colour for accent flows (e.g. home-cook purple). Overrides
   *  the variant's background and forces white text. */
  tone?: string;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  Icon,
  TrailingIcon,
  loading = false,
  disabled = false,
  fullWidth = true,
  tone,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const s = SIZES[size];
  const base = paint(variant);
  const bg = tone ?? base.bg;
  const fg = tone ? '#fff' : base.fg;
  const border = tone ? undefined : base.border;
  const inactive = disabled || loading;
  const heavy = !!tone || (variant !== 'secondary' && variant !== 'tertiary');

  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityLabel={accessibilityLabel ?? title}
      style={{
        height: s.height,
        paddingHorizontal: s.padX,
        borderRadius: Radius.pill,
        backgroundColor: bg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        opacity: inactive && variant !== 'muted' ? 0.55 : 1,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        ...border,
        ...style,
      }}>
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : Icon ? (
        <Icon size={s.icon} color={fg} />
      ) : null}
      <Text numberOfLines={1} style={{ fontFamily: heavy ? Font.heading : Font.semibold, fontSize: s.font, color: fg }}>
        {title}
      </Text>
      {!loading && TrailingIcon ? <TrailingIcon size={s.icon} color={fg} /> : null}
    </PressableScale>
  );
}
