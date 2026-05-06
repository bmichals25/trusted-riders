import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline } from "@/components/Map";

import { EmergencyModal } from "@/components/ui/EmergencyModal";
import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import { GradientCard } from "@/components/ui/gradient-card";
import { LocationRow } from "@/components/ui/LocationRow";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DISPATCH_PHONE, formatPhone } from "@/lib/config";
import { useDispatch } from "@/lib/dispatch-context";
import { useHaptics } from "@/lib/haptics-context";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "@/lib/haptics";
import { useDirections } from "@/lib/use-directions";
import type { DispatchedRide } from "@/lib/rides";
import { colors, radii, spacing } from "@/lib/theme";

export default function RideDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const { rides, acceptRide, declineRide } = useDispatch();
  const ride = rides.find((item) => item.id === rideId) ?? makeMissingRide(rideId);
  const { impact, notification } = useHaptics();
  const mapRef = useRef<MapView | null>(null);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const isPendingRide = ride.status === "pending";
  const hasRouteMap = !!ride.pickupCoords && !!ride.dropoffCoords;
  const directions = useDirections(ride.pickupCoords, ride.dropoffCoords);

  const routeCoords =
    ride.routeCoords.length > 1
      ? ride.routeCoords
      : directions.routeCoords && directions.routeCoords.length > 1
      ? directions.routeCoords
      : [ride.pickupCoords, ride.dropoffCoords].filter((coord): coord is NonNullable<typeof coord> => !!coord);

  const midLat = routeCoords.length > 0 ? routeCoords.reduce((sum, c) => sum + c.latitude, 0) / routeCoords.length : 0;
  const midLng = routeCoords.length > 0 ? routeCoords.reduce((sum, c) => sum + c.longitude, 0) / routeCoords.length : 0;

  useEffect(() => {
    if (!hasRouteMap || routeCoords.length < 2) return;
    mapRef.current?.fitToCoordinates(routeCoords, {
      edgePadding: { top: 36, right: 36, bottom: 36, left: 36 },
      animated: false,
    });
  }, [hasRouteMap, routeCoords]);

  return (
    <PageTransition>
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.surfaceLow }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <FadeInBlock delay={40}>
      {hasRouteMap ? (
        <View style={{ height: 200, borderRadius: radii.md, overflow: "hidden", margin: spacing.md, borderCurve: "continuous" }}>
        <MapView
          ref={mapRef}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: midLat,
            longitude: midLng,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          }}
          onMapReady={() => {
            mapRef.current?.fitToCoordinates(routeCoords, {
              edgePadding: { top: 36, right: 36, bottom: 36, left: 36 },
              animated: false,
            });
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          <Marker
            coordinate={ride.pickupCoords!}
            title="Pickup"
            pinColor={colors.blue}
          />
          <Marker
            coordinate={ride.dropoffCoords!}
            title="Drop-off"
            pinColor={colors.green}
          />
          {routeCoords.length > 1 ? (
            <Polyline
              coordinates={routeCoords}
              strokeColor={colors.blue}
              strokeWidth={4}
            />
          ) : null}
        </MapView>
        </View>
      ) : (
        <View
          style={{
            height: 200,
            borderRadius: radii.md,
            margin: spacing.md,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "900" }}>Route map unavailable</Text>
          <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 18 }}>
            The backend did not provide pickup and drop-off coordinates for this ride.
          </Text>
        </View>
      )}
      </FadeInBlock>

      <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
        <FadeInBlock delay={120}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <StatusBadge status={getRideBadgeStatus(ride.status)} />
            <Text style={{ color: colors.slate400, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.5 }}>
              {ride.scheduledDate} {ride.scheduledTime}
            </Text>
          </View>
          <Text style={{ color: colors.primary, fontSize: 28, fontWeight: "900" }}>
            {ride.passengerName}
          </Text>
          <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "500", textTransform: "uppercase" }}>
            {ride.transitType} — {ride.tripType}
          </Text>
        </View>
        </FadeInBlock>

        <FadeInBlock delay={200}>
        <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderCurve: "continuous", overflow: "hidden" }}>
          <View style={{ padding: spacing.md, gap: 12 }}>
            <LocationRow color={colors.blue} label="Pickup" address={ride.pickupAddress} />
            <View style={{ height: 1, backgroundColor: colors.slate100, marginLeft: 28 }} />
            <LocationRow color={colors.green} label="Drop-off" address={ride.dropoffAddress} />
          </View>
        </View>
        </FadeInBlock>

        {ride.notes ? (
        <FadeInBlock delay={280}>
        <View style={{
          backgroundColor: colors.errorSoft,
          borderRadius: radii.md,
          borderCurve: "continuous",
          padding: spacing.md,
          gap: 8,
        }}>
          <Text style={{ color: colors.error, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.3 }}>
            Care Notes
          </Text>
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600", lineHeight: 20 }}>
            {ride.notes}
          </Text>
        </View>
        </FadeInBlock>
        ) : null}

        {isPendingRide ? (
          <FadeInBlock delay={360}>
          <View style={{ gap: spacing.sm }}>
            <Pressable
              onPress={() => {
                notification(NotificationFeedbackType.Success);
                acceptRide(ride.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Accept ride ${ride.id}`}
            >
              <GradientCard padding={18}>
                <Text style={{ color: colors.surface, fontSize: 14, fontWeight: "800", textAlign: "center", textTransform: "uppercase", letterSpacing: 1.5 }}>
                  Accept Mission
                </Text>
              </GradientCard>
            </Pressable>
            <Pressable
              onPress={() => {
                notification(NotificationFeedbackType.Warning);
                declineRide(ride.id);
                router.back();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Decline ride ${ride.id}`}
              style={({ pressed }) => ({
                minHeight: 52,
                borderRadius: radii.md,
                borderCurve: "continuous",
                backgroundColor: pressed ? colors.errorSoftStrong : colors.errorSoft,
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <Text style={{ color: colors.error, fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5 }}>
                Decline
              </Text>
            </Pressable>
          </View>
          </FadeInBlock>
        ) : (
          <>
          <FadeInBlock delay={360}>
          <Pressable
            onPress={() => {
              notification(NotificationFeedbackType.Warning);
              setEmergencyOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Open emergency options"
            style={({ pressed }) => ({
              backgroundColor: pressed ? "#B91C1C" : colors.error,
              borderRadius: radii.md,
              borderCurve: "continuous",
              paddingVertical: 18,
              paddingHorizontal: spacing.md,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            })}
          >
            <View style={{ gap: 2 }}>
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2.4 }}>
                Tap to escalate
              </Text>
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "900", letterSpacing: -0.3 }}>
                Emergency
              </Text>
            </View>
            <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "900" }}>→</Text>
          </Pressable>
          </FadeInBlock>

          <FadeInBlock delay={440}>
          <Pressable onPress={() => { impact(ImpactFeedbackStyle.Light); router.push({ pathname: "/chat", params: { rideId, riderName: ride.passengerName } }); }} accessibilityRole="button" accessibilityLabel="Open admin chat">
            <GradientCard padding={16}>
              <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 }}>
                <Text style={{ color: colors.surface, fontSize: 14, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5 }}>
                  Admin Chat
                </Text>
                <Text style={{ color: colors.surface, fontSize: 14, fontWeight: "800" }}>→</Text>
              </View>
            </GradientCard>
          </Pressable>
          </FadeInBlock>
          </>
        )}
      </View>

      <EmergencyModal
        visible={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
        description={`Reach help fast during ${ride.passengerName}'s ride.`}
        options={[
          { kicker: "Emergency services", title: "Call 9-1-1", number: "911", variant: "danger" },
          {
            kicker: "Dispatch",
            title: "TrustedRiders",
            number: DISPATCH_PHONE,
            hint: formatPhone(DISPATCH_PHONE),
            variant: "primary",
          },
          ...(ride.emergencyContact
            ? [{
                kicker: "Rider's contact",
                title: "Emergency contact",
                number: ride.emergencyContact,
                hint: formatPhone(ride.emergencyContact),
                variant: "primary" as const,
              }]
            : []),
        ]}
      />
    </ScrollView>
    </PageTransition>
  );
}

function getRideBadgeStatus(status: DispatchedRide["status"]) {
  switch (status) {
    case "pending":
      return "pending";
    case "accepted":
      return "scheduled";
    case "en_route":
      return "enRoute";
    case "picked_up":
      return "arrived";
    case "in_transit":
      return "inTransit";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "scheduled";
  }
}

function makeMissingRide(rideId?: string): DispatchedRide {
  return {
    id: rideId || "unknown",
    passengerName: "Ride not loaded",
    passengerPhotoUrl: "",
    pickupAddress: "Pickup address pending",
    dropoffAddress: "Drop-off address pending",
    pickupCoords: null,
    dropoffCoords: null,
    routeCoords: [],
    scheduledDate: "Date pending",
    scheduledTime: "Time pending",
    transitType: "Sedan",
    tripType: "One-Way",
    notes: "",
    emergencyContact: "",
    status: "pending",
    createdAt: Date.now(),
  };
}
