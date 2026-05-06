import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline } from "@/components/Map";

import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import { LocationRow } from "@/components/ui/LocationRow";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useDispatch } from "@/lib/dispatch-context";
import type { DispatchedRide } from "@/lib/rides";
import { colors, radii, spacing } from "@/lib/theme";

export default function PastRideScreen() {
  const insets = useSafeAreaInsets();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const { rides } = useDispatch();
  const ride = rides.find((item) => item.id === rideId);

  if (!ride) {
    return (
      <PageTransition>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.surfaceLow,
            padding: spacing.md,
            justifyContent: "center",
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: radii.md,
              borderCurve: "continuous",
              padding: spacing.xl,
              gap: spacing.sm,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 20, fontWeight: "900", textAlign: "center" }}>
              Ride unavailable
            </Text>
            <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "600", textAlign: "center", lineHeight: 20 }}>
              This ride is not present in the latest backend response.
            </Text>
          </View>
        </View>
      </PageTransition>
    );
  }

  const hasRouteMap = !!ride.pickupCoords && !!ride.dropoffCoords;
  const routeCoords =
    ride.routeCoords.length > 1
      ? ride.routeCoords
      : [ride.pickupCoords, ride.dropoffCoords].filter((coord): coord is NonNullable<typeof coord> => !!coord);
  const midLat = routeCoords.length > 0 ? routeCoords.reduce((sum, c) => sum + c.latitude, 0) / routeCoords.length : 0;
  const midLng = routeCoords.length > 0 ? routeCoords.reduce((sum, c) => sum + c.longitude, 0) / routeCoords.length : 0;

  return (
    <PageTransition>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: colors.surfaceLow }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        <FadeInBlock delay={40}>
          {hasRouteMap ? (
            <View style={{ height: 180, borderRadius: radii.md, overflow: "hidden", margin: spacing.md, borderCurve: "continuous" }}>
              <MapView
                style={{ flex: 1 }}
                initialRegion={{
                  latitude: midLat,
                  longitude: midLng,
                  latitudeDelta: 0.035,
                  longitudeDelta: 0.035,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
              >
                <Marker coordinate={ride.pickupCoords!} title="Pickup" pinColor={colors.blue} />
                <Marker coordinate={ride.dropoffCoords!} title="Drop-off" pinColor={colors.green} />
                <Polyline
                  coordinates={routeCoords}
                  strokeColor={colors.blue}
                  strokeWidth={3}
                />
              </MapView>
            </View>
          ) : (
            <View
              style={{
                height: 180,
                margin: spacing.md,
                borderRadius: radii.md,
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
                <StatusBadge status={getPastRideBadgeStatus(ride.status)} />
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
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radii.md,
                  borderCurve: "continuous",
                  padding: spacing.md,
                  gap: 8,
                }}
              >
                <Text style={{ color: colors.slate400, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.3 }}>
                  Backend Notes
                </Text>
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "600", lineHeight: 20 }}>
                  {ride.notes}
                </Text>
              </View>
            </FadeInBlock>
          ) : null}
        </View>
      </ScrollView>
    </PageTransition>
  );
}

function getPastRideBadgeStatus(status: DispatchedRide["status"]) {
  return status === "cancelled" ? "cancelled" : "completed";
}
