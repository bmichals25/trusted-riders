import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, View, useWindowDimensions } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocationIndicator } from "@/components/ui/LocationIndicator";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { colors, radii, spacing } from "@/lib/theme";

const BRAND_NAME = "TrustedRide Certified";
const LOGO_SOURCE = require("../../assets/trustedride_certified_main_logo_transparent.png");
const LOGO_URI = Image.resolveAssetSource(LOGO_SOURCE).uri;
const LOGO_ASPECT_RATIO = 1409 / 427;
const HEADER_ACTIONS_RESERVED_WIDTH = 128;
const LOGO_OPTICAL_OFFSET_X = -12;

export function HomeBrandHeader({
  backendConnected,
  backendError,
}: {
  backendConnected: boolean;
  backendError: string | null;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { impact } = useHaptics();
  const isFocused = useIsFocused();
  const [logoRevision, setLogoRevision] = useState(0);
  const compact = width < 430;

  useEffect(() => {
    if (isFocused) setLogoRevision((current) => current + 1);
  }, [isFocused]);

  const logoSize = useMemo(() => {
    const centeredAvailableWidth = width - spacing.md * 2 - HEADER_ACTIONS_RESERVED_WIDTH * 2;
    const logoWidth = Math.max(210, Math.min(centeredAvailableWidth, compact ? 240 : 304));

    return {
      width: logoWidth,
      height: Math.round(logoWidth / LOGO_ASPECT_RATIO),
    };
  }, [compact, width]);

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: spacing.md,
      }}
    >
      <View
        style={{
          minHeight: compact ? 72 : 82,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          accessibilityLabel={BRAND_NAME}
          accessible
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            key={`home-logo-${logoRevision}`}
            source={{ uri: LOGO_URI }}
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            style={{
              width: logoSize.width,
              height: logoSize.height,
              flexShrink: 0,
              transform: [{ translateX: LOGO_OPTICAL_OFFSET_X }],
            }}
          />
        </View>
        <View
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: "flex-end",
            justifyContent: "center",
            flexDirection: "row",
            gap: spacing.sm,
          }}
        >
          <LocationIndicator backendConnected={backendConnected} backendError={backendError} compact={compact} />
          <DispatchChatButton
            onPress={() => {
              impact(ImpactFeedbackStyle.Light);
              router.push("/chat");
            }}
          />
        </View>
      </View>
    </View>
  );
}

function DispatchChatButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open dispatch messages"
      hitSlop={8}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: radii.pill,
        backgroundColor: pressed ? colors.surfaceHigh : colors.surfaceLow,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <MessageGlyph />
    </Pressable>
  );
}

function MessageGlyph() {
  return (
    <View
      style={{
        width: 18,
        height: 15,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: colors.blue,
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 3,
          bottom: -5,
          width: 8,
          height: 8,
          borderLeftWidth: 2,
          borderBottomWidth: 2,
          borderColor: colors.blue,
          backgroundColor: colors.surfaceLow,
          transform: [{ rotate: "-35deg" }],
        }}
      />
    </View>
  );
}
