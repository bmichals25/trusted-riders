import { Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "@/lib/theme";
import { BackChevron } from "./BackChevron";
import { LocationIndicator } from "./LocationIndicator";

const BRAND_NAME = "TrustedRide Certified";

type Props = {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showLogo?: boolean;
  logoWidth?: number;
  showStatus?: boolean;
  backendConnected?: boolean;
  backendError?: string | null;
};

export function AppHeader({
  title,
  subtitle,
  showBack = false,
  showLogo = false,
  logoWidth = 164,
  showStatus = true,
  backendConnected = true,
  backendError,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        paddingTop: insets.top + 8,
        paddingBottom: title || subtitle ? spacing.sm : 12,
        paddingHorizontal: spacing.md,
        gap: title || subtitle ? 6 : 0,
      }}
    >
      <View
        style={{
          minHeight: 40,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        {showBack ? <BackChevron /> : null}
        {showLogo ? (
          <View
            accessibilityLabel={BRAND_NAME}
            accessible
            style={{ flexDirection: "row", alignItems: "center", flexShrink: 0 }}
          >
            <Image
              source={require("../../assets/trustedride_certified_main_logo_transparent.png")}
              contentFit="contain"
              style={{ width: logoWidth, height: Math.round(logoWidth / 3.3), flexShrink: 0 }}
            />
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }} />
        {showStatus ? (
          <LocationIndicator backendConnected={backendConnected} backendError={backendError} />
        ) : null}
      </View>

      {title || subtitle ? (
        <View style={{ paddingLeft: showBack ? 36 : 0, minWidth: 0 }}>
          {subtitle ? (
            <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" }}>
              {subtitle}
            </Text>
          ) : null}
          {title ? (
            <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "900", lineHeight: 27 }} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
