import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/components/ui/DriverNameGate";
import { EditFieldModal } from "@/components/ui/EditFieldModal";
import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import { useHaptics } from "@/lib/haptics-context";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "@/lib/haptics";
import { useLocation } from "@/lib/location-context";
import * as storage from "@/lib/storage";
import { colors, radii, shadows, spacing } from "@/lib/theme";

type EditableFieldId = "profile" | "certifications" | "vehicle";

type EditableField = {
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
};

const OPERATOR_FIELDS: Record<EditableFieldId, EditableField> = {
  profile: {
    key: "tr-settings-profile",
    label: "Operator Profile",
    placeholder: "Display name",
    hint: "Shown in your dispatch record and on the ride card.",
  },
  certifications: {
    key: "tr-settings-certifications",
    label: "Certifications",
    placeholder: "e.g. 4 Active",
    hint: "Summary shown in your operator card.",
  },
  vehicle: {
    key: "tr-settings-vehicle",
    label: "Vehicle",
    placeholder: "Year Make Model",
    hint: "Make sure this matches your registered vehicle.",
  },
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isTracking, startTracking, stopTracking } = useLocation();
  const { signOut } = useAuth();

  const [notifications, setNotifications] = useState(true);
  const [autoAccept, setAutoAccept] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { hapticsEnabled, setHapticsEnabled, selection, impact, notification } = useHaptics();

  // Editable operator profile fields — rehydrated from storage on mount and
  // persisted on every edit so changes survive reloads and sessions.
  const [profileName, setProfileName] = useState("Ben Driver");
  const [certifications, setCertifications] = useState("4 Active");
  const [vehicle, setVehicle] = useState("’19 Honda Odyssey");
  const [editingFieldId, setEditingFieldId] = useState<EditableFieldId | null>(null);

  useEffect(() => {
    (async () => {
      const [storedProfile, storedCerts, storedVehicle] = await Promise.all([
        storage.get(OPERATOR_FIELDS.profile.key),
        storage.get(OPERATOR_FIELDS.certifications.key),
        storage.get(OPERATOR_FIELDS.vehicle.key),
      ]);
      if (storedProfile) setProfileName(storedProfile);
      if (storedCerts) setCertifications(storedCerts);
      if (storedVehicle) setVehicle(storedVehicle);
    })();
  }, []);

  const editingField = editingFieldId ? OPERATOR_FIELDS[editingFieldId] : null;

  const getEditingValue = (id: EditableFieldId): string => {
    switch (id) {
      case "profile":
        return profileName;
      case "certifications":
        return certifications;
      case "vehicle":
        return vehicle;
      default: {
        // Compile-time exhaustiveness — adding a new EditableFieldId without
        // handling it here will fail to typecheck.
        const _exhaustive: never = id;
        return _exhaustive;
      }
    }
  };

  const editingValue = editingFieldId ? getEditingValue(editingFieldId) : "";

  const handleSaveField = (value: string) => {
    if (!editingFieldId) return;
    const trimmed = value.trim();
    if (!trimmed) return; // EditFieldModal already blocks empties, but belt-and-suspenders
    const { key } = OPERATOR_FIELDS[editingFieldId];
    switch (editingFieldId) {
      case "profile":
        setProfileName(trimmed);
        break;
      case "certifications":
        setCertifications(trimmed);
        break;
      case "vehicle":
        setVehicle(trimmed);
        break;
      default: {
        const _exhaustive: never = editingFieldId;
        return _exhaustive;
      }
    }
    void storage.set(key, trimmed);
  };

  const openEdit = (fieldId: EditableFieldId) => {
    impact(ImpactFeedbackStyle.Light);
    setEditingFieldId(fieldId);
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    notification(NotificationFeedbackType.Warning);
    setSigningOut(true);
    if (router.canGoBack()) router.back();
    await signOut();
  };

  return (
    <PageTransition>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: colors.surfaceLow }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        <FadeInBlock delay={40}>
          <OperatorSummary />
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
            label="Push Notifications"
            description="New ride requests and mission updates"
            value={notifications}
            onValueChange={(v) => {
              selection();
              setNotifications(v);
            }}
          />
          <ToggleRow
            label="Auto-Accept"
            description="Automatically accept high-priority missions"
            value={autoAccept}
            onValueChange={(v) => {
              selection();
              setAutoAccept(v);
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
        <Section kicker="Operator">
          <ReadoutRow label="Profile" value={profileName} onPress={() => openEdit("profile")} editable />
          <ReadoutRow label="Certifications" value={certifications} onPress={() => openEdit("certifications")} editable />
          <ReadoutRow label="Vehicle" value={vehicle} onPress={() => openEdit("vehicle")} editable />
          <ReadoutRow
            label="Earnings"
            value="View"
            chevron
            onPress={() => {
              impact(ImpactFeedbackStyle.Light);
              router.push({ pathname: "/info", params: { slug: "earnings" } });
            }}
          />
        </Section>
        </FadeInBlock>

        <FadeInBlock delay={300}>
        <Section kicker="Support">
          <ReadoutRow
            label="Help Center"
            chevron
            onPress={() => {
              impact(ImpactFeedbackStyle.Light);
              router.push({ pathname: "/info", params: { slug: "help" } });
            }}
          />
          <ReadoutRow
            label="Report an Issue"
            chevron
            onPress={() => {
              impact(ImpactFeedbackStyle.Light);
              router.push({ pathname: "/info", params: { slug: "report" } });
            }}
          />
          <ReadoutRow
            label="Terms of Service"
            chevron
            onPress={() => {
              impact(ImpactFeedbackStyle.Light);
              router.push({ pathname: "/info", params: { slug: "terms" } });
            }}
          />
          <ReadoutRow
            label="Privacy Policy"
            chevron
            onPress={() => {
              impact(ImpactFeedbackStyle.Light);
              router.push({ pathname: "/info", params: { slug: "privacy" } });
            }}
          />
        </Section>
        </FadeInBlock>

        <FadeInBlock delay={380}>
          <SystemFooter signingOut={signingOut} onSignOut={handleSignOut} />
        </FadeInBlock>
      </ScrollView>

      {editingField ? (
        <EditFieldModal
          visible={!!editingFieldId}
          onClose={() => setEditingFieldId(null)}
          onSave={handleSaveField}
          label={editingField.label}
          placeholder={editingField.placeholder}
          hint={editingField.hint}
          initialValue={editingValue}
        />
      ) : null}
    </PageTransition>
  );
}

