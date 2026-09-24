import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SymbolIcon, type AppSymbolName } from "@/components/ui/SymbolIcon";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
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

/** The driver's next step for an in-progress ride, shown as the card's primary action. */
function nextDriverStepFor(status: RideStatus): { label: string; icon: AppSymbolName; next: RideStatus } | null {
  if (status === "en_route") return { label: "Arrived at pickup", icon: "mappin.circle.fill", next: "picked_up" };
  if (status === "picked_up") return { label: "Passenger on board", icon: "person.fill.checkmark", next: "in_transit" };
  if (status === "in_transit") return { label: "Complete ride", icon: "flag.checkered", next: "completed" };
  return null;
}

export function CurrentRideCard({
  ride,
  onOpen,
  onChat,
  onNavigate,
  onAdvance,
}: {
  ride: DispatchedRide;
  onOpen: () => void;
  onChat: () => void;
  onNavigate: () => void;
  onAdvance?: (next: RideStatus) => Promise<boolean>;
}) {
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const step = onAdvance ? nextDriverStepFor(ride.status) : null;

  const handleAdvance = async () => {
    if (!step || !onAdvance || advancing) return;
    setAdvancing(true);
    setAdvanceError(null);
    const ok = await onAdvance(step.next);
    setAdvancing(false);
    if (!ok) setAdvanceError("Couldn't update dispatch. Check your connection and try again.");
  };

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
        {step ? (
          <PrimaryActionButton
            label={advancing ? "Updating…" : step.label}
            iconName={step.icon}
            onPress={handleAdvance}
            disabled={advancing}
          />
        ) : (
          <PrimaryActionButton
            label={primaryActionLabelFor(ride.status)}
            iconName={primaryActionIconFor(ride.status)}
            onPress={onOpen}
          />
        )}
        {advanceError ? (
          <Text accessibilityLiveRegion="polite" style={{ color: colors.error, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
            {advanceError}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {step ? (
            <SecondaryActionButton label="Details" iconName="doc.text.magnifyingglass" onPress={onOpen} />
          ) : null}
          <SecondaryActionButton label="Chat" iconName="bubble.left.and.bubble.right.fill" onPress={onChat} />
          <SecondaryActionButton label="Navigate" iconName="location.fill" onPress={onNavigate} />
        </View>
      </View>
    </View>
  );
}

export type RideRequestResponder = (
  ride: DispatchedRide,
  response: "accept" | "decline",
) => Promise<{ ok: boolean; message?: string }>;

export function UpcomingRideCard({
  ride,
  onOpen,
  onNavigate,
  onRespond,
}: {
  ride: DispatchedRide;
  onOpen: () => void;
  onNavigate: () => void;
  onRespond?: RideRequestResponder;
}) {
  return (
    <View style={cardStyle}>
      <RideHeader ride={ride} />
      <RouteRows ride={ride} />
      {ride.awaitingAcceptance && onRespond ? <RideRequestActions ride={ride} onRespond={onRespond} /> : null}
      <View style={{ gap: spacing.sm }}>
        <SecondaryActionButton label="View Ride" iconName="doc.text.magnifyingglass" onPress={onOpen} />
        <SecondaryActionButton label="Navigate" iconName="location.fill" onPress={onNavigate} />
      </View>
    </View>
  );
}

/** Accept / Decline for a ride dispatch assigned but the driver hasn't answered yet. */
export function RideRequestActions({ ride, onRespond }: { ride: DispatchedRide; onRespond: RideRequestResponder }) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const respond = async (response: "accept" | "decline") => {
    if (busy) return;
    setBusy(response);
    setError(null);
    const result = await onRespond(ride, response);
    setBusy(null);
    if (!result.ok) setError(result.message ?? "Couldn't update dispatch. Try again.");
  };

  const confirmDecline = () => {
    Alert.alert(
      `Decline ride #${ride.id}?`,
      "Dispatch will be told and will reassign it to another driver.",
      [
        { text: "Keep ride", style: "cancel" },
        { text: "Decline", style: "destructive", onPress: () => void respond("decline") },
      ],
    );
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "700", lineHeight: 18 }}>
        Dispatch assigned you this ride. Let them know if you can take it.
      </Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <DeclineButton label={busy === "decline" ? "Declining…" : "Decline"} onPress={confirmDecline} disabled={!!busy} />
        <PrimaryActionButton
          label={busy === "accept" ? "Accepting…" : "Accept ride"}
          iconName="checkmark.circle.fill"
          onPress={() => void respond("accept")}
          disabled={!!busy}
        />
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.error, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function DeclineButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 52,
        borderRadius: radii.sm,
        borderWidth: 1.5,
        borderColor: colors.error,
        backgroundColor: pressed ? colors.errorSoft : colors.surface,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: spacing.sm,
        opacity: disabled ? 0.6 : 1,
      })}
    >
      <SymbolIcon name="xmark.circle.fill" size={18} type="hierarchical" tintColor={colors.error} weight="bold" />
      <Text style={{ color: colors.error, fontSize: 16, fontWeight: "800" }}>{label}</Text>
    </Pressable>
  );
}

