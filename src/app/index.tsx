import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, StatusBar, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame } from 'lucide-react-native';

import { useAuth } from '@/providers/auth-provider';
import { Font } from '@/constants/fonts';
import { Palette, Space, Type, Gradients } from '@/constants/theme';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const { session, loading } = useAuth();

  // Animation values
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);

  // Logo animation trigger
  useEffect(() => {
    scale.value = withSpring(1, { stiffness: 100, damping: 10 });
    opacity.value = withSpring(1, { stiffness: 100, damping: 10 });

    // Staggered text reveal
    const textTimer = setTimeout(() => {
      textOpacity.value = withSpring(1, { stiffness: 80, damping: 12 });
      textTranslateY.value = withSpring(0, { stiffness: 80, damping: 12 });
    }, 200);

    return () => clearTimeout(textTimer);
  }, [opacity, scale, textOpacity, textTranslateY]);

  // Session-based transition logic
  useEffect(() => {
    if (loading) return;

    if (session) {
      // User is logged in, transition to App (tabs) immediately
      router.replace('/(tabs)');
    } else {
      // User is not logged in, show splash for 2.5 seconds, then transition to Auth view
      const timer = setTimeout(() => {
        router.replace('/auth');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [session, loading, router]);

  // Animated styles
  const animatedLogoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Decorative background glow */}
      <View style={styles.glowContainer}>
        <View style={styles.ambientGlow} />
      </View>

      <View style={styles.content}>
        {/* Animated logo mark */}
        <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
          <LinearGradient
            colors={Gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoGradient}
          >
            <Flame size={44} color={Palette.surface} style={styles.logoIcon} />
          </LinearGradient>
        </Animated.View>

        {/* Animated brand type */}
        <Animated.View style={[styles.textContainer, animatedTextStyle]}>
          <Text style={styles.title}>Preppa</Text>
          <Text style={styles.subtitle}>Meal Prep, Simplified.</Text>
        </Animated.View>
      </View>

      {/* Subtle loader showing it's checking session/loading */}
      <View style={styles.footer}>
        {loading ? (
          <ActivityIndicator size="small" color={Palette.brand} style={styles.loader} />
        ) : (
          <View style={styles.pulseContainer}>
            <View style={styles.pulseDot} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ambientGlow: {
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: (width * 0.8) / 2,
    backgroundColor: Palette.brandLight,
    opacity: 0.1,
    filter: 'blur(60px)', // Web platform styling
    // Android/iOS ambient shadow wrapper
    shadowColor: Palette.brandLight,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 100,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  logoContainer: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: Palette.surface,
    padding: Space.xs,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    marginBottom: Space.xl,
  },
  logoGradient: {
    flex: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: {
    // Add subtle shadow to icon inside gradient
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontFamily: Font.display,
    fontSize: Type.displayXl,
    color: Palette.ink,
    letterSpacing: -0.5,
    marginBottom: Space.xs,
  },
  subtitle: {
    fontFamily: Font.body,
    fontSize: Type.body,
    color: Palette.textSecondary,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
  },
  loader: {
    transform: [{ scale: 0.85 }],
  },
  pulseContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Palette.brandLight,
    opacity: 0.6,
  },
});
