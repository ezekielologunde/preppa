import { MotiView } from 'moti';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BRAND, PreppaLogo } from './preppa-logo';

const TRACK_WIDTH = 100;
const BAR_WIDTH = 36;

export function LoadingSplash() {
  const x = useSharedValue(-BAR_WIDTH);
  const ringScale = useSharedValue(0.92);

  useEffect(() => {
    x.value = withRepeat(
      withTiming(TRACK_WIDTH, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    ringScale.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.94, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [x, ringScale]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: ringScale.value }] }));

  return (
    <Animated.View exiting={FadeOut.duration(360)} style={styles.container}>
      <View style={styles.logoWrap}>
        <Animated.View style={[styles.ring, ringStyle]} />
        <MotiView
          from={{ scale: 0.92 }}
          animate={{ scale: 1.04 }}
          transition={{ type: 'timing', duration: 1100, loop: true, repeatReverse: true }}>
          <PreppaLogo size={92} glow />
        </MotiView>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.bar, barStyle]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#0b0604',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
    zIndex: 2000,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 1.5,
    borderColor: 'rgba(232,97,26,0.35)',
  },
  track: {
    width: TRACK_WIDTH,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  bar: {
    width: BAR_WIDTH,
    height: 3,
    borderRadius: 2,
    backgroundColor: BRAND.orange,
  },
});
