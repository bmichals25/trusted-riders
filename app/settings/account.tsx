import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/components/ui/DriverNameGate";
import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import {
  ActionRow,
  ReadoutRow,
  SettingsSection,
  SettingsSubHeader,
} from "@/features/settings/settings-screen-sections";
import { NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { colors, spacing } from "@/lib/theme";

export default function AccountSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { signOut, session, biometricSignInLabel, turnOffBiometricSignIn } = useAuth();
  const { notification } = useHaptics();
  const [signingOut, setSigningOut] = useState(false);
  const profileName = session?.name ?? "Trusted Rider";

  const performSignOut = async () => {
    if (signingOut) return;
    notification(NotificationFeedbackType.Warning);
    setSigningOut(true);
    await signOut();
  };

  const handleTurnOffBiometric = () => {
    if (!biometricSignInLabel) return;
    Alert.alert(
      `Turn off ${biometricSignInLabel} sign-in?`,
      `You'll sign in with your password. It's offered again the next time you do.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Turn Off", style: "destructive", onPress: () => void turnOffBiometricSignIn() },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign out?",
      "This signs you out of TrustedRide on this device.",
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

  return (
    <PageTransition>
      <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
        <SettingsSubHeader title="Account" topInset={insets.top} />
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.lg }}
        >
          <FadeInBlock delay={60}>
            <SettingsSection>
              <ReadoutRow label="Profile" value={profileName} iconName="person.crop.circle.fill" />
              {biometricSignInLabel ? (
                <ActionRow
                  label={`Sign in with ${biometricSignInLabel}`}
                  value="On"
                  detail="Tap to turn off"
                  iconName="faceid"
                  iconTone="blue"
                  onPress={handleTurnOffBiometric}
                />
              ) : null}
              <ActionRow
                label="Sign Out"
                detail={biometricSignInLabel ? `Ends session; also turns off ${biometricSignInLabel}` : "Ends session and clears token"}
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
