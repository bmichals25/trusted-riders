import React from "react";
import { Pressable, Switch, Text, View } from "react-native";

import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme";

export function SettingsTitle() {
  return (
    <View style={{ marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.lg, gap: 6 }}>
      <Text style={{ color: colors.primary, fontSize: 34, fontWeight: "900", lineHeight: 40 }} numberOfLines={1}>
        Settings
      </Text>
      <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "700", lineHeight: 20 }} numberOfLines={2}>
        Operational preferences for your active driver session.
      </Text>
    </View>
  );
}

export function OperatorSummary({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TR";

  return (
    <View
      accessible
      accessibilityLabel={`Chaperone ${name}. On duty.`}
      style={{
        marginHorizontal: spacing.md,
        marginBottom: spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: radii.sm,
        borderCurve: "continuous",
        padding: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        ...shadows.soft,
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: radii.sm,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: colors.surface, fontSize: 17, fontWeight: "900" }} numberOfLines={1}>
          {initials}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={{ color: colors.slate500, ...typography.sectionKicker }} numberOfLines={1}>
          Chaperone
        </Text>
        <Text selectable style={{ color: colors.primary, fontSize: 22, fontWeight: "900", lineHeight: 27 }} numberOfLines={1}>
          {name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.green }} />
          <Text style={{ color: colors.greenStrong, fontSize: 12, fontWeight: "900" }} numberOfLines={1}>
            On duty for live operations
          </Text>
        </View>
      </View>
    </View>
  );
}

export function SettingsSection({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.lg, gap: spacing.sm }}>
      <Text style={{ color: colors.slate500, ...typography.sectionKicker }}>
        {kicker}
      </Text>
      <View style={{ backgroundColor: colors.surface, borderRadius: radii.sm, borderCurve: "continuous", overflow: "hidden", ...shadows.soft }}>
        {children}
      </View>
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  critical,
  last,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  critical?: boolean;
  last?: boolean;
}) {
  return (
    <View
      style={{
        padding: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.slate100,
        flexDirection: "row",
        justifyContent: "space-between",
        gap: spacing.md,
        alignItems: "center",
        minHeight: 76,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: critical ? colors.blueStrong : colors.primary, fontSize: 15, fontWeight: "900" }}>
          {label}
        </Text>
        <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "600", lineHeight: 18 }}>
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        accessibilityHint={description}
        accessibilityValue={{ text: value ? "On" : "Off" }}
        accessibilityState={{ checked: value }}
        trackColor={{ false: colors.slate200, true: colors.blueSoft }}
        thumbColor={value ? colors.blueStrong : colors.surface}
      />
    </View>
  );
}

export function ReadoutRow({ label, value, tone = "default", last }: { label: string; value: string; tone?: "default" | "good" | "muted"; last?: boolean }) {
  const valueColor = tone === "good" ? colors.greenStrong : tone === "muted" ? colors.slate500 : colors.primary;

  return (
    <View
      style={{
        padding: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.slate100,
        flexDirection: "row",
        justifyContent: "space-between",
        gap: spacing.md,
        minHeight: 56,
        alignItems: "center",
      }}
    >
      <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "700" }}>{label}</Text>
      <Text selectable style={{ color: valueColor, fontSize: 14, fontWeight: "800", flexShrink: 1, textAlign: "right" }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function ReloadAppButton({ onReload }: { onReload: () => void }) {
  const { impact } = useHaptics();

  return (
    <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.lg, gap: spacing.sm }}>
      <Text style={{ color: colors.slate500, ...typography.sectionKicker }}>
        Demo
      </Text>
      <Pressable
        onPress={() => {
          impact(ImpactFeedbackStyle.Light);
          onReload();
        }}
        accessibilityRole="button"
        accessibilityLabel="Reload app"
        accessibilityHint="Reloads the app so the opening animation plays from the beginning."
        style={({ pressed }) => ({
          minHeight: 58,
          borderRadius: radii.sm,
          borderCurve: "continuous",
          backgroundColor: pressed ? colors.surfaceHigh : colors.surface,
          borderWidth: 1,
          borderColor: colors.slate200,
          alignItems: "center",
          justifyContent: "center",
          ...shadows.soft,
        })}
      >
        <Text style={{ color: colors.blueStrong, fontSize: 14, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" }}>
          Reload App
        </Text>
      </Pressable>
      <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "700", textAlign: "center", lineHeight: 17 }}>
        Replays the opening animation from a clean app reload.
      </Text>
    </View>
  );
}

export function SystemFooter({ signingOut, onSignOut }: { signingOut: boolean; onSignOut: () => void }) {
  const { impact } = useHaptics();
  return (
    <View style={{ marginHorizontal: spacing.md, gap: spacing.md, marginBottom: spacing.lg }}>
      <Pressable
        disabled={signingOut}
        onPress={() => {
          impact(ImpactFeedbackStyle.Medium);
          onSignOut();
        }}
        accessibilityRole="button"
        accessibilityLabel={signingOut ? "Signing out" : "Sign out"}
        accessibilityState={{ disabled: signingOut, busy: signingOut }}
        style={({ pressed }) => ({
          minHeight: 58,
          borderRadius: radii.sm,
          borderCurve: "continuous",
          backgroundColor: pressed || signingOut ? colors.errorSoftStrong : colors.errorSoft,
          borderWidth: 1,
          borderColor: colors.errorSoftStrong,
          alignItems: "center",
          justifyContent: "center",
          opacity: signingOut ? 0.7 : 1,
        })}
      >
        <Text style={{ color: colors.error, fontSize: 14, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" }}>
          {signingOut ? "Signing out" : "Sign Out"}
        </Text>
      </Pressable>
      <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "700", textAlign: "center" }}>
        Ends session and clears token
      </Text>
    </View>
  );
}
