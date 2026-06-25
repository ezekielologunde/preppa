import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Palette } from '@/constants/theme';
import { fontAssets } from '@/constants/fonts';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { usePushRegistration } from '@/hooks/use-push-registration';

SplashScreen.preventAutoHideAsync();

// Routes reachable without a session. Everything else requires auth.
const PUBLIC_SEGMENTS = new Set(['auth', 'index', '']);

// Redirects between the auth screen and the app based on session state.
// Without this gate the app boots straight into (tabs) and the sign-in screen
// is unreachable — users can neither sign in nor create an account.
function AuthGate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Register this device for push once signed in.
  usePushRegistration(session?.user?.id ?? null);

  useEffect(() => {
    if (loading) return;
    const onPublic = PUBLIC_SEGMENTS.has(segments[0] ?? '');
    if (!session && !onPublic) {
      router.replace('/auth');
    } else if (session && onPublic) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.canvas }}>
        <ActivityIndicator color={Palette.brand} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AuthGate />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
