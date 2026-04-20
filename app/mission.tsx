import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import MapView, { Marker, Polyline } from "@/components/Map";

import { AnimatedDriverMarker } from "@/components/ui/AnimatedDriverMarker";
import { Avatar } from "@/components/ui/Avatar";
import { GradientCard } from "@/components/ui/gradient-card";
import { PageTransition } from "@/components/ui/PageTransition";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PROTOTYPE_RIDE_ID } from "@/lib/config";
import { clearActiveRideId, setActiveRideId } from "@/lib/fleet-api";
import { useHaptics } from "@/lib/haptics-context";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "@/lib/haptics";
import { useLocation } from "@/lib/location-context";
import { useDirections } from "@/lib/use-directions";
import { activeMission } from "@/lib/mock-data";
import { colors, radii, shadows, spacing, type StatusKey } from "@/lib/theme";

const totalStages = 4;

export default function MissionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView | null>(null);
  const followMode = useRef(true);
  const { location, startBackgroundTracking } = useLocation();
  const { impact, notification } = useHaptics();
  const snapPoints = useMemo(() => [380, "85%"], []);
  const [missionStep, setMissionStep] = useState(1);
  const [riderProfileOpen, setRiderProfileOpen] = useState(false);

  // While on the mission screen, stamp the active ride id onto each background
  // ping. `setActiveRideId` writes to AsyncStorage so the TaskManager task
  // (which can't read React context) can read it. Hardcoded to 1 until ride
  // ids are plumbed end-to-end.
  //
  // Background tracking itself is kicked off globally in startTracking() so
  // pings keep flowing on every screen, not just this one. We don't stop it
  // on unmount — that would kill tracking the moment the driver navigates
  // away from the mission screen.
  useEffect(() => {
    setActiveRideId(PROTOTYPE_RIDE_ID);
    void startBackgroundTracking();
    return () => {
      clearActiveRideId();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTarget =
    missionStep === 1
      ? activeMission.pickup
      : missionStep === 2
        ? activeMission.dropoff
        : missionStep === 3
          ? activeMission.dropoff
          : activeMission.pickup;

  const currentAction =
    missionStep === 1
      ? "Pickup Passenger"
      : missionStep === 2
        ? "Arrive at Facility"
        : missionStep === 3
          ? "Return Pickup"
          : "Arrive Home";

  const missionStatus: StatusKey =
    missionStep === 1
      ? "enRoute"
      : missionStep === 2 || missionStep === 3
        ? "inTransit"
        : "arrived";

  const stageBars = useMemo(() => new Array(totalStages).fill(0), []);

  return (
    <PageTransition>
    <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
      <MissionMap missionStep={missionStep} onMapRef={(ref) => { mapRef.current = ref; }} />

      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: headerHeight + 8,
          left: 16,
          right: 16,
          gap: 8,
        }}
      >
        {Platform.OS !== "web" && (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: 12,
            }}
          >
            <Text style={statusText}>
              9:41
            </Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <View style={hudPill(16)} />
              <View style={hudPill(8)} />
            </View>
          </View>
        )}

        <View
          style={{
            backgroundColor: colors.surfaceScrim80,
            borderRadius: radii.md,
            borderCurve: "continuous",
            padding: 16,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            ...shadows.floating,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
            <Avatar initials="ER" size={40} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={missionEyebrow}>
                  Active Mission
                </Text>
                <StatusBadge status={missionStatus} />
              </View>
              <Text selectable numberOfLines={1} style={missionTarget}>
                {currentTarget}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Text style={etaLabel}>
              ETA
            </Text>
            <Text selectable style={etaValue}>
              {activeMission.eta}
            </Text>
          </View>
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          right: 16,
          bottom: 350,
          gap: 10,
        }}
      >
        <FloatingControl
          label="➤"
          hint="Re-center map on my location"
          onPress={() => {
            impact(ImpactFeedbackStyle.Light);
            if (location && mapRef.current) {
              followMode.current = true;
              mapRef.current.animateCamera(
                { center: { latitude: location.latitude, longitude: location.longitude } },
                { duration: 400 },
              );
            }
          }}
        />
        <FloatingControl
          label="◎"
          hint="Reset map heading to north"
          onPress={() => {
            impact(ImpactFeedbackStyle.Light);
            if (mapRef.current) {
              mapRef.current.animateCamera({ heading: 0 }, { duration: 400 });
            }
          }}
        />
      </View>

      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        enableContentPanningGesture={false}
        handleIndicatorStyle={{
          width: 48,
          height: 6,
          borderRadius: radii.pill,
          backgroundColor: colors.slate200,
        }}
        backgroundStyle={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
        }}
        style={shadows.floating}
      >
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 20,
            gap: spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Pressable onPress={() => { impact(ImpactFeedbackStyle.Light); setRiderProfileOpen(true); }} accessibilityRole="button" accessibilityLabel={`View profile for ${activeMission.name}`}>
                <Avatar initials="ER" size={56} />
              </Pressable>
              <View style={{ gap: 4 }}>
                <Text selectable style={sheetTitle}>
                  {activeMission.name}
                </Text>
                <Text style={sheetSubtitle}>
                  {activeMission.type}
                </Text>
              </View>
            </View>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radii.xs,
                backgroundColor: colors.surfaceLow,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.slate500, fontSize: 20 }}>⋯</Text>
            </View>
          </View>

          <View style={{ gap: 16 }}>
            <Text style={stageHeader}>
              Mission Stages
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {stageBars.map((_, index) => (
                <View
                  key={index}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: radii.pill,
                    backgroundColor:
                      missionStep >= index + 1 ? colors.blue : colors.slate100,
                  }}
                />
              ))}
            </View>

            <View style={{ gap: 22, paddingTop: 8 }}>
              <StageRow
                active={missionStep === 1}
                complete={missionStep > 1}
                title="Pickup @ Home"
                value={activeMission.pickup}
              />
              <StageRow
                active={missionStep === 2}
                complete={missionStep > 2}
                title="Drop-off @ Facility"
                value={activeMission.dropoff}
              />

              <View
                style={{
                  paddingTop: 18,
                  borderTopWidth: 1,
                  borderTopColor: colors.slate100,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text style={{ color: colors.slate300, fontSize: 16 }}>↺</Text>
                <Text style={returnLabel}>
                  Return Leg Details
                </Text>
              </View>
              <StageRow
                active={missionStep === 3}
                complete={missionStep > 3}
                title="Return Pickup"
                value={activeMission.dropoff}
              />
              <StageRow
                active={missionStep === 4}
                complete={false}
                title="Arrive Home"
                value={activeMission.pickup}
              />
            </View>
          </View>
        </BottomSheetScrollView>

        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: 14,
            paddingBottom: 48 + insets.bottom,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.slate100,
            gap: 10,
          }}
        >
          <Pressable
            onPress={() => {
              notification(NotificationFeedbackType.Success);
              setMissionStep((current) => (current < totalStages ? current + 1 : 1));
            }}
            accessibilityRole="button"
            accessibilityLabel={currentAction}
          >
            <GradientCard padding={18}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Text style={primaryButtonText}>{currentAction}</Text>
                <Text style={primaryButtonText}>→</Text>
              </View>
            </GradientCard>
          </Pressable>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => notification(NotificationFeedbackType.Warning)}
              accessibilityRole="button"
              accessibilityLabel="Cancel ride"
              style={secondaryBtn}
            >
              <Text style={secondaryBtnText}>Cancel Ride</Text>
            </Pressable>
            <Pressable
              onPress={() => notification(NotificationFeedbackType.Warning)}
              accessibilityRole="button"
              accessibilityLabel="Report an issue"
              style={secondaryBtn}
            >
              <Text style={secondaryBtnText}>Report Issue</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => notification(NotificationFeedbackType.Error)}
            accessibilityRole="button"
            accessibilityLabel="Emergency assistance"
            style={emergencyBtn}
          >
            <Text style={emergencyBtnText}>Emergency Help</Text>
          </Pressable>
        </View>
      </BottomSheet>

      <Modal
        visible={riderProfileOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRiderProfileOpen(false)}
      >
        <Pressable
          onPress={() => setRiderProfileOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close rider profile"
          style={{
            flex: 1,
            backgroundColor: colors.surfaceScrim46,
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              height: "92%",
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              borderCurve: "continuous",
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.xl,
              paddingBottom: spacing.xl,
            }}
          >
            <View style={{ alignItems: "center", gap: 24, paddingBottom: spacing.lg }}>
              <View style={modalHandle} />
              <Avatar initials="ER" size={96} />
              <View style={{ alignItems: "center", gap: 6 }}>
                <Text selectable style={profileName}>
                  {activeMission.name}
                </Text>
                <Text style={profileTier}>
                  Tier 1 Passenger
                </Text>
              </View>
            </View>

            <ScrollView
              contentInsetAdjustmentBehavior="automatic"
              style={{ flex: 1 }}
              contentContainerStyle={{ gap: spacing.xl, paddingBottom: spacing.xl }}
              showsVerticalScrollIndicator={false}
            >
              <View style={medicalCard}>
                <Text style={medicalTitle}>
                  Medical Protocols
                </Text>
                <Text selectable style={medicalBody}>
                  Vision impaired in left eye. Requires steady arm assistance during
                  boarding. Avoid heavy scent in vehicle.
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 14 }}>
                <ProfileTile label="Transit" value="Wheelchair" />
                <ProfileTile label="Age" value={activeMission.age} />
              </View>
            </ScrollView>

            <Pressable onPress={() => { impact(ImpactFeedbackStyle.Light); setRiderProfileOpen(false); }} accessibilityRole="button" accessibilityLabel="Close rider protocols">
              <GradientCard padding={18}>
                <Text style={primaryButtonText}>Close Protocols</Text>
              </GradientCard>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
    </PageTransition>
  );
}

