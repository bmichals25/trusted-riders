import { useEffect } from "react";
import { Platform } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/**
 * Screen-level transition wrapper. On native, `react-native-screens` already
 * handles slide/fade transitions via the Stack's `animation` option, so this
 * is a no-op. On web, where native-stack does not animate screen exits, this
 * drives a manual fade + subtle translate on focus loss so navigating away
 * from a screen feels intentional instead of abrupt.
 *
 * Entry is a quick ease-out fade-in; exit is a slightly shorter ease-in
 * fade-out paired with a small rightward translate (~24px). The Stack's
 * underlying swap still happens, but the screen visibly eases itself off
 * instead of disappearing.
 *
 * Respects `prefers-reduced-motion`.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const isFocused = useIsFocused();
  const progress = useSharedValue(1);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (reduced) {
      progress.value = isFocused ? 1 : 0;
      return;
    }
    if (isFocused) {
      progress.value = withTiming(1, {
        duration: 320,
        easing: Easing.bezier(0.25, 1, 0.5, 1),
      });
    } else {
      progress.value = withTiming(0, {
        duration: 260,
        easing: Easing.bezier(0.4, 0, 1, 1),
      });
    }
  }, [isFocused, progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: (1 - progress.value) * 24 }],
  }));

  // Native: native-stack already handles screen transitions — render plainly.
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle]}>{children}</Animated.View>
  );
}