/* ─────────────────────────────────────── */
/*   Operator Summary (dispatch readout)   */
/* ─────────────────────────────────────── */
function OperatorSummary() {
  return (
    <View
      style={{
        marginHorizontal: spacing.md,
        marginTop: spacing.md,
        marginBottom: spacing.lg,
        backgroundColor: colors.primary,
        borderRadius: radii.sm,
        borderCurve: "continuous",
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.lg,
        gap: 10,
        overflow: "hidden",
      }}
    >
      {/* Top row: ID + Status pill */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text
          style={{
            color: colors.slate400,
            fontSize: 11,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 2.4,
          }}
        >
          Operator · 099-242
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: "rgba(22, 163, 74, 0.16)",
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: radii.xs,
          }}
        >
          <PulsingDot color={colors.greenLight} />
          <Text
            style={{
              color: colors.greenLight,
              fontSize: 10,
              fontWeight: "900",
              letterSpacing: 1.8,
              textTransform: "uppercase",
            }}
          >
            On Duty
          </Text>
        </View>
      </View>

      {/* Driver name */}
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: 32,
          fontWeight: "900",
          letterSpacing: -0.8,
          lineHeight: 36,
        }}
      >
        Ben Driver
      </Text>

      {/* Meta line */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Meta label="Certified" value="Mar 2024" />
        <Divider dim />
        <Meta label="Vehicle" value="Odyssey" />
        <Divider dim />
        <Meta label="Shift" value="03:42" />
      </View>
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
      <Text
        style={{
          color: colors.slate400,
          fontSize: 10,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 1.6,
        }}
      >
        {label}
      </Text>
      <Text style={{ color: colors.slate300, fontSize: 13, fontWeight: "700", letterSpacing: 0.2 }}>
        {value}
      </Text>
    </View>
  );
}

function Divider({ dim }: { dim?: boolean }) {
  return (
    <View
      style={{
        width: 3,
        height: 3,
        borderRadius: 3,
        backgroundColor: dim ? colors.primarySoft : colors.slate300,
      }}
    />
  );
}

/* ─────────────────────────────────────── */
/*            Section wrapper              */
/* ─────────────────────────────────────── */
function Section({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text
        style={{
          color: colors.slate400,
          fontSize: 11,
          fontWeight: "900",
          textTransform: "uppercase",
          letterSpacing: 2.8,
          paddingHorizontal: spacing.md + 4,
          paddingBottom: 10,
        }}
      >
        {kicker}
      </Text>
      <View style={{ gap: 3, paddingHorizontal: spacing.md }}>{children}</View>
    </View>
  );
}