function MissionMap({
  missionStep,
  onMapRef,
}: {
  missionStep: number;
  onMapRef?: (ref: MapView | null) => void;
}) {
  const { location } = useLocation();
  const mapRef = useRef<MapView | null>(null);
  const followMode = useRef(true);
  const hasInitialized = useRef(false);
  const lastAnimatedCoords = useRef<{ lat: number; lng: number } | null>(null);
  const userInteracting = useRef(false);

  // Determine current navigation target based on mission stage
  const currentTarget =
    missionStep <= 1
      ? activeMission.pickupCoords
      : missionStep <= 3
        ? activeMission.dropoffCoords
        : activeMission.pickupCoords;

  // Get real directions from driver → current target
  const driverPos = location
    ? { latitude: location.latitude, longitude: location.longitude }
    : null;
  const directions = useDirections(driverPos, currentTarget);

  // Center on driver when location ACTUALLY changes and follow mode is on
  useEffect(() => {
    if (!location || !mapRef.current) return;

    // Skip if the user is actively touching the map
    if (userInteracting.current) return;

    // Skip if coordinates haven't meaningfully changed (< 1m)
    if (lastAnimatedCoords.current) {
      const dLat = Math.abs(location.latitude - lastAnimatedCoords.current.lat);
      const dLng = Math.abs(location.longitude - lastAnimatedCoords.current.lng);
      if (dLat < 0.00001 && dLng < 0.00001) return;
    }

    lastAnimatedCoords.current = { lat: location.latitude, lng: location.longitude };

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      mapRef.current.fitToCoordinates(
        [
          { latitude: location.latitude, longitude: location.longitude },
          activeMission.pickupCoords,
          activeMission.dropoffCoords,
        ],
        { edgePadding: { top: 140, right: 60, bottom: 320, left: 60 }, animated: false },
      );
      return;
    }

    if (followMode.current) {
      mapRef.current.animateCamera(
        {
          center: { latitude: location.latitude, longitude: location.longitude },
        },
        { duration: 800 },
      );
    }
  }, [location]);

  const center = location
    ? { latitude: location.latitude, longitude: location.longitude }
    : { latitude: 37.782, longitude: -122.413 };

  // Use real route coords if available, otherwise fall back to straight line
  const activeRouteCoords =
    directions.routeCoords && directions.routeCoords.length > 1
      ? directions.routeCoords
      : driverPos
        ? [driverPos, currentTarget]
        : [activeMission.pickupCoords, activeMission.dropoffCoords];

  return (
    <MapView
      ref={(ref) => {
        mapRef.current = ref;
        onMapRef?.(ref);
      }}
      style={{ flex: 1 }}
      initialRegion={{
        ...center,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }}
      showsUserLocation={false}
      showsMyLocationButton={false}
      loadingEnabled={false}
      moveOnMarkerPress={false}
      scrollEnabled
      zoomEnabled
      pitchEnabled
      rotateEnabled
      onTouchStart={() => { userInteracting.current = true; }}
      onTouchEnd={() => {
        userInteracting.current = false;
        followMode.current = false;
      }}
      onPanDrag={() => { followMode.current = false; }}
    >
      <Marker
        coordinate={activeMission.pickupCoords}
        title="Pickup"
        description={activeMission.pickup}
        pinColor={colors.blue}
        tracksViewChanges={false}
      />
      <Marker
        coordinate={activeMission.dropoffCoords}
        title="Drop-off"
        description={activeMission.dropoff}
        pinColor={colors.green}
        tracksViewChanges={false}
      />
      <Polyline
        coordinates={activeRouteCoords}
        strokeColor={colors.blue}
        strokeWidth={4}
      />
      {location && (
        <AnimatedDriverMarker
          latitude={location.latitude}
          longitude={location.longitude}
          heading={location.heading}
        />
      )}
    </MapView>
  );
}

