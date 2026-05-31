import React from "react";
import { SymbolIcon, type AppSymbolName } from "@/components/ui/SymbolIcon";
import { ActivityIndicator, Pressable, Switch, Text, View } from "react-native";

import { BackChevron } from "@/components/ui/BackChevron";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme";

export function SettingsSubHeader({ title, topInset }: { title: string; topInset: number }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        paddingTop: topInset + 8,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <BackChevron fallbackHref="/settings" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" }}>
          Settings
        </Text>
        <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "900", lineHeight: 27 }} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
}

export function OperatorSummary({
  name,
  isTracking,
}: {
  name: string;
  isTracking: boolean;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TR";

  return (
    <View
      accessible
      accessibilityLabel={`Chaperone ${name}. ${isTracking ? "Live location is being shared." : "Live location sharing is off."}`}
      style={{
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        borderCurve: "continuous",
        padding: spacing.md,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
        ...shadows.soft,
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ color: colors.slate500, ...typography.sectionKicker, flex: 1 }} numberOfLines={1}>
            Chaperone
          </Text>
          <LiveLocationPill active={isTracking} />
        </View>
        <Text selectable style={{ color: colors.primary, fontSize: 22, fontWeight: "900", lineHeight: 27 }}>
          {name}
        </Text>
      </View>
    </View>
  );
}

function LiveLocationPill({ active }: { active: boolean }) {
  const palette = active
    ? { bg: colors.greenSoft, dot: colors.green, text: colors.greenStrong }
    : { bg: colors.slate100, dot: colors.slate400, text: colors.primarySoft };

  return (
    <View
      style={{
        minHeight: 24,
        borderRadius: radii.pill,
        backgroundColor: palette.bg,
        paddingHorizontal: 9,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        flexShrink: 0,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.dot }} />
      <Text style={{ color: palette.text, fontSize: 11, fontWeight: "900" }} numberOfLines={1}>
        {active ? "Live" : "Off"}
      </Text>
    </View>
  );
}

export function SettingsSection({
  kicker,
  footer,
  children,
}: {
  kicker?: string;
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.md, gap: spacing.sm }}>
      {kicker ? (
        <Text style={{ color: colors.slate500, ...typography.sectionKicker, paddingHorizontal: spacing.md }}>
          {kicker}
        </Text>
      ) : null}
      <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderCurve: "continuous", overflow: "hidden", ...shadows.soft }}>
        {children}
      </View>
      {footer ? (
        <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "700", lineHeight: 17, paddingHorizontal: spacing.md }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

function SettingIcon({
  name,
  tone = "blue",
}: {
  name: AppSymbolName;
  tone?: "blue" | "green" | "slate" | "amber" | "red";
}) {
  const palette = {
    blue: { bg: colors.blueSoft, fg: colors.blueStrong },
    green: { bg: colors.greenSoft, fg: colors.greenStrong },
    slate: { bg: colors.slate100, fg: colors.primarySoft },
    amber: { bg: colors.amberSoft, fg: colors.amberStrong },
    red: { bg: colors.errorSoftDark, fg: colors.error },
  }[tone];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 34,
        height: 34,
        borderRadius: radii.sm,
        backgroundColor: palette.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <SymbolIcon
        name={name}
        size={18}
        type="hierarchical"
        tintColor={palette.fg}
        weight="semibold"
      />
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  critical,
  iconName,
  iconTone,
  last,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  critical?: boolean;
  iconName?: AppSymbolName;
  iconTone?: "blue" | "green" | "slate" | "amber" | "red";
  last?: boolean;
}) {
  return (
    <View
      style={{
        paddingVertical: spacing.md,
        paddingLeft: spacing.md,
        paddingRight: spacing.sm,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.slate100,
        flexDirection: "row",
        justifyContent: "space-between",
        gap: spacing.md,
        alignItems: "center",
        minHeight: 74,
      }}
    >
      {iconName ? <SettingIcon name={iconName} tone={iconTone ?? (critical ? "blue" : "slate")} /> : null}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: critical ? colors.blueStrong : colors.primary, fontSize: 15, fontWeight: "900" }} numberOfLines={1}>
          {label}
        </Text>
        <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "600", lineHeight: 18 }} numberOfLines={2}>
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
        trackColor={{ false: colors.slate200, true: colors.greenSoft }}
        thumbColor={value ? colors.greenStrong : colors.surface}
      />
    </View>
  );
}

