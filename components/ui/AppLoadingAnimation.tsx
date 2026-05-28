import { useCallback, useEffect, useRef } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { VideoView, useVideoPlayer } from "expo-video";

import { colors } from "@/lib/theme";

const LOADING_VIDEO = require("../../assets/trustedride-loading-animation.mp4");

export function AppLoadingAnimation({
  exiting = false,
  onExitComplete,
  onReady,
  style,
}: {
  exiting?: boolean;
  onExitComplete?: () => void;
  onReady?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReducedMotion();
  const readyCalledRef = useRef(false);
  const rootOpacity = useSharedValue(1);
  const videoOpacity = useSharedValue(1);
  const player = useVideoPlayer(LOADING_VIDEO, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = true;
    videoPlayer.allowsExternalPlayback = false;
    videoPlayer.keepScreenOnWhilePlaying = false;
  });

  const markReady = useCallback(() => {
    if (readyCalledRef.current) return;
    readyCalledRef.current = true;
    onReady?.();
  }, [onReady]);

  useEffect(() => {
    player.play();

    const readyFallbackTimer = setTimeout(() => {
      markReady();
    }, 1200);

    return () => clearTimeout(readyFallbackTimer);
  }, [markReady, player]);

  useEffect(() => {
    if (!exiting) {
      rootOpacity.value = 1;
      videoOpacity.value = 1;
      return;
    }

    if (reducedMotion) {
      rootOpacity.value = 0;
      onExitComplete?.();
      return;
    }

    videoOpacity.value = withTiming(0, {
      duration: 120,
      easing: Easing.bezier(0.4, 0, 1, 1),
    });
    rootOpacity.value = withTiming(0, {
      duration: 220,
      easing: Easing.bezier(0.4, 0, 1, 1),
    });

    const completeTimer = setTimeout(() => {
      onExitComplete?.();
    }, 240);

    return () => clearTimeout(completeTimer);
  }, [exiting, onExitComplete, reducedMotion, rootOpacity, videoOpacity]);

  const rootAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rootOpacity.value,
  }));
  const videoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: videoOpacity.value,
  }));
  return (
    <Animated.View style={[s.screen, style, rootAnimatedStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, videoAnimatedStyle]}>
        <VideoView
          player={player}
          nativeControls={false}
          contentFit="cover"
          allowsPictureInPicture={false}
          onFirstFrameRender={markReady}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
});
