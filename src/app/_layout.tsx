import '@/global.css';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname, useRouter } from 'expo-router';
import { CircleUser, Compass, House, MonitorPlay, ShoppingBag, Ticket } from 'lucide-react-native';
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
import { supabase } from '@/lib/supabase';
import { registerPushToken, usePushNotificationListeners } from '@/lib/push-notifications';

import { FloatingCartBar } from '@/components/floating-cart-bar';
import { LoadingSplash } from '@/components/loading-splash';
import { Onboarding } from '@/components/onboarding';
import { ErrorBoundary } from '@/components/error-boundary';
import { AppProviders } from '@/providers/app-providers';
import { useAuth } from '@/providers/auth-provider';

const ONBOARDED_KEY = 'preppa.onboarded.v1';

// ─── FTUE helpers ────────────────────────────────────────────────────────────
// FTUE state is persisted in two places so reinstalling the app does not send
// a returning signed-in user back through onboarding:
//   1. AsyncStorage (fast, local) — `preppa.ftue.v2.<uid>`
//   2. Supabase profiles.onboarding_completed_at (durable, survives reinstall)
// On first check we read the local key; if absent we fall back to the server.
// On completion we write both.

const FTUE_KEY = (uid: string) => `preppa.ftue.v2.${uid}`;

async function isFirstLogin(uid: string): Promise<boolean> {
  try {
    const local = await AsyncStorage.getItem(FTUE_KEY(uid));
    if (local === '1') return false;

    const { data } = await Promise.race([
      supabase.from('profiles').select('onboarding_completed_at').eq('id', uid).maybeSingle(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);

    if (data?.onboarding_completed_at) {
      await AsyncStorage.setItem(FTUE_KEY(uid), '1').catch(() => {});
      return false;
    }
    return true;
  } catch {
    return false; // fail-open: timeout or storage error
  }
}

export async function markFtueComplete(uid: string): Promise<void> {
  await AsyncStorage.setItem(FTUE_KEY(uid), '1').catch(() => {});
  supabase
    .from('profiles')
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq('id', uid)
    .then(() => {}, () => {});
}

// Screens that are dark by design — inverting them would make them light.
const DARK_BY_DESIGN = ['/prepper-orders', '/earnings', '/admin', '/prepper', '/meal-editor', '/dashboard'];

// ─── Sidebar nav items ────────────────────────────────────────────────────────

const SIDEBAR_ITEMS = [
  { href: '/',             label: 'Home',        Icon: House },
  { href: '/explore',      label: 'Explore',     Icon: Compass },
  { href: '/feeds',        label: 'Feeds',       Icon: MonitorPlay },
  { href: '/experiences',  label: 'Experiences', Icon: Ticket },
  { href: '/cart',         label: 'Cart',        Icon: ShoppingBag },
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
      <View accessibilityRole="tablist" style={{ flex: 1 }}>
        {SIDEBAR_ITEMS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          const color = active ? Palette.brand : Palette.textSecondary;

          return (
            <PressableScale
              key={href}
              onPress={() => { feedback.tap(); router.push(href as never); }}
              accessibilityRole="tab"
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
      </View>
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

  // TODO: Implement real dark mode token system. CSS invert removed — was inverting food photography.
  const invert = false;
  const darkProps = { style: { flex: 1 } };

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

// ─── Push notification setup ─────────────────────────────────────────────────
// Always rendered (inside AppProviders, never conditional) so hooks are stable.

function PushSetup() {
  const { session } = useAuth();
  usePushNotificationListeners();

  useEffect(() => {
    if (session?.user?.id) {
      void registerPushToken(session.user.id);
    }
  }, [session?.user?.id]);

  return null;
}

// ─── Auth gate ───────────────────────────────────────────────────────────────

function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Track which uid we've completed the FTUE check for, so a second user
  // logging in during the same app session gets their own check.
  const [ftueCheckedFor, setFtueCheckedFor] = useState<string | null>(null);

  const isPublicPath = pathname.startsWith('/auth') || pathname.startsWith('/onboarding');
  const ftueChecked = !!session && ftueCheckedFor === session.user.id;

  useEffect(() => {
    if (loading) return;

    if (!session) {
      if (!isPublicPath) router.replace('/auth?mode=signin');
      return;
    }

    const uid = session.user.id;
    isFirstLogin(uid).then((firstTime) => {
      if (firstTime) {
        router.replace('/onboarding/step-1');
      } else if (isPublicPath) {
        router.replace('/');
      }
      setFtueCheckedFor(uid);
    });
  }, [session, loading, pathname]);

  // Hide children while we determine the correct route.
  if (loading) return <LoadingSplash />;
  if (!session && !isPublicPath) return null;
  if (session && !ftueChecked && !isPublicPath) return <LoadingSplash />;

  return <>{children}</>;
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
    <ErrorBoundary>
      <AppProviders>
        <PushSetup />
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <ResponsiveFrame>
            <AuthGate>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="change-email" options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="change-password" options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }} />
                <Stack.Screen name="review" options={{ presentation: 'modal' }} />
                <Stack.Screen name="referral" options={{ presentation: 'modal' }} />
                <Stack.Screen name="notification-settings" options={{ presentation: 'modal' }} />
                <Stack.Screen name="notification-preferences" options={{ presentation: 'modal' }} />
                <Stack.Screen name="dietary-preferences" options={{ presentation: 'modal' }} />
                <Stack.Screen name="boost" options={{ presentation: 'modal' }} />
                <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
              </Stack>
              <FloatingCartBar />
            </AuthGate>
            {ready && !onboarded && (
              <Onboarding onGetStarted={() => goToAuth('signup')} onSignIn={() => goToAuth('signin')} />
            )}
            {!ready && <LoadingSplash />}
          </ResponsiveFrame>
        </ThemeProvider>
      </AppProviders>
    </ErrorBoundary>
  );
}
