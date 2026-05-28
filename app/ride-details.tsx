import { useCallback, useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackChevron } from "@/components/ui/BackChevron";
import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import { useDispatch } from "@/lib/dispatch-context";
import { fetchRides } from "@/lib/fleet-api";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { type DispatchedRide, hasDrawableRoute, type RideCoordinate } from "@/lib/rides";
import { colors, radii, shadows, spacing } from "@/lib/theme";

export default function RideDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { rideId } = useLocalSearchParams<{ rideId?: string }>();
  const { rides, acceptRide, declineRide } = useDispatch();
  const { impact, notification } = useHaptics();
  const [fetchedRide, setFetchedRide] = useState<DispatchedRide | null>(null);
  const ride = rides.find((item) => item.id === rideId) ?? rides.find((item) => normalizeRideId(item.id) === normalizeRideId(rideId)) ?? fetchedRide;
  const detailId = normalizeRideId(ride?.id ?? rideId);
  const isPendingRequest = ride?.status === "pending";

  useEffect(() => {
    if (ride || !rideId) return;
    void fetchRides()
      .then((nextRides) => {
        const nextRide = nextRides.find((item) => item.id === rideId)
          ?? nextRides.find((item) => normalizeRideId(item.id) === normalizeRideId(rideId))
          ?? null;
        setFetchedRide(nextRide);
      })
      .catch((error) => {
        console.log("[ride-details] fallback ride fetch skipped", error instanceof Error ? error.message : error);
      });
  }, [ride, rideId]);

  const openChat = useCallback((target: DispatchedRide) => {
    impact(ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/chat",
      params: { rideId: target.id, riderName: target.passengerName },
    });
  }, [impact, router]);

  const openNavigation = useCallback((target: DispatchedRide) => {
    impact(ImpactFeedbackStyle.Light);
    Linking.openURL(navigationUrlForRide(target));
  }, [impact]);

  return (
    <PageTransition>
      <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
        <View
          style={{
            backgroundColor: colors.surface,
            paddingTop: insets.top + 8,
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.sm,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <BackChevron />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" }}>
              {isPendingRequest ? "Request Review" : "Current Ride"}
            </Text>
            <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "900", lineHeight: 27 }} numberOfLines={1}>
              {detailId ? `Ride #${detailId}` : "Ride Details"}
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ padding: spacing.md, paddingBottom: ride ? insets.bottom + (isPendingRequest ? 178 : 112) : insets.bottom + 28, gap: spacing.md }}
        >
          {ride ? (
            <>
              <FadeInBlock delay={50}>
                <RideDetailHero ride={ride} />
              </FadeInBlock>
              <FadeInBlock delay={95}>
                <RideDetailMap ride={ride} />
              </FadeInBlock>
              <FadeInBlock delay={125}>
                <RouteDetailPanel ride={ride} />
              </FadeInBlock>
              <FadeInBlock delay={155}>
                <TripContextPanel ride={ride} />
              </FadeInBlock>
            </>
          ) : (
            <FadeInBlock delay={60}>
              <MissingRideNotice rideId={rideId} />
            </FadeInBlock>
          )}
        </ScrollView>

        {ride ? (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: spacing.md,
              paddingTop: spacing.sm,
              paddingBottom: insets.bottom + spacing.md,
              backgroundColor: colors.surfaceFrosted,
              borderTopWidth: 1,
              borderTopColor: colors.slate100,
              gap: spacing.sm,
            }}
          >
            {isPendingRequest ? (
              <>
                <DetailActionButton
                  label="Accept Request"
                  tone="primary"
                  onPress={() => {
                    notification(NotificationFeedbackType.Success);
                    acceptRide(ride.id);
                    router.back();
                  }}
                />
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <DetailActionButton label="Chat" tone="secondary" onPress={() => openChat(ride)} />
                  <DetailActionButton
                    label="Decline"
                    tone="danger"
                    onPress={() => {
                      impact(ImpactFeedbackStyle.Medium);
                      declineRide(ride.id);
                      router.back();
                    }}
                  />
                </View>
              </>
            ) : (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <DetailActionButton label="Chat" tone="secondary" onPress={() => openChat(ride)} />
                <DetailActionButton label="Navigate" tone="primary" onPress={() => openNavigation(ride)} />
              </View>
            )}
          </View>
        ) : null}
      </View>
    </PageTransition>
  );
}

function RideDetailMap({ ride }: { ride: DispatchedRide }) {
  const coords = hasDrawableRoute(ride.routeCoords)
    ? ride.routeCoords
    : [ride.pickupCoords, ride.dropoffCoords].filter((coord): coord is RideCoordinate => !!coord);

  if (!hasDrawableRoute(coords)) {
    return (
      <View style={{ height: 190, borderRadius: radii.md, backgroundColor: colors.mapPlaceholder, alignItems: "center", justifyContent: "center", padding: spacing.md }}>
        <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "900", textAlign: "center", lineHeight: 20 }}>
          Map appears when ride coordinates are available.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ height: 230, borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.mapPlaceholder, ...shadows.soft }}>
      <MapView style={{ flex: 1 }} initialRegion={regionFor(coords)} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}>
        <Polyline coordinates={coords} strokeWidth={4} strokeColor={colors.blue} />
        {ride.pickupCoords ? <Marker coordinate={ride.pickupCoords} pinColor={colors.green} /> : null}
        {ride.dropoffCoords ? <Marker coordinate={ride.dropoffCoords} pinColor={colors.blue} /> : null}
      </MapView>
    </View>
  );
}

