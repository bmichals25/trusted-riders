import React, { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/components/ui/DriverNameGate";
import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { useLocation } from "@/lib/location-context";
import { colors, radii, shadows, spacing } from "@/lib/theme";

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
          <Section kicker="Telemetry">
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
          </Section>
        </FadeInBlock>

        <FadeInBlock delay={220}>
          <Section kicker="Account">
            <ReadoutRow label="Profile" value={profileName} />
            <ReadoutRow label="Session" value="Backend identity from login" />
          </Section>
        </FadeInBlock>

        <FadeInBlock delay={300}>
          <SystemFooter signingOut={signingOut} onSignOut={handleSignOut} />
        </FadeInBlock>
      </ScrollView>
      </View>
    </PageTransition>
  );
}

function OperatorSummary({ name }: { name: string }) {
  return (
    <View
      style={{
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        marginBottom: spacing.lg,
        backgroundColor: colors.primary,
        borderRadius: radii.sm,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
        gap: 10,
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.slate400, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 2.4 }}>
          Chaperone
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(22, 163, 74, 0.16)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.xs }}>
          <Text style={{ color: colors.greenLight, fontSize: 10, fontWeight: "900", letterSpacing: 1.8, textTransform: "uppercase" }}>
            On Duty
          </Text>
        </View>
      </View>
      <Text style={{ color: "#FFFFFF", fontSize: 32, fontWeight: "900", lineHeight: 36 }}>
        {name}
      </Text>
    </View>
  );
}

function Section({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.lg, gap: spacing.sm }}>
      <Text style={{ color: colors.slate400, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2.2 }}>
        {kicker}
      </Text>
      <View style={{ backgroundColor: colors.surface, borderRadius: radii.sm, overflow: "hidden", ...shadows.soft }}>
        {children}
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  critical,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  critical?: boolean;
}) {
  return (
    <View style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.slate100, flexDirection: "row", justifyContent: "space-between", gap: spacing.md, alignItems: "center" }}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: critical ? colors.blue : colors.primary, fontSize: 15, fontWeight: "900" }}>{label}</Text>
        <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "600", lineHeight: 18 }}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.slate200, true: colors.blueSoft }} thumbColor={value ? colors.blue : colors.surface} />
    </View>
  );
}

function ReadoutRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.slate100, flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
      <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "700" }}>{label}</Text>
      <Text selectable style={{ color: colors.primary, fontSize: 14, fontWeight: "900", flexShrink: 1, textAlign: "right" }}>{value}</Text>
    </View>
  );
}

function SystemFooter({ signingOut, onSignOut }: { signingOut: boolean; onSignOut: () => void }) {
  const { impact } = useHaptics();
  return (
    <View style={{ marginHorizontal: spacing.md, gap: spacing.md }}>
      <Pressable
        disabled={signingOut}
        onPress={() => {
          impact(ImpactFeedbackStyle.Medium);
          onSignOut();
        }}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={({ pressed }) => ({
          minHeight: 58,
          borderRadius: radii.sm,
          backgroundColor: pressed || signingOut ? "#1E293B" : colors.primary,
          alignItems: "center",
          justifyContent: "center",
          opacity: signingOut ? 0.7 : 1,
        })}
      >
        <Text style={{ color: colors.surface, fontSize: 14, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" }}>
          {signingOut ? "Signing out" : "Sign Out"}
        </Text>
      </Pressable>
      <Text style={{ color: colors.slate400, fontSize: 12, fontWeight: "700", textAlign: "center" }}>
        Ends session and clears token
      </Text>
    </View>
  );
}
