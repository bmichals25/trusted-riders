import { useEffect } from "react";
import { View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type Props = {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  exitDelay?: number;
  exitDuration?: number;
  exitOnBlur?: boolean;
  replayOnFocus?: boolean;
  replayKey?: string | number | boolean;
  ready?: boolean;
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
  exitDelay = 0,
  exitDuration = 220,
  exitOnBlur = true,
  replayOnFocus = false,
  replayKey,
  ready = true,
  style,
}: Props) {
  const progress = useSharedValue(0);
  const reduced = useReducedMotion();
  const isFocused = useIsFocused();

  useEffect(() => {
    cancelAnimation(progress);

    if (!ready) {
      progress.value = 0;
      return;
    }

    const show = isFocused || !exitOnBlur;

    if (reduced) {
      progress.value = show ? 1 : 0;
      return;
    }

    if (show) {
      if (isFocused && replayOnFocus) {
        progress.value = 0;
      }

      // Drive the stagger delay on the JS thread rather than via withDelay().
      // Release (Hermes) builds were failing to advance withDelay()'d
      // UI-thread timing animations, which stranded every delayed section at
      // opacity 0 behind the un-delayed (delay=0) header — i.e. a home screen
      // with a visible header and a completely blank body. A JS setTimeout
      // that kicks off a plain withTiming behaves identically in dev and
      // production builds.
      const enterTimer = setTimeout(() => {
        progress.value = withTiming(1, {
          duration,
          easing: Easing.bezier(0.25, 1, 0.5, 1),
        });
      }, delay);

      // Safety net: an entrance animation must never be able to permanently
      // hide content. If the timing animation hasn't landed by the time it
      // should have finished, snap the block fully visible.
      const guaranteeTimer = setTimeout(() => {
        progress.value = 1;
      }, delay + duration + 150);

      return () => {
        clearTimeout(enterTimer);
        clearTimeout(guaranteeTimer);
      };
    }

    // Screen is being transitioned away — collapse back to hidden state.
    const exitTimer = setTimeout(() => {
      progress.value = withTiming(0, {
        duration: exitDuration,
        easing: Easing.bezier(0.4, 0, 1, 1),
      });
    }, exitDelay);

    return () => clearTimeout(exitTimer);
  }, [isFocused, delay, duration, exitDelay, exitDuration, exitOnBlur, progress, ready, reduced, replayOnFocus, replayKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  if (reduced) {
    return <View style={style}>{children}</View>;
  }

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
