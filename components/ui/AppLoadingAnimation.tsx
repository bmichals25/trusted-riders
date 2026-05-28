import { useCallback, useEffect, useRef } from "react";
import { Image, StyleSheet, type StyleProp, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { VideoView, useVideoPlayer } from "expo-video";

import { colors, spacing } from "@/lib/theme";

const LOADING_VIDEO = require("../../assets/trustedride-loading-animation.mp4");
const LOGO = require("../../assets/trustedride_certified_main_logo_transparent.png");

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
  const scrimOpacity = useSharedValue(0);
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
    if (reducedMotion) {
      player.pause();
      player.currentTime = 0;
      markReady();
      return;
    }

    player.play();

    const readyFallbackTimer = setTimeout(() => {
      markReady();
    }, 900);

    return () => clearTimeout(readyFallbackTimer);
  }, [markReady, player, reducedMotion]);

  useEffect(() => {
    if (!exiting) {
      rootOpacity.value = 1;
      videoOpacity.value = 1;
      scrimOpacity.value = 0;
      return;
    }

    if (reducedMotion) {
      rootOpacity.value = 0;
      onExitComplete?.();
      return;
    }

    scrimOpacity.value = withTiming(1, {
      duration: 140,
      easing: Easing.bezier(0.25, 1, 0.5, 1),
    });
    videoOpacity.value = withTiming(0, {
      duration: 180,
      easing: Easing.bezier(0.4, 0, 1, 1),
    });
    rootOpacity.value = withDelay(
      120,
      withTiming(0, {
        duration: 220,
        easing: Easing.bezier(0.4, 0, 1, 1),
      }),
    );

    const completeTimer = setTimeout(() => {
      onExitComplete?.();
    }, 360);

    return () => clearTimeout(completeTimer);
  }, [exiting, onExitComplete, reducedMotion, rootOpacity, scrimOpacity, videoOpacity]);

  const rootAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rootOpacity.value,
  }));
  const videoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: videoOpacity.value,
  }));
  const scrimAnimatedStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  return (
    <Animated.View style={[s.screen, style, rootAnimatedStyle]}>
      {reducedMotion ? (
        <View style={s.reducedMotionFallback}>
          <Image source={LOGO} resizeMode="contain" style={s.logo} />
        </View>
      ) : (
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
      )}
      <Animated.View pointerEvents="none" style={[s.exitScrim, scrimAnimatedStyle]} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  exitScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface,
  },
  reducedMotionFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  logo: {
    width: "82%",
    maxWidth: 360,
    height: 120,
  },
});
