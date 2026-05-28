import { useEffect, useMemo, useState } from "react";
import { Image, View, useWindowDimensions } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocationIndicator } from "@/components/ui/LocationIndicator";
import { colors, spacing } from "@/lib/theme";

const LOGO_SOURCE = require("../../assets/TR_logo.png");
const LOGO_URI = Image.resolveAssetSource(LOGO_SOURCE).uri;

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
    const maxWidth = compact ? Math.min(width - spacing.md * 2 - 104, 216) : 216;
    return {
      width: maxWidth,
      height: Math.round(maxWidth * 0.24),
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
        <Image
          key={`home-logo-${logoRevision}`}
          source={{ uri: LOGO_URI }}
          accessibilityLabel="TrustedRiders"
          resizeMode="contain"
          style={{ width: logoSize.width, height: logoSize.height, minHeight: 44, flexShrink: 0 }}
        />
        <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
          <LocationIndicator backendConnected={backendConnected} backendError={backendError} compact={compact} />
        </View>
      </View>
    </View>
  );
}
