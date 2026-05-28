import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/components/ui/DriverNameGate";
import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import {
  OperatorSummary,
  ReadoutRow,
  SettingsSection,
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

  return (
    <PageTransition>
      <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        style={{ flex: 1, backgroundColor: colors.surfaceLow }}
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 40 }}
      >
        <FadeInBlock delay={40}>
          <OperatorSummary name={profileName} />
        </FadeInBlock>

        <FadeInBlock delay={140}>
          <SettingsSection kicker="Telemetry">
            <ToggleRow
              label="Live Location"
              description="Share GPS with dispatch during active missions"
              value={isTracking}
              critical
              onValueChange={(val) => {
                selection();
                if (val) startTracking();
                else stopTracking();
              }}
            />
            <ToggleRow
              label="Haptic Feedback"
              description="Vibrate on button presses and confirmations"
              value={hapticsEnabled}
              onValueChange={(val) => {
                setHapticsEnabled(val);
                if (val) selection();
              }}
            />
          </SettingsSection>
        </FadeInBlock>

        <FadeInBlock delay={220}>
          <SettingsSection kicker="Account">
            <ReadoutRow label="Profile" value={profileName} />
            <ReadoutRow label="Session" value="Signed in" />
          </SettingsSection>
        </FadeInBlock>

        <FadeInBlock delay={300}>
          <SystemFooter signingOut={signingOut} onSignOut={handleSignOut} />
        </FadeInBlock>
      </ScrollView>
      </View>
    </PageTransition>
  );
}
