import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Linking, Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { LocationIndicator } from "@/components/ui/LocationIndicator";
import { LocationPermissionBanner } from "@/components/ui/LocationPermissionBanner";
import { LocationRow } from "@/components/ui/LocationRow";
import { PageTransition } from "@/components/ui/PageTransition";
import { RideRequestCard } from "@/components/ui/RideRequestCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useDispatch } from "@/lib/dispatch-context";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { useLocation } from "@/lib/location-context";
import { type DispatchedRide, hasDrawableRoute, type RideCoordinate, type RideStatus } from "@/lib/rides";
import { colors, radii, shadows, spacing, type StatusKey } from "@/lib/theme";

export default function HomeScreen() {
  const router = useRouter();
  const { activeRide, pendingRides, backendError, hasLoadedRides, refreshRides, acceptRide, declineRide } = useDispatch();
  const { error: locationError } = useLocation();
  const { impact, notification } = useHaptics();
  const homeScrollRef = useRef<ScrollView>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [homeViewportHeight, setHomeViewportHeight] = useState(0);
  const [homeContentHeight, setHomeContentHeight] = useState(0);
  const homeBottomPadding = 108;
  const homeScrollableContentHeight = Math.max(0, homeContentHeight - homeBottomPadding);
  const homeCanScroll = homeScrollableContentHeight > homeViewportHeight + 2;
  const shouldShowRideRequests = hasLoadedRides && !backendError && pendingRides.length > 0;
  const shouldShowEmptyRides = hasLoadedRides && !backendError && !activeRide && pendingRides.length === 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshRides();
    setRefreshing(false);
  }, [refreshRides]);

  const openChat = useCallback((ride: DispatchedRide) => {
    impact(ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/chat",
      params: { rideId: ride.id, riderName: ride.passengerName },
    });
  }, [impact, router]);

  const openRideRequestDetails = useCallback((ride: DispatchedRide) => {
    impact(ImpactFeedbackStyle.Light);
    router.push(`/ride-details?rideId=${encodeURIComponent(ride.id)}`);
  }, [impact, router]);

  const openRideDetails = useCallback((ride: DispatchedRide) => {
    impact(ImpactFeedbackStyle.Light);
    router.push(`/ride-details?rideId=${encodeURIComponent(ride.id)}`);
  }, [impact, router]);

  const openNavigation = useCallback((ride: DispatchedRide) => {
    impact(ImpactFeedbackStyle.Light);
    Linking.openURL(navigationUrlForRide(ride));
  }, [impact]);

  return (
    <PageTransition>
      <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
        <HomeBrandHeader backendConnected={!backendError} backendError={backendError} />

        <ScrollView
          ref={homeScrollRef}
          style={{ flex: 1, backgroundColor: colors.surfaceLow }}
          contentInsetAdjustmentBehavior="never"
          scrollEnabled
          bounces
          alwaysBounceVertical
          scrollEventThrottle={16}
          onScroll={(event) => {
            if (!homeCanScroll && event.nativeEvent.contentOffset.y > 0) {
              homeScrollRef.current?.scrollTo({ y: 0, animated: false });
            }
          }}
          onScrollEndDrag={() => {
            if (!homeCanScroll) homeScrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
          onMomentumScrollEnd={() => {
            if (!homeCanScroll) homeScrollRef.current?.scrollTo({ y: 0, animated: false });
          }}
          onLayout={(event) => setHomeViewportHeight(event.nativeEvent.layout.height)}
          onContentSizeChange={(_, height) => setHomeContentHeight(height)}
          contentContainerStyle={{
            minHeight: homeCanScroll ? undefined : homeViewportHeight,
            paddingTop: spacing.md,
            paddingBottom: homeBottomPadding,
            gap: spacing.lg,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
        >
          <FadeInBlock delay={80} exitDelay={90}>
            <LocationPermissionBanner />
          </FadeInBlock>

          {backendError ? (
            <FadeInBlock delay={125} exitDelay={70}>
              <Notice tone="error" title="Backend rides unavailable" body={backendError} />
            </FadeInBlock>
          ) : null}

          {locationError ? (
            <FadeInBlock delay={145} exitDelay={60}>
              <Notice tone="warning" title="Location warning" body={locationError} />
            </FadeInBlock>
          ) : null}

          {!hasLoadedRides && !backendError ? (
            <FadeInBlock delay={170} exitDelay={35}>
              <Section title="Current Ride">
                <LoadingState title="Loading ride information" body="Checking the live backend for current rides and requests." />
              </Section>
            </FadeInBlock>
          ) : activeRide ? (
            <FadeInBlock delay={170} exitDelay={35}>
              <Section title="Current Ride">
                <CurrentRideCard
                  ride={activeRide}
                  onOpen={() => openRideDetails(activeRide)}
                  onChat={() => openChat(activeRide)}
                  onNavigate={() => openNavigation(activeRide)}
                />
              </Section>
            </FadeInBlock>
          ) : shouldShowEmptyRides ? (
            <FadeInBlock delay={170} exitDelay={35}>
              <Section title="Current Ride">
                <EmptyRideState />
              </Section>
            </FadeInBlock>
          ) : null}

          {shouldShowRideRequests ? (
            activeRide ? (
              <FadeInBlock delay={230} exitDelay={0}>
                <View style={{ marginHorizontal: spacing.md }}>
                  <RideRequestsBanner count={pendingRides.length} latestRide={pendingRides[0]} onPress={() => openRideRequestDetails(pendingRides[0])} />
                </View>
              </FadeInBlock>
            ) : (
              <FadeInBlock delay={230} exitDelay={0}>
                <Section title="Ride Requests" count={pendingRides.length}>
                  <View style={{ gap: spacing.md }}>
                    {pendingRides.map((ride, index) => (
                      <FadeInBlock
                        key={ride.id}
                        delay={260 + index * 45}
                        exitDelay={Math.max(0, (pendingRides.length - index - 1) * 28)}
                        distance={10}
                      >
                        <RideRequestCard
                          ride={ride}
                          onOpen={() => openRideRequestDetails(ride)}
                          onChat={() => openChat(ride)}
                          onAccept={() => {
                            notification(NotificationFeedbackType.Success);
                            acceptRide(ride.id);
                          }}
                          onDecline={() => {
                            impact(ImpactFeedbackStyle.Medium);
                            declineRide(ride.id);
                          }}
                        />
                      </FadeInBlock>
                    ))}
                  </View>
                </Section>
              </FadeInBlock>
            )
          ) : null}
        </ScrollView>
      </View>
    </PageTransition>
  );
}

function HomeBrandHeader({
  backendConnected,
  backendError,
}: {
  backendConnected: boolean;
  backendError: string | null;
}) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [logoRevision, setLogoRevision] = useState(0);

  useEffect(() => {
    if (isFocused) setLogoRevision((current) => current + 1);
  }, [isFocused]);

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        paddingHorizontal: spacing.md,
      }}
    >
      <View
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        {isFocused ? (
          <Image
            key={`home-logo-${logoRevision}`}
            source={require("../../assets/TR_logo.png")}
            accessibilityLabel="TrustedRiders"
            resizeMode="contain"
            style={{ width: 184, height: 44, flexShrink: 0 }}
          />
        ) : (
          <View style={{ width: 184, height: 44 }} />
        )}
        <View style={{ flex: 1, minWidth: 0 }} />
        <LocationIndicator backendConnected={backendConnected} backendError={backendError} />
      </View>
    </View>
  );
}

