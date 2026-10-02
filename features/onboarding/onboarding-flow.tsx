import { useCallback, useEffect, useState } from "react";
import { type Href } from "expo-router";
import * as Location from "expo-location";
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { SymbolIcon, type AppSymbolName } from "@/components/ui/SymbolIcon";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { useLocation } from "@/lib/location-context";
import {
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationPermissionState,
} from "@/lib/push-notifications";
import { colors, radii, shadows, spacing } from "@/lib/theme";

type Step = "welcome" | "location" | "notifications" | "availability";
const STEPS: Step[] = ["welcome", "location", "notifications", "availability"];

/**
 * The first-sign-in walkthrough (OnboardingGate). Each permission step explains why before iOS asks,
 * shows when it's already on, and can be skipped; nothing here blocks the app except LocationSetupGate
 * afterwards, which still requires location.
 */
export function OnboardingFlow({
  firstName,
  onFinish,
}: {
  firstName: string | null;
  onFinish: (destination: Href | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const { impact, notification } = useHaptics();
  const { permissionStatus, backgroundPermissionStatus, requestPermission, requestBackgroundPermission } = useLocation();
  const [step, setStep] = useState<Step>("welcome");
  const [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPermissionState>("undetermined");

  useEffect(() => {
    void getNotificationPermission().then(setNotifications).catch(() => {});
  }, []);

  const index = STEPS.indexOf(step);
  const next = useCallback(() => {
    impact(ImpactFeedbackStyle.Light);
    const following = STEPS[STEPS.indexOf(step) + 1];
    if (following) setStep(following);
  }, [impact, step]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const foregroundOn = permissionStatus === Location.PermissionStatus.GRANTED;
  const foregroundDenied = permissionStatus === Location.PermissionStatus.DENIED;
  const alwaysOn = backgroundPermissionStatus === Location.PermissionStatus.GRANTED || Platform.OS === "web";

  let content: StepContent;
  if (step === "welcome") {
    content = {
      icon: null,
      kicker: "Welcome",
      title: firstName ? `Welcome to TrustedRide, ${firstName}` : "Welcome to TrustedRide",
      body: "This app is how you'll get rides from your coordinator, see your schedule, and stay in touch during every trip. Three quick things to set up:",
      points: [
        { icon: "location.fill", text: "Location, so your coordinator can follow along during rides" },
        { icon: "bell.badge.fill", text: "Notifications, so you never miss a ride request" },
        { icon: "calendar.badge.clock", text: "Your availability, so rides fit your week" },
      ],
      primary: { label: "Get started", onPress: next },
    };
  } else if (step === "location") {
    content = {
      icon: "location.fill",
      kicker: "Step 1 of 3",
      title: "Share your location during rides",
      body:
        "Your coordinator sees where you are only while you're on a ride, so they can keep passengers and families updated. It also powers directions to pickups.",
      status: alwaysOn && foregroundOn ? "Location is on" : foregroundOn ? "On while using the app" : null,
      note: foregroundOn && !alwaysOn
        ? "Choose \"Always Allow\" so updates keep going when your phone is locked or you switch to Maps during a ride."
        : foregroundDenied
          ? "Location is turned off for TrustedRide. Open Settings, tap Location, and choose Always."
          : null,
      primary: foregroundDenied
        ? { label: "Open Settings", onPress: () => void Linking.openSettings() }
        : !foregroundOn
          ? { label: "Allow location", onPress: () => void run(requestPermission) }
          : !alwaysOn
            ? { label: "Allow when the phone is locked", onPress: () => void run(requestBackgroundPermission) }
            : { label: "Continue", onPress: next },
      secondary: foregroundOn && !alwaysOn ? { label: "Not now", onPress: next } : foregroundDenied ? { label: "Skip for now", onPress: next } : null,
    };
  } else if (step === "notifications") {
    const on = notifications === "granted";
    content = {
      icon: "bell.badge.fill",
      kicker: "Step 2 of 3",
      title: "Turn on notifications",
      body:
        "Get new ride requests, schedule changes and messages from your coordinator right away. Notifications never include passenger details.",
      status: on ? "Notifications are on" : null,
      note: notifications === "denied" ? "Notifications are off for TrustedRide. Open Settings and turn on Allow Notifications." : null,
      primary: on || notifications === "unavailable"
        ? { label: "Continue", onPress: next }
        : notifications === "denied"
          ? { label: "Open Settings", onPress: () => void Linking.openSettings() }
          : {
              label: "Allow notifications",
              onPress: () =>
                void run(async () => {
                  const state = await requestNotificationPermission();
                  setNotifications(state);
                  if (state === "granted") notification(NotificationFeedbackType.Success);
                }),
            },
      secondary: on || notifications === "unavailable" ? null : { label: "Not now", onPress: next },
    };
  } else {
    content = {
      icon: "calendar.badge.clock",
      kicker: "Step 3 of 3",
      title: "When can you drive?",
      body:
        "Set your hours for the coming week so your coordinator can plan rides around you. You can change them any time under Schedule → My availability.",
      primary: {
        label: "Set my availability",
        onPress: () => {
          notification(NotificationFeedbackType.Success);
          onFinish("/mission?section=availability" as Href);
        },
      },
      secondary: {
        label: "I'll do it later",
        onPress: () => {
          impact(ImpactFeedbackStyle.Light);
          onFinish(null);
        },
      },
    };
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceLow, paddingTop: insets.top + spacing.md }}>
      <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: spacing.lg }} accessibilityLabel={`Step ${index + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <View
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: radii.pill,
              backgroundColor: i <= index ? colors.primary : colors.slate200,
            }}
          />
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.lg, gap: spacing.md }}
      >
        <FadeInBlock key={step} delay={0}>
          <View style={{ gap: spacing.md }}>
            {content.icon ? (
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: radii.lg,
                  borderCurve: "continuous",
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SymbolIcon name={content.icon} size={30} type="monochrome" tintColor={colors.surface} weight="semibold" />
              </View>
            ) : (
              <Image
                source={require("../../assets/trustedride_certified_main_logo_transparent.png")}
                style={{ width: 200, height: 60, alignSelf: "flex-start" }}
                resizeMode="contain"
                accessibilityLabel="TrustedRide Certified"
              />
            )}
            <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" }}>
              {content.kicker}
            </Text>
            <Text accessibilityRole="header" style={{ color: colors.primary, fontSize: 30, fontWeight: "900", lineHeight: 35, letterSpacing: -0.5 }}>
              {content.title}
            </Text>
            <Text style={{ color: colors.primarySoft, fontSize: 16, fontWeight: "600", lineHeight: 23 }}>{content.body}</Text>

            {content.points ? (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radii.md,
                  borderCurve: "continuous",
                  padding: spacing.md,
                  gap: spacing.md,
                  ...shadows.soft,
                }}
              >
                {content.points.map((p) => (
                  <View key={p.text} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <View
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: radii.sm,
                        backgroundColor: colors.blueSoft,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <SymbolIcon name={p.icon} size={17} type="monochrome" tintColor={colors.blueStrong} weight="semibold" />
                    </View>
                    <Text style={{ flex: 1, color: colors.primary, fontSize: 15, fontWeight: "700", lineHeight: 20 }}>{p.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {content.status ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  alignSelf: "flex-start",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: radii.pill,
                  backgroundColor: colors.greenSoft,
                }}
              >
                <SymbolIcon name="checkmark.circle.fill" size={16} tintColor={colors.greenStrong} />
                <Text style={{ color: colors.greenStrong, fontSize: 14, fontWeight: "800" }}>{content.status}</Text>
              </View>
            ) : null}
            {content.note ? (
              <Text style={{ color: colors.amberStrong, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>{content.note}</Text>
            ) : null}
          </View>
        </FadeInBlock>
      </ScrollView>

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.md, gap: spacing.xs }}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={content.primary.onPress}
          style={({ pressed }) => ({
            minHeight: 54,
            borderRadius: radii.md,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            opacity: busy ? 0.6 : 1,
          })}
        >
          {busy ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={{ color: colors.surface, fontSize: 17, fontWeight: "900" }}>{content.primary.label}</Text>
          )}
        </Pressable>
        {content.secondary ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={content.secondary.onPress}
            style={{ minHeight: 46, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: colors.primarySoft, fontSize: 16, fontWeight: "800" }}>{content.secondary.label}</Text>
          </Pressable>
        ) : (
          <View style={{ minHeight: 46 }} />
        )}
      </View>
    </View>
  );
}

type Action = { label: string; onPress: () => void };
type StepContent = {
  icon: AppSymbolName | null;
  kicker: string;
  title: string;
  body: string;
  points?: { icon: AppSymbolName; text: string }[];
  status?: string | null;
  note?: string | null;
  primary: Action;
  secondary?: Action | null;
};
