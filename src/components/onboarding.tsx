import { BlurView } from 'expo-blur';
import { feedback } from '@/lib/feedback';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, FeColorMatrix, FeTurbulence, Filter, Rect } from 'react-native-svg';

import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { PreppaLogo } from './preppa-logo';

const ACID = '#d8ff3e';
const SEG =
  'Nigerian · Jamaican · Halal · Plant-Based · Keto · Ethiopian · Thai · Mexican · High Protein · Home-cooked · Real Food · ';

type Props = { onGetStarted: () => void; onSignIn?: () => void };

const FONT = {
  display: 'Bricolage-ExtraBold',
  bold: 'Bricolage-Bold',
  body: 'Jakarta-Medium',
  logo: Font.logo,
};

// ─── Film grain ───────────────────────────────────────────────────────────────

function FilmGrain() {
  return (
    <Svg style={StyleSheet.absoluteFill as object} pointerEvents="none">
      <Defs>
        <Filter id="grain">
          <FeTurbulence type="fractalNoise" baseFrequency={0.65} numOctaves={3} stitchTiles="stitch" />
          <FeColorMatrix type="saturate" values="0" />
        </Filter>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" filter="url(#grain)" opacity={0.06} />
    </Svg>
  );
}

// ─── Acid ping dot ────────────────────────────────────────────────────────────

function PingDot() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    scale.value = withRepeat(withTiming(2.4, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
    opacity.value = withRepeat(withTiming(0, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
  }, [scale, opacity]);

  const ripple = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: ACID }, ripple]} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ACID }} />
    </View>
  );
}

// ─── Marquee ticker ───────────────────────────────────────────────────────────

function Marquee() {
  const tx = useSharedValue(0);
  const [segWidth, setSegWidth] = useState(0);

  useEffect(() => {
    if (segWidth === 0) return;
    tx.value = withRepeat(
      withTiming(-segWidth, { duration: segWidth * 13, easing: Easing.linear }),
      -1,
      false,
    );
  }, [segWidth, tx]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));

  return (
    <View style={{ overflow: 'hidden', width: '100%' }}>
      <Animated.View style={[{ flexDirection: 'row' }, style]}>
        <Text
          onLayout={(e) => setSegWidth(e.nativeEvent.layout.width)}
          style={{ fontFamily: FONT.body, fontSize: 12.5, color: 'rgba(255,255,255,0.42)', letterSpacing: 0.3 }}>
          {SEG}
        </Text>
        <Text style={{ fontFamily: FONT.body, fontSize: 12.5, color: 'rgba(255,255,255,0.42)', letterSpacing: 0.3 }}>
          {SEG}
        </Text>
      </Animated.View>
    </View>
  );
}

// ─── Background orb ───────────────────────────────────────────────────────────

function Orb({ size, color, left, top, delay = 0, drift = 28 }: {
  size: number; color: string; left: number; top: number; delay?: number; drift?: number;
}) {
  return (
    <MotiView
      from={{ translateY: -drift, translateX: -drift / 2, opacity: 0.9 }}
      animate={{ translateY: drift, translateX: drift / 2, opacity: 1 }}
      transition={{ type: 'timing', duration: 5200, loop: true, repeatReverse: true, delay }}
      pointerEvents="none"
      style={{
        position: 'absolute', left, top, width: size, height: size, borderRadius: size / 2,
        experimental_backgroundImage: `radial-gradient(circle, ${color}, transparent 70%)`,
      }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Onboarding({ onGetStarted, onSignIn }: Props) {
  function handleStart() {
    feedback.impact();
    onGetStarted();
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#FF9A3C', Palette.brand, '#D9430F', '#B5260A']}
        locations={[0, 0.4, 0.74, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <FilmGrain />
      <Orb size={360} color="rgba(255,205,90,0.55)" left={-90} top={-40} delay={0} />
      <Orb size={300} color="rgba(255,77,125,0.5)" left={210} top={120} delay={700} drift={36} />
      <Orb size={260} color="rgba(255,150,60,0.5)" left={-40} top={520} delay={1200} drift={22} />

      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <MotiView
            from={{ opacity: 0, translateY: 24, scale: 0.9 }}
            animate={{ opacity: 1, translateY: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 14, stiffness: 130, delay: 120 }}
            style={styles.brandBlock}>
            <PreppaLogo size={110} tileColor="rgba(255,255,255,0.16)" />
            <Text style={styles.wordmark}>preppa</Text>
            <Text style={styles.tagline}>Real food from real local Preppas near you.</Text>
          </MotiView>
        </View>

        <MotiView
          from={{ opacity: 0, translateY: 28 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 16, stiffness: 120, delay: 320 }}
          style={styles.actions}>
          <Marquee />

          <BlurView intensity={24} tint="light" style={styles.pill}>
            <PingDot />
            <Text style={styles.pillText}>Chefs live in your city</Text>
          </BlurView>

          <Pressable
            onPress={handleStart}
            accessibilityRole="button"
            accessibilityLabel="Get Started — It's Free"
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
            <Text style={styles.ctaText}>Get Started — It&apos;s Free</Text>
          </Pressable>

          <Pressable onPress={onSignIn} accessibilityRole="button" accessibilityLabel="Sign in to your account" hitSlop={10}>
            {({ pressed }) => (
              <Text style={[styles.signin, pressed && { opacity: 0.6 }]}>
                Already a member? <Text style={styles.signinBold}>Sign in →</Text>
              </Text>
            )}
          </Pressable>
        </MotiView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1500, overflow: 'hidden' },
  safe: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 28, paddingTop: 24, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brandBlock: { alignItems: 'center', gap: 18 },
  wordmark: { fontFamily: FONT.logo, fontSize: 58, color: '#fff', letterSpacing: -1.5, marginTop: 4 },
  tagline: { fontFamily: FONT.body, fontSize: 19, lineHeight: 27, color: 'rgba(255,255,255,0.92)', textAlign: 'center', maxWidth: 290 },
  actions: { width: '100%', alignItems: 'center', gap: 18 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: Radius.pill, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  pillText: { fontFamily: FONT.body, color: '#fff', fontSize: 14 },
  cta: {
    width: '100%', alignItems: 'center', backgroundColor: Palette.surface,
    borderRadius: 18, paddingVertical: 17,
    shadowColor: '#7a2200', shadowOpacity: 0.3, shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  ctaPressed: { transform: [{ scale: 0.97 }], opacity: 0.95 },
  ctaText: { fontFamily: FONT.bold, fontSize: 18, color: '#D9430F' },
  signin: { fontFamily: FONT.body, color: 'rgba(255,255,255,0.9)', fontSize: 15 },
  signinBold: { fontFamily: FONT.bold, color: '#fff', textDecorationLine: 'underline' },
});
