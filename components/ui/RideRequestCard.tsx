import { Pressable, Text, View } from "react-native";

import { type DispatchedRide } from "@/lib/rides";
import { colors, radii, shadows, spacing } from "@/lib/theme";

export function RideRequestCard({
  ride,
  onOpen,
  onChat,
  onAccept,
  onDecline,
}: {
  ride: DispatchedRide;
  onOpen: () => void;
  onChat: () => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const requestId = ride.id.replace(/^ride-?/i, "");

  return (
    <View style={requestCardStyle}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open pending ride request ${requestId}`}
        style={({ pressed }) => ({ gap: spacing.md, opacity: pressed ? 0.76 : 1 })}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
          <View style={requestMarkStyle}>
            <Text style={{ color: colors.primary, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }}>NEW</Text>
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
              <Text style={{ color: colors.primary, fontSize: 19, fontWeight: "900", flex: 1 }} numberOfLines={1}>
                Ride #{requestId}
              </Text>
              <View style={requestTimePillStyle}>
                <Text style={{ color: colors.primarySoft, fontSize: 12, fontWeight: "900" }}>{ride.scheduledTime}</Text>
              </View>
            </View>
            <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>
              {ride.scheduledDate} · {ride.transitType}
            </Text>
          </View>
        </View>

        <View style={requestRouteStyle}>
          <RequestRoutePoint tone="pickup" label="Pickup" address={ride.pickupAddress} />
          <View style={{ height: 14, marginLeft: 5, borderLeftWidth: 1, borderLeftColor: colors.slate200 }} />
          <RequestRoutePoint tone="dropoff" label="Dropoff" address={ride.dropoffAddress} />
        </View>
      </Pressable>

      <View style={{ gap: spacing.sm }}>
        <RequestActionButton label="Accept request" tone="primary" onPress={onAccept} />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <RequestActionButton label="Chat" tone="secondary" onPress={onChat} />
          <RequestActionButton label="Decline" tone="danger" onPress={onDecline} />
        </View>
      </View>
    </View>
  );
}

function RequestRoutePoint({ tone, label, address }: { tone: "pickup" | "dropoff"; label: string; address: string }) {
  const color = tone === "pickup" ? colors.green : colors.blue;
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
      <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: color, marginTop: 3 }} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: colors.slate400, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2 }}>
          {label}
        </Text>
        <Text selectable style={{ color: colors.primary, fontSize: 15, fontWeight: "800", lineHeight: 20 }}>
          {address}
        </Text>
      </View>
    </View>
  );
}

function RequestActionButton({ label, tone, onPress }: { label: string; tone: "primary" | "secondary" | "danger"; onPress: () => void }) {
  const backgroundColor = tone === "primary" ? colors.primary : tone === "danger" ? colors.errorSoft : colors.surfaceLow;
  const color = tone === "primary" ? colors.surface : tone === "danger" ? colors.error : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 46,
        borderRadius: radii.sm,
        backgroundColor,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.72 : 1,
        borderWidth: tone === "secondary" ? 1 : 0,
        borderColor: colors.slate200,
      })}
    >
      <Text style={{ color, fontSize: 13, fontWeight: "900", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

const requestCardStyle = {
  backgroundColor: colors.surface,
  borderRadius: radii.md,
  padding: spacing.md,
  gap: spacing.md,
  borderWidth: 1,
  borderColor: colors.ghostBorder,
  ...shadows.soft,
} as const;

const requestMarkStyle = {
  width: 44,
  height: 44,
  borderRadius: radii.sm,
  backgroundColor: colors.amberSoft,
  alignItems: "center",
  justifyContent: "center",
} as const;

const requestTimePillStyle = {
  minHeight: 28,
  paddingHorizontal: spacing.sm,
  borderRadius: radii.pill,
  backgroundColor: colors.surfaceLow,
  alignItems: "center",
  justifyContent: "center",
} as const;

const requestRouteStyle = {
  backgroundColor: colors.surfaceLowest,
  borderRadius: radii.sm,
  paddingVertical: spacing.md,
  paddingHorizontal: spacing.md,
  borderWidth: 1,
  borderColor: colors.slate100,
} as const;