function StageRow({
  active,
  complete,
  title,
  value,
}: {
  active: boolean;
  complete: boolean;
  title: string;
  value: string;
}) {
  const opacity = complete ? 0.45 : active ? 1 : 0.22;

  return (
    <View style={{ flexDirection: "row", gap: 16, opacity }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: radii.xs,
          backgroundColor: complete || active ? colors.blueSoft : colors.surfaceLow,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        {complete ? (
          <Text style={{ color: colors.blue, fontSize: 12, fontWeight: "800" }}>✓</Text>
        ) : active ? (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: radii.pill,
              backgroundColor: colors.blue,
            }}
          />
        ) : null}
      </View>
      <View style={{ gap: 4, flex: 1 }}>
        <Text style={stageTitle}>
          {title}
        </Text>
        <Text selectable style={stageValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ProfileTile({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surfaceLow,
        borderRadius: radii.md,
        borderCurve: "continuous",
        padding: spacing.md,
        gap: 4,
      }}
    >
      <Text style={tileLabel}>
        {label}
      </Text>
      <Text selectable style={tileValue}>
        {value}
      </Text>
    </View>
  );
}

function FloatingControl({ label, hint, onPress }: { label: string; hint?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={hint}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: radii.pill,
          backgroundColor: colors.surfaceScrim70,
          justifyContent: "center",
          alignItems: "center",
          ...shadows.floating,
        }}
      >
        <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "800" }}>{label}</Text>
      </View>
    </Pressable>
  );
}

