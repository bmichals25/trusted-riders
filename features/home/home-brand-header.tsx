import { useEffect, useMemo, useState } from "react";
import { Image, Text, View, useWindowDimensions } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocationIndicator } from "@/components/ui/LocationIndicator";
import { colors, spacing } from "@/lib/theme";

const BRAND_NAME = "TrustedRIde Certified";
const EMBLEM_SOURCE = require("../../assets/TR_favicon.png");
const EMBLEM_URI = Image.resolveAssetSource(EMBLEM_SOURCE).uri;

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

  const brandSizing = useMemo(() => {
    const availableWidth = compact ? width - spacing.md * 2 - 104 : 280;
    return {
      emblemSize: compact ? 42 : 48,
      nameWidth: Math.max(168, Math.min(availableWidth - 52, compact ? 220 : 280)),
      fontSize: compact ? 21 : 24,
      lineHeight: compact ? 24 : 27,
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
            minHeight: 54,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          <Image
            key={`home-logo-${logoRevision}`}
            source={{ uri: EMBLEM_URI }}
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            style={{
              width: brandSizing.emblemSize,
              height: brandSizing.emblemSize,
              flexShrink: 0,
            }}
          />
          <Text
            numberOfLines={2}
            style={{
              width: brandSizing.nameWidth,
              color: colors.primary,
              fontSize: brandSizing.fontSize,
              lineHeight: brandSizing.lineHeight,
              fontWeight: "900",
              letterSpacing: 0,
            }}
          >
            {BRAND_NAME}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
          <LocationIndicator backendConnected={backendConnected} backendError={backendError} compact={compact} />
        </View>
      </View>
    </View>
  );
}
