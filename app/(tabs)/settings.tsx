import React, { useState } from "react";
import { useRouter } from "expo-router";
import { Alert, Linking, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth, useStartupPresentation } from "@/components/ui/DriverNameGate";
import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import {
  ActionRow,
  OperatorSummary,
  ReadoutRow,
  SettingsSection,
  SettingsTitle,
  ToggleRow,
} from "@/features/settings/settings-screen-sections";
import { NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { useLocation } from "@/lib/location-context";
import { sendGpsCommandMessage } from "@/lib/chat-api";
import { colors, spacing } from "@/lib/theme";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    isTracking,
    permissionStatus,
    hasAlwaysLocationAccess,
    error: locationError,
    startTracking,
    stopTracking,
  } = useLocation();
  const { signOut, session } = useAuth();
  const { replayStartupAnimation } = useStartupPresentation();
  const [signingOut, setSigningOut] = useState(false);
  const { hapticsEnabled, setHapticsEnabled, selection, notification } = useHaptics();
  const profileName = session?.name ?? "Chaperone";
  const foregroundLocationValue = permissionStatus === "granted" ? "Allowed" : permissionStatus ? "Limited" : "Unknown";
  const backgroundLocationValue = hasAlwaysLocationAccess
    ? "Always"
    : isTracking
      ? "Required"
      : "Required to track";

  const performSignOut = async () => {
    if (signingOut) return;
    notification(NotificationFeedbackType.Warning);
    setSigningOut(true);
    await signOut();
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign out?",
      "This clears the current chaperone session on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => {
            void performSignOut();
          },
        },
      ],
    );
  };

  const handleOpenSystemSettings = () => {
    selection();
    void Linking.openSettings();
  };

  const handleReloadApp = () => {
    selection();
    replayStartupAnimation();
    requestAnimationFrame(() => {
      router.replace("/(tabs)");
    });
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
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          style={{ flex: 1, backgroundColor: colors.surfaceLow }}
          contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 96 }}
        >
          <FadeInBlock delay={30}>
            <SettingsTitle />
          </FadeInBlock>

          <FadeInBlock delay={90}>
            <OperatorSummary
              name={profileName}
              isTracking={isTracking}
              hasAlwaysLocationAccess={hasAlwaysLocationAccess}
            />
          </FadeInBlock>

          <FadeInBlock delay={150}>
            <SettingsSection
              kicker="Operations"
              footer="Location controls affect dispatch visibility during active rides."
            >
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
                detail={locationError ?? "Foreground tracking status"}
                tone={isTracking ? "good" : locationError ? "warning" : "muted"}
                iconName="antenna.radiowaves.left.and.right"
                iconTone={isTracking ? "green" : locationError ? "amber" : "slate"}
              />
              <ReadoutRow
                label="iOS Location"
                value={foregroundLocationValue}
                detail={`Always access: ${backgroundLocationValue}`}
                tone={hasAlwaysLocationAccess ? "good" : isTracking ? "warning" : "muted"}
                iconName="iphone"
                iconTone={hasAlwaysLocationAccess ? "green" : isTracking ? "amber" : "slate"}
              />
              <ActionRow
                label="System Location Settings"
                detail="Open iOS settings for app permissions"
                value="Open"
                iconName="gearshape.fill"
                iconTone="blue"
                onPress={handleOpenSystemSettings}
                last
              />
            </SettingsSection>
          </FadeInBlock>

          <FadeInBlock delay={230}>
            <SettingsSection kicker="Experience">
              <ToggleRow
                label="Haptic Feedback"
                description="Use vibration for taps and confirmations"
                value={hapticsEnabled}
                iconName="hand.tap.fill"
                iconTone={hapticsEnabled ? "blue" : "slate"}
                last
                onValueChange={(val) => {
                  setHapticsEnabled(val);
                  if (val) selection();
                }}
              />
            </SettingsSection>
          </FadeInBlock>

          <FadeInBlock delay={310}>
            <SettingsSection
              kicker="Demo"
              footer="Use reload to replay the full launch video and home entrance animation."
            >
              <ActionRow
                label="Reload App"
                detail="Restart from the opening animation"
                value="Reload"
                iconName="arrow.clockwise"
                iconTone="blue"
                onPress={handleReloadApp}
                last
              />
            </SettingsSection>
          </FadeInBlock>

          <FadeInBlock delay={390}>
            <SettingsSection kicker="Account">
              <ReadoutRow label="Profile" value={profileName} detail="Signed-in chaperone" iconName="person.crop.circle.fill" />
              <ReadoutRow label="Session" value="Signed in" detail="Backend token active" tone="good" iconName="checkmark.shield.fill" iconTone="green" />
              <ActionRow
                label="Sign Out"
                detail="Ends session and clears token"
                iconName="rectangle.portrait.and.arrow.right"
                destructive
                disabled={signingOut}
                busy={signingOut}
                onPress={handleSignOut}
                last
              />
            </SettingsSection>
          </FadeInBlock>
        </ScrollView>
      </View>
    </PageTransition>
  );
}
