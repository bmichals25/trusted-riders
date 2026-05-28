import { useEffect, type ReactNode } from "react";
import { View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

export function ChatOpeningBlock({
  children,
  delay,
  distance,
  style,
}: {
  children: ReactNode;
  delay: number;
  distance: number;
  style?: any;
}) {
  const isFocused = useIsFocused();
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    cancelAnimation(progress);

    if (reduced) {
      progress.value = 1;
      return;
    }

    if (isFocused) {
      progress.value = 0;
      progress.value = withDelay(
        delay,
        withTiming(1, {
          duration: 340,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        }),
      );
    }
  }, [delay, isFocused, progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  if (reduced) return <View style={style}>{children}</View>;

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
