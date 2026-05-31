import { Linking, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import {
  ActionRow,
  ReadoutRow,
  SettingsSection,
  SettingsSubHeader,
  ToggleRow,
} from "@/features/settings/settings-screen-sections";
import { sendGpsCommandMessage } from "@/lib/chat-api";
import { useHaptics } from "@/lib/haptics-context";
import { useLocation } from "@/lib/location-context";
import { colors, spacing } from "@/lib/theme";

export default function LocationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const {
    isTracking,
    permissionStatus,
    backgroundPermissionStatus,
    hasAlwaysLocationAccess,
    error: locationError,
    requestBackgroundPermission,
    startTracking,
    stopTracking,
  } = useLocation();
  const { selection } = useHaptics();

  const foregroundLocationValue = permissionStatus === "granted" ? "Allowed" : permissionStatus ? "Limited" : "Unknown";
  const backgroundLocationDetail = hasAlwaysLocationAccess
    ? "Background: Always"
    : backgroundPermissionStatus === "denied"
      ? "Open system settings to allow Always"
      : "Always required before active tracking";
  const alwaysPermissionActionValue = backgroundPermissionStatus === "denied" ? "Settings" : "Request";

  const handleOpenSystemSettings = () => {
    selection();
    void Linking.openSettings();
  };

  const handlePrepareAlwaysAccess = async () => {
    selection();
    if (backgroundPermissionStatus === "denied") {
      void Linking.openSettings();
      return;
    }
    await requestBackgroundPermission();
  };

  const handleLocationToggle = async (enabled: boolean) => {
    selection();
    if (enabled) {
      const trackingStarted = await startTracking();
      if (trackingStarted) {
        void sendGpsCommandMessage("gps_yes").catch((error) => {
          console.log("[settings] gps_yes command failed", error instanceof Error ? error.message : error);
        });
      }
    } else {
      stopTracking();
      void sendGpsCommandMessage("gps_off").catch((error) => {
        console.log("[settings] gps_off command failed", error instanceof Error ? error.message : error);
      });
    }
  };

  return (
    <PageTransition>
      <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
        <SettingsSubHeader title="Location & Tracking" topInset={insets.top} />
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.lg }}
        >
          <FadeInBlock delay={60}>
            <SettingsSection kicker="Operations">
              <ToggleRow
                label="Live Location"
                description="Share GPS with dispatch during active rides"
                value={isTracking}
                critical
                iconName="location.fill"
                iconTone={isTracking ? "green" : "blue"}
                onValueChange={(val) => {
                  void handleLocationToggle(val);
                }}
              />
              <ReadoutRow
                label="Telemetry"
                value={isTracking ? "Broadcasting" : "Paused"}
                detail={locationError ?? undefined}
                tone={isTracking ? "good" : locationError ? "warning" : "muted"}
                iconName="antenna.radiowaves.left.and.right"
                iconTone={isTracking ? "green" : locationError ? "amber" : "slate"}
              />
              <ReadoutRow
                label="Location Permission"
                value={foregroundLocationValue}
                detail={backgroundLocationDetail}
                tone={hasAlwaysLocationAccess ? "good" : isTracking ? "warning" : "muted"}
                iconName="iphone"
                iconTone={hasAlwaysLocationAccess ? "green" : isTracking ? "amber" : "slate"}
              />
              {!hasAlwaysLocationAccess ? (
                <ActionRow
                  label="Always Location Access"
                  detail="Required only when live ride tracking is active"
                  value={alwaysPermissionActionValue}
                  iconName="location.fill"
                  iconTone="amber"
                  onPress={handlePrepareAlwaysAccess}
                />
              ) : null}
              <ActionRow
                label="System Location Settings"
                detail="Open system settings for app permissions"
                value="Open"
                iconName="gearshape.fill"
                iconTone="blue"
                onPress={handleOpenSystemSettings}
                last
              />
            </SettingsSection>
          </FadeInBlock>
        </ScrollView>
      </View>
    </PageTransition>
  );
}
