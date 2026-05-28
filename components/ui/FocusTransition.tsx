import { useEffect } from "react";
import { View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type Props = {
  children: React.ReactNode;
  distance?: number;
  enterDuration?: number;
  exitDuration?: number;
  style?: any;
};

export function FocusTransition({
  children,
  distance = 10,
  enterDuration = 320,
  exitDuration = 210,
  style,
}: Props) {
  const isFocused = useIsFocused();
  const reduced = useReducedMotion();
  const progress = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      progress.value = isFocused ? 1 : 0;
      return;
    }

    progress.value = withTiming(isFocused ? 1 : 0, {
      duration: isFocused ? enterDuration : exitDuration,
      easing: isFocused
        ? Easing.bezier(0.25, 1, 0.5, 1)
        : Easing.bezier(0.4, 0, 1, 1),
    });
  }, [enterDuration, exitDuration, isFocused, progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.94 + progress.value * 0.06,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  if (reduced) {
    return <View style={style}>{children}</View>;
  }

  return <Animated.View style={[{ flex: 1 }, style, animatedStyle]}>{children}</Animated.View>;
}
