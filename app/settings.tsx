import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHaptics } from "@/lib/haptics-context";
import { useLocation } from "@/lib/location-context";
import { colors, radii, spacing } from "@/lib/theme";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isTracking, startTracking, stopTracking } = useLocation();

  const [notifications, setNotifications] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false);
  const { hapticsEnabled, setHapticsEnabled, selection } = useHaptics();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.surfaceLow }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.md }}>
        <SettingsGroup title="Notifications">
          <SettingsToggle
            label="Push Notifications"
            description="New ride requests and mission updates"
            value={notifications}
            onValueChange={setNotifications}
          />
          <Divider />
          <SettingsToggle
            label="Auto-Accept Rides"
            description="Automatically accept high-priority missions"
            value={autoAccept}
            onValueChange={setAutoAccept}
          />
        </SettingsGroup>

        <SettingsGroup title="Privacy & Location">
          <SettingsToggle
            label="Live Location Sharing"
            description="Share GPS with dispatch during active missions"
            value={isTracking}
            onValueChange={(val) => {
              if (val) startTracking();
              else stopTracking();
            }}
          />
        </SettingsGroup>

        <SettingsGroup title="Appearance">
          <SettingsToggle
            label="Haptic Feedback"
            description="Vibrate on button presses and confirmations"
            value={hapticsEnabled}
            onValueChange={(val) => {
              setHapticsEnabled(val);
              if (val) selection();
            }}
          />
        </SettingsGroup>

        <SettingsGroup title="Account">
          <SettingsRow label="Operator Profile" detail="Ben Driver" />
          <Divider />
          <SettingsRow label="Certifications" detail="4 Active" />
          <Divider />
          <SettingsRow label="Vehicle Information" detail="2019 Honda Odyssey" />
          <Divider />
          <SettingsRow label="Payment & Earnings" detail="View" />
        </SettingsGroup>

        <SettingsGroup title="Support">
          <SettingsRow label="Help Center" detail="→" />
          <Divider />
          <SettingsRow label="Report an Issue" detail="→" />
          <Divider />
          <SettingsRow label="Terms of Service" detail="→" />
          <Divider />
          <SettingsRow label="Privacy Policy" detail="→" />
        </SettingsGroup>

        <View style={{ paddingVertical: spacing.lg, alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.slate400, fontSize: 12, fontWeight: "500", textTransform: "uppercase", letterSpacing: 1 }}>
            TrustedRiders v0.1.0
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => ({
              opacity: pressed ? 0.6 : 1,
              paddingVertical: 6,
              paddingHorizontal: 12,
              minHeight: 44,
              justifyContent: "center",
            })}
          >
            <Text style={{ color: colors.error, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
              Sign Out
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 0 }}>
      <Text style={{
        color: colors.slate400,
        fontSize: 12,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 1.5,
        paddingHorizontal: 4,
        paddingBottom: 8,
      }}>
        {title}
      </Text>
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        borderCurve: "continuous",
        overflow: "hidden",
      }}>
        {children}
      </View>
    </View>
  );
}

function SettingsToggle({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View
      accessibilityRole="none"
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.md,
        paddingVertical: 14,
        gap: 12,
        minHeight: 44,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>
          {label}
        </Text>
        <Text style={{ color: colors.slate400, fontSize: 14, fontWeight: "500" }}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.slate200, true: colors.blue }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

function SettingsRow({ label, detail }: { label: string; detail: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${detail}`}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        paddingVertical: 14,
        minHeight: 44,
        backgroundColor: pressed ? colors.surfaceLow : colors.surface,
      })}
    >
      <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600" }}>
        {label}
      </Text>
      <Text style={{ color: colors.slate400, fontSize: 15, fontWeight: "500" }}>
        {detail}
      </Text>
    </Pressable>
  );
}

function Divider() {
  return (
    <View style={{
      height: 1,
      backgroundColor: colors.slate100,
      marginLeft: spacing.md,
    }} />
  );
}
