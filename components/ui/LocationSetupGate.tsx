import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";

import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { useLocation } from "@/lib/location-context";
import { colors, radii, spacing } from "@/lib/theme";

/**
 * Post-sign-in onboarding step. Blocks entry to the app until the driver has
 * granted location access, which the rest of the app depends on for the map,
 * navigation, and dispatch updates. Already-granted users pass through
 * transparently after a brief permission check.
 */
export function LocationSetupGate({ children }: { children: React.ReactNode }) {
  const { permissionStatus, requestPermission, startTracking } = useLocation();
  const { impact } = useHaptics();
  const [requesting, setRequesting] = useState(false);

  const onEnable = useCallback(async () => {
    impact(ImpactFeedbackStyle.Light);
    setRequesting(true);
    const granted = await requestPermission();
    setRequesting(false);
    if (granted) {
      startTracking();
    }
  }, [impact, requestPermission, startTracking]);

  const onOpenSettings = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    if (Platform.OS === "web") return;
    Linking.openSettings();
  }, [impact]);

  const onReload = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.reload();
    }
  }, [impact]);

  if (permissionStatus === null) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

  if (permissionStatus === Location.PermissionStatus.GRANTED) {
    return <>{children}</>;
  }

  const blocked = permissionStatus === Location.PermissionStatus.DENIED;

  return (
    <View style={s.center}>
      <View style={s.card}>
        <View style={s.iconWrap}>
          <Text style={s.icon}>◎</Text>
        </View>

        <Text style={s.title}>Turn on location</Text>
        <Text style={s.subtitle}>
          TrustedRiders needs your location to show your position on the map,
          navigate to pickups, and share live updates with dispatch during
          active rides.
        </Text>

        {blocked ? (
          <>
            <Text style={s.hint}>
              {Platform.OS === "web"
                ? "Location is blocked for this site. Tap the lock icon in the address bar, set Location to Allow, then try again."
                : "Location is turned off for TrustedRiders. Open Settings to re-enable it."}
            </Text>
            <Pressable
              style={s.button}
              onPress={Platform.OS === "web" ? onReload : onOpenSettings}
            >
              <Text style={s.buttonText}>
                {Platform.OS === "web" ? "Enable Tracking" : "Open Settings"}
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            style={[s.button, requesting && s.buttonDisabled]}
            onPress={onEnable}
            disabled={requesting}
          >
            {requesting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.buttonText}>Enable Tracking</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceLow,
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  icon: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "900",
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.primary,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.slate500,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  hint: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.slate500,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  button: {
    width: "100%",
    backgroundColor: colors.blue,
    borderRadius: radii.sm,
    padding: spacing.md,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
});
