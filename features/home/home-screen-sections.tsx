import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { Avatar } from "@/components/ui/Avatar";
import { LocationRow } from "@/components/ui/LocationRow";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { type DispatchedRide, hasDrawableRoute, type RideCoordinate, type RideStatus } from "@/lib/rides";
import { colors, radii, shadows, spacing, type StatusKey } from "@/lib/theme";

export function CurrentRideCard({
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
      <View style={{ gap: spacing.sm }}>
        <PrimaryActionButton label="Start Ride" onPress={onOpen} />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <SecondaryActionButton label="Chat" onPress={onChat} />
          <SecondaryActionButton label="Navigate" onPress={onNavigate} />
        </View>
      </View>
    </View>
  );
}

export function RideRequestsBanner({ count, latestRide, onPress }: { count: number; latestRide: DispatchedRide; onPress: () => void }) {
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
        borderColor: colors.amberSoft,
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
          <Text style={{ color: colors.amberStrong, fontSize: 12, fontWeight: "900" }} numberOfLines={1}>
            Ride #{latestRide.id.replace(/^ride-?/i, "")} · {latestRide.scheduledTime}
          </Text>
        </View>
        <View style={{ backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 7 }}>
          <Text style={{ color: colors.blueStrong, fontSize: 12, fontWeight: "900" }}>
            View
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
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

export function LoadingState({ title, body }: { title: string; body: string }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0.58);

  useEffect(() => {
    if (reduced) {
      pulse.value = 0.72;
      return;
    }

    pulse.value = withRepeat(
      withTiming(1, {
        duration: 950,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [pulse, reduced]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${title}. ${body}`}
      style={cardStyle}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <SkeletonBlock pulseStyle={pulseStyle} style={{ width: 48, height: 48, borderRadius: 24 }} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <SkeletonBlock pulseStyle={pulseStyle} style={{ width: "64%", height: 18, borderRadius: radii.xs }} />
          <SkeletonBlock pulseStyle={pulseStyle} style={{ width: "82%", height: 13, borderRadius: radii.xs }} />
        </View>
        <SkeletonBlock pulseStyle={pulseStyle} style={{ width: 92, height: 34, borderRadius: radii.xs }} />
      </View>

      <SkeletonBlock pulseStyle={pulseStyle} style={{ height: 170, borderRadius: radii.sm }} />

      <View style={{ gap: spacing.md }}>
        {[colors.green, colors.blue].map((dotColor, index) => (
          <View key={dotColor} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: dotColor }} />
            <View style={{ flex: 1, gap: spacing.xs }}>
              <SkeletonBlock pulseStyle={pulseStyle} style={{ width: index === 0 ? 70 : 84, height: 11, borderRadius: radii.xs }} />
              <SkeletonBlock pulseStyle={pulseStyle} style={{ width: index === 0 ? "78%" : "88%", height: 18, borderRadius: radii.xs }} />
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.sm }}>
        <SkeletonBlock pulseStyle={pulseStyle} style={{ height: 54, borderRadius: radii.sm }} />
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {[0, 1].map((item) => (
            <SkeletonBlock key={item} pulseStyle={pulseStyle} style={{ flex: 1, height: 42, borderRadius: radii.sm }} />
          ))}
        </View>
      </View>
    </View>
  );
}

function SkeletonBlock({ pulseStyle, style }: { pulseStyle: any; style: any }) {
  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.slate100,
          borderColor: colors.slate200,
          borderWidth: 1,
        },
        style,
        pulseStyle,
      ]}
    />
  );
}

export function EmptyRideState() {
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

export function Notice({ tone, title, body }: { tone: "error" | "warning"; title: string; body: string }) {
  const accent = tone === "error" ? colors.error : colors.amber;
  return (
    <View style={{ marginHorizontal: spacing.md, backgroundColor: colors.surface, borderLeftWidth: 4, borderLeftColor: accent, borderRadius: radii.sm, padding: spacing.md, gap: 4, ...shadows.soft }}>
      <Text style={{ color: tone === "error" ? colors.error : colors.amberStrong, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2 }}>{title}</Text>
      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>{body}</Text>
    </View>
  );
}

export function navigationUrlForRide(ride: DispatchedRide) {
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

function PrimaryActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 54,
        borderRadius: radii.sm,
        backgroundColor: colors.green,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Text style={{ color: colors.surface, fontSize: 16, fontWeight: "900", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

function SecondaryActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 42,
        borderRadius: radii.sm,
        backgroundColor: pressed ? colors.surfaceHigh : colors.surfaceLow,
        borderWidth: 1,
        borderColor: colors.slate200,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "900", textAlign: "center" }}>{label}</Text>
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

const cardStyle = {
  backgroundColor: colors.surface,
  borderRadius: radii.sm,
  padding: spacing.md,
  gap: spacing.md,
  ...shadows.soft,
} as const;
