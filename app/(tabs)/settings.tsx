import React, { useState } from "react";
import { DevSettings, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/components/ui/DriverNameGate";
import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import {
  OperatorSummary,
  ReadoutRow,
  ReloadAppButton,
  SettingsSection,
  SettingsTitle,
  SystemFooter,
  ToggleRow,
} from "@/features/settings/settings-screen-sections";
import { NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { useLocation } from "@/lib/location-context";
import { colors, spacing } from "@/lib/theme";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { isTracking, startTracking, stopTracking } = useLocation();
  const { signOut, session } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const { hapticsEnabled, setHapticsEnabled, selection, notification } = useHaptics();
  const profileName = session?.name ?? "Chaperone";

  const handleSignOut = async () => {
    if (signingOut) return;
    notification(NotificationFeedbackType.Warning);
    setSigningOut(true);
    await signOut();
  };

  const handleReloadApp = () => {
    selection();
    DevSettings.reload();
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
            <OperatorSummary name={profileName} />
          </FadeInBlock>

          <FadeInBlock delay={150}>
            <ReloadAppButton onReload={handleReloadApp} />
          </FadeInBlock>

          <FadeInBlock delay={230}>
            <SettingsSection kicker="Operations">
              <ToggleRow
                label="Live Location"
                description="Share GPS with dispatch during active rides"
                value={isTracking}
                critical
                onValueChange={(val) => {
                  selection();
                  if (val) startTracking();
                  else stopTracking();
                }}
              />
              <ReadoutRow label="Telemetry" value={isTracking ? "Broadcasting" : "Paused"} tone={isTracking ? "good" : "muted"} last />
            </SettingsSection>
          </FadeInBlock>

          <FadeInBlock delay={310}>
            <SettingsSection kicker="Experience">
              <ToggleRow
                label="Haptic Feedback"
                description="Use vibration for taps and confirmations"
                value={hapticsEnabled}
                last
                onValueChange={(val) => {
                  setHapticsEnabled(val);
                  if (val) selection();
                }}
              />
            </SettingsSection>
          </FadeInBlock>

          <FadeInBlock delay={390}>
            <SettingsSection kicker="Account">
              <ReadoutRow label="Profile" value={profileName} />
              <ReadoutRow label="Session" value="Signed in" tone="good" last />
            </SettingsSection>
          </FadeInBlock>

          <FadeInBlock delay={470}>
            <SystemFooter signingOut={signingOut} onSignOut={handleSignOut} />
          </FadeInBlock>
        </ScrollView>
      </View>
    </PageTransition>
  );
}
