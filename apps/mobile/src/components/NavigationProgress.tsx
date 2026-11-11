import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import {
  beginNavigationLoading,
  isNavigationLoading,
  subscribeNavigationLoading,
} from '../api/navigation-loading';
import { colors } from '../theme';

function useNavigationLoadingVisible() {
  return useSyncExternalStore(subscribeNavigationLoading, isNavigationLoading, () => false);
}

/** Watches Expo Router pathname and kicks the nav loader on each change. */
export function NavigationLoadingWatcher() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const skipFirst = useRef(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    // Skip the boot path so the auth splash isn't double-loaded with a progress bar.
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    // Soft: keep counts if a tab/More press already opened the transition.
    beginNavigationLoading({ restart: false });
  }, [pathname, mounted]);

  return null;
}

/** Slim top progress bar for tab/More navigation + destination API loading. */
export function NavigationProgressBar() {
  const loading = useNavigationLoadingVisible();
  const slide = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (loading) {
      opacity.setValue(1);
      slide.setValue(0);
      loopRef.current = Animated.loop(
        Animated.timing(slide, {
          toValue: 1,
          duration: 1050,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      );
      loopRef.current.start();
      return () => {
        loopRef.current?.stop();
        loopRef.current = null;
      };
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
    loopRef.current?.stop();
    loopRef.current = null;
    return undefined;
  }, [loading, opacity, slide]);

  const translateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 320],
  });

  return (
    <View
      pointerEvents="none"
      style={styles.track}
      accessibilityElementsHidden={!loading}
      importantForAccessibility={loading ? 'yes' : 'no-hide-descendants'}
    >
      <Animated.View
        style={[
          styles.bar,
          {
            opacity,
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    zIndex: 50,
    overflow: 'hidden',
  },
  bar: {
    width: '45%',
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
});