export function ReadoutRow({
  label,
  value,
  detail,
  tone = "default",
  iconName,
  iconTone,
  last,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "good" | "muted" | "warning";
  iconName?: AppSymbolName;
  iconTone?: "blue" | "green" | "slate" | "amber" | "red";
  last?: boolean;
}) {
  const valueColor = tone === "good"
    ? colors.greenStrong
    : tone === "warning"
      ? colors.amberStrong
      : tone === "muted"
        ? colors.slate500
        : colors.primary;
  const valueBackground = tone === "good"
    ? colors.greenSoft
    : tone === "warning"
      ? colors.amberSoft
      : tone === "muted"
        ? colors.slate100
        : colors.surfaceLow;

  return (
    <View
      accessible
      accessibilityLabel={`${label}. ${value}${detail ? `. ${detail}` : ""}`}
      style={{
        padding: spacing.md,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.slate100,
        flexDirection: "row",
        gap: spacing.md,
        minHeight: 62,
        alignItems: "center",
      }}
    >
      {iconName ? <SettingIcon name={iconName} tone={iconTone ?? "slate"} /> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "800" }} numberOfLines={1}>{label}</Text>
        {detail ? (
          <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "600", lineHeight: 16 }} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          maxWidth: 128,
          borderRadius: radii.pill,
          backgroundColor: valueBackground,
          paddingHorizontal: 10,
          paddingVertical: 5,
        }}
      >
        <Text selectable style={{ color: valueColor, fontSize: 13, fontWeight: "900", textAlign: "right" }} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function ActionRow({
  label,
  value,
  detail,
  iconName,
  iconTone = "slate",
  destructive,
  disabled,
  busy,
  last,
  onPress,
}: {
  label: string;
  value?: string;
  detail?: string;
  iconName: AppSymbolName;
  iconTone?: "blue" | "green" | "slate" | "amber" | "red";
  destructive?: boolean;
  disabled?: boolean;
  busy?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  const { impact } = useHaptics();

  return (
      <Pressable
        disabled={disabled}
        onPress={() => {
          impact(destructive ? ImpactFeedbackStyle.Medium : ImpactFeedbackStyle.Light);
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={detail}
        accessibilityState={{ disabled, busy }}
        style={({ pressed }) => ({
          minHeight: 64,
          padding: spacing.md,
          borderBottomWidth: last ? 0 : 1,
          borderBottomColor: destructive ? colors.errorSoftStrong : colors.slate100,
          backgroundColor: pressed ? (destructive ? colors.errorSoft : colors.surfaceLow) : colors.surface,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          opacity: disabled ? 0.65 : 1,
        })}
      >
        <SettingIcon name={iconName} tone={destructive ? "red" : iconTone} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={{ color: destructive ? colors.error : colors.primary, fontSize: 15, fontWeight: "900" }} numberOfLines={1}>
            {busy ? `${label}...` : label}
          </Text>
          {detail ? (
            <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "600", lineHeight: 16 }} numberOfLines={2}>
              {detail}
            </Text>
          ) : null}
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={destructive ? colors.error : colors.blueStrong} />
        ) : value ? (
          <Text style={{ color: destructive ? colors.error : colors.blueStrong, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>
            {value}
          </Text>
        ) : (
          <SymbolIcon
            name="chevron.right"
            size={13}
            type="hierarchical"
            tintColor={colors.slate400}
            weight="semibold"
          />
        )}
      </Pressable>
  );
}
