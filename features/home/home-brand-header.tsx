import { useEffect, useMemo, useState } from "react";
import { Image, View, useWindowDimensions } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocationIndicator } from "@/components/ui/LocationIndicator";
import { colors, spacing } from "@/lib/theme";

const BRAND_NAME = "TrustedRide Certified";
const LOGO_SOURCE = require("../../assets/trustedride_certified_main_logo_transparent.png");
const LOGO_URI = Image.resolveAssetSource(LOGO_SOURCE).uri;
const LOGO_ASPECT_RATIO = 1409 / 427;

export function HomeBrandHeader({
  backendConnected,
  backendError,
}: {
  backendConnected: boolean;
  backendError: string | null;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isFocused = useIsFocused();
  const [logoRevision, setLogoRevision] = useState(0);
  const compact = width < 430;

  useEffect(() => {
    if (isFocused) setLogoRevision((current) => current + 1);
  }, [isFocused]);

  const logoSize = useMemo(() => {
    const availableWidth = compact ? width - spacing.md * 2 - 96 : 304;
    const logoWidth = Math.max(210, Math.min(availableWidth, compact ? 252 : 304));

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
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <View
          accessibilityLabel={BRAND_NAME}
          accessible
          style={{
            minHeight: compact ? 72 : 82,
            flexDirection: "row",
            alignItems: "center",
            flexShrink: 1,
            minWidth: 0,
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
            }}
          />
        </View>
        <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
          <LocationIndicator backendConnected={backendConnected} backendError={backendError} compact={compact} />
        </View>
      </View>
    </View>
  );
}
