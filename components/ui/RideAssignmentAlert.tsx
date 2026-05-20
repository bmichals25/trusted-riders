import { useEffect, useRef } from "react";
import { Image, Modal, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import MapView, { Marker, Polyline } from "@/components/Map";

import { Avatar } from "@/components/ui/Avatar";
import { useDispatch } from "@/lib/dispatch-context";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { hasDrawableRoute } from "@/lib/rides";
import { colors, radii, spacing } from "@/lib/theme";

export function RideAssignmentAlert() {
  const router = useRouter();
  const { assignmentNotice, dismissAssignmentNotice } = useDispatch();
  const { impact, notification } = useHaptics();
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    if (!assignmentNotice) return;

    notification(NotificationFeedbackType.Warning);
    impact(ImpactFeedbackStyle.Heavy);
  }, [assignmentNotice, impact, notification]);

  if (!assignmentNotice) return null;

  const ride = assignmentNotice.ride;
  const routeCoords =
    ride.routeCoords.length > 1
      ? ride.routeCoords
      : ride.pickupCoords && ride.dropoffCoords
      ? [ride.pickupCoords, ride.dropoffCoords]
      : [];
  const hasRouteMap = routeCoords.length > 1;
  const midLat = hasRouteMap ? routeCoords.reduce((sum, coord) => sum + coord.latitude, 0) / routeCoords.length : 0;
  const midLng = hasRouteMap ? routeCoords.reduce((sum, coord) => sum + coord.longitude, 0) / routeCoords.length : 0;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismissAssignmentNotice}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(15, 23, 42, 0.72)",
          justifyContent: "center",
          padding: spacing.lg,
        }}
      >
        <View
          accessibilityRole="alert"
          accessibilityLabel={`New ride assigned. ${ride.scheduledDate} at ${ride.scheduledTime}. Pickup: ${ride.pickupAddress}. Drop-off: ${ride.dropoffAddress}. Passenger: ${ride.passengerName}.`}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            overflow: "hidden",
            shadowColor: colors.primary,
            shadowOffset: { width: 0, height: 18 },
            shadowOpacity: 0.24,
            shadowRadius: 34,
            elevation: 12,
          }}
        >
          <View style={mapHero}>
            {hasRouteMap ? (
              <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: midLat,
                  longitude: midLng,
                  latitudeDelta: 0.035,
                  longitudeDelta: 0.035,
                }}
                onMapReady={() => {
                  mapRef.current?.fitToCoordinates(routeCoords, {
                    edgePadding: { top: 74, right: 42, bottom: 178, left: 42 },
                    animated: false,
                  });
                }}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                {ride.pickupCoords ? <Marker coordinate={ride.pickupCoords} title="Pickup" pinColor={colors.blue} /> : null}
                {ride.dropoffCoords ? <Marker coordinate={ride.dropoffCoords} title="Drop-off" pinColor={colors.green} /> : null}
                {hasDrawableRoute(routeCoords) ? (
                  <Polyline coordinates={routeCoords} strokeColor={colors.blue} strokeWidth={4} />
                ) : null}
              </MapView>
            ) : (
              <View style={unavailableCard}>
                <Text style={unavailableTitle}>Route map unavailable</Text>
                <Text style={unavailableText}>The backend did not provide pickup and drop-off coordinates.</Text>
              </View>
            )}

            <View style={mapScrimTop} />
            <View style={mapHeader}>
              <View style={assignedPill}>
                <Text style={assignedText}>New ride assigned</Text>
              </View>
            </View>

            <View style={mapOverlayStack}>
              <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "stretch" }}>
                <View style={riderCard}>
                  {ride.passengerPhotoUrl ? (
                    <Image
                      source={{ uri: ride.passengerPhotoUrl }}
                      accessibilityLabel={`${ride.passengerName} profile photo`}
                      style={riderPhoto}
                    />
                  ) : (
                    <Avatar initials={getInitials(ride.passengerName)} size={42} />
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={compactLabel}>Rider</Text>
                    <Text selectable style={riderNameText} numberOfLines={1}>
                      {ride.passengerName}
                    </Text>
                    {!ride.passengerPhotoUrl ? (
                      <Text style={missingDataText} numberOfLines={1}>
                        Photo not provided
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={timeCard}>
                  <Text style={timeLabel}>Pickup</Text>
                  <Text style={timeDateText} numberOfLines={1}>{ride.scheduledDate}</Text>
                  <Text style={timeText} numberOfLines={1}>{ride.scheduledTime}</Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <RouteLine label="Pickup" value={ride.pickupAddress} color={colors.blue} />
                <RouteLine label="Drop-off" value={ride.dropoffAddress} color={colors.green} />
              </View>
            </View>
          </View>

          <View style={{ padding: spacing.md, gap: spacing.sm }}>
            <View style={conditionsCard}>
              <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.3 }}>
                Special conditions
              </Text>
              <Text selectable numberOfLines={2} style={{ color: ride.notes ? colors.primary : colors.slate500, fontSize: 15, fontWeight: "700", lineHeight: 20 }}>
                {ride.notes || "Not provided by backend"}
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss new ride alert"
                onPress={dismissAssignmentNotice}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 48,
                  borderRadius: radii.sm,
                  backgroundColor: pressed ? colors.slate200 : colors.slate100,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <Text style={{ color: colors.primarySoft, fontSize: 13, fontWeight: "900", textTransform: "uppercase" }}>
                  Dismiss
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Review new ride"
                onPress={() => {
                  router.push({ pathname: "/ride-details", params: { rideId: ride.id } });
                  setTimeout(dismissAssignmentNotice, 0);
                }}
                style={({ pressed }) => ({
                  flex: 1.4,
                  minHeight: 48,
                  borderRadius: radii.sm,
                  backgroundColor: pressed ? colors.primarySoft : colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <Text style={{ color: colors.surface, fontSize: 13, fontWeight: "900", textTransform: "uppercase" }}>
                  Review Ride
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "TR";
}

function RouteLine({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        flexDirection: "row",
        gap: 8,
        backgroundColor: colors.surfaceFrosted,
        borderRadius: radii.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
      }}
    >
      <View
        style={{
          width: 11,
          height: 11,
          borderRadius: radii.pill,
          backgroundColor: color,
          marginTop: 5,
        }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.slate500, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.1 }}>
          {label}
        </Text>
        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "900", lineHeight: 18, marginTop: 3 }} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const conditionsCard = {
  backgroundColor: colors.surfaceLow,
  borderRadius: radii.sm,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  gap: 4,
};

const mapHero = {
  height: 430,
  backgroundColor: colors.mapPlaceholder,
};

const mapScrimTop = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  height: 116,
  backgroundColor: "rgba(15, 23, 42, 0.18)",
};

