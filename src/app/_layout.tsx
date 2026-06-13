import '@/global.css';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRouter } from 'expo-router';
import { CircleUser, Compass, House, MonitorPlay, Ticket } from 'lucide-react-native';
import { MotiView, MotiText } from 'moti';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { fontAssets, Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { BP, contentWidthFor, shouldCenter } from '@/lib/layout';
import { useDarkMode } from '@/lib/theme-mode';

import { LoadingSplash } from '@/components/loading-splash';
import { Onboarding } from '@/components/onboarding';
import { AppProviders } from '@/providers/app-providers';

const ONBOARDED_KEY = 'preppa.onboarded.v1';

// Screens that are dark by design — inverting them would make them light.
const DARK_BY_DESIGN = ['/prepper-orders', '/earnings', '/admin', '/prepper', '/meal-editor'];

// ─── Sidebar nav items ────────────────────────────────────────────────────────

const SIDEBAR_ITEMS = [
  { href: '/',             label: 'Home',        Icon: House },
  { href: '/explore',      label: 'Explore',     Icon: Compass },
  { href: '/feeds',        label: 'Feeds',       Icon: MonitorPlay },
  { href: '/experiences',  label: 'Experiences', Icon: Ticket },
  { href: '/profile',      label: 'Profile',     Icon: CircleUser },
] as const;

/**
 * Polymorphic navigation: an icon RAIL on tablets that morphs into a labelled
 * SIDEBAR on desktop. Mounts at ≥ 600px on every platform (a native iPad gets
 * it too). The container width and the labels animate, so widening the window
 * glides the rail open instead of snapping.
 */
function AppSidebar() {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (width < BP.tablet) return null;

  const isDesktop = width >= BP.desktop;
  const railWidth = isDesktop ? 240 : 72;

  // Expo router may report "/feeds" for the tab route named "feeds".
  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/' || pathname === '/index';
    return pathname.startsWith(href);
  }

  return (
    <MotiView
      animate={{ width: railWidth }}
      transition={{ type: 'timing', duration: 240 }}
      style={{
        backgroundColor: Palette.surface,
        borderRightWidth: 1,
        borderRightColor: Palette.border,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 12,
      }}>
      {SIDEBAR_ITEMS.map(({ href, label, Icon }) => {
        const active = isActive(href);
        const color = active ? Palette.brand : Palette.textSecondary;

        return (
          <PressableScale
            key={href}
            onPress={() => { feedback.tap(); router.push(href as never); }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: isDesktop ? 'flex-start' : 'center',
              gap: 12,
              marginHorizontal: 8,
              marginBottom: 4,
              paddingVertical: 11,
              paddingHorizontal: isDesktop ? 12 : 0,
              borderRadius: 12,
              backgroundColor: active ? Palette.brandTint : 'transparent',
            }}>
            <Icon size={22} color={color} strokeWidth={active ? 2.4 : 1.8} />
            {isDesktop ? (
              <MotiText
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'timing', duration: 200, delay: 80 }}
                style={{ fontFamily: active ? Font.semibold : Font.medium, fontSize: 14.5, color, letterSpacing: 0.1 }}>
                {label}
              </MotiText>
            ) : null}
          </PressableScale>
        );
      })}
    </MotiView>
  );
}

// ─── Responsive frame ─────────────────────────────────────────────────────────

/**
 * Adaptive app shell — one model for every platform (see lib/layout.ts):
 *   < 600px : pass-through single column (bottom tab bar handles nav)
 *   ≥ 600px : AppSidebar (rail → labelled sidebar) + a content area that FILLS
 *             the rest. Browse/feed/business surfaces stretch edge-to-edge;
 *             focused forms centre at a comfortable max-width. No grey "device
 *             frame" margins — the shell looks native, not like blocks on a canvas.
 * On web it also carries dark mode via a smart CSS invert (web-only).
 */
function ResponsiveFrame({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const dark = useDarkMode();
  const pathname = usePathname();
  const path = pathname ?? '/';

  const invert = Platform.OS === 'web' && dark && !DARK_BY_DESIGN.some((r) => path.startsWith(r));
  const darkProps = invert
    ? { dataSet: { preppadark: 'true' }, style: { flex: 1, filter: 'invert(0.93) hue-rotate(180deg)' } as never }
    : { style: { flex: 1 } };

  // Compact phones: pass-through (the bottom tab bar is the nav here).
  if (width < BP.tablet) {
    return <View {...darkProps}>{children}</View>;
  }

  const darkSurface = DARK_BY_DESIGN.some((r) => path.startsWith(r)) || path.startsWith('/customers');
  const shellBg = darkSurface ? '#0C0E13' : Palette.canvas;
  const center = shouldCenter(path, width);
  const maxW = contentWidthFor(path, width);

  return (
    <View {...darkProps}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: shellBg }}>
        <AppSidebar />
        {/* Content area fills the rest; focused flows centre within it. */}
        <View style={{ flex: 1 }}>
          {center ? (
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ flex: 1, width: '100%', maxWidth: maxW }}>{children}</View>
            </View>
          ) : (
            children
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY)
      .then((value) => setOnboarded(value === '1'))
      .catch(() => setOnboarded(false));

    // Minimum splash time so the brand moment doesn't flicker on fast loads.
    const timer = setTimeout(() => setBooting(false), 1600);
    return () => clearTimeout(timer);
  }, []);

  // Font loading must never block the app — proceed on load OR error.
  const ready = !booting && onboarded !== null && (fontsLoaded || !!fontError);

  async function dismissOnboarding() {
    setOnboarded(true);
    try {
      await AsyncStorage.setItem(ONBOARDED_KEY, '1');
    } catch {
      // Non-fatal: onboarding just shows again next launch.
    }
  }

  async function goToAuth(mode: 'signin' | 'signup') {
    await dismissOnboarding();
    router.push(`/auth?mode=${mode}`);
  }

  return (
    <AppProviders>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <ResponsiveFrame>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="change-email" options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="change-password" options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="review" options={{ presentation: 'modal' }} />
            <Stack.Screen name="referral" options={{ presentation: 'modal' }} />
            <Stack.Screen name="notification-settings" options={{ presentation: 'modal' }} />
            <Stack.Screen name="dietary-preferences" options={{ presentation: 'modal' }} />
            <Stack.Screen name="boost" options={{ presentation: 'modal' }} />
          </Stack>
          {ready && !onboarded && (
            <Onboarding onGetStarted={() => goToAuth('signup')} onSignIn={() => goToAuth('signin')} />
          )}
          {!ready && <LoadingSplash />}
        </ResponsiveFrame>
      </ThemeProvider>
    </AppProviders>
  );
}
