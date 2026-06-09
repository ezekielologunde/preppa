import { ActivityIndicator, Pressable, type PressableProps, Text } from 'react-native';

import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost';

const container: Record<Variant, string> = {
  primary: 'bg-blue-600 active:bg-blue-700',
  secondary: 'bg-zinc-200 active:bg-zinc-300 dark:bg-zinc-800 dark:active:bg-zinc-700',
  ghost: 'bg-transparent active:bg-zinc-100 dark:active:bg-zinc-800',
};

const label: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-zinc-900 dark:text-zinc-50',
  ghost: 'text-zinc-900 dark:text-zinc-50',
};

export type ButtonProps = PressableProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  className?: string;
};

/** Example NativeWind component — universal across iOS, Android, web/desktop. */
export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className={cn(
        'h-12 flex-row items-center justify-center gap-2 rounded-xl px-5',
        container[variant],
        (disabled || loading) && 'opacity-50',
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : '#18181b'} />
      ) : (
        <Text className={cn('text-base font-semibold', label[variant])}>{title}</Text>
      )}
    </Pressable>
  );
}
