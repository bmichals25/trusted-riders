import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  LayoutChangeEvent,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";

import MapView, { Marker, Polyline } from "@/components/Map";

import { Avatar } from "@/components/ui/Avatar";
import { EmergencyModal } from "@/components/ui/EmergencyModal";
import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { useAuth } from "@/components/ui/DriverNameGate";
import { PageTransition } from "@/components/ui/PageTransition";
import { GradientCard } from "@/components/ui/gradient-card";
import { LocationRow } from "@/components/ui/LocationRow";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LocationPermissionBanner } from "@/components/ui/LocationPermissionBanner";
import { useDispatch } from "@/lib/dispatch-context";
import { useHaptics } from "@/lib/haptics-context";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "@/lib/haptics";
import { useLocation } from "@/lib/location-context";
import { useDirections } from "@/lib/use-directions";
import { DISPATCH_PHONE, formatPhone } from "@/lib/config";
import { colors, radii, shadows, spacing, type StatusKey } from "@/lib/theme";


type TabKey = "current" | "scheduled" | "past" | "requests";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey | null>("current");
  const [riderProfileOpen, setRiderProfileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { rides, pendingRides, scheduledRides, activeRide, refreshRides, acceptRide, declineRide } = useDispatch();
  const { impact, notification, selection } = useHaptics();
  const pastRides = rides.filter((ride) => ride.status === "completed" || ride.status === "cancelled");

  const protocolBars = useMemo(() => new Array(5).fill(0), []);
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<TabKey, number>>({
    current: 0,
    scheduled: 0,
    past: 0,
    requests: 0,
  });

  const handleSectionLayout =
    (tab: TabKey) =>
    (event: LayoutChangeEvent) => {
      sectionOffsets.current[tab] = event.nativeEvent.layout.y;
    };

  const toggleSection = (tab: TabKey) => {
    selection();
    setActiveTab((current) => {
      const next = current === tab ? "current" : tab;

      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(sectionOffsets.current[next], 0),
          animated: true,
        });
      }, 350);

      return next;
    });
  };

  return (
    <PageTransition>
      <ScrollView
        ref={scrollViewRef}
        contentInsetAdjustmentBehavior="never"
        style={{ flex: 1, backgroundColor: colors.surfaceLow }}
        contentContainerStyle={{
          paddingBottom: 172 + insets.bottom,
        }}
        scrollIndicatorInsets={{ bottom: 132 + insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              refreshRides().finally(() => setRefreshing(false));
            }}
            tintColor={colors.blue}
            colors={[colors.blue]}
          />
        }
      >
        <LocationPermissionBanner />
        <View
          style={{
            paddingHorizontal: spacing.sm,
            paddingTop: spacing.sm,
            gap: 4,
          }}
        >
          <FadeInBlock delay={40}>
          <AccordionSection
            title="Current Ride"
            active={activeTab === "current"}
            onLayout={handleSectionLayout("current")}
            onPress={() => toggleSection("current")}
          >
            {activeRide ? (
              <View style={{ gap: spacing.sm }}>
                <Pressable
                  onPress={() => { impact(ImpactFeedbackStyle.Light); router.push("/mission"); }}
                  accessibilityRole="button"
                  accessibilityLabel="Open live mission map"
                  style={({ pressed }) => ({
                    ...currentMapHero,
                    transform: [{ scale: pressed ? 0.995 : 1 }],
                  })}
                >
                  <MiniMap />
                  <View style={currentMapTopBar}>
                    <StatusBadge status={getRideBadgeStatus(activeRide.status)} />
                  </View>
                  <Pressable
                    onPress={() => { impact(ImpactFeedbackStyle.Light); setRiderProfileOpen(true); }}
                    accessibilityRole="button"
                    accessibilityLabel={`View rider profile for ${activeRide.passengerName}`}
                    style={({ pressed }) => [
                      currentMapRiderCard,
                      pressed ? { opacity: 0.9 } : null,
                    ]}
                  >
                    <Avatar initials={activeRide.passengerName.split(" ").map(n => n[0]).join("")} size={44} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={compactOverlayLabel}>Rider</Text>
                      <Text selectable style={currentMapRiderName} numberOfLines={1}>
                        {activeRide.passengerName}
                      </Text>
                      <Text selectable style={currentMapRiderMeta} numberOfLines={1}>
                        {activeRide.transitType} {activeRide.tripType} · ID {activeRide.id}
                      </Text>
                    </View>
                    <View style={currentMapTimeCard}>
                      <Text style={currentMapTimeLabel}>Pickup</Text>
                      <Text selectable style={currentMapTime} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
                        {activeRide.scheduledTime}
                      </Text>
                      <Text selectable style={currentMapDate} numberOfLines={1}>
                        {activeRide.scheduledDate}
                      </Text>
                    </View>
                  </Pressable>
                </Pressable>

                <View style={currentRouteOverlayCard}>
                  <View style={currentRouteRow}>
                    <View style={routeDotBlue} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={compactOverlayLabel}>Pickup</Text>
                      <Text selectable style={currentRouteAddress} numberOfLines={2}>
                        {activeRide.pickupAddress}
                      </Text>
                    </View>
                  </View>
                  <View style={{ height: 1, backgroundColor: colors.slate100, marginLeft: 19 }} />
                  <View style={currentRouteRow}>
                    <View style={routeDotGreen} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={compactOverlayLabel}>Drop-off</Text>
                      <Text selectable style={currentRouteAddress} numberOfLines={2}>
                        {activeRide.dropoffAddress}
                      </Text>
                    </View>
                  </View>
                </View>

                {activeRide.notes ? (
                  <View style={currentRideDetailCard}>
                    <Text style={microLabel}>Care notes</Text>
                    <Text selectable style={currentRideBodyText}>
                      {activeRide.notes}
                    </Text>
                  </View>
                ) : null}

                {activeRide.emergencyContact ? (
                  <View style={currentRideDetailCard}>
                    <Text style={microLabel}>Emergency contact</Text>
                    <Text selectable style={currentRideBodyText}>
                      {formatPhone(activeRide.emergencyContact)}
                    </Text>
                  </View>
                ) : null}

                <Pressable onPress={() => { impact(ImpactFeedbackStyle.Light); router.push("/mission"); }} accessibilityRole="button" accessibilityLabel="Track live mission">
                  <GradientCard padding={16}>
                    <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 }}>
                      <Text style={primaryActionText}>Track Live Mission</Text>
                      <Text style={primaryActionText}>→</Text>
                    </View>
                  </GradientCard>
                </Pressable>
              </View>
            ) : (
              <View
                style={{
                  borderRadius: radii.md,
                  borderCurve: "continuous",
                  paddingVertical: 24,
                  paddingHorizontal: spacing.lg,
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radii.sm,
                    backgroundColor: colors.surfaceLow,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 2,
                  }}
                >
                  <Text style={{ color: colors.slate300, fontSize: 18 }}>⌂</Text>
                </View>
                <Text style={emptyStateHeading}>
                  No active ride
                </Text>
                <Text style={emptyStateText}>
                  Accept a ride request to start a mission
                </Text>
              </View>
            )}
          </AccordionSection>
          </FadeInBlock>

          <FadeInBlock delay={120}>
          <AccordionSection
            title="Scheduled Rides"
            active={activeTab === "scheduled"}
            badge={scheduledRides.length > 0 ? String(scheduledRides.length) : undefined}
            onLayout={handleSectionLayout("scheduled")}
            onPress={() => toggleSection("scheduled")}
          >
            <View style={{ gap: spacing.md }}>
              {scheduledRides.length === 0 ? (
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radii.md,
                    borderCurve: "continuous",
                    paddingVertical: 24,
                    paddingHorizontal: spacing.xl,
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Text style={{ color: colors.slate300, fontSize: 20 }}>▸</Text>
                  <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}>
                    No upcoming rides
                  </Text>
                  <Text style={{ color: colors.slate400, fontSize: 13, fontWeight: "500", textAlign: "center" }}>
                    Scheduled rides will appear here
                  </Text>
                </View>
              ) : null}
              {scheduledRides.map((ride) => (
                <Pressable
                  key={ride.id}
                  onPress={() => { impact(ImpactFeedbackStyle.Light); router.push({ pathname: "/ride-details", params: { rideId: ride.id } }); }}
                  style={({ pressed }) => ({
                    backgroundColor: colors.surface,
                    borderRadius: radii.md,
                    borderCurve: "continuous",
                    padding: 20,
                    gap: 10,
                    opacity: pressed ? 0.92 : 1,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                    ...shadows.soft,
                  })}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text selectable style={timeBadge}>
                      {ride.scheduledDate} {ride.scheduledTime}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <StatusBadge status="scheduled" />
                      <Text selectable style={microLabel}>
                        {ride.id}
                      </Text>
                    </View>
                  </View>
                  <Text selectable style={cardTitle}>
                    {ride.passengerName}
                  </Text>
                  <Text selectable style={cardMeta}>
                    {ride.transitType} — {ride.tripType}
                  </Text>
                  <View style={{ gap: 4 }}>
                    <View style={rowCenter}>
                      <View style={routeDotBlue} />
                      <Text style={routeAddressText}>{ride.pickupAddress}</Text>
                    </View>
                    <View style={rowCenter}>
                      <View style={routeDotGreen} />
                      <Text style={routeAddressText}>{ride.dropoffAddress}</Text>
                    </View>
                  </View>
                  <Text selectable style={dispatcherHint}>
                    Waiting for dispatcher to release
                  </Text>
                </Pressable>
              ))}
            </View>
          </AccordionSection>
          </FadeInBlock>

          <FadeInBlock delay={200}>
          <AccordionSection
            title="Past Rides"
            active={activeTab === "past"}
            onLayout={handleSectionLayout("past")}
            onPress={() => toggleSection("past")}
          >
            <View style={{ gap: spacing.sm }}>
              {pastRides.length === 0 ? (
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radii.md,
                    borderCurve: "continuous",
                    paddingVertical: 24,
                    paddingHorizontal: spacing.xl,
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Text style={{ color: colors.slate300, fontSize: 20 }}>◷</Text>
                  <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}>
                    No ride history
                  </Text>
                  <Text style={{ color: colors.slate400, fontSize: 13, fontWeight: "500", textAlign: "center" }}>
                    Completed rides will appear here
                  </Text>
                </View>
              ) : null}
              {pastRides.length > 0 ? (
                <View style={pastSummaryCard}>
                  <View style={{ gap: 2 }}>
                    <Text style={microLabel}>Ride history</Text>
                    <Text style={pastSummaryValue}>{pastRides.length} past trips</Text>
                  </View>
                  <View style={pastLatestPill}>
                    <Text style={pastLatestText}>{pastRides[0]?.scheduledDate ?? "Latest"}</Text>
                  </View>
                </View>
              ) : null}
              {pastRides.map((ride) => (
                <Pressable
                  key={ride.id}
                  onPress={() => { impact(ImpactFeedbackStyle.Light); router.push({ pathname: "/past-ride", params: { rideId: ride.id } }); }}
                  accessibilityRole="button"
                  accessibilityLabel={`View past ride with ${ride.passengerName}`}
                  style={({ pressed }) => ({
                    ...pastRideCard,
                    borderColor: pressed ? colors.blue : colors.slate100,
                    opacity: pressed ? 0.92 : 1,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
                >
                  <View style={pastDateRail}>
                    <Text style={pastDateText}>{ride.scheduledDate}</Text>
                    <Text style={pastTimeText}>{ride.scheduledTime}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 8, minWidth: 0 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: spacing.sm,
                      }}
                    >
                      <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                        <Text selectable style={pastRideName} numberOfLines={1}>
                          {ride.passengerName}
                        </Text>
                        <Text style={microLabel} numberOfLines={1}>
                          {ride.transitType} {ride.tripType}
                        </Text>
                      </View>
                      <StatusBadge status={ride.status === "cancelled" ? "cancelled" : "completed"} />
                    </View>
                    <View style={{ gap: 5 }}>
                      <View style={rowCenter}>
                        <View style={routeDotBlue} />
                        <Text style={pastRouteText} numberOfLines={1}>{ride.pickupAddress}</Text>
                      </View>
                      <View style={rowCenter}>
                        <View style={routeDotGreen} />
                        <Text style={pastRouteText} numberOfLines={1}>{ride.dropoffAddress}</Text>
                      </View>
                    </View>
                  </View>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: radii.pill,
                      backgroundColor: colors.surfaceLow,
                      flexDirection: "row",
                      justifyContent: "center",
                      alignItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Text style={{ color: colors.slate400, fontSize: 15, fontWeight: "900" }}>›</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </AccordionSection>
          </FadeInBlock>

          <FadeInBlock delay={280}>
          <AccordionSection
            title="Ride Requests"
            active={activeTab === "requests"}
            badge={pendingRides.length > 0 ? String(pendingRides.length) : undefined}
            onLayout={handleSectionLayout("requests")}
            onPress={() => toggleSection("requests")}
          >
            {pendingRides.length > 0 ? (
              <View style={{ gap: spacing.sm }}>
                {pendingRides.map((ride) => (
                  <View
                    key={ride.id}
                    style={requestCard}
                  >
                    <View
                      style={requestTopBar}
                    />
                    <View style={{ flexDirection: "row", gap: 12, alignItems: "stretch" }}>
                      <Pressable
                        onPress={() => {
                          impact(ImpactFeedbackStyle.Light);
                          router.push({ pathname: "/ride-details", params: { rideId: ride.id } });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`View details for ride ${ride.id}`}
                        style={({ pressed }) => ({
                          flex: 1,
                          minWidth: 0,
                          gap: 7,
                          opacity: pressed ? 0.72 : 1,
                        })}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text selectable style={requestDateBadge}>
                            {ride.scheduledDate}
                          </Text>
                          <Text selectable style={requestTimeBadge}>
                            {ride.scheduledTime}
                          </Text>
                          <View
                            style={requestIdBadge}
                          >
                            <Text selectable style={requestIdText}>
                              {ride.id}
                            </Text>
                          </View>
                        </View>
                        <View style={{ gap: 2 }}>
                          <Text selectable style={requestCompactTitle} numberOfLines={1}>
                            {ride.passengerName}
                          </Text>
                          <Text selectable style={requestCompactMeta} numberOfLines={1}>
                            {ride.transitType} {ride.tripType}
                          </Text>
                        </View>
                        <View style={{ gap: 3 }}>
                          <View style={requestRouteRow}>
                            <View style={routeDotBlue} />
                            <Text selectable style={routeAddressText} numberOfLines={1}>{ride.pickupAddress}</Text>
                          </View>
                          <View style={requestRouteRow}>
                            <View style={routeDotGreen} />
                            <Text selectable style={routeAddressText} numberOfLines={1}>{ride.dropoffAddress}</Text>
                          </View>
                        </View>
                        {ride.notes ? (
                          <Text selectable numberOfLines={1} style={requestNotesText}>
                            {ride.notes}
                          </Text>
                        ) : null}
                      </Pressable>
                      <View style={requestActions}>
                        <Pressable
                          onPress={() => { notification(NotificationFeedbackType.Success); acceptRide(ride.id); }}
                          accessibilityRole="button"
                          accessibilityLabel={`Accept ride ${ride.id}`}
                          style={({ pressed }) => [requestAcceptButton, pressed ? { opacity: 0.82 } : null]}
                        >
                          <Text style={requestAcceptText}>Accept</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => { notification(NotificationFeedbackType.Warning); declineRide(ride.id); }}
                          accessibilityRole="button"
                          accessibilityLabel={`Decline ride ${ride.id}`}
                          style={({ pressed }) => [requestDeclineButton, pressed ? { opacity: 0.72 } : null]}
                        >
                          <Text style={requestDeclineText}>Decline</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radii.md,
                  borderCurve: "continuous",
                  paddingVertical: 40,
                  paddingHorizontal: spacing.xl,
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radii.md,
                    backgroundColor: colors.surfaceLow,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 4,
                  }}
                >
                  <Text style={{ color: colors.slate300, fontSize: 20 }}>✓</Text>
                </View>
                <Text style={emptyStateHeading}>
                  All clear
                </Text>
                <Text style={emptyStateText}>
                  No pending ride requests
                </Text>
              </View>
            )}
          </AccordionSection>
          </FadeInBlock>
        </View>
      </ScrollView>

      <OperatorSheet bottomInset={insets.bottom} />

      <SheetModal
        visible={riderProfileOpen && !!activeRide}
        onClose={() => setRiderProfileOpen(false)}
        snapPoints={["56%", "90%"]}
      >
        <View style={{ alignItems: "center", gap: 18, paddingBottom: spacing.lg }}>
          <Avatar initials={activeRide?.passengerName.split(" ").map(n => n[0]).join("") ?? ""} size={96} />
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text selectable style={modalTitle}>
              {activeRide?.passengerName}
            </Text>
            <Text style={microLabel}>
              Rider Profile & Protocols
            </Text>
          </View>
        </View>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          {activeRide?.notes ? (
            <View style={alertCardStyle}>
              <Text style={alertTitle}>
                Critical Care Notes
              </Text>
              <Text selectable style={alertBody}>
                {activeRide.notes}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 14 }}>
            <InfoTile label="Transit Type" value={activeRide?.transitType ?? ""} />
            <InfoTile label="Trip Type" value={activeRide?.tripType ?? ""} />
          </View>

          {activeRide?.emergencyContact ? (
            <View style={{ gap: 10 }}>
              <Text style={microLabel}>
                Emergency Contact
              </Text>
              <View style={infoRowCard}>
                <Text selectable style={infoRowValue}>
                  {activeRide.emergencyContact}
                </Text>
                <View style={callPill}>
                  <Text style={{ color: colors.surface, fontWeight: "800" }}>Call</Text>
                </View>
              </View>
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            <Text style={microLabel}>
              Protocol Compliance
            </Text>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {protocolBars.map((_, index) => (
                <View
                  key={index}
                  style={{
                    flex: 1,
                    height: 5,
                    borderRadius: radii.pill,
                    backgroundColor: colors.blue,
                  }}
                />
              ))}
            </View>
            <Text style={protocolCaption}>
              Perfect safety record last 20 trips
            </Text>
          </View>
        </ScrollView>
        <Pressable onPress={() => { impact(ImpactFeedbackStyle.Light); setRiderProfileOpen(false); }} accessibilityRole="button" accessibilityLabel="Return to mission">
          <GradientCard padding={18}>
            <Text style={primaryActionText}>Return to Mission</Text>
          </GradientCard>
        </Pressable>
      </SheetModal>

    </PageTransition>
  );
}

function AccordionSection({
  title,
  active,
  badge,
  onLayout,
  onPress,
  children,
}: {
  title: string;
  active: boolean;
  badge?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <View onLayout={onLayout} style={{ marginBottom: 4 }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title} section, ${active ? "expanded" : "collapsed"}`}
        accessibilityState={{ expanded: active }}
        style={{
          backgroundColor: active ? colors.surface : colors.surfaceHigh,
          paddingHorizontal: spacing.md,
          paddingVertical: 14,
          borderTopLeftRadius: radii.md,
          borderTopRightRadius: radii.md,
          borderBottomLeftRadius: active ? 0 : radii.md,
          borderBottomRightRadius: active ? 0 : radii.md,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text selectable style={[sectionTitle, !active && { opacity: 0.5 }]}>
            {title}
          </Text>
          {badge ? (
            <View
              style={{
                backgroundColor: colors.blue,
                borderRadius: radii.xs,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Text style={{ color: colors.surface, fontSize: 13, fontWeight: "900" }}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: colors.primary, fontSize: 18 }}>
          {active ? "▾" : "▸"}
        </Text>
      </Pressable>
      {active ? (
        <View
          style={{
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
            borderBottomLeftRadius: radii.md,
            borderBottomRightRadius: radii.md,
            borderCurve: "continuous",
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}


function SheetModal({
  visible,
  onClose,
  snapPoints,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  snapPoints: Array<string | number>;
  children: React.ReactNode;
}) {
  if (Platform.OS === "web") {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <Pressable
          onPress={onClose}
          style={{
            flex: 1,
            backgroundColor: colors.scrim,
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              height: typeof snapPoints[0] === "number" ? snapPoints[0] : (snapPoints[0] ?? "56%") as `${number}%`,
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.lg,
              borderTopRightRadius: radii.lg,
              ...shadows.soft,
            }}
          >
            <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}>
              <View style={{ width: 44, height: 5, borderRadius: radii.pill, backgroundColor: colors.slate300 }} />
            </View>
            <View
              style={{
                flex: 1,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.md,
                paddingBottom: spacing.lg,
              }}
            >
              {children}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  const modalRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
      return;
    }

    modalRef.current?.dismiss();
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.32}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{
        width: 44,
        height: 5,
        borderRadius: radii.pill,
        backgroundColor: colors.slate300,
      }}
      backgroundStyle={{
        backgroundColor: colors.surface,
        borderTopLeftRadius: radii.lg,
        borderTopRightRadius: radii.lg,
      }}
      style={shadows.soft}
    >
      <BottomSheetView
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.lg,
          flex: 1,
        }}
      >
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

function OperatorSheet({ bottomInset }: { bottomInset: number }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const { impact, notification, selection } = useHaptics();
  // Wired to the real LocationProvider so this button stays in lockstep with
  // the Settings toggle — flipping one affects the other.
  const { isTracking, startTracking, stopTracking } = useLocation();
  const flipProgress = useSharedValue(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const { height: screenHeight } = Dimensions.get("window");
  const operatorDisplayName = session?.name ?? "Driver";
  const operatorBackendId = session ? String(session.id) : "Pending";
  const operatorInitials = getInitials(operatorDisplayName);
  const pendingProfileFields = useMemo(
    () => [
      { label: "Operator credential ID", value: "Needs API", icon: "!" },
      { label: "Certifications", value: "Needs API", icon: "+" },
      { label: "Certified since", value: "Needs API", icon: "+" },
      { label: "QR verification", value: "Needs API", icon: "+" },
    ],
    [],
  );

  const collapsedHeight = 88 + bottomInset;
  // Keep the expanded drawer under the custom brand header. The route content
  // area and native safe-area math differ slightly on iOS, so this guard gives
  // the header a stable visual lane while still letting the drawer feel tall.
  const expandedHeight = screenHeight - insets.top - 64;
  const sheetY = useSharedValue(0); // 0 = collapsed, 1 = expanded

  const open = useCallback(() => {
    sheetY.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) });
  }, []);

  const close = useCallback(() => {
    sheetY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
  }, []);

  // Snapshot the sheet position when the drag starts so subsequent translations
  // map 1:1 against finger movement instead of compounding each frame.
  const dragStart = useSharedValue(0);

  const panGestureSheet = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .failOffsetX([-20, 20])
    .onBegin(() => {
      dragStart.value = sheetY.value;
    })
    .onUpdate((e) => {
      // Dragging up from collapsed (negative translationY) or down from expanded.
      // One range of pixels == one full open/close sweep (no damping).
      const range = expandedHeight - collapsedHeight;
      const delta = -e.translationY / range;
      sheetY.value = Math.max(0, Math.min(1, dragStart.value + delta));
    })
    .onEnd((e) => {
      const vy = -e.velocityY;
      if (sheetY.value > 0.5 || vy > 500) {
        sheetY.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) });
      } else if (sheetY.value < 0.5 || vy < -500) {
        sheetY.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.quad) });
      }
    });

  // Single tap on the HANDLE area toggles the sheet. We deliberately do NOT
  // attach this to the whole sheet — otherwise tapping interior controls
  // (Location toggle, Emergency, etc.) would also collapse the drawer.
  const tapGestureHandle = Gesture.Tap().onEnd(() => {
    runOnJS(impact)(ImpactFeedbackStyle.Light);
    if (sheetY.value > 0.5) {
      runOnJS(close)();
    } else {
      runOnJS(open)();
    }
  });

  const sheetAnimatedStyle = useAnimatedStyle(() => {
    const height = collapsedHeight + (expandedHeight - collapsedHeight) * sheetY.value;
    return { height };
  });

  const flipCard = useCallback(() => {
    flipProgress.value = withTiming(cardFlipped ? 0 : 1, { duration: 400, easing: Easing.out(Easing.quad) });
    setCardFlipped(!cardFlipped);
  }, [cardFlipped]);

  const cardPan = Gesture.Pan().activeOffsetX([-15, 15]).failOffsetY([-10, 10])
    .onUpdate((e) => { flipProgress.value = Math.max(0, Math.min(1, cardFlipped ? 1 - Math.abs(e.translationX) / 200 : Math.abs(e.translationX) / 200)); })
    .onEnd((e) => { const flip = Math.abs(e.translationX) > 60; flipProgress.value = withTiming(flip ? (cardFlipped ? 0 : 1) : (cardFlipped ? 1 : 0), { duration: 250 }); if (flip) runOnJS(setCardFlipped)(!cardFlipped); });
  const cardTap = Gesture.Tap().onEnd(() => { runOnJS(flipCard)(); });
  const cardGesture = Gesture.Exclusive(cardPan, cardTap);

  const frontStyle = useAnimatedStyle(() => ({ transform: [{ perspective: 1000 }, { rotateY: `${interpolate(flipProgress.value, [0, 1], [0, 180])}deg` }], backfaceVisibility: "hidden" as const }));
  const backStyle = useAnimatedStyle(() => ({ transform: [{ perspective: 1000 }, { rotateY: `${interpolate(flipProgress.value, [0, 1], [180, 360])}deg` }], backfaceVisibility: "hidden" as const, position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 }));

  const cardHeight = Math.min(screenHeight - insets.top - 300, 420);

  const contentOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(sheetY.value, [0, 0.3, 1], [0, 0, 1]),
  }));

  // Slide-up entrance for the sheet itself — independent of page fade so the
  // drawer always feels like it arrives from below, not from the side.
  const sheetIsFocused = useIsFocused();
  const entranceY = useSharedValue(140);

  useEffect(() => {
    entranceY.value = withTiming(sheetIsFocused ? 0 : 140, {
      duration: sheetIsFocused ? 420 : 280,
      easing: sheetIsFocused
        ? Easing.bezier(0.25, 1, 0.5, 1) // ease-out-quart
        : Easing.bezier(0.4, 0, 1, 1), // ease-in
    });
  }, [sheetIsFocused, entranceY]);

  const entranceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: entranceY.value }],
  }));

  return (
    <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 20, elevation: 20 }}>
      <GestureDetector gesture={panGestureSheet}>
        <Animated.View style={[{ backgroundColor: colors.primary, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, paddingBottom: bottomInset }, sheetAnimatedStyle, entranceStyle]}>
          {/* Handle + header are the ONLY tap-to-toggle zone so interior
              controls (Location toggle, Emergency) don't accidentally close
              the drawer when tapped. */}
          <GestureDetector gesture={tapGestureHandle}>
            <View style={Platform.OS === "web" ? ({ cursor: "pointer" } as any) : undefined}>
              {/* Handle */}
              <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
                <View style={{ width: 40, height: 5, borderRadius: radii.pill, backgroundColor: colors.primarySoft }} />
              </View>
              {/* Header */}
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: radii.sm, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: colors.slate300, fontSize: 18 }}>⛊</Text>
                  </View>
                  <View>
                    <Text style={operatorName}>{operatorDisplayName}</Text>
                    <Text style={{ color: colors.slate400, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 }}>Backend ID #{operatorBackendId}</Text>
                  </View>
                </View>
              </View>
            </View>
          </GestureDetector>
          {/* Expandable content */}
          <Animated.View style={[{ flex: 1, overflow: "hidden" }, contentOpacity]}>
            <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              <View style={{ height: 1, backgroundColor: colors.primarySoft }} />
              <GestureDetector gesture={cardGesture}>
              <View style={{ height: cardHeight }}>
                <Animated.View style={[{ backgroundColor: colors.surface, borderRadius: 12, borderCurve: "continuous", overflow: "hidden", height: cardHeight }, frontStyle]}>
                  <View style={{ padding: 20, gap: 18, flex: 1 }}>
                    <View style={{ flexDirection: "row", gap: 16 }}>
                      <View style={{ width: 80, height: 96, borderRadius: radii.sm, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: colors.surface, fontSize: 28, fontWeight: "900" }}>{operatorInitials}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 4, justifyContent: "center" }}>
                        <Text style={{ color: colors.primary, fontSize: 24, fontWeight: "900" }}>{operatorDisplayName}</Text>
                        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                          <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "700" }}>Backend ID: {operatorBackendId}</Text>
                          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.slate300 }} />
                          <Text style={{ color: colors.green, fontSize: 13, fontWeight: "800", textTransform: "uppercase" }}>Active</Text>
                        </View>
                        <Text style={{ color: colors.slate400, fontSize: 13, fontWeight: "600" }}>Profile fields pending backend</Text>
                      </View>
                    </View>
                    <View style={{ height: 1, backgroundColor: colors.slate100 }} />
                    <View style={{ gap: 10 }}>
                      <Text style={{ color: colors.slate400, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.5 }}>Certifications</Text>
                      {pendingProfileFields.map((field) => (
                        <View key={field.label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View style={{ width: 20, height: 20, borderRadius: radii.xs, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" }}>
                              <Text style={{ color: colors.green, fontSize: 8, fontWeight: "900" }}>{field.icon}</Text>
                            </View>
                            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>{field.label}</Text>
                          </View>
                          <Text style={{ color: colors.slate400, fontSize: 13, fontWeight: "500" }}>{field.value}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={{ flex: 1 }} />
                    <View style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={{ color: colors.slate400, fontSize: 13, fontWeight: "700" }}>QR verification pending backend</Text>
                      <Text style={{ color: colors.slate300, fontSize: 12 }}>↻</Text>
                    </View>
                  </View>
                </Animated.View>
                <Animated.View style={[{ backgroundColor: colors.surface, borderRadius: 12, borderCurve: "continuous", overflow: "hidden", height: cardHeight }, backStyle]}>
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 24 }}>
                    <View style={{ width: 180, height: 180, backgroundColor: colors.surfaceLow, borderRadius: radii.md, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.slate100, gap: 8 }}>
                      <Text style={{ color: colors.primary, fontSize: 34, fontWeight: "900", letterSpacing: -1 }}>QR</Text>
                      <Text style={{ color: colors.slate400, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.4 }}>Pending backend</Text>
                    </View>
                    <View style={{ alignItems: "center", gap: 6 }}>
                      <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "900" }}>{operatorDisplayName}</Text>
                      <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "700" }}>Backend ID: {operatorBackendId}</Text>
                      <Text style={{ color: colors.slate400, fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 18, paddingHorizontal: 20 }}>Backend needs to provide a QR verification payload</Text>
                    </View>
                  </View>
                </Animated.View>
              </View>
              </GestureDetector>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => {
                    selection();
                    if (isTracking) stopTracking();
                    else startTracking();
                  }}
                  accessibilityRole="button"
                  style={{ flex: 1, borderRadius: radii.md, backgroundColor: isTracking ? colors.greenSoftDark : colors.errorSoftDark, paddingVertical: 14, alignItems: "center" }}
                >
                  <Text style={{ color: isTracking ? colors.greenLight : colors.errorLight, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>
                    {isTracking ? "Location On" : "Location Off"}
                  </Text>
                </Pressable>
                <Pressable onPress={() => { close(); setTimeout(() => router.push("/settings"), 350); }} accessibilityRole="button" style={{ flex: 1, borderRadius: radii.md, backgroundColor: colors.primarySoft, paddingVertical: 14, alignItems: "center" }}>
                  <Text style={{ color: colors.slate300, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>Settings</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => {
                  runOnJS(notification)(NotificationFeedbackType.Warning);
                  setEmergencyOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Open emergency options"
                style={{ borderRadius: radii.md, backgroundColor: colors.errorSoftStrong, paddingVertical: 16, alignItems: "center" }}
              >
                <Text style={{ color: colors.errorLight, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.5 }}>Emergency</Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <EmergencyModal
        visible={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
        description="Pick a line. We'll dial immediately."
        options={[
          { kicker: "Emergency services", title: "Call 9-1-1", number: "911", variant: "danger" },
          {
            kicker: "Dispatch",
            title: "TrustedRiders",
            number: DISPATCH_PHONE,
            hint: formatPhone(DISPATCH_PHONE),
            variant: "primary",
          },
        ]}
      />
    </View>
  );
}

function LiveTrackingBadge() {
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <View
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        zIndex: 10,
      }}
    >
      <Animated.View
        style={[
          {
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: "#22C55E",
          },
          dotStyle,
        ]}
      />
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" }}>
        Live Tracking
      </Text>
    </View>
  );
}

function getRideBadgeStatus(status: string): StatusKey {
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

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "TR";
}

function MiniMap() {
  const { isTracking } = useLocation();
  const { activeRide } = useDispatch();
  const mapRef = useRef<MapView | null>(null);

  const pickup = activeRide?.pickupCoords ?? null;
  const dropoff = activeRide?.dropoffCoords ?? null;
  const directions = useDirections(pickup, dropoff);

  const routeCoords =
    activeRide?.routeCoords && activeRide.routeCoords.length > 1
      ? activeRide.routeCoords
      : directions.routeCoords && directions.routeCoords.length > 1
      ? directions.routeCoords
      : [pickup, dropoff].filter((coord): coord is NonNullable<typeof coord> => !!coord);

  const center = routeCoords.length > 0
    ? {
        latitude: routeCoords.reduce((sum, coord) => sum + coord.latitude, 0) / routeCoords.length,
        longitude: routeCoords.reduce((sum, coord) => sum + coord.longitude, 0) / routeCoords.length,
      }
    : null;

  useEffect(() => {
    if (routeCoords.length < 2) return;
    mapRef.current?.fitToCoordinates(routeCoords, {
      edgePadding: { top: 36, right: 36, bottom: 36, left: 36 },
      animated: false,
    });
  }, [routeCoords]);

  if (!center) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.mapPlaceholder }}>
        <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
          Map unavailable
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {isTracking && <LiveTrackingBadge />}
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={{
          ...center,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        pointerEvents="none"
        showsMyLocationButton={false}
      >
        {pickup ? (
          <Marker
            coordinate={pickup}
            title="Pickup"
            pinColor={colors.blue}
          />
        ) : null}
        {dropoff ? (
          <Marker
            coordinate={dropoff}
            title="Drop-off"
            pinColor={colors.green}
          />
        ) : null}
        {routeCoords.length > 1 ? (
          <Polyline
            coordinates={routeCoords}
            strokeColor={colors.blue}
            strokeWidth={3}
          />
        ) : null}
      </MapView>
    </View>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
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
      <Text style={microLabel}>
        {label}
      </Text>
      <Text selectable style={infoTileValue}>
        {value}
      </Text>
    </View>
  );
}


const eyebrow = {
  color: colors.slate400,
  fontSize: 12,
  fontWeight: "700" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 2,
};

const primaryActionText = {
  color: colors.surface,
  fontSize: 14,
  fontWeight: "800" as const,
  textAlign: "center" as const,
  letterSpacing: 1.5,
  textTransform: "uppercase" as const,
};

const sectionTitle = {
  color: colors.primary,
  fontSize: 16,
  fontWeight: "700" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 0.5,
};

const timeBadge = {
  color: colors.blue,
  fontSize: 14,
  fontWeight: "700" as const,
  backgroundColor: colors.blueSoft,
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: radii.xs,
  overflow: "hidden" as const,
};

const microLabel = {
  color: colors.slate400,
  fontSize: 12,
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};

const cardTitle = {
  color: colors.primary,
  fontSize: 24,
  fontWeight: "900" as const,
};

const cardMeta = {
  color: colors.slate500,
  fontSize: 14,
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
};

const currentMapHero = {
  height: 300,
  backgroundColor: colors.mapPlaceholder,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  overflow: "hidden" as const,
};

const currentMapTopBar = {
  position: "absolute" as const,
  top: spacing.sm,
  left: spacing.sm,
  right: spacing.sm,
  flexDirection: "row" as const,
  justifyContent: "flex-end" as const,
  alignItems: "center" as const,
};

const currentMapStatusPill = {
  backgroundColor: colors.surfaceFrosted,
  borderRadius: radii.pill,
  paddingHorizontal: spacing.sm,
  paddingVertical: 7,
};

const currentMapStatusText = {
  color: colors.primary,
  fontSize: 11,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.4,
};

const currentMapRiderCard = {
  position: "absolute" as const,
  left: spacing.sm,
  right: spacing.sm,
  bottom: spacing.sm,
  backgroundColor: colors.surfaceFrosted,
  borderRadius: radii.sm,
  padding: spacing.sm,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: spacing.sm,
};

const compactOverlayLabel = {
  color: colors.slate500,
  fontSize: 11,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.1,
};

const currentMapRiderName = {
  color: colors.primary,
  fontSize: 20,
  fontWeight: "900" as const,
  lineHeight: 24,
};

const currentMapRiderMeta = {
  color: colors.slate500,
  fontSize: 12,
  fontWeight: "800" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 0.8,
};

const currentMapTimeCard = {
  width: 122,
  backgroundColor: colors.primary,
  borderRadius: radii.sm,
  paddingHorizontal: 8,
  paddingVertical: 8,
  alignItems: "flex-end" as const,
};

const currentMapTimeLabel = {
  color: colors.surfaceScrim80,
  fontSize: 10,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};

const currentMapTime = {
  color: colors.accent,
  fontSize: 20,
  fontWeight: "900" as const,
  lineHeight: 24,
};

const currentMapDate = {
  color: colors.surface,
  fontSize: 11,
  fontWeight: "800" as const,
};

const currentRouteOverlayCard = {
  backgroundColor: colors.surfaceLowest,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  gap: 8,
};

const currentRouteRow = {
  flexDirection: "row" as const,
  alignItems: "flex-start" as const,
  gap: spacing.sm,
};

const currentRouteAddress = {
  color: colors.primary,
  fontSize: 14,
  fontWeight: "800" as const,
  lineHeight: 18,
};

const currentRideHero = {
  backgroundColor: colors.surfaceLowest,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  padding: spacing.md,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 14,
};

const currentRideDetailCard = {
  backgroundColor: colors.surfaceLowest,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  padding: spacing.md,
  gap: spacing.sm,
};

const currentRideBodyText = {
  color: colors.primary,
  fontSize: 15,
  fontWeight: "600" as const,
  lineHeight: 20,
};

const pastRideName = {
  color: colors.primary,
  fontSize: 19,
  fontWeight: "900" as const,
};

const pastSummaryCard = {
  backgroundColor: colors.surfaceLow,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
};

const pastSummaryValue = {
  color: colors.primary,
  fontSize: 16,
  fontWeight: "900" as const,
};

const pastLatestPill = {
  backgroundColor: colors.surface,
  borderRadius: radii.pill,
  paddingHorizontal: spacing.sm,
  paddingVertical: 6,
};

const pastLatestText = {
  color: colors.slate500,
  fontSize: 12,
  fontWeight: "800" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};

const pastRideCard = {
  backgroundColor: colors.surface,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  borderWidth: 1,
  padding: spacing.md,
  flexDirection: "row" as const,
  gap: spacing.sm,
  alignItems: "center" as const,
  ...shadows.soft,
};

const pastDateRail = {
  width: 72,
  minHeight: 74,
  borderRadius: radii.sm,
  backgroundColor: colors.surfaceLow,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 4,
  gap: 4,
};

const pastDateText = {
  color: colors.primary,
  fontSize: 13,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 0.4,
  textAlign: "center" as const,
};

const pastTimeText = {
  color: colors.slate400,
  fontSize: 11,
  fontWeight: "800" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 0.2,
  textAlign: "center" as const,
};

const pastRouteText = {
  color: colors.slate500,
  fontSize: 13,
  fontWeight: "600" as const,
  flex: 1,
};

const emptyStateHeading = {
  color: colors.primary,
  fontSize: 17,
  fontWeight: "700" as const,
};

const emptyStateText = {
  color: colors.slate400,
  fontSize: 14,
  fontWeight: "500" as const,
  textAlign: "center" as const,
};

const operatorName = {
  color: colors.surface,
  fontSize: 18,
  fontWeight: "800" as const,
};

const modalTitle = {
  color: colors.primary,
  fontSize: 32,
  fontWeight: "900" as const,
  textAlign: "center" as const,
};

const alertCardStyle = {
  backgroundColor: colors.errorSoft,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  padding: spacing.lg,
  gap: 10,
};

const alertTitle = {
  color: colors.error,
  fontSize: 12,
  fontWeight: "700" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.3,
};

const alertBody = {
  color: colors.primary,
  fontSize: 16,
  fontWeight: "600" as const,
  lineHeight: 24,
};

const infoRowCard = {
  backgroundColor: colors.surfaceLowest,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  padding: spacing.md,
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
};

const infoRowValue = {
  color: colors.primary,
  fontSize: 17,
  fontWeight: "700" as const,
};

const callPill = {
  backgroundColor: colors.primary,
  borderRadius: radii.xs,
  paddingHorizontal: 12,
  paddingVertical: 10,
};

const protocolCaption = {
  color: colors.slate500,
  fontSize: 12,
  fontWeight: "700" as const,
  textTransform: "uppercase" as const,
};

// ── Extracted from loops (M4 perf) ──────────────────────────

const rowCenter = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 8,
};

const routeDotBlue = {
  width: 7,
  height: 7,
  borderRadius: radii.pill,
  backgroundColor: colors.blue,
};

const routeDotGreen = {
  width: 7,
  height: 7,
  borderRadius: radii.pill,
  backgroundColor: colors.green,
};

const routeAddressText = {
  color: colors.slate500,
  fontSize: 14,
  fontWeight: "600" as const,
};

const requestCard = {
  backgroundColor: colors.surface,
  borderRadius: radii.md,
  paddingHorizontal: spacing.md,
  paddingVertical: 14,
  overflow: "hidden" as const,
  borderCurve: "continuous" as const,
  ...shadows.soft,
};

const requestTopBar = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  height: 4,
  backgroundColor: colors.primary,
};

const requestTimeBadge = {
  color: colors.blue,
  fontSize: 12,
  fontWeight: "700" as const,
  backgroundColor: colors.blueSoft,
  paddingHorizontal: 7,
  paddingVertical: 3,
  borderRadius: radii.xs,
  overflow: "hidden" as const,
};

const requestDateBadge = {
  color: colors.primary,
  fontSize: 12,
  fontWeight: "800" as const,
  backgroundColor: colors.surfaceLow,
  paddingHorizontal: 7,
  paddingVertical: 3,
  borderRadius: radii.xs,
  overflow: "hidden" as const,
};

const requestIdBadge = {
  alignSelf: "flex-start" as const,
  backgroundColor: colors.primary,
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: radii.xs,
};

const requestIdText = {
  color: colors.accent,
  fontSize: 11,
  fontWeight: "600" as const,
  letterSpacing: 1,
};

const requestCompactTitle = {
  color: colors.primary,
  fontSize: 17,
  fontWeight: "900" as const,
  letterSpacing: -0.2,
};

const requestCompactMeta = {
  color: colors.slate400,
  fontSize: 12,
  fontWeight: "700" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 0.8,
};

const requestRouteRow = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 7,
  minWidth: 0,
};

const requestNotesText = {
  color: colors.slate400,
  fontSize: 12,
  fontWeight: "500" as const,
  fontStyle: "italic" as const,
};

const requestActions = {
  width: 82,
  gap: 7,
  justifyContent: "center" as const,
  flexShrink: 0,
};

const requestAcceptButton = {
  minHeight: 36,
  borderRadius: radii.xs,
  backgroundColor: colors.primary,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 8,
};

const requestDeclineButton = {
  minHeight: 34,
  borderRadius: radii.xs,
  backgroundColor: colors.errorSoft,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 8,
};

const requestAcceptText = {
  color: colors.surface,
  fontSize: 11,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};

const requestDeclineText = {
  color: colors.error,
  fontSize: 11,
  fontWeight: "800" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 0.8,
};

const dispatcherHint = {
  color: colors.slate400,
  fontSize: 13,
  fontWeight: "600" as const,
};

const infoTileValue = {
  color: colors.primary,
  fontSize: 18,
  fontWeight: "800" as const,
};
