import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";

import { colors } from "@/lib/theme";

const LOADING_VIDEO = require("../../assets/trustedride-loading-animation.mp4");
const LOADING_POSTER = require("../../assets/trustedride_certified_main_logo_transparent.png");
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
  const [videoFailed, setVideoFailed] = useState(false);
  const rootOpacity = useSharedValue(1);
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
    const statusSubscription = player.addListener("statusChange", ({ status }) => {
      if (status !== "error") return;
      // In release builds a freshly created player can fail to attach the
      // bundled asset (notably on the Settings "Reload App" remount). Drop the
      // VideoView so the native broken-media glyph never shows, fall back to the
      // branded poster, and reveal the app immediately instead of waiting out
      // the playback timeout.
      setVideoFailed(true);
      markReady();
    });
    player.play();

    const seamlessHandoffTimer = setTimeout(() => {
      markReady();
    }, SEAMLESS_HANDOFF_MS);
    const readyFallbackTimer = setTimeout(() => {
      markReady();
    }, PLAYBACK_FALLBACK_MS);

    return () => {
      endSubscription.remove();
      statusSubscription.remove();
      clearTimeout(seamlessHandoffTimer);
      clearTimeout(readyFallbackTimer);
    };
  }, [markReady, player]);

  useEffect(() => {
    if (!exiting) {
      rootOpacity.value = 1;
      return;
    }

    if (reducedMotion) {
      rootOpacity.value = 0;
      onExitComplete?.();
      return;
    }

    rootOpacity.value = withTiming(0, {
      duration: 260,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });

    const completeTimer = setTimeout(() => {
      onExitComplete?.();
    }, 280);

    return () => clearTimeout(completeTimer);
  }, [exiting, onExitComplete, reducedMotion, rootOpacity]);

  const rootAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rootOpacity.value,
  }));
  return (
    <Animated.View style={[s.screen, style, rootAnimatedStyle]}>
      {videoFailed ? (
        <View style={s.posterWrap} pointerEvents="none">
          <Image
            source={LOADING_POSTER}
            style={s.posterLogo}
            contentFit="contain"
            transition={0}
          />
        </View>
      ) : (
        <VideoView
          player={player}
          nativeControls={false}
          contentFit="cover"
          allowsPictureInPicture={false}
          style={StyleSheet.absoluteFill}
        />
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceLow,
    overflow: "hidden",
  },
  posterWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 48,
  },
  posterLogo: {
    width: "72%",
    aspectRatio: 1409 / 427,
  },
});
