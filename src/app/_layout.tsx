import '@/global.css';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider, usePathname, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, useColorScheme, useWindowDimensions, View } from 'react-native';

import { maxWidthFor } from '@/lib/layout';
import { useDarkMode } from '@/lib/theme-mode';

import AppTabs from '@/components/app-tabs';
import { LoadingSplash } from '@/components/loading-splash';
import { Onboarding } from '@/components/onboarding';
import { fontAssets } from '@/constants/fonts';
import { AppProviders } from '@/providers/app-providers';

const ONBOARDED_KEY = 'preppa.onboarded.v1';

// Screens that are dark by design — inverting them would make them light.
const DARK_BY_DESIGN = ['/dashboard', '/prepper-orders', '/earnings', '/admin'];

/**
 * Responsive frame for web. Each route class gets an intentional width
 * (lib/layout.ts): focused flows stay a phone-class column, content lists get
 * a comfortable reading width, and browse/business surfaces widen into real
 * tablet/desktop layouts (the screens add grid columns to match).
 * The frame also carries dark mode on web: a smart-invert flips every light
 * surface dark in one move; photos are counter-inverted (see theme-mode.ts).
 */
function ResponsiveFrame({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const dark = useDarkMode();
  const pathname = usePathname();
  const invert = Platform.OS === 'web' && dark && !DARK_BY_DESIGN.some((r) => pathname.startsWith(r));
  const darkProps = invert
    ? { dataSet: { preppadark: 'true' }, style: { flex: 1, filter: 'invert(0.93) hue-rotate(180deg)' } as never }
    : { style: { flex: 1 } };
  if (Platform.OS !== 'web' || width <= 560) return <View {...darkProps}>{children}</View>;
  const frameWidth = maxWidthFor(pathname ?? '/', width);
  // Business (prepper/admin) surfaces are dark — match the gutter to them.
  const darkSurface = DARK_BY_DESIGN.some((r) => (pathname ?? '').startsWith(r)) || (pathname ?? '').startsWith('/customers') || (pathname ?? '').startsWith('/meal-editor') || (pathname ?? '').startsWith('/prepper-orders');
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
          {/* Navigator always mounted so routing stays valid; overlays sit on top. */}
          <AppTabs />
          {ready && !onboarded && (
            <Onboarding onGetStarted={() => goToAuth('signup')} onSignIn={() => goToAuth('signin')} />
          )}
          {!ready && <LoadingSplash />}
        </ResponsiveFrame>
      </ThemeProvider>
    </AppProviders>
  );
}