export function NextUpcomingRideCard({
  ride,
  onOpen,
  onNavigate,
  onRespond,
}: {
  ride: DispatchedRide;
  onOpen: () => void;
  onNavigate: () => void;
  onRespond?: RideRequestResponder;
}) {
  return (
    <View style={cardStyle}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open next upcoming ride for ${ride.passengerName}`}
        style={({ pressed }) => ({ gap: spacing.md, opacity: pressed ? 0.78 : 1 })}
      >
        <RideHeader ride={ride} />
        <RideMiniMap ride={ride} />
        <RouteRows ride={ride} />
      </Pressable>
      {ride.awaitingAcceptance && onRespond ? <RideRequestActions ride={ride} onRespond={onRespond} /> : null}
      <View style={{ gap: spacing.sm }}>
        <SecondaryActionButton label="View Ride" iconName="doc.text.magnifyingglass" onPress={onOpen} />
        <SecondaryActionButton label="Navigate" iconName="location.fill" onPress={onNavigate} />
      </View>
    </View>
  );
}

export function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <View style={{ marginHorizontal: spacing.md, gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "800" }}>{title}</Text>
        {typeof count === "number" ? (
          <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "600" }}>{count}</Text>
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
        },
        style,
        pulseStyle,
      ]}
    />
  );
}

export function EmptyRideState({
  refreshing,
  onRefresh,
}: {
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <View
      accessible
      accessibilityLabel="Standing by. No current or upcoming rides are assigned. Dispatch updates will appear here automatically. Pull down or tap refresh to check now."
      style={[cardStyle, { gap: spacing.md }]}
    >
      <View style={{ gap: 7 }}>
        <Text style={{ color: colors.primary, fontSize: 20, fontWeight: "800", lineHeight: 25 }}>
          Standing by
        </Text>
        <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "600", lineHeight: 20 }} numberOfLines={1}>
          No rides assigned. Updates appear automatically.
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: spacing.md }}>
        <Pressable
          disabled={refreshing}
          onPress={onRefresh}
          accessibilityRole="button"
          accessibilityLabel={refreshing ? "Refreshing rides" : "Refresh rides"}
          accessibilityState={{ disabled: refreshing, busy: refreshing }}
          style={({ pressed }) => ({
            minWidth: 118,
            minHeight: 44,
            borderRadius: radii.sm,
            backgroundColor: pressed ? colors.surfaceHigh : colors.surfaceLow,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing.md,
            opacity: refreshing ? 0.72 : 1,
          })}
        >
          {refreshing ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>Refresh</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export function Notice({ tone, title, body }: { tone: "error" | "warning"; title: string; body: string }) {
  const accent = tone === "error" ? colors.error : colors.amber;
  return (
    <View style={{ marginHorizontal: spacing.md, backgroundColor: colors.surface, borderLeftWidth: 4, borderLeftColor: accent, borderRadius: radii.sm, padding: spacing.md, gap: 4, ...shadows.soft }}>
      <Text style={{ color: tone === "error" ? colors.error : colors.amberStrong, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2 }}>{title}</Text>
      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>{body}</Text>
    </View>
  );
}

function RideHeader({ ride }: { ride: DispatchedRide }) {
  const initials = useMemo(() => initialsFor(ride.passengerName), [ride.passengerName]);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <Avatar initials={initials} size={48} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, alignItems: "center" }}>
          <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "800", flex: 1 }}>
            {ride.passengerName}
          </Text>
          <StatusBadge status={ride.awaitingAcceptance ? "request" : badgeStatusFor(ride.status)} />
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
        <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "600", textAlign: "center" }}>
          Route appears once coordinates load.
        </Text>
      </View>
    );
  }

  const region = regionFor(coords);
  return (
    <View
      accessible
      accessibilityLabel={`Route preview from pickup ${ride.pickupAddress} to dropoff ${ride.dropoffAddress}.`}
      style={{
        height: 164,
        borderRadius: radii.sm,
        overflow: "hidden",
        backgroundColor: colors.mapPlaceholder,
        ...shadows.soft,
      }}
    >
      <MapView
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        initialRegion={region}
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
        // Show the driver's own position on in-progress rides so the card reflects progress along the route.
        showsUserLocation={ride.status === "en_route" || ride.status === "picked_up" || ride.status === "in_transit"}
        loadingEnabled
        loadingBackgroundColor={colors.mapPlaceholder}
        loadingIndicatorColor={colors.blueStrong}
        legalLabelInsets={{ bottom: 4, left: 8, right: 8, top: 0 }}
      >
        <Polyline
          coordinates={coords}
          strokeWidth={7}
          strokeColor="rgba(37, 99, 235, 0.24)"
          lineCap="round"
          lineJoin="round"
        />
        <Polyline
          coordinates={coords}
          strokeWidth={4}
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
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: spacing.sm,
          top: spacing.sm,
          minHeight: 30,
          borderRadius: radii.pill,
          backgroundColor: "rgba(255,255,255,0.92)",
          paddingHorizontal: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
          ...shadows.soft,
        }}
      >
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.blue }} />
        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
          Route preview
        </Text>
      </View>
    </View>
  );
}

function MapStopMarker({ tone }: { tone: "pickup" | "dropoff" }) {
  const color = tone === "pickup" ? colors.green : colors.blue;
  return (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: color,
        borderWidth: 4,
        borderColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        ...shadows.soft,
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.surface }} />
    </View>
  );
}

function PrimaryActionButton({
  label,
  iconName,
  onPress,
  disabled = false,
}: {
  label: string;
  iconName: AppSymbolName;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: disabled }}
      style={({ pressed }) => ({
        opacity: disabled ? 0.7 : 1,
        flex: 1,
        minHeight: 52,
        borderRadius: radii.sm,
        backgroundColor: pressed ? colors.primaryPressed : colors.primary,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: spacing.sm,
        paddingVertical: 15,
        paddingHorizontal: spacing.md,
      })}
    >
      <SymbolIcon
        name={iconName}
        size={19}
        type="hierarchical"
        tintColor={colors.surface}
        weight="bold"
      />
      <Text style={{ color: colors.surface, fontSize: 16, fontWeight: "800", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

function SecondaryActionButton({
  label,
  iconName,
  onPress,
}: {
  label: string;
  iconName: AppSymbolName;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 44,
        borderRadius: radii.sm,
        backgroundColor: pressed ? colors.slate200 : colors.surfaceHigh,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 7,
        paddingHorizontal: spacing.sm,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <SymbolIcon
        name={iconName}
        size={15}
        type="hierarchical"
        tintColor={colors.primary}
        weight="semibold"
      />
      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

function badgeStatusFor(status: RideStatus): StatusKey {
  if (status === "pending" || status === "accepted") return "scheduled";
  if (status === "en_route") return "enRoute";
  if (status === "picked_up") return "arrived";
  if (status === "in_transit") return "inTransit";
  if (status === "completed") return "completed";
  return "cancelled";
}

function primaryActionLabelFor(status: RideStatus) {
  return status === "accepted" ? "Start Ride" : "View Ride";
}

function primaryActionIconFor(status: RideStatus): AppSymbolName {
  return status === "accepted" ? "play.fill" : "arrow.right.circle.fill";
}

function initialsFor(name: string) {
  // Rides without a rider name are labelled "Ride #11": show "#11" rather than the meaningless "R#".
  const rideNumber = /^ride\s*#?\s*(\d+)$/i.exec(name.trim());
  if (rideNumber) return `#${rideNumber[1]}`;
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
    latitudeDelta: Math.max((maxLat - minLat) * 2.35, 0.055),
    longitudeDelta: Math.max((maxLng - minLng) * 2.35, 0.055),
  };
}

const cardStyle = {
  backgroundColor: colors.surface,
  borderRadius: radii.sm,
  padding: spacing.md,
  gap: spacing.md,
  ...shadows.soft,
} as const;
