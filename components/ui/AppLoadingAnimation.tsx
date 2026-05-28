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
const LOADING_VIDEO_DURATION_MS = 4010;
const PRE_END_HANDOFF_MS = 120;
const SEAMLESS_HANDOFF_MS = LOADING_VIDEO_DURATION_MS - PRE_END_HANDOFF_MS;
const PLAYBACK_FALLBACK_MS = 6500;

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
    const endSubscription = player.addListener("playToEnd", markReady);
    player.play();

    const seamlessHandoffTimer = setTimeout(() => {
      markReady();
    }, SEAMLESS_HANDOFF_MS);
    const readyFallbackTimer = setTimeout(() => {
      markReady();
    }, PLAYBACK_FALLBACK_MS);

    return () => {
      endSubscription.remove();
      clearTimeout(seamlessHandoffTimer);
      clearTimeout(readyFallbackTimer);
    };
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
      duration: 180,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
    rootOpacity.value = withTiming(0, {
      duration: 260,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });

    const completeTimer = setTimeout(() => {
      onExitComplete?.();
    }, 280);

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
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceLow,
    overflow: "hidden",
  },
});