function RideDetailHero({ ride }: { ride: DispatchedRide }) {
  const isPendingRequest = ride.status === "pending";
  return (
    <View style={{ backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.md, gap: spacing.lg, ...shadows.floating }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md }}>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text style={{ color: colors.slate300, fontSize: 12, fontWeight: "900", letterSpacing: 1.4, textTransform: "uppercase" }}>
            {isPendingRequest ? "Pending Request" : "Current Ride"}
          </Text>
          <Text style={{ color: colors.surface, fontSize: 33, fontWeight: "900", lineHeight: 38 }} numberOfLines={1}>
            Ride #{normalizeRideId(ride.id)}
          </Text>
          <Text style={{ color: colors.slate300, fontSize: 15, fontWeight: "800" }} numberOfLines={1}>
            {ride.scheduledDate} · {ride.scheduledTime} · {ride.transitType}
          </Text>
        </View>
        <View style={{ backgroundColor: isPendingRequest ? colors.amberSoft : colors.blueSoft, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 8 }}>
          <Text style={{ color: isPendingRequest ? colors.amber : colors.blue, fontSize: 12, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" }}>
            {isPendingRequest ? "New" : rideStatusLabel(ride.status)}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <MetricTile label="Trip" value={ride.tripType} />
        <MetricTile label="Vehicle" value={ride.transitType} />
      </View>
    </View>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: radii.sm, padding: spacing.sm, gap: 3 }}>
      <Text style={{ color: colors.slate400, fontSize: 10, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" }}>
        {label}
      </Text>
      <Text style={{ color: colors.surface, fontSize: 15, fontWeight: "900" }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function RouteDetailPanel({ ride }: { ride: DispatchedRide }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, gap: spacing.md, ...shadows.soft }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.md }}>
        <Text style={{ color: colors.primary, fontSize: 21, fontWeight: "900" }}>
          Route
        </Text>
        <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "900" }}>
          Pickup to dropoff
        </Text>
      </View>
      <View style={{ gap: 0 }}>
        <RouteStop tone="pickup" label="Pickup" address={ride.pickupAddress} />
        <View style={{ height: 24, marginLeft: 9, borderLeftWidth: 2, borderLeftColor: colors.slate200 }} />
        <RouteStop tone="dropoff" label="Dropoff" address={ride.dropoffAddress} />
      </View>
    </View>
  );
}

function RouteStop({ tone, label, address }: { tone: "pickup" | "dropoff"; label: string; address: string }) {
  const color = tone === "pickup" ? colors.green : colors.blue;
  return (
    <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
      <View style={{ width: 20, alignItems: "center", paddingTop: 3 }}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: color, borderWidth: 4, borderColor: tone === "pickup" ? colors.greenSoft : colors.blueSoft }} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={{ color: colors.slate400, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.3 }}>
          {label}
        </Text>
        <Text selectable style={{ color: colors.primary, fontSize: 18, fontWeight: "900", lineHeight: 24 }}>
          {address}
        </Text>
      </View>
    </View>
  );
}

function TripContextPanel({ ride }: { ride: DispatchedRide }) {
  const hasNotes = !!ride.notes?.trim();
  const fallback = ride.status === "pending"
    ? "No special instructions attached to this request."
    : "No special instructions attached to this ride.";
  return (
    <View style={{ backgroundColor: colors.surfaceLowest, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.slate100 }}>
      <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "900" }}>
        Dispatch Context
      </Text>
      <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
        {hasNotes ? ride.notes : fallback}
      </Text>
    </View>
  );
}

function DetailActionButton({ label, tone, onPress }: { label: string; tone: "primary" | "secondary" | "danger"; onPress: () => void }) {
  const backgroundColor = tone === "primary" ? colors.primary : tone === "danger" ? colors.errorSoft : colors.surface;
  const color = tone === "primary" ? colors.surface : tone === "danger" ? colors.error : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flex: 1,
        minHeight: tone === "primary" ? 54 : 48,
        borderRadius: radii.sm,
        backgroundColor,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.72 : 1,
        borderWidth: tone === "primary" ? 0 : 1,
        borderColor: tone === "danger" ? colors.errorSoftStrong : colors.slate200,
      })}
    >
      <Text style={{ color, fontSize: 14, fontWeight: "900", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

function MissingRideNotice({ rideId }: { rideId?: string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, gap: spacing.sm, ...shadows.soft }}>
      <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "900" }}>
        Ride request not found
      </Text>
      <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "700", lineHeight: 19 }}>
        {rideId ? `Ride #${normalizeRideId(rideId)} is no longer in the current request list.` : "This request is no longer available."}
      </Text>
    </View>
  );
}

function rideStatusLabel(status: DispatchedRide["status"]) {
  if (status === "accepted") return "Accepted";
  if (status === "en_route") return "En Route";
  if (status === "picked_up") return "Picked Up";
  if (status === "in_transit") return "In Transit";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Pending";
}

function navigationUrlForRide(ride: DispatchedRide) {
  const destination = ride.dropoffCoords
    ? `${ride.dropoffCoords.latitude},${ride.dropoffCoords.longitude}`
    : ride.dropoffAddress;
  const encodedDestination = encodeURIComponent(destination);

  if (Platform.OS === "ios") {
    return `http://maps.apple.com/?daddr=${encodedDestination}&dirflg=d`;
  }

  if (Platform.OS === "android") {
    return `google.navigation:q=${encodedDestination}`;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`;
}

function normalizeRideId(value?: string) {
  return String(value ?? "").replace(/^ride-?/i, "");
}

function regionFor(coords: RideCoordinate[]) {
  const latitudes = coords.map((coord) => coord.latitude);
  const longitudes = coords.map((coord) => coord.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.8, 0.025),
    longitudeDelta: Math.max((maxLng - minLng) * 1.8, 0.025),
  };
}
