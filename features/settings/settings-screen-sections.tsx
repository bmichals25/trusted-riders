import React from "react";
import { Pressable, Switch, Text, View } from "react-native";

import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme";

export function OperatorSummary({ name }: { name: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`Chaperone ${name}. On duty.`}
      style={{
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        marginBottom: spacing.lg,
        backgroundColor: colors.primary,
        borderRadius: radii.sm,
        borderCurve: "continuous",
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
        gap: 12,
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm }}>
        <Text style={{ color: colors.slate300, ...typography.sectionKicker }} numberOfLines={1}>
          Chaperone
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.greenSoftDark, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.xs }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.greenLight }} />
          <Text style={{ color: colors.greenLight, fontSize: 10, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" }}>
            On Duty
          </Text>
        </View>
      </View>
      <Text selectable style={{ color: colors.surface, fontSize: 32, fontWeight: "900", lineHeight: 38 }} numberOfLines={2}>
        {name}
      </Text>
      <Text style={{ color: colors.slate300, fontSize: 13, fontWeight: "700", lineHeight: 18 }} numberOfLines={2}>
        Profile active for live ride operations.
      </Text>
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
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  critical?: boolean;
}) {
  return (
    <View style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.slate100, flexDirection: "row", justifyContent: "space-between", gap: spacing.md, alignItems: "center", minHeight: 72 }}>
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

export function ReadoutRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.slate100, flexDirection: "row", justifyContent: "space-between", gap: spacing.md, minHeight: 52, alignItems: "center" }}>
      <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "700" }}>{label}</Text>
      <Text selectable style={{ color: colors.primary, fontSize: 14, fontWeight: "800", flexShrink: 1, textAlign: "right" }} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function SystemFooter({ signingOut, onSignOut }: { signingOut: boolean; onSignOut: () => void }) {
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
        accessibilityLabel={signingOut ? "Signing out" : "Sign out"}
        accessibilityState={{ disabled: signingOut, busy: signingOut }}
        style={({ pressed }) => ({
          minHeight: 58,
          borderRadius: radii.sm,
          borderCurve: "continuous",
          backgroundColor: pressed || signingOut ? colors.primaryPressed : colors.primary,
          alignItems: "center",
          justifyContent: "center",
          opacity: signingOut ? 0.7 : 1,
        })}
      >
        <Text style={{ color: colors.surface, fontSize: 14, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" }}>
          {signingOut ? "Signing out" : "Sign Out"}
        </Text>
      </Pressable>
      <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "700", textAlign: "center" }}>
        Ends session and clears token
      </Text>
    </View>
  );
}
