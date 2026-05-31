import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/components/ui/DriverNameGate";
import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import { ActionRow, OperatorSummary, SettingsSection } from "@/features/settings/settings-screen-sections";
import { useLocation } from "@/lib/location-context";
import { colors, spacing } from "@/lib/theme";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isTracking } = useLocation();
  const { session } = useAuth();
  const profileName = session?.name ?? "Chaperone";

  return (
    <PageTransition>
      <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          style={{ flex: 1, backgroundColor: colors.surfaceLow }}
          contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + 96 }}
        >
          <FadeInBlock delay={60}>
            <OperatorSummary name={profileName} isTracking={isTracking} />
          </FadeInBlock>

          <FadeInBlock delay={140}>
            <SettingsSection>
              <ActionRow
                label="Location & Tracking"
                detail="Live GPS, telemetry, and permissions"
                iconName="location.fill"
                iconTone="blue"
                onPress={() => router.push("/settings/location")}
              />
              <ActionRow
                label="App Preferences"
                detail="Haptics and demo controls"
                iconName="slider.horizontal.3"
                iconTone="blue"
                onPress={() => router.push("/settings/app")}
              />
              <ActionRow
                label="Account"
                detail="Profile and sign out"
                iconName="person.crop.circle.fill"
                iconTone="blue"
                onPress={() => router.push("/settings/account")}
                last
              />
            </SettingsSection>
          </FadeInBlock>
        </ScrollView>
      </View>
    </PageTransition>
  );
}
