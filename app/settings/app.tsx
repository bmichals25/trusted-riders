import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useStartupPresentation } from "@/components/ui/DriverNameGate";
import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import {
  ActionRow,
  SettingsSection,
  SettingsSubHeader,
  ToggleRow,
} from "@/features/settings/settings-screen-sections";
import { useHaptics } from "@/lib/haptics-context";
import { colors, spacing } from "@/lib/theme";

export default function AppSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { reloadAppToHome } = useStartupPresentation();
  const { hapticsEnabled, setHapticsEnabled, selection } = useHaptics();

  const handleReloadApp = () => {
    selection();
    reloadAppToHome();
    router.replace("/");
  };

  return (
    <PageTransition>
      <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
        <SettingsSubHeader title="App Preferences" topInset={insets.top} />
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: insets.bottom + spacing.lg }}
        >
          <FadeInBlock delay={60}>
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

          <FadeInBlock delay={140}>
            <SettingsSection kicker="Demo">
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
        </ScrollView>
      </View>
    </PageTransition>
  );
}
