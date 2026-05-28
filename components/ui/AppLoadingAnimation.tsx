import { useEffect } from "react";
import { Image, StyleSheet, type StyleProp, View, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { VideoView, useVideoPlayer } from "expo-video";

import { colors, spacing } from "@/lib/theme";

const LOADING_VIDEO = require("../../assets/trustedride-loading-animation.mp4");
const LOGO = require("../../assets/trustedride_certified_main_logo_transparent.png");

export function AppLoadingAnimation({
  onReady,
  style,
}: {
  onReady?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReducedMotion();
  const player = useVideoPlayer(LOADING_VIDEO, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.allowsExternalPlayback = false;
    videoPlayer.keepScreenOnWhilePlaying = false;
  });

  useEffect(() => {
    if (reducedMotion) {
      player.pause();
      player.currentTime = 0;
      onReady?.();
      return;
    }

    player.play();
  }, [onReady, player, reducedMotion]);

  return (
    <View style={[s.screen, style]}>
      {reducedMotion ? (
        <View style={s.reducedMotionFallback}>
          <Image source={LOGO} resizeMode="contain" style={s.logo} />
        </View>
      ) : (
        <VideoView
          player={player}
          nativeControls={false}
          contentFit="cover"
          allowsPictureInPicture={false}
          onFirstFrameRender={onReady}
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceLow,
    overflow: "hidden",
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
