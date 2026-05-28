import { Image, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "@/lib/theme";
import { BackChevron } from "./BackChevron";
import { LocationIndicator } from "./LocationIndicator";

const BRAND_NAME = "TrustedRIde Certified";

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
            style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 }}
          >
            <Image
              source={require("../../assets/TR_favicon.png")}
              resizeMode="contain"
              style={{ width: 34, height: 34, flexShrink: 0 }}
            />
            <Text
              numberOfLines={2}
              style={{
                width: logoWidth,
                color: colors.primary,
                fontSize: 17,
                lineHeight: 19,
                fontWeight: "900",
              }}
            >
              {BRAND_NAME}
            </Text>
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
