import '@/global.css';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRouter } from 'expo-router';
import { CircleUser, Compass, House, LayoutGrid, Sparkles } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { fontAssets, Font } from '@/constants/fonts';
import { Palette } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { maxWidthFor } from '@/lib/layout';
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
  { href: '/feeds',        label: 'Feed',        Icon: LayoutGrid },
  { href: '/experiences',  label: 'Experiences', Icon: Sparkles },
  { href: '/profile',      label: 'Profile',     Icon: CircleUser },
] as const;

function WebSidebar() {
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const router = useRouter();

  const isTablet  = width >= 768 && width < 1120;
  const isDesktop = width >= 1120;
  const show = Platform.OS === 'web' || width >= 768;

  if (!show) return null;

  const sidebarWidth = isDesktop ? 220 : 72;

  // Normalise pathname to match the href format used above.
  // Expo router may give "/feeds" for the tab route named "feeds".
  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/' || pathname === '/index';
    return pathname.startsWith(href);
  }

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{
        width: sidebarWidth,
        backgroundColor: Palette.surface,
        borderRightWidth: 1,
        borderRightColor: Palette.border,
      }}>
      <View style={{ flex: 1, paddingTop: 16 }}>
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
                justifyContent: isTablet ? 'center' : 'flex-start',
                gap: 12,
                marginHorizontal: 8,
                marginBottom: 4,
                paddingVertical: 10,
                paddingHorizontal: isDesktop ? 12 : 0,
                borderRadius: 12,
                backgroundColor: active ? Palette.brandTint : 'transparent',
              }}>
              <Icon size={22} color={color} strokeWidth={active ? 2.4 : 1.8} />
              {isDesktop && (
                <Text
                  style={{
                    fontFamily: active ? Font.semibold : Font.medium,
                    fontSize: 14,
                    color,
                    letterSpacing: 0.1,
                  }}>
                  {label}
                </Text>
              )}
            </PressableScale>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ─── Responsive frame ─────────────────────────────────────────────────────────

/**
 * Responsive frame for web. Each route class gets an intentional width
 * (lib/layout.ts): focused flows stay a phone-class column, content lists get
 * a comfortable reading width, and browse/business surfaces widen into real
 * tablet/desktop layouts (the screens add grid columns to match).
 * The frame also carries dark mode on web: a smart-invert flips every light
 * surface dark in one move; photos are counter-inverted (see theme-mode.ts).
 *
 * On tablet/desktop (≥768px) the WebSidebar is mounted here, to the left of
 * the Stack. The tab bar returns null at that width to avoid double navigation.
 */
function ResponsiveFrame({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const dark = useDarkMode();
  const pathname = usePathname();

  const isTabletOrDesktop = width >= 768;
  const invert = Platform.OS === 'web' && dark && !DARK_BY_DESIGN.some((r) => pathname.startsWith(r));

  const darkProps = invert
    ? { dataSet: { preppadark: 'true' }, style: { flex: 1, filter: 'invert(0.93) hue-rotate(180deg)' } as never }
    : { style: { flex: 1 } };

  // Mobile: pass-through with optional dark invert.
  if (Platform.OS !== 'web' || width <= 560) {
    return <View {...darkProps}>{children}</View>;
  }

  const frameWidth = maxWidthFor(pathname ?? '/', width);
  const darkSurface =
    DARK_BY_DESIGN.some((r) => (pathname ?? '').startsWith(r)) ||
    (pathname ?? '').startsWith('/customers');

  // On tablet/desktop: sidebar + content, constrained inside the centred frame.
  if (isTabletOrDesktop) {
    return (
      <View {...darkProps}>
        <View style={{ flex: 1, backgroundColor: darkSurface ? '#08090C' : '#E9E7E4', alignItems: 'center' }}>
          <View
            style={{
              flex: 1,
              width: '100%',
              maxWidth: frameWidth,
              backgroundColor: darkSurface ? '#0C0E13' : '#F7F7F8',
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOpacity: 0.12,
              shadowRadius: 32,
              shadowOffset: { width: 0, height: 0 },
              flexDirection: 'row',
            }}>
            <WebSidebar />
            <View style={{ flex: 1 }}>{children}</View>
          </View>
        </View>
      </View>
    );
  }

  // Narrow web (560–767px): centred frame, no sidebar.
  return (
    <View {...darkProps}>
      <View style={{ flex: 1, backgroundColor: darkSurface ? '#08090C' : '#E9E7E4', alignItems: 'center' }}>
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: frameWidth,
            backgroundColor: darkSurface ? '#0C0E13' : '#F7F7F8',
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOpacity: 0.12,
            shadowRadius: 32,
            shadowOffset: { width: 0, height: 0 },
          }}>
          {children}
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
