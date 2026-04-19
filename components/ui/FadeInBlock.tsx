import { useEffect } from "react";
import { View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

type Props = {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  exitDuration?: number;
  style?: any;
};

/**
 * Staggered entrance + exit wrapper.
 *
 * Entry: fade in and translate up on mount (staggered via `delay`).
 * Exit: when the screen loses focus (the Stack is transitioning away), fade
 * out and translate slightly up. React Navigation's `useIsFocused` fires on
 * both iOS and web, which reanimated's layout-animation `exiting` prop does
 * not — so driving exit through a shared value keeps behavior consistent.
 *
 * Tuning per "Vigilant Command Center" aesthetic:
 *   enter = ease-out-quart (decisive deceleration)
 *   exit  = ease-in (~52% of entry duration — leaving feels decisive, not laggy)
 *
 * Respects `prefers-reduced-motion`.
 */
export function FadeInBlock({
  children,
  delay = 0,
  distance = 14,
  duration = 420,
  exitDuration = 220,
  style,
}: Props) {
  const progress = useSharedValue(0);
  const reduced = useReducedMotion();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (reduced) {
      progress.value = isFocused ? 1 : 0;
      return;
    }
    if (isFocused) {
      progress.value = withDelay(
        delay,
        withTiming(1, {
          duration,
          easing: Easing.bezier(0.25, 1, 0.5, 1),
        }),
      );
    } else {
      // Screen is being transitioned away — collapse back to hidden state.
      progress.value = withTiming(0, {
        duration: exitDuration,
        easing: Easing.bezier(0.4, 0, 1, 1),
      });
    }
  }, [isFocused, delay, duration, exitDuration, progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  if (reduced) {
    return <View style={style}>{children}</View>;
  }

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