function hudPill(width: number) {
  return {
    width,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  };
}

const statusText = {
  color: colors.primary,
  fontSize: 14,
  fontWeight: "700" as const,
};

const missionEyebrow = {
  color: colors.blue,
  fontSize: 12,
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.5,
};

const missionTarget = {
  color: colors.primary,
  fontSize: 16,
  fontWeight: "700" as const,
};

const etaLabel = {
  color: colors.slate400,
  fontSize: 12,
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
};

const etaValue = {
  color: colors.primary,
  fontSize: 18,
  fontWeight: "800" as const,
};

const sheetTitle = {
  color: colors.primary,
  fontSize: 30,
  fontWeight: "900" as const,
};

const sheetSubtitle = {
  color: colors.blue,
  fontSize: 12,
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};

const stageHeader = {
  color: colors.slate400,
  fontSize: 12,
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.5,
};

const returnLabel = {
  color: colors.slate300,
  fontSize: 12,
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.5,
};

const stageTitle = {
  color: colors.slate500,
  fontSize: 13,
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
};

const stageValue = {
  color: colors.primary,
  fontSize: 17,
  fontWeight: "700" as const,
};

const primaryButtonText = {
  color: colors.surface,
  fontSize: 14,
  fontWeight: "800" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.8,
};

const secondaryBtn = {
  flex: 1,
  backgroundColor: colors.surfaceLow,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  paddingVertical: 14,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  minHeight: 48,
};

const secondaryBtnText = {
  color: colors.slate500,
  fontSize: 12,
  fontWeight: "700" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.2,
};

const emergencyBtn = {
  backgroundColor: colors.errorSoft,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  borderWidth: 1,
  borderColor: colors.errorSoftStrong,
  paddingVertical: 14,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  minHeight: 48,
};

const emergencyBtnText = {
  color: colors.error,
  fontSize: 12,
  fontWeight: "800" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.4,
};

const modalHandle = {
  width: 48,
  height: 5,
  borderRadius: radii.pill,
  backgroundColor: colors.slate200,
};

const profileName = {
  color: colors.primary,
  fontSize: 34,
  fontWeight: "900" as const,
  textAlign: "center" as const,
};

const profileTier = {
  color: colors.blue,
  fontSize: 13,
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.4,
};

const medicalCard = {
  backgroundColor: colors.errorSoft,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  padding: spacing.lg,
  gap: 10,
};

const medicalTitle = {
  color: colors.error,
  fontSize: 13,
  fontWeight: "700" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.3,
};

const medicalBody = {
  color: colors.primary,
  fontSize: 16,
  fontWeight: "600" as const,
  lineHeight: 24,
};

const tileLabel = {
  color: colors.slate400,
  fontSize: 12,
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
};

const tileValue = {
  color: colors.primary,
  fontSize: 18,
  fontWeight: "700" as const,
};