const mapHeader = {
  position: "absolute" as const,
  top: spacing.md,
  left: spacing.md,
  right: spacing.md,
  flexDirection: "row" as const,
  alignItems: "center" as const,
};

const assignedPill = {
  backgroundColor: colors.surfaceFrosted,
  borderRadius: radii.pill,
  paddingHorizontal: spacing.sm,
  paddingVertical: 7,
};

const assignedText = {
  color: colors.amber,
  fontSize: 11,
  fontWeight: "900" as const,
  letterSpacing: 1.7,
  textTransform: "uppercase" as const,
};

const mapOverlayStack = {
  position: "absolute" as const,
  left: spacing.md,
  right: spacing.md,
  bottom: spacing.md,
  gap: spacing.sm,
};

const unavailableCard = {
  flex: 1,
  backgroundColor: colors.surfaceLow,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  padding: spacing.md,
  gap: 6,
};

const riderCard = {
  flex: 1.15,
  minWidth: 0,
  backgroundColor: colors.surfaceFrosted,
  borderRadius: radii.sm,
  padding: spacing.sm,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: spacing.sm,
};

const riderPhoto = {
  width: 42,
  height: 42,
  borderRadius: radii.sm,
  backgroundColor: colors.surfaceLow,
};

const compactLabel = {
  color: colors.slate500,
  fontSize: 11,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
};

const riderNameText = {
  color: colors.primary,
  fontSize: 19,
  fontWeight: "900" as const,
  lineHeight: 23,
};

const missingDataText = {
  color: colors.slate400,
  fontSize: 11,
  fontWeight: "700" as const,
};

const timeCard = {
  width: 116,
  backgroundColor: "rgba(15, 23, 42, 0.94)",
  borderRadius: radii.sm,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.sm,
  justifyContent: "center" as const,
};

const timeLabel = {
  color: colors.surfaceScrim80,
  fontSize: 10,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.2,
};

const timeDateText = {
  color: colors.surface,
  fontSize: 18,
  fontWeight: "900" as const,
  lineHeight: 22,
};

const timeText = {
  color: colors.accent,
  fontSize: 23,
  fontWeight: "900" as const,
  lineHeight: 27,
};

const unavailableTitle = {
  color: colors.primary,
  fontSize: 16,
  fontWeight: "900" as const,
  textAlign: "center" as const,
};

const unavailableText = {
  color: colors.slate500,
  fontSize: 13,
  fontWeight: "600" as const,
  textAlign: "center" as const,
  lineHeight: 18,
};
