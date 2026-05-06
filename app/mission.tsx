import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import MapView, { Marker, Polyline } from "@/components/Map";

import { AnimatedDriverMarker } from "@/components/ui/AnimatedDriverMarker";
import { Avatar } from "@/components/ui/Avatar";
import { EmergencyModal } from "@/components/ui/EmergencyModal";
import { GradientCard } from "@/components/ui/gradient-card";
import { PageTransition } from "@/components/ui/PageTransition";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DISPATCH_PHONE, formatPhone } from "@/lib/config";
import { useDispatch } from "@/lib/dispatch-context";
import { clearActiveRideId, setActiveRideId } from "@/lib/fleet-api";
import { useHaptics } from "@/lib/haptics-context";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "@/lib/haptics";
import { useLocation } from "@/lib/location-context";
import { getRideBackendId, type DispatchedRide } from "@/lib/rides";
import { useDirections } from "@/lib/use-directions";
import { colors, radii, shadows, spacing, type StatusKey } from "@/lib/theme";

const totalStages = 4;

export default function MissionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapView | null>(null);
  const followMode = useRef(true);
  const { activeRide, updateStatus } = useDispatch();
  const mission = activeRide ?? makeMissingRide();
  const missionInitials = getInitials(mission.passengerName);
  const { location, startBackgroundTracking, stopBackgroundTracking } = useLocation();
  const { impact, notification } = useHaptics();
  const snapPoints = useMemo(() => [520, "88%"], []);
  const routeFitPadding = useMemo(
    () => ({
      top: headerHeight + 208,
      right: 84,
      bottom: 532 + insets.bottom,
      left: 48,
    }),
    [headerHeight, insets.bottom],
  );
  const [missionStep, setMissionStep] = useState(1);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [riderProfileOpen, setRiderProfileOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  // While on the mission screen, keep Suresh's backend informed even if the phone is
  // locked. `setActiveRideId` writes to AsyncStorage so the TaskManager task
  // (which can't read React context) can stamp each background ping.
  useEffect(() => {
    const backendRideId = activeRide ? getRideBackendId(activeRide.id) : null;
    if (backendRideId !== null) {
      void setActiveRideId(backendRideId);
    } else {
      void clearActiveRideId();
    }
    startBackgroundTracking();
    return () => {
      stopBackgroundTracking();
      clearActiveRideId();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRide?.id]);

  const currentTarget =
    missionStep === 1
      ? mission.pickupAddress
      : missionStep === 2
        ? mission.dropoffAddress
        : missionStep === 3
          ? mission.dropoffAddress
          : mission.pickupAddress;

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
  const stages = useMemo(
    () => [
      { title: "Pickup @ Home", value: mission.pickupAddress },
      { title: "Drop-off @ Facility", value: mission.dropoffAddress },
      { title: "Return Pickup", value: mission.dropoffAddress },
      { title: "Arrive Home", value: mission.pickupAddress },
    ],
    [mission.dropoffAddress, mission.pickupAddress],
  );
  const currentStage = stages[missionStep - 1] ?? stages[0];
  const nextStage = stages[missionStep] ?? null;
  const isExpanded = sheetIndex > 0;
  const missionMapCoords = useMemo(() => {
    const coords: Array<{ latitude: number; longitude: number }> = [];
    if (location) coords.push({ latitude: location.latitude, longitude: location.longitude });
    if (mission.pickupCoords) coords.push(mission.pickupCoords);
    if (mission.dropoffCoords) coords.push(mission.dropoffCoords);
    return coords;
  }, [
    location?.latitude,
    location?.longitude,
    mission.dropoffCoords,
    mission.pickupCoords,
  ]);
  const currentMapTarget = missionStep <= 1
    ? mission.pickupCoords
    : missionStep <= 3
      ? mission.dropoffCoords
      : mission.pickupCoords;
  const advanceMission = () => {
    notification(NotificationFeedbackType.Success);
    const nextStatus =
      missionStep === 1
        ? "picked_up"
        : missionStep === 2 || missionStep === 3
          ? "in_transit"
          : "completed";
    updateStatus(mission.id, nextStatus);
    if (missionStep >= totalStages) {
      router.back();
      return;
    }
    setMissionStep((current) => current + 1);
  };
  const openCancelConfirm = () => {
    notification(NotificationFeedbackType.Warning);
    setCancelConfirmOpen(true);
  };
  const confirmCancelRide = () => {
    notification(NotificationFeedbackType.Warning);
    updateStatus(mission.id, "cancelled");
    setCancelConfirmOpen(false);
    router.back();
  };
  const openReportIssue = () => {
    impact(ImpactFeedbackStyle.Light);
    router.push({ pathname: "/info", params: { slug: "report" } });
  };
  const openEmergency = () => {
    notification(NotificationFeedbackType.Error);
    setEmergencyOpen(true);
  };
  const recenterOnDriver = () => {
    impact(ImpactFeedbackStyle.Light);
    if (location && mapRef.current) {
      followMode.current = true;
      mapRef.current.animateCamera(
        { center: { latitude: location.latitude, longitude: location.longitude } },
        { duration: 400 },
      );
    }
  };
  const focusCurrentStopOnMap = () => {
    impact(ImpactFeedbackStyle.Light);
    followMode.current = false;
    if (!mapRef.current || !currentMapTarget) return;
    const latitudeInset = 0.0028;
    const longitudeInset = 0.0028;
    mapRef.current.fitToCoordinates(
      [
        {
          latitude: currentMapTarget.latitude - latitudeInset,
          longitude: currentMapTarget.longitude - longitudeInset,
        },
        {
          latitude: currentMapTarget.latitude + latitudeInset,
          longitude: currentMapTarget.longitude + longitudeInset,
        },
      ],
      { edgePadding: routeFitPadding, animated: true },
    );
  };
  const fitMissionRouteOnMap = () => {
    impact(ImpactFeedbackStyle.Light);
    followMode.current = false;
    if (!mapRef.current || missionMapCoords.length === 0) return;
    if (missionMapCoords.length === 1) {
      mapRef.current.animateCamera(
        { center: missionMapCoords[0], heading: 0 },
        { duration: 400 },
      );
      return;
    }
    mapRef.current.fitToCoordinates(
      missionMapCoords,
      { edgePadding: routeFitPadding, animated: true },
    );
  };
  const toggleMissionDetail = () => {
    impact(ImpactFeedbackStyle.Light);
    bottomSheetRef.current?.snapToIndex(isExpanded ? 0 : 1);
  };
  const openRiderProfile = () => {
    impact(ImpactFeedbackStyle.Light);
    setRiderProfileOpen(true);
  };
  const openNativeMissionMenu = () => {
    impact(ImpactFeedbackStyle.Light);
    const detailLabel = isExpanded ? "Show Compact Controls" : "Show Full Mission Detail";
    const actions = [
      { label: detailLabel, run: toggleMissionDetail },
      { label: "Fit Route On Map", run: fitMissionRouteOnMap },
      { label: "View Rider Profile", run: openRiderProfile },
    ];

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: mission.passengerName,
          message: `Ride ${mission.id}`,
          options: [...actions.map((action) => action.label), "Cancel"],
          cancelButtonIndex: actions.length,
          userInterfaceStyle: "light",
        },
        (buttonIndex) => {
          actions[buttonIndex]?.run();
        },
      );
      return;
    }

    Alert.alert(
      "Mission Options",
      `${mission.passengerName} · Ride ${mission.id}`,
      [
        ...actions.map((action) => ({
          text: action.label,
          onPress: action.run,
        })),
        { text: "Cancel", style: "cancel" as const },
      ],
    );
  };

  return (
    <PageTransition>
    <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
      <MissionMap
        ride={mission}
        missionStep={missionStep}
        fitPadding={routeFitPadding}
        onMapRef={(ref) => { mapRef.current = ref; }}
      />

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
          style={mapInfoBanner}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Avatar initials={missionInitials} size={40} />
            <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={missionEyebrow} numberOfLines={1}>
                  Active Mission
                </Text>
                <StatusBadge status={missionStatus} />
              </View>
              <Text selectable numberOfLines={2} style={missionTarget}>
                {currentTarget}
              </Text>
            </View>
            <View style={etaPill}>
              <Text style={etaLabel}>
                ETA
              </Text>
              <Text selectable style={etaValue}>
                Live
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          right: 16,
          top: headerHeight + 158,
          gap: 10,
          zIndex: 20,
        }}
      >
        <FloatingControl
          label="➤"
          hint="Re-center map on my location"
          onPress={recenterOnDriver}
        />
        <FloatingControl
          label="◎"
          hint="Center the current mission stop in the visible map area"
          onPress={focusCurrentStopOnMap}
        />
      </View>

      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        onChange={setSheetIndex}
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
            paddingBottom: 14,
            gap: spacing.md,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            layout={LinearTransition.duration(220)}
            style={sheetHeaderCard}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
              <Pressable onPress={() => { impact(ImpactFeedbackStyle.Light); setRiderProfileOpen(true); }} accessibilityRole="button" accessibilityLabel={`View profile for ${mission.passengerName}`}>
                <Avatar initials={missionInitials} size={56} />
              </Pressable>
              <View style={rideTitleBlock}>
                <Text style={rideTitleEyebrow} numberOfLines={1}>
                  Ride {mission.id}
                </Text>
                <Text selectable style={sheetTitle} numberOfLines={1}>
                  {mission.passengerName}
                </Text>
                <Text style={sheetSubtitle} numberOfLines={1}>
                  {mission.transitType} {mission.tripType}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={openNativeMissionMenu}
              accessibilityRole="button"
              accessibilityLabel="Open mission options"
              style={({ pressed }) => [missionMenuButton, pressed ? { opacity: 0.72 } : null]}
            >
              <Text style={{ color: colors.slate500, fontSize: 20 }}>⋯</Text>
            </Pressable>
          </Animated.View>

          {isExpanded ? (
            <Animated.View
              key="expanded-mission-detail"
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(120)}
              layout={LinearTransition.duration(220)}
              style={{ gap: 16 }}
            >
              <Text style={stageHeader}>
                Mission Stages
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {stageBars.map((_, index) => (
                  <View
                    key={index}
                    style={{
                      flex: 1,
                      height: 8,
                      borderRadius: radii.pill,
                      backgroundColor:
                        missionStep >= index + 1 ? colors.blue : colors.slate200,
                    }}
                  />
                ))}
              </View>

              <View style={{ gap: 10, paddingTop: 2 }}>
                <StageRow
                  active={missionStep === 1}
                  complete={missionStep > 1}
                  title={stages[0].title}
                  value={stages[0].value}
                />
                <StageRow
                  active={missionStep === 2}
                  complete={missionStep > 2}
                  title={stages[1].title}
                  value={stages[1].value}
                />

                <View
                  style={returnSectionHeader}
                >
                  <Text style={{ color: colors.slate500, fontSize: 16 }}>↺</Text>
                  <Text style={returnLabel}>
                    Return Leg Details
                  </Text>
                </View>
                <StageRow
                  active={missionStep === 3}
                  complete={missionStep > 3}
                  title={stages[2].title}
                  value={stages[2].value}
                />
                <StageRow
                  active={missionStep === 4}
                  complete={false}
                  title={stages[3].title}
                  value={stages[3].value}
                />
              </View>

              <View style={detailGrid}>
                <ProfileTile label="Pickup Time" value={`${mission.scheduledDate} ${mission.scheduledTime}`} />
                <ProfileTile label="Ride ID" value={mission.id} />
              </View>
            </Animated.View>
          ) : (
            <Animated.View
              key="collapsed-mission-actions"
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(120)}
              layout={LinearTransition.duration(220)}
              style={collapsedMissionContent}
            >
              <CondensedMissionSummary
                currentStage={currentStage}
                nextStage={nextStage}
                missionStep={missionStep}
                totalStages={totalStages}
              />
              <MissionActionStack
                currentAction={currentAction}
                onAdvance={advanceMission}
                onCancel={openCancelConfirm}
                onReport={openReportIssue}
                onEmergency={openEmergency}
              />
            </Animated.View>
          )}
        </BottomSheetScrollView>

        {isExpanded ? (
          <Animated.View
            key="expanded-action-footer"
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            layout={LinearTransition.duration(220)}
            style={{
              paddingHorizontal: spacing.lg,
              paddingTop: 12,
              paddingBottom: 22 + insets.bottom,
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.slate100,
            }}
          >
            <MissionActionStack
              currentAction={currentAction}
              onAdvance={advanceMission}
              onCancel={openCancelConfirm}
              onReport={openReportIssue}
              onEmergency={openEmergency}
            />
          </Animated.View>
        ) : null}
      </BottomSheet>

      <ConfirmActionModal
        visible={cancelConfirmOpen}
        title="Cancel this ride?"
        description="This will update the backend ride status to cancelled and return you to dispatch."
        destructiveLabel="Cancel Ride"
        onConfirm={confirmCancelRide}
        onClose={() => setCancelConfirmOpen(false)}
      />

      <EmergencyModal
        visible={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
        title="Mission emergency"
        description="Call dispatch, the rider emergency contact if available, or 911."
        options={[
          ...(mission.emergencyContact
            ? [{
                kicker: "Rider contact",
                title: "Emergency Contact",
                number: mission.emergencyContact,
                hint: formatPhone(mission.emergencyContact),
                variant: "primary" as const,
              }]
            : []),
          {
            kicker: "TrustedRiders",
            title: "Dispatch",
            number: DISPATCH_PHONE,
            hint: formatPhone(DISPATCH_PHONE),
            variant: "primary",
          },
          {
            kicker: "Immediate danger",
            title: "Call 911",
            number: "911",
            variant: "danger",
          },
        ]}
      />

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
              <Avatar initials={missionInitials} size={96} />
              <View style={{ alignItems: "center", gap: 6 }}>
                <Text selectable style={profileName}>
                  {mission.passengerName}
                </Text>
                <Text style={profileTier}>
                  Backend Ride {mission.id}
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
                  {mission.notes || "No care notes are attached to this ride."}
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 14 }}>
                <ProfileTile label="Transit" value={mission.transitType} />
                <ProfileTile label="Trip" value={mission.tripType} />
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
  ride,
  missionStep,
  fitPadding,
  onMapRef,
}: {
  ride: DispatchedRide;
  missionStep: number;
  fitPadding: { top: number; right: number; bottom: number; left: number };
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
      ? ride.pickupCoords
      : missionStep <= 3
        ? ride.dropoffCoords
        : ride.pickupCoords;
  const routeEndpoints = [ride.pickupCoords, ride.dropoffCoords].filter(
    (coord): coord is NonNullable<typeof coord> => !!coord,
  );

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
      const fitCoords = [
        { latitude: location.latitude, longitude: location.longitude },
        ...routeEndpoints,
      ];
      if (fitCoords.length > 1) {
        mapRef.current.fitToCoordinates(
          fitCoords,
          { edgePadding: fitPadding, animated: false },
        );
      }
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
  }, [location, fitPadding]);

  const center = location
    ? { latitude: location.latitude, longitude: location.longitude }
    : ride.pickupCoords ?? ride.dropoffCoords;

  if (!center) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.mapPlaceholder }}>
        <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
          Route map unavailable
        </Text>
      </View>
    );
  }

  // Use real route coords if available, otherwise fall back to straight line
  const activeRouteCoords =
    missionStep > 1 && ride.routeCoords.length > 1
      ? ride.routeCoords
      : directions.routeCoords && directions.routeCoords.length > 1
      ? directions.routeCoords
      : driverPos && currentTarget
        ? [driverPos, currentTarget]
        : routeEndpoints;

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
      {ride.pickupCoords ? (
        <Marker
          coordinate={ride.pickupCoords}
          title="Pickup"
          description={ride.pickupAddress}
          pinColor={colors.blue}
          tracksViewChanges={false}
        />
      ) : null}
      {ride.dropoffCoords ? (
        <Marker
          coordinate={ride.dropoffCoords}
          title="Drop-off"
          description={ride.dropoffAddress}
          pinColor={colors.green}
          tracksViewChanges={false}
        />
      ) : null}
      {activeRouteCoords.length > 1 ? (
        <Polyline
          coordinates={activeRouteCoords}
          strokeColor={colors.blue}
          strokeWidth={4}
        />
      ) : null}
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
  const isUpcoming = !active && !complete;
  const markerBackground = complete
    ? colors.greenSoft
    : active
      ? colors.blueSoft
      : colors.surface;
  const markerBorder = complete
    ? colors.green
    : active
      ? colors.blue
      : colors.slate200;
  const titleColor = active
    ? colors.primarySoft
    : complete
      ? colors.slate500
      : colors.slate400;
  const valueColor = active
    ? colors.primary
    : complete
      ? colors.primarySoft
      : colors.slate500;

  return (
    <View
      style={[
        stageRow,
        active ? stageRowActive : null,
        complete ? stageRowComplete : null,
        isUpcoming ? stageRowUpcoming : null,
      ]}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radii.sm,
          backgroundColor: markerBackground,
          borderWidth: 1,
          borderColor: markerBorder,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        {complete ? (
          <Text style={{ color: colors.green, fontSize: 13, fontWeight: "900" }}>✓</Text>
        ) : active ? (
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: radii.pill,
              backgroundColor: colors.blue,
            }}
          />
        ) : (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: radii.pill,
              backgroundColor: colors.slate300,
            }}
          />
        )}
      </View>
      <View style={{ gap: 4, flex: 1 }}>
        <Text style={[stageTitle, { color: titleColor }]} numberOfLines={1}>
          {title}
        </Text>
        <Text selectable style={[stageValue, { color: valueColor }]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function CondensedMissionSummary({
  currentStage,
  nextStage,
  missionStep,
  totalStages,
}: {
  currentStage: { title: string; value: string };
  nextStage: { title: string; value: string } | null;
  missionStep: number;
  totalStages: number;
}) {
  return (
    <View style={condensedCard}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <View style={{ gap: 4, flex: 1 }}>
          <Text style={condensedEyebrow}>
            Current Step
          </Text>
          <Text style={condensedTitle} numberOfLines={1}>
            {currentStage.title}
          </Text>
        </View>
        <View style={stepCounter}>
          <Text style={stepCounterText}>
            {missionStep}/{totalStages}
          </Text>
        </View>
      </View>

      <View style={condensedAddressBlock}>
        <View style={activeDot} />
        <Text selectable style={condensedAddress} numberOfLines={2}>
          {currentStage.value}
        </Text>
      </View>

      {nextStage ? (
        <View style={nextStepBlock}>
          <Text style={nextStepLabel}>
            Next
          </Text>
          <Text selectable style={nextStepValue} numberOfLines={1}>
            {nextStage.title} · {nextStage.value}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MissionActionStack({
  currentAction,
  onAdvance,
  onCancel,
  onReport,
  onEmergency,
}: {
  currentAction: string;
  onAdvance: () => void;
  onCancel: () => void;
  onReport: () => void;
  onEmergency: () => void;
}) {
  return (
    <View style={missionActionStack}>
      <Pressable
        onPress={onAdvance}
        accessibilityRole="button"
        accessibilityLabel={currentAction}
        style={({ pressed }) => [primaryActionButton, pressed ? primaryActionButtonPressed : null]}
      >
        <Text style={primaryButtonText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
          {currentAction}
        </Text>
        <Text style={primaryButtonArrow}>→</Text>
      </Pressable>

      <View style={supportActionGrid}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel ride"
          style={({ pressed }) => [secondaryBtn, pressed ? secondaryBtnPressed : null]}
        >
          <View style={supportIconCircle}>
            <Text style={supportIconText}>×</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={onReport}
          accessibilityRole="button"
          accessibilityLabel="Report an issue"
          style={({ pressed }) => [secondaryBtn, pressed ? secondaryBtnPressed : null]}
        >
          <View style={supportIconCircle}>
            <Text style={supportIconText}>?</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={onEmergency}
          accessibilityRole="button"
          accessibilityLabel="Emergency assistance"
          style={({ pressed }) => [emergencyBtn, pressed ? emergencyBtnPressed : null]}
        >
          <View style={emergencyIconCircle}>
            <Text style={emergencyIconText}>!</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function ConfirmActionModal({
  visible,
  title,
  description,
  destructiveLabel,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  description: string;
  destructiveLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={confirmModalRoot}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close confirmation"
          style={confirmModalBackdrop}
        />
        <View style={confirmModalCard}>
          <View style={{ gap: 8 }}>
            <Text style={confirmModalKicker}>Confirm Action</Text>
            <Text style={confirmModalTitle}>{title}</Text>
            <Text style={confirmModalBody}>{description}</Text>
          </View>
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel={destructiveLabel}
              style={({ pressed }) => [confirmDestructiveButton, pressed ? { opacity: 0.78 } : null]}
            >
              <Text style={confirmDestructiveText}>{destructiveLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Keep ride"
              style={({ pressed }) => [confirmKeepButton, pressed ? { opacity: 0.72 } : null]}
            >
              <Text style={confirmKeepText}>Keep Ride Active</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.slate200,
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

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "TR";
}

function makeMissingRide(): DispatchedRide {
  return {
    id: "pending",
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
    status: "en_route",
    createdAt: Date.now(),
  };
}

const statusText = {
  color: colors.primary,
  fontSize: 14,
  fontWeight: "700" as const,
};

const missionEyebrow = {
  color: colors.blue,
  fontSize: 11,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
};

const missionTarget = {
  color: colors.primary,
  fontSize: 15,
  lineHeight: 19,
  fontWeight: "800" as const,
  flexShrink: 1,
};

const etaLabel = {
  color: colors.slate500,
  fontSize: 10,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
};

const etaValue = {
  color: colors.primary,
  fontSize: 15,
  fontWeight: "900" as const,
};

const mapInfoBanner = {
  backgroundColor: colors.surfaceFrosted,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  paddingHorizontal: 14,
  paddingVertical: 12,
  borderWidth: 1,
  borderColor: colors.surface,
  ...shadows.floating,
};

const etaPill = {
  minWidth: 58,
  borderRadius: radii.sm,
  borderCurve: "continuous" as const,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.slate200,
  paddingHorizontal: 10,
  paddingVertical: 7,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 1,
};

const sheetHeaderCard = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  backgroundColor: colors.surfaceLowest,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  borderWidth: 1,
  borderColor: colors.slate200,
  paddingHorizontal: spacing.md,
  paddingVertical: 14,
};

const missionMenuButton = {
  width: 48,
  height: 48,
  borderRadius: radii.sm,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.slate200,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const rideTitleBlock = {
  flex: 1,
  minWidth: 0,
  gap: 5,
};

const rideTitleEyebrow = {
  color: colors.slate500,
  fontSize: 11,
  lineHeight: 13,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};

const sheetTitle = {
  color: colors.primary,
  fontSize: 30,
  lineHeight: 34,
  fontWeight: "900" as const,
};

const sheetSubtitle = {
  color: colors.blue,
  fontSize: 14,
  lineHeight: 17,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.4,
};

const stageHeader = {
  color: colors.primarySoft,
  fontSize: 13,
  fontWeight: "800" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.5,
};

const stageRow = {
  flexDirection: "row" as const,
  gap: 14,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  borderWidth: 1,
  padding: 12,
};

const stageRowActive = {
  backgroundColor: colors.surfaceLowest,
  borderColor: colors.blueSoft,
};

const stageRowComplete = {
  backgroundColor: colors.surfaceLowest,
  borderColor: colors.greenSoft,
};

const stageRowUpcoming = {
  backgroundColor: colors.surfaceLow,
  borderColor: colors.slate200,
};

const returnSectionHeader = {
  borderRadius: radii.sm,
  borderCurve: "continuous" as const,
  borderWidth: 1,
  borderColor: colors.slate200,
  backgroundColor: colors.surfaceLow,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
  paddingHorizontal: 12,
  paddingVertical: 10,
};

const returnLabel = {
  color: colors.slate500,
  fontSize: 12,
  fontWeight: "800" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.5,
};

const stageTitle = {
  color: colors.slate500,
  fontSize: 12,
  fontWeight: "800" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 0.9,
};

const stageValue = {
  color: colors.primary,
  fontSize: 16,
  lineHeight: 21,
  fontWeight: "800" as const,
};

const condensedCard = {
  backgroundColor: colors.surfaceLowest,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  borderWidth: 1,
  borderColor: colors.blueSoft,
  padding: spacing.md,
  gap: 12,
};

const condensedEyebrow = {
  color: colors.blue,
  fontSize: 12,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.2,
};

const condensedTitle = {
  color: colors.primary,
  fontSize: 22,
  lineHeight: 26,
  fontWeight: "900" as const,
};

const stepCounter = {
  minWidth: 52,
  height: 36,
  borderRadius: radii.pill,
  backgroundColor: colors.blue,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 12,
};

const stepCounterText = {
  color: colors.surface,
  fontSize: 13,
  fontWeight: "900" as const,
};

const condensedAddressBlock = {
  flexDirection: "row" as const,
  alignItems: "flex-start" as const,
  gap: 10,
  backgroundColor: colors.surface,
  borderRadius: radii.sm,
  borderCurve: "continuous" as const,
  borderWidth: 1,
  borderColor: colors.slate200,
  padding: 12,
};

const activeDot = {
  width: 10,
  height: 10,
  borderRadius: radii.pill,
  backgroundColor: colors.blue,
  marginTop: 5,
};

const condensedAddress = {
  color: colors.primary,
  fontSize: 17,
  lineHeight: 22,
  fontWeight: "900" as const,
  flex: 1,
};

const nextStepBlock = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
};

const nextStepLabel = {
  color: colors.slate500,
  fontSize: 12,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};

const nextStepValue = {
  color: colors.primarySoft,
  fontSize: 13,
  fontWeight: "800" as const,
  flex: 1,
};

const detailGrid = {
  flexDirection: "row" as const,
  gap: 10,
};

const collapsedMissionContent = {
  gap: 12,
};

const missionActionStack = {
  backgroundColor: colors.surfaceLowest,
  borderRadius: radii.lg,
  borderCurve: "continuous" as const,
  borderWidth: 1,
  borderColor: colors.slate200,
  padding: 10,
  gap: 9,
};

const primaryActionButton = {
  minHeight: 56,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  backgroundColor: colors.primary,
  paddingHorizontal: spacing.md,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: 10,
  ...shadows.soft,
};

const primaryActionButtonPressed = {
  backgroundColor: colors.primarySoft,
};

const primaryButtonText = {
  color: colors.surface,
  fontSize: 13,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.4,
  flexShrink: 1,
};

const primaryButtonArrow = {
  color: colors.surface,
  fontSize: 20,
  fontWeight: "900" as const,
};

const supportActionGrid = {
  flexDirection: "row" as const,
  gap: 10,
};

const secondaryBtn = {
  flex: 1,
  backgroundColor: colors.surface,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  borderWidth: 1,
  borderColor: colors.slate200,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  minHeight: 58,
};

const secondaryBtnPressed = {
  backgroundColor: colors.surfaceLow,
};

const supportIconCircle = {
  width: 34,
  height: 34,
  borderRadius: radii.pill,
  backgroundColor: colors.surfaceLow,
  borderWidth: 1,
  borderColor: colors.slate200,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const supportIconText = {
  color: colors.primarySoft,
  fontSize: 22,
  lineHeight: 24,
  fontWeight: "900" as const,
};

const emergencyBtn = {
  flex: 1,
  backgroundColor: colors.errorSoft,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  borderWidth: 1,
  borderColor: colors.errorSoftStrong,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  minHeight: 58,
};

const emergencyBtnPressed = {
  backgroundColor: colors.errorSoftDark,
};

const emergencyIconCircle = {
  width: 34,
  height: 34,
  borderRadius: radii.pill,
  backgroundColor: colors.error,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const emergencyIconText = {
  color: colors.surface,
  fontSize: 22,
  lineHeight: 24,
  fontWeight: "900" as const,
};

const confirmModalRoot = {
  flex: 1,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  padding: spacing.lg,
};

const confirmModalBackdrop = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(15, 23, 42, 0.72)",
};

const confirmModalCard = {
  width: "100%" as const,
  maxWidth: 380,
  backgroundColor: colors.surface,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  padding: spacing.lg,
  gap: spacing.lg,
};

const confirmModalKicker = {
  color: colors.error,
  fontSize: 11,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 2,
};

const confirmModalTitle = {
  color: colors.primary,
  fontSize: 24,
  lineHeight: 29,
  fontWeight: "900" as const,
};

const confirmModalBody = {
  color: colors.slate500,
  fontSize: 14,
  lineHeight: 20,
  fontWeight: "700" as const,
};

const confirmDestructiveButton = {
  minHeight: 52,
  borderRadius: radii.sm,
  borderCurve: "continuous" as const,
  backgroundColor: colors.error,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const confirmDestructiveText = {
  color: colors.surface,
  fontSize: 13,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.4,
};

const confirmKeepButton = {
  minHeight: 48,
  borderRadius: radii.sm,
  borderCurve: "continuous" as const,
  backgroundColor: colors.surfaceLow,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const confirmKeepText = {
  color: colors.primarySoft,
  fontSize: 13,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
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