function CurrentRideCard({
  ride,
  onOpen,
  onChat,
  onNavigate,
}: {
  ride: DispatchedRide;
  onOpen: () => void;
  onChat: () => void;
  onNavigate: () => void;
}) {
  return (
    <View style={cardStyle}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open current ride details for ride ${ride.id}`}
        style={({ pressed }) => ({ gap: spacing.md, opacity: pressed ? 0.78 : 1 })}
      >
        <RideHeader ride={ride} />
        <RideMiniMap ride={ride} />
        <RouteRows ride={ride} />
      </Pressable>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <ActionButton label="View" tone="primary" onPress={onOpen} />
        <ActionButton label="Chat" tone="secondary" onPress={onChat} />
        <ActionButton label="Navigate" tone="secondary" onPress={onNavigate} />
      </View>
    </View>
  );
}

function RideRequestsBanner({ count, latestRide, onPress }: { count: number; latestRide: DispatchedRide; onPress: () => void }) {
  const lastOpenAtRef = useRef(0);
  const openOnce = useCallback(() => {
    const now = Date.now();
    if (now - lastOpenAtRef.current < 650) return;
    lastOpenAtRef.current = now;
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={openOnce}
      onPressIn={openOnce}
      accessibilityRole="button"
      accessibilityLabel={`${count} pending ride ${count === 1 ? "request" : "requests"}. Open ride requests.`}
      hitSlop={8}
      pressRetentionOffset={16}
      style={({ pressed }) => ({
        alignSelf: "stretch",
        minHeight: 54,
        backgroundColor: colors.amberSoft,
        borderRadius: radii.pill,
        paddingLeft: 8,
        paddingRight: spacing.sm,
        paddingVertical: 7,
        borderWidth: 1,
        borderColor: "rgba(217, 119, 6, 0.18)",
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <View pointerEvents="none" style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        <View style={{ width: 38, height: 38, borderRadius: radii.pill, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.amber, fontSize: 17, fontWeight: "900" }}>{count}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "900" }} numberOfLines={1}>
            {count === 1 ? "Pending ride request" : "Pending ride requests"}
          </Text>
          <Text style={{ color: colors.amber, fontSize: 12, fontWeight: "900" }} numberOfLines={1}>
            Ride #{latestRide.id.replace(/^ride-?/i, "")} · {latestRide.scheduledTime}
          </Text>
        </View>
        <View style={{ backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 7 }}>
          <Text style={{ color: colors.blue, fontSize: 12, fontWeight: "900" }}>
            View
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function RideHeader({ ride }: { ride: DispatchedRide }) {
  const initials = useMemo(() => initialsFor(ride.passengerName), [ride.passengerName]);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <Avatar initials={initials} size={48} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, alignItems: "center" }}>
          <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "900", flex: 1 }} numberOfLines={1}>
            {ride.passengerName}
          </Text>
          <StatusBadge status={badgeStatusFor(ride.status)} />
        </View>
        <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "700" }}>
          {ride.scheduledDate} · {ride.scheduledTime} · {ride.transitType}
        </Text>
      </View>
    </View>
  );
}

function RouteRows({ ride }: { ride: DispatchedRide }) {
  return (
    <View style={{ gap: spacing.md }}>
      <LocationRow color={colors.green} label="Pickup" address={ride.pickupAddress} />
      <LocationRow color={colors.blue} label="Dropoff" address={ride.dropoffAddress} />
    </View>
  );
}

function RideMiniMap({ ride }: { ride: DispatchedRide }) {
  const coords = hasDrawableRoute(ride.routeCoords)
    ? ride.routeCoords
    : [ride.pickupCoords, ride.dropoffCoords].filter((coord): coord is RideCoordinate => !!coord);

  if (!hasDrawableRoute(coords)) {
    return (
      <View style={{ height: 150, borderRadius: radii.sm, backgroundColor: colors.mapPlaceholder, alignItems: "center", justifyContent: "center", padding: spacing.md }}>
        <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "800", textAlign: "center" }}>
          Route preview appears when pickup and dropoff coordinates are available.
        </Text>
      </View>
    );
  }

  const region = regionFor(coords);
  return (
    <View style={{ height: 170, borderRadius: radii.sm, overflow: "hidden", backgroundColor: colors.mapPlaceholder }}>
      <MapView style={{ flex: 1 }} initialRegion={region} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}>
        <Polyline coordinates={coords} strokeWidth={4} strokeColor={colors.blue} />
        {ride.pickupCoords ? <Marker coordinate={ride.pickupCoords} pinColor={colors.green} /> : null}
        {ride.dropoffCoords ? <Marker coordinate={ride.dropoffCoords} pinColor={colors.blue} /> : null}
      </MapView>
    </View>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <View style={{ marginHorizontal: spacing.md, gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "900" }}>{title}</Text>
        {typeof count === "number" ? (
          <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "900" }}>{count}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function LoadingState({ title, body }: { title: string; body: string }) {
  return (
    <View style={[cardStyle, { alignItems: "center" }]}>
      <ActivityIndicator color={colors.blue} />
      <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "900", textAlign: "center" }}>{title}</Text>
      <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "700", textAlign: "center", lineHeight: 18 }}>{body}</Text>
    </View>
  );
}

function EmptyRideState() {
  return (
    <View style={[cardStyle, { alignItems: "center" }]}>
      <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "900", textAlign: "center" }}>
        No rides right now
      </Text>
      <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "700", textAlign: "center", lineHeight: 18 }}>
        You do not have a current ride or any pending ride requests.
      </Text>
    </View>
  );
}

function Notice({ tone, title, body }: { tone: "error" | "warning"; title: string; body: string }) {
  const accent = tone === "error" ? colors.error : colors.amber;
  return (
    <View style={{ marginHorizontal: spacing.md, backgroundColor: colors.surface, borderLeftWidth: 4, borderLeftColor: accent, borderRadius: radii.sm, padding: spacing.md, gap: 4, ...shadows.soft }}>
      <Text style={{ color: accent, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4 }}>{title}</Text>
      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>{body}</Text>
    </View>
  );
}

function ActionButton({ label, tone, onPress }: { label: string; tone: "primary" | "secondary" | "danger"; onPress: () => void }) {
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

function badgeStatusFor(status: RideStatus): StatusKey {
  if (status === "pending") return "pending";
  if (status === "accepted") return "scheduled";
  if (status === "en_route") return "enRoute";
  if (status === "picked_up" || status === "in_transit") return "inTransit";
  if (status === "completed") return "completed";
  return "cancelled";
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TR";
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

const cardStyle = {
  backgroundColor: colors.surface,
  borderRadius: radii.sm,
  padding: spacing.md,
  gap: spacing.md,
  ...shadows.soft,
} as const;
