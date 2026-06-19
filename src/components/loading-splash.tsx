import { MotiView } from 'moti';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Palette } from '@/constants/theme';
import { BRAND, PreppaLogo } from './preppa-logo';

const TRACK_WIDTH = 120;
const BAR_WIDTH = 44;

export function LoadingSplash() {
  const x = useSharedValue(-BAR_WIDTH);
  const logoScale = useSharedValue(0);

  useEffect(() => {
    // Spring scale-in for the wordmark
    logoScale.value = withSpring(1, { damping: 20, stiffness: 260 });

    // Sliding progress bar
    x.value = withRepeat(
      withTiming(TRACK_WIDTH, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [x, logoScale]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: logoScale.value }] }));

  return (
    <Animated.View exiting={FadeOut.duration(300)} style={styles.container}>
      {/* Logo with spring entrance */}
      <Animated.View style={logoStyle}>
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 200 }}>
          <PreppaLogo size={80} glow={false} />
        </MotiView>
      </Animated.View>

      {/* Progress bar */}
      <View style={styles.track}>
        <Animated.View style={[styles.bar, barStyle]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Palette.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    zIndex: 2000,
  },
  track: {
    width: TRACK_WIDTH,
    height: 3,
    borderRadius: 2,
    backgroundColor: Palette.border,
    overflow: 'hidden',
  },
  bar: {
    width: BAR_WIDTH,
    height: 3,
    borderRadius: 2,
    backgroundColor: BRAND.orange,
  },
});
