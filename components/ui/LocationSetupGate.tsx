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
import { DEMO_MODE } from "@/lib/demo-mode";
import { colors, radii, shadows, spacing } from "@/lib/theme";

/**
 * Post-sign-in onboarding step. Blocks entry to the app until the driver has
 * granted location access, which the rest of the app depends on for the map,
 * navigation, and dispatch updates. Already-granted users pass through
 * transparently after a brief permission check.
 */
export function LocationSetupGate({ children }: { children: React.ReactNode }) {
  const {
    backgroundPermissionStatus,
    permissionStatus,
    requestPermission,
    startBackgroundTracking,
    startTracking,
  } = useLocation();
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

  const onEnableAlways = useCallback(async () => {
    impact(ImpactFeedbackStyle.Light);
    setRequesting(true);
    await startBackgroundTracking();
    setRequesting(false);
  }, [impact, startBackgroundTracking]);

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

  if (DEMO_MODE) {
    return <>{children}</>;
  }

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

        <Text style={s.title}>
          Turn on location
        </Text>
        <Text style={s.subtitle}>
          TrustedRiders needs location access to show your position on the map,
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
              accessibilityRole="button"
              accessibilityLabel={Platform.OS === "web" ? "Enable tracking" : "Open Settings"}
              accessibilityHint={Platform.OS === "web" ? "Reloads after you allow location in the browser." : "Opens iOS Settings for TrustedRiders."}
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
            accessibilityRole="button"
            accessibilityLabel={requesting ? "Requesting location access" : "Enable tracking"}
            accessibilityHint="Requests location access for maps, pickup navigation, and dispatch updates."
            accessibilityState={{ disabled: requesting, busy: requesting }}
          >
            {requesting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.buttonText}>Enable Tracking</Text>
            )}
          </Pressable>
        )}

        {Platform.OS !== "web" &&
        backgroundPermissionStatus !== null &&
        backgroundPermissionStatus !== Location.PermissionStatus.GRANTED &&
        !blocked ? (
          <Pressable
            style={[s.secondaryButton, requesting && s.buttonDisabled]}
            onPress={onEnableAlways}
            disabled={requesting}
            accessibilityRole="button"
            accessibilityLabel="Allow always later"
            accessibilityHint="Continues without background location permission for now."
            accessibilityState={{ disabled: requesting }}
          >
            <Text style={s.secondaryButtonText}>Allow Always Later</Text>
          </Pressable>
        ) : null}
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
    ...shadows.floating,
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
    color: colors.surface,
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
  secondaryButton: {
    width: "100%",
    borderRadius: radii.sm,
    padding: spacing.md,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
});
