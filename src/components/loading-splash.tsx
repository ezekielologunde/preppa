import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { BRAND, PreppaLogo } from './preppa-logo';

const TRACK_WIDTH = 120;
const BAR_WIDTH = 46;

/**
 * Latency / boot loading screen — white backdrop, glowing flame mark, and an
 * indeterminate loading bar. Shown while the app warms up.
 */
export function LoadingSplash() {
  const x = useSharedValue(-BAR_WIDTH);

  useEffect(() => {
    x.value = withRepeat(
      withTiming(TRACK_WIDTH, { duration: 1050, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [x]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <Animated.View exiting={FadeOut.duration(380)} style={styles.container}>
      <PreppaLogo size={92} glow />
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
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 30,
    zIndex: 2000,
  },
  track: {
    width: TRACK_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#EFEFF2',
    overflow: 'hidden',
  },
  bar: {
    width: BAR_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: BRAND.orange,
  },
});