/* ─────────────────────────────────────── */
/*   Toggle row (telemetry readout style)  */
/* ─────────────────────────────────────── */
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
  onValueChange: (v: boolean) => void;
  critical?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surface,
        paddingVertical: 16,
        paddingHorizontal: spacing.md,
        borderRadius: radii.sm,
        borderCurve: "continuous",
        gap: 14,
        minHeight: 60,
      }}
    >
      {critical ? (
        <View
          style={{
            width: 2,
            alignSelf: "stretch",
            marginVertical: -16,
            backgroundColor: value ? colors.green : colors.slate200,
          }}
        />
      ) : null}

      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{
              color: colors.primary,
              fontSize: 11,
              fontWeight: "900",
              textTransform: "uppercase",
              letterSpacing: 2.2,
            }}
          >
            {label}
          </Text>
          {critical && value ? <PulsingDot color={colors.green} /> : null}
        </View>
        <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "500", letterSpacing: 0.1 }}>
          {description}
        </Text>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.slate200, true: colors.blue }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.slate200}
      />
    </View>
  );
}

/* ─────────────────────────────────────── */
/*   Readout row (flat telemetry line)     */
/* ─────────────────────────────────────── */
function ReadoutRow({
  label,
  value,
  chevron,
  onPress,
  editable,
}: {
  label: string;
  value?: string;
  chevron?: boolean;
  onPress?: () => void;
  editable?: boolean;
}) {
  const { impact } = useHaptics();
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      impact(ImpactFeedbackStyle.Light);
    }
  };
  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}${editable ? ", tap to edit" : ""}` : label}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: spacing.md,
        paddingVertical: 14,
        minHeight: 52,
        backgroundColor: pressed ? colors.surfaceHigh : colors.surface,
        borderRadius: radii.sm,
        borderCurve: "continuous",
        gap: 12,
      })}
    >
      <Text
        style={{
          color: colors.primary,
          fontSize: 11,
          fontWeight: "900",
          textTransform: "uppercase",
          letterSpacing: 2,
          flex: 1,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {value ? (
          <Text
            style={{
              color: colors.primarySoft,
              fontSize: 13,
              fontWeight: "700",
              letterSpacing: 0.2,
            }}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}
        {editable ? (
          <Text style={{ color: colors.blue, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4 }}>
            Edit
          </Text>
        ) : chevron ? (
          <Text style={{ color: colors.slate400, fontSize: 16, fontWeight: "700" }}>›</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/* ─────────────────────────────────────── */
/*   System footer (sign out + build)      */
/* ─────────────────────────────────────── */
function SystemFooter({
  signingOut,
  onSignOut,
}: {
  signingOut: boolean;
  onSignOut: () => void;
}) {
  return (
    <View style={{ paddingHorizontal: spacing.md, gap: spacing.lg, marginTop: spacing.xs }}>
      <Pressable
        onPress={onSignOut}
        disabled={signingOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={({ pressed }) => ({
          backgroundColor: pressed || signingOut ? "#1E293B" : colors.primary,
          borderRadius: radii.sm,
          borderCurve: "continuous",
          paddingVertical: 18,
          paddingHorizontal: spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          minHeight: 60,
        })}
      >
        <View style={{ gap: 2 }}>
          <Text
            style={{
              color: colors.errorLight,
              fontSize: 11,
              fontWeight: "900",
              textTransform: "uppercase",
              letterSpacing: 2.6,
            }}
          >
            {signingOut ? "Signing out" : "Sign Out"}
          </Text>
          <Text style={{ color: colors.slate400, fontSize: 12, fontWeight: "600", letterSpacing: 0.2 }}>
            Ends session and clears token
          </Text>
        </View>
        <Text style={{ color: colors.errorLight, fontSize: 18, fontWeight: "900" }}>
          {signingOut ? "…" : "→"}
        </Text>
      </Pressable>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text
          style={{
            color: colors.slate400,
            fontSize: 10,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          Build 0.1.0 · Prototype
        </Text>
        <Text
          style={{
            color: colors.slate400,
            fontSize: 10,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          TrustedRiders
        </Text>
      </View>
    </View>
  );
}

/* ─────────────────────────────────────── */
/*    Pulsing dot (transmission beacon)    */
/* ─────────────────────────────────────── */
function PulsingDot({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.3,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: Platform.OS !== "web",
          }),
        ]),
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.3,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: Platform.OS !== "web",
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, scale]);

  return (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}
