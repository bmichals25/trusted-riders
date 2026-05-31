import { useCallback, useEffect, useState } from "react";
import { SymbolIcon, type AppSymbolName } from "@/components/ui/SymbolIcon";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackChevron } from "@/components/ui/BackChevron";
import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import { useDispatch } from "@/lib/dispatch-context";
import { fetchRides } from "@/lib/fleet-api";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { showMapProviderOptionsForRide } from "@/lib/map-navigation";
import { type DispatchedRide, hasDrawableRoute, type RideCoordinate } from "@/lib/rides";
import { colors, radii, shadows, spacing } from "@/lib/theme";

export function RideDetailsScreenContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { rideId } = useLocalSearchParams<{ rideId?: string }>();
  const { rides } = useDispatch();
  const { impact } = useHaptics();
  const [fetchedRide, setFetchedRide] = useState<DispatchedRide | null>(null);
  const ride = rides.find((item) => item.id === rideId) ?? rides.find((item) => normalizeRideId(item.id) === normalizeRideId(rideId)) ?? fetchedRide;
  const detailId = normalizeRideId(ride?.id ?? rideId);

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
    showMapProviderOptionsForRide(target);
  }, [impact]);

  return (
    <PageTransition>
      <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
        <RideDetailsHeader detailId={detailId} ride={ride} topInset={insets.top} />

        <ScrollView
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ padding: spacing.md, paddingBottom: ride ? insets.bottom + 178 : insets.bottom + 28, gap: spacing.md }}
        >
          {ride ? (
            <>
              <FadeInBlock delay={50}>
                <RideDetailHero ride={ride} />
              </FadeInBlock>
              <FadeInBlock delay={85}>
                <RideReadinessStrip ride={ride} />
              </FadeInBlock>
              <FadeInBlock delay={115}>
                <RideDetailMap ride={ride} />
              </FadeInBlock>
              <FadeInBlock delay={145}>
                <RouteDetailPanel ride={ride} />
              </FadeInBlock>
              <FadeInBlock delay={175}>
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
          <RideDetailsActionBar
            bottomInset={insets.bottom}
            onChat={() => openChat(ride)}
            onNavigate={() => openNavigation(ride)}
          />
        ) : null}
      </View>
    </PageTransition>
  );
}

function RideDetailsHeader({ detailId, ride, topInset }: { detailId: string; ride: DispatchedRide | null; topInset: number }) {
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
      <BackChevron />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" }}>
          {ride ? rideHeaderEyebrow(ride.status) : "Ride Details"}
        </Text>
        <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "900", lineHeight: 27 }} numberOfLines={1}>
          {detailId ? `Ride #${detailId}` : "Ride Details"}
        </Text>
      </View>
    </View>
  );
}

function RideDetailsActionBar({
  bottomInset,
  onChat,
  onNavigate,
}: {
  bottomInset: number;
  onChat: () => void;
  onNavigate: () => void;
}) {
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: bottomInset + spacing.md,
        backgroundColor: colors.surface,
        gap: spacing.sm,
        ...shadows.floating,
      }}
    >
      <View style={{ gap: spacing.sm }}>
        <DetailActionButton iconName="location.fill" label="Navigate" tone="primary" onPress={onNavigate} />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <DetailActionButton iconName="message.fill" label="Chat" tone="secondary" onPress={onChat} />
        </View>
      </View>
    </View>
  );
}

function RideReadinessStrip({ ride }: { ride: DispatchedRide }) {
  return (
    <View
      accessible
      accessibilityLabel={`Ride readiness. Status ${rideStatusLabel(ride.status)}. Scheduled ${ride.scheduledDate} at ${ride.scheduledTime}. Vehicle ${ride.transitType}.`}
      style={{
        backgroundColor: colors.surfaceLow,
        borderRadius: radii.sm,
        borderCurve: "continuous",
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
      }}
    >
      <ReadinessMetric
        label="Status"
        value={rideStatusLabel(ride.status)}
      />
      <ReadinessMetric
        label="Time"
        value={ride.scheduledTime}
      />
      <ReadinessMetric
        label="Vehicle"
        value={ride.transitType}
      />
    </View>
  );
}

function ReadinessMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: colors.slate500, fontSize: 10, fontWeight: "800", letterSpacing: 0.9, textTransform: "uppercase" }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700", lineHeight: 18 }} numberOfLines={1}>
        {value}
      </Text>
    </View>
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
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Route map. Pickup ${ride.pickupAddress}. Dropoff ${ride.dropoffAddress}.`}
      style={{
        height: 230,
        borderRadius: radii.md,
        overflow: "hidden",
        backgroundColor: colors.mapPlaceholder,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.slate200,
        ...shadows.soft,
      }}
    >
      <MapView
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
        initialRegion={regionFor(coords)}
        mapType="mutedStandard"
        userInterfaceStyle="light"
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsBuildings={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        toolbarEnabled={false}
        loadingEnabled
        loadingBackgroundColor={colors.mapPlaceholder}
        loadingIndicatorColor={colors.blueStrong}
        legalLabelInsets={{ bottom: 4, left: 8, right: 8, top: 0 }}
      >
        <Polyline
          coordinates={coords}
          strokeWidth={8}
          strokeColor="rgba(37, 99, 235, 0.24)"
          lineCap="round"
          lineJoin="round"
        />
        <Polyline
          coordinates={coords}
          strokeWidth={5}
          strokeColor={colors.blue}
          lineCap="round"
          lineJoin="round"
        />
        {ride.pickupCoords ? (
          <Marker coordinate={ride.pickupCoords} anchor={{ x: 0.5, y: 0.5 }}>
            <MapStopMarker tone="pickup" />
          </Marker>
        ) : null}
        {ride.dropoffCoords ? (
          <Marker coordinate={ride.dropoffCoords} anchor={{ x: 0.5, y: 0.5 }}>
            <MapStopMarker tone="dropoff" />
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
}

function MapStopMarker({ tone }: { tone: "pickup" | "dropoff" }) {
  const color = tone === "pickup" ? colors.green : colors.blue;
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: color,
        borderWidth: 4,
        borderColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        ...shadows.soft,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.surface }} />
    </View>
  );
}

function RideDetailHero({ ride }: { ride: DispatchedRide }) {
  const rideNumber = normalizeRideId(ride.id);
  const passengerNameIsFallback = normalizeRideId(ride.passengerName) === rideNumber;
  const heroTitle = passengerNameIsFallback ? `Ride #${rideNumber}` : ride.passengerName;
  const heroSubtitle = `${ride.scheduledDate} · ${ride.scheduledTime} · ${ride.transitType}`;

  return (
    <View
      accessible
      accessibilityLabel={`${rideHeaderEyebrow(ride.status)}. ${heroTitle}. ${heroSubtitle}. Trip ${ride.tripType}. Vehicle ${ride.transitType}.`}
      style={{ backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.md, gap: spacing.lg, ...shadows.floating }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md }}>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Text style={{ color: colors.surface, fontSize: 33, fontWeight: "900", lineHeight: 38 }}>
            {heroTitle}
          </Text>
          <Text style={{ color: colors.slate300, fontSize: 15, fontWeight: "800" }} numberOfLines={1}>
            {heroSubtitle}
          </Text>
        </View>
      </View>

    </View>
  );
}

function RouteDetailPanel({ ride }: { ride: DispatchedRide }) {
  return (
    <View
      accessible
      accessibilityLabel={`Route. Pickup ${ride.pickupAddress}. Dropoff ${ride.dropoffAddress}.`}
      style={{ backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, gap: spacing.md, ...shadows.soft }}
    >
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
  const fallback = "No special instructions attached to this ride.";
  return (
    <View style={{ backgroundColor: colors.surfaceLow, borderRadius: radii.sm, padding: spacing.md, gap: spacing.sm }}>
      <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "800" }}>
        Dispatch Context
      </Text>
      <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
        {hasNotes ? ride.notes : fallback}
      </Text>
    </View>
  );
}

function DetailActionButton({
  iconName,
  label,
  tone,
  onPress,
  accessibilityHint,
}: {
  iconName: AppSymbolName;
  label: string;
  tone: "primary" | "secondary" | "danger";
  onPress: () => void;
  accessibilityHint?: string;
}) {
  const color = tone === "primary" ? colors.surface : tone === "danger" ? colors.error : colors.primary;
  const iconColor = color;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: tone === "primary" ? 54 : 48,
        borderRadius: radii.sm,
        backgroundColor:
          tone === "primary"
            ? pressed
              ? colors.primaryPressed
              : colors.primary
            : tone === "danger"
              ? colors.errorSoft
              : colors.surfaceHigh,
        alignItems: "center",
        justifyContent: "center",
        opacity: tone === "primary" ? 1 : pressed ? 0.72 : 1,
        flexDirection: "row",
        gap: 8,
      })}
    >
      <SymbolIcon
        name={iconName}
        size={16}
        type="hierarchical"
        tintColor={iconColor}
        weight="semibold"
      />
      <Text style={{ color, fontSize: 14, fontWeight: "800", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

function MissingRideNotice({ rideId }: { rideId?: string }) {
  return (
    <View style={{ backgroundColor: colors.surfaceLow, borderRadius: radii.sm, padding: spacing.md, gap: spacing.sm }}>
      <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "800" }}>
        Ride not found
      </Text>
      <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "700", lineHeight: 19 }}>
        {rideId ? `Ride #${normalizeRideId(rideId)} is no longer in the current ride list.` : "This ride is no longer available."}
      </Text>
    </View>
  );
}

function rideStatusLabel(status: DispatchedRide["status"]) {
  if (status === "pending") return "Upcoming";
  if (status === "accepted") return "Scheduled";
  if (status === "en_route") return "En Route";
  if (status === "picked_up") return "Picked Up";
  if (status === "in_transit") return "In Transit";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Upcoming";
}

function rideHeaderEyebrow(status: DispatchedRide["status"]) {
  if (status === "pending" || status === "accepted") return "Upcoming Ride";
  if (status === "completed") return "Completed Ride";
  if (status === "cancelled") return "Cancelled Ride";
  return "Current Ride";
}

function normalizeRideId(value?: string) {
  return String(value ?? "").trim().replace(/^(?:ride[\s_-]*#?|#)/i, "").trim();
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
    latitudeDelta: Math.max((maxLat - minLat) * 2.35, 0.055),
    longitudeDelta: Math.max((maxLng - minLng) * 2.35, 0.055),
  };
}
