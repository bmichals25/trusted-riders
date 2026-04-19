import { Linking, Platform, Pressable, Text, View } from "react-native";

import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { useLocation } from "@/lib/location-context";
import { colors, radii, spacing } from "@/lib/theme";

export function LocationPermissionBanner() {
  const { permissionStatus, requestPermission } = useLocation();
  const { impact } = useHaptics();

  // Only show when permission has been explicitly denied
  if (permissionStatus !== "denied") return null;

  return (
    <View
      style={{
        marginHorizontal: spacing.md,
        marginTop: spacing.sm,
        backgroundColor: "rgba(220, 38, 38, 0.06)",
        borderRadius: radii.md,
        borderCurve: "continuous",
        padding: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{
            color: colors.error,
            fontSize: 11,
            fontWeight: "900",
            textTransform: "uppercase",
            letterSpacing: 1.3,
          }}
        >
          Location Disabled
        </Text>
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "600", lineHeight: 18 }}>
          Enable location to see your position on the map and navigate to pickups.
        </Text>
      </View>
      <Pressable
        onPress={async () => {
          impact(ImpactFeedbackStyle.Light);
          const granted = await requestPermission();
          if (!granted) {
            if (Platform.OS === "web") {
              if (typeof window !== "undefined" && typeof window.alert === "function") {
                window.alert(
                  "Location is blocked for this site. Click the lock icon in the address bar, set Location to Allow, then reload.",
                );
              }
              return;
            }
            Linking.openSettings();
          }
        }}
        style={{
          backgroundColor: colors.primary,
          borderRadius: radii.xs,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <Text style={{ color: colors.surface, fontSize: 11, fontWeight: "800" }}>Enable</Text>
      </Pressable>
    </View>
  );
}
