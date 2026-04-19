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
  TextStyle,
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
import { useHeaderHeight } from "@react-navigation/elements";
import { useIsFocused } from "@react-navigation/native";

import MapView, { Marker, Polyline } from "@/components/Map";

import { Avatar } from "@/components/ui/Avatar";
import { EmergencyModal } from "@/components/ui/EmergencyModal";
import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import { GradientCard } from "@/components/ui/gradient-card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LocationPermissionBanner } from "@/components/ui/LocationPermissionBanner";
import { useDispatch } from "@/lib/dispatch-context";
import { useHaptics } from "@/lib/haptics-context";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "@/lib/haptics";
import { useLocation } from "@/lib/location-context";
import {
  pastRides,
  routeSteps,
  scheduledRides,
} from "@/lib/mock-data";
import { colors, radii, shadows, spacing } from "@/lib/theme";


type TabKey = "current" | "scheduled" | "past" | "requests";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey | null>("current");
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [riderProfileOpen, setRiderProfileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { pendingRides, scheduledRides: dispatchedScheduled, activeRide, acceptRide, declineRide } = useDispatch();
  const { impact, notification, selection } = useHaptics();

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
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: colors.surfaceLow }}
        contentContainerStyle={{
          paddingBottom: 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setTimeout(() => setRefreshing(false), 1500);
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
              <View style={{ gap: spacing.md }}>
                <Pressable
                  onPress={() => { impact(ImpactFeedbackStyle.Light); setRiderProfileOpen(true); }}
                  accessibilityRole="button"
                  accessibilityLabel={`View rider profile for ${activeRide.passengerName}`}
                  style={({ pressed }) => ({
                    backgroundColor: colors.surfaceLowest,
                    borderRadius: radii.md,
                    borderCurve: "continuous",
                    padding: spacing.md,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    opacity: pressed ? 0.96 : 1,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
                >
                  <Avatar initials={activeRide.passengerName.split(" ").map(n => n[0]).join("")} size={48} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={eyebrow}>
                        Active Mission
                      </Text>
                      <StatusBadge status="enRoute" />
                    </View>
                    <Text selectable style={{ color: colors.primary, fontSize: 24, fontWeight: "900" }}>
                      {activeRide.passengerName}
                    </Text>
                    <Text selectable style={{ color: colors.slate500, fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8 }}>
                      {activeRide.transitType} {activeRide.tripType}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <Text selectable style={{ color: colors.slate400, fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 }}>TIME</Text>
                    <Text selectable style={{ color: colors.primary, fontSize: 24, fontWeight: "900" }}>{activeRide.scheduledTime}</Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => { impact(ImpactFeedbackStyle.Light); router.push("/mission"); }}
                  accessibilityRole="button"
                  accessibilityLabel="Open live mission map"
                  style={({ pressed }) => ({
                    height: 140,
                    backgroundColor: colors.mapPlaceholder,
                    borderRadius: radii.md,
                    overflow: "hidden",
                    borderCurve: "continuous",
                    transform: [{ scale: pressed ? 0.995 : 1 }],
                  })}
                >
                  <MiniMap />
                  <View style={{ position: "absolute", left: 12, bottom: 12, flexDirection: "row", gap: 8 }}>
                    <View style={{ backgroundColor: colors.surfaceFrosted, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.xs, flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 7, height: 7, borderRadius: radii.pill, backgroundColor: colors.blue }} />
                      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>{activeRide.pickupAddress}</Text>
                    </View>
                    <View style={{ backgroundColor: colors.surfaceFrosted, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.xs, flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 7, height: 7, borderRadius: radii.pill, backgroundColor: colors.green }} />
                      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>{activeRide.dropoffAddress}</Text>
                    </View>
                  </View>
                  <View style={{ position: "absolute", right: 12, top: 12, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.xs }}>
                    <Text style={{ color: colors.surface, fontSize: 13, fontWeight: "800", letterSpacing: 0.8 }}>Live GPS</Text>
                  </View>
                </Pressable>

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
            badge={dispatchedScheduled.length > 0 ? String(dispatchedScheduled.length + scheduledRides.length) : undefined}
            onLayout={handleSectionLayout("scheduled")}
            onPress={() => toggleSection("scheduled")}
          >
            <View style={{ gap: spacing.md }}>
              {dispatchedScheduled.length === 0 && scheduledRides.length === 0 ? (
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
              {dispatchedScheduled.map((ride) => (
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
              {scheduledRides.map((ride) => (
                <Pressable
                  key={ride.id}
                  onPress={() => { impact(ImpactFeedbackStyle.Light); router.push({ pathname: "/ride-details", params: { rideId: ride.id } }); }}
                  style={({ pressed }) => ({
                    backgroundColor: colors.surface,
                    borderRadius: radii.md,
                    borderCurve: "continuous",
                    padding: 20,
                    flexDirection: "row",
                    gap: 16,
                    opacity: pressed ? 0.92 : 1,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                    ...shadows.soft,
                  })}
                >
                  <View style={{ flex: 1, gap: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text selectable style={timeBadge}>
                        {ride.time}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <StatusBadge status="scheduled" />
                        <Text selectable style={microLabel}>
                          {ride.id}
                        </Text>
                      </View>
                    </View>
                    <Text selectable style={cardTitle}>
                      {ride.name}
                    </Text>
                    <Text selectable style={cardMeta}>
                      {ride.type} — {ride.vehicle}
                    </Text>
                  </View>
                    <View
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: radii.md,
                        overflow: "hidden",
                        borderCurve: "continuous",
                        backgroundColor: colors.mapPlaceholder,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                  >
                    <View style={{ gap: 6, alignItems: "center" }}>
                      <View style={{ width: 8, height: 8, borderRadius: radii.pill, backgroundColor: colors.blue, opacity: 0.6 }} />
                      <View style={{ width: 1, height: 20, backgroundColor: colors.slate300 }} />
                      <View style={{ width: 8, height: 8, borderRadius: radii.pill, backgroundColor: colors.green, opacity: 0.6 }} />
                    </View>
                  </View>
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
            <View style={{ gap: 4 }}>
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
              {pastRides.map((ride, index) => (
                <Pressable
                  key={ride.name}
                  onPress={() => { impact(ImpactFeedbackStyle.Light); router.push({ pathname: "/past-ride", params: { riderName: ride.name } }); }}
                  accessibilityRole="button"
                  accessibilityLabel={`View past ride with ${ride.name}`}
                  style={({ pressed }) => ({
                    backgroundColor: colors.surface,
                    borderRadius: radii.md,
                    borderCurve: "continuous",
                    paddingHorizontal: spacing.lg,
                    paddingVertical: 18,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    opacity: pressed ? 0.92 : 1,
                    transform: [{ scale: pressed ? 0.99 : 1 }],
                  })}
                >
                  <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                    <Text selectable style={pastRideName} numberOfLines={1}>
                      {ride.name}
                    </Text>
                    <Text style={microLabel} numberOfLines={1}>
                      {ride.date} · {ride.type}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <StatusBadge status="completed" />
                    <Text style={{ color: colors.slate300, fontSize: 16 }}>▸</Text>
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
              <View style={{ gap: spacing.md }}>
                {pendingRides.map((ride) => (
                  <View
                    key={ride.id}
                    style={requestCard}
                  >
                    <View
                      style={requestTopBar}
                    />
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <View>
                        <Text selectable style={requestTimeBadge}>
                          {ride.scheduledTime}
                        </Text>
                      </View>
                      <View
                        style={requestIdBadge}
                      >
                        <Text selectable style={requestIdText}>
                          {ride.id}
                        </Text>
                      </View>
                    </View>
                    <View style={{ gap: 4 }}>
                      <Text selectable style={cardTitle}>
                        {ride.passengerName}
                      </Text>
                      <Text selectable style={cardMeta}>
                        {ride.transitType} {ride.tripType}
                      </Text>
                    </View>
                    <View style={{ gap: 6 }}>
                      <View style={rowCenter}>
                        <View style={routeDotBlue} />
                        <Text selectable style={routeAddressText}>{ride.pickupAddress}</Text>
                      </View>
                      <View style={rowCenter}>
                        <View style={routeDotGreen} />
                        <Text selectable style={routeAddressText}>{ride.dropoffAddress}</Text>
                      </View>
                    </View>
                    {ride.notes ? (
                      <Text selectable style={{ color: colors.slate400, fontSize: 12, fontWeight: "500", fontStyle: "italic" }}>
                        {ride.notes}
                      </Text>
                    ) : null}
                    <Pressable onPress={() => { notification(NotificationFeedbackType.Success); acceptRide(ride.id); }} accessibilityRole="button" accessibilityLabel={`Accept ride ${ride.id}`}>
                      <GradientCard padding={18}>
                        <Text style={primaryActionText}>Accept Mission</Text>
                      </GradientCard>
                    </Pressable>
                    <Pressable onPress={() => { notification(NotificationFeedbackType.Warning); declineRide(ride.id); }} accessibilityRole="button" accessibilityLabel={`Decline ride ${ride.id}`} style={{ minHeight: 44, justifyContent: "center" }}>
                      <Text style={declineText}>Decline</Text>
                    </Pressable>
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

      <SheetModal
        visible={directionsOpen}
        onClose={() => setDirectionsOpen(false)}
        snapPoints={["58%", "90%"]}
      >
        <View style={{ gap: 18, paddingBottom: spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text selectable style={modalSectionTitle}>
              Route Protocol
            </Text>
            <Pressable onPress={() => { impact(ImpactFeedbackStyle.Light); setDirectionsOpen(false); }} accessibilityRole="button" accessibilityLabel="Dismiss directions" style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={microLabel}>
                Dismiss
              </Text>
            </Pressable>
          </View>
        </View>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 10, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          {routeSteps.map((step, index) => (
            <View
              key={step.title}
              style={{
                backgroundColor:
                  step.accent === "next" ? colors.surfaceLow : colors.surface,
                borderRadius: radii.md,
                borderCurve: "continuous",
                padding: spacing.lg,
                gap: 14,
              }}
            >
              {index === 0 ? (
                <Text selectable style={nextActionLabel}>
                  Next Action
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: 14 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radii.pill,
                    backgroundColor:
                      index === 0 ? colors.blue : colors.surfaceHigh,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: index === 0 ? colors.surface : colors.primary,
                      fontSize: 18,
                      fontWeight: "800",
                    }}
                  >
                    {index === 0 ? "↑" : index === 1 ? "→" : "↱"}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text selectable style={index === 0 ? routePrimaryTitle : routeSecondaryTitle}>
                    {step.title}
                  </Text>
                  <Text selectable style={routeSubtitle}>
                    {step.subtitle}
                  </Text>
                </View>
              </View>
            </View>
          ))}

          <View style={destinationCard}>
            <View style={destinationPin}>
              <Text style={{ color: colors.green, fontSize: 20 }}>⌖</Text>
            </View>
            <Text selectable style={destinationLabel}>
              Final Destination
            </Text>
            <Text selectable style={destinationTitle}>
              {activeRide?.dropoffAddress ?? "—"}
            </Text>
          </View>
        </ScrollView>
        <Pressable onPress={() => { impact(ImpactFeedbackStyle.Light); setDirectionsOpen(false); }} accessibilityRole="button" accessibilityLabel="Return to map">
          <GradientCard padding={18}>
            <Text style={primaryActionText}>Return to Map</Text>
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
  const contentHeight = useSharedValue(0);
  const measuredHeight = useRef(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      contentHeight.value = active ? measuredHeight.current : 0;
      return;
    }
    contentHeight.value = withTiming(active ? measuredHeight.current : 0, {
      duration: 300,
      easing: Easing.out(Easing.quad),
    });
  }, [active]);

  const animatedContentStyle = useAnimatedStyle(() => ({
    height: contentHeight.value,
    overflow: "hidden" as const,
  }));

  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    const h = event.nativeEvent.layout.height;
    if (h > 0 && h !== measuredHeight.current) {
      measuredHeight.current = h;
      if (active) {
        contentHeight.value = withTiming(h, { duration: 200, easing: Easing.out(Easing.quad) });
      }
    }
  }, [active]);

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
      <Animated.View style={animatedContentStyle}>
        <View
          onLayout={onContentLayout}
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
      </Animated.View>
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
              height: snapPoints[0] ?? "56%",
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
  const headerHeight = useHeaderHeight();
  const router = useRouter();
  const { impact, notification, selection } = useHaptics();
  // Wired to the real LocationProvider so this button stays in lockstep with
  // the Settings toggle — flipping one affects the other.
  const { isTracking, startTracking, stopTracking } = useLocation();
  const flipProgress = useSharedValue(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const { height: screenHeight } = Dimensions.get("window");

  const collapsedHeight = 88 + bottomInset;
  // The sheet is rendered inside the screen content area, which already sits
  // below the navigation header. Subtract the header height so the expanded
  // top edge stops just below the "TrustedRiders" bar instead of being
  // clipped behind it.
  const expandedHeight = screenHeight - insets.top - headerHeight - 12;
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
    <GestureHandlerRootView style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}>
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
                    <Text style={operatorName}>User #Ben123</Text>
                    <Text style={{ color: colors.slate400, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 }}>Operator ID</Text>
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
                        <Text style={{ color: colors.surface, fontSize: 28, fontWeight: "900" }}>BD</Text>
                      </View>
                      <View style={{ flex: 1, gap: 4, justifyContent: "center" }}>
                        <Text style={{ color: colors.primary, fontSize: 24, fontWeight: "900" }}>Ben Driver</Text>
                        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                          <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "700" }}>ID: 099-242</Text>
                          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.slate300 }} />
                          <Text style={{ color: colors.green, fontSize: 13, fontWeight: "800", textTransform: "uppercase" }}>Active</Text>
                        </View>
                        <Text style={{ color: colors.slate400, fontSize: 13, fontWeight: "600" }}>Certified since March 2024</Text>
                      </View>
                    </View>
                    <View style={{ height: 1, backgroundColor: colors.slate100 }} />
                    <View style={{ gap: 10 }}>
                      <Text style={{ color: colors.slate400, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.5 }}>Certifications</Text>
                      {[{ label: "TrustedRiders Certified", date: "Mar 2024", icon: "◆" }, { label: "ADA Compliance", date: "Jun 2024", icon: "◆" }, { label: "Wheelchair Assist", date: "Mar 2024", icon: "◆" }, { label: "First Aid / CPR", date: "Jan 2025", icon: "+" }].map((cert) => (
                        <View key={cert.label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View style={{ width: 20, height: 20, borderRadius: radii.xs, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" }}>
                              <Text style={{ color: colors.green, fontSize: 8, fontWeight: "900" }}>{cert.icon}</Text>
                            </View>
                            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>{cert.label}</Text>
                          </View>
                          <Text style={{ color: colors.slate400, fontSize: 13, fontWeight: "500" }}>{cert.date}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={{ flex: 1 }} />
                    <View style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={{ color: colors.slate400, fontSize: 13, fontWeight: "700" }}>Tap or swipe to show QR</Text>
                      <Text style={{ color: colors.slate300, fontSize: 12 }}>↻</Text>
                    </View>
                  </View>
                </Animated.View>
                <Animated.View style={[{ backgroundColor: colors.surface, borderRadius: 12, borderCurve: "continuous", overflow: "hidden", height: cardHeight }, backStyle]}>
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 24 }}>
                    <View style={{ width: 180, height: 180, backgroundColor: colors.surfaceLow, borderRadius: radii.md, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.slate100 }}>
                      <View style={{ gap: 3, alignItems: "center" }}>
                        {[0,1,2,3,4,5,6].map((row) => (<View key={row} style={{ flexDirection: "row", gap: 3 }}>{[0,1,2,3,4,5,6].map((col) => (<View key={col} style={{ width: 18, height: 18, borderRadius: 2, backgroundColor: (row<3&&col<3)||(row<3&&col>3)||(row>3&&col<3) ? (row+col)%2===0?colors.primary:colors.surface : (row*col+row)%3===0?colors.primary:colors.slate200 }} />))}</View>))}
                      </View>
                    </View>
                    <View style={{ alignItems: "center", gap: 6 }}>
                      <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "900" }}>Ben Driver</Text>
                      <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "700" }}>ID: 099-242</Text>
                      <Text style={{ color: colors.slate400, fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 18, paddingHorizontal: 20 }}>Scan to verify operator identity</Text>
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
        options={[
          { kicker: "Emergency services", title: "Call 9-1-1", number: "911", variant: "danger" },
          {
            kicker: "Dispatch",
            title: "TrustedRiders",
            number: "+15550000911",
            hint: "+1 (555) 000-0911",
            variant: "primary",
          },
        ]}
      />
    </GestureHandlerRootView>
  );
}

function PulsingDot() {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - pulse.value,
    transform: [{ scale: 1 + pulse.value * 2 }],
  }));

  return (
    <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: "rgba(37, 99, 235, 0.3)",
          },
          ringStyle,
        ]}
      />
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: colors.blue,
          borderWidth: 2.5,
          borderColor: "#fff",
          shadowColor: colors.blue,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 6,
          elevation: 6,
        }}
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

function MiniMap() {
  const { location, isTracking } = useLocation();
  const { activeRide } = useDispatch();

  const pickup = activeRide?.pickupCoords ?? { latitude: 37.788, longitude: -122.408 };
  const dropoff = activeRide?.dropoffCoords ?? { latitude: 37.775, longitude: -122.42 };

  const center = location
    ? { latitude: location.latitude, longitude: location.longitude }
    : pickup;

  return (
    <View style={{ flex: 1 }}>
      {isTracking && <LiveTrackingBadge />}
      <MapView
        style={{ flex: 1 }}
        initialRegion={{
          ...center,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        }}
        region={location ? { ...center, latitudeDelta: 0.025, longitudeDelta: 0.025 } : undefined}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        pointerEvents="none"
        showsMyLocationButton={false}
      >
        {location && (
          <Marker
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges
          >
            <PulsingDot />
          </Marker>
        )}
        <Marker
          coordinate={pickup}
          title="Pickup"
          pinColor={colors.blue}
        />
        <Marker
          coordinate={dropoff}
          title="Drop-off"
          pinColor={colors.green}
        />
        <Polyline
          coordinates={[pickup, dropoff]}
          strokeColor={colors.blue}
          strokeWidth={3}
        />
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

const pastRideName = {
  color: colors.primary,
  fontSize: 18,
  fontWeight: "800" as const,
};

const requestMinutes = {
  color: colors.primary,
  fontSize: 48,
  fontWeight: "900" as const,
  fontVariant: ["tabular-nums"] as TextStyle["fontVariant"],
};

const declineText = {
  color: colors.error,
  fontSize: 12,
  fontWeight: "700" as const,
  textAlign: "center" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.5,
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

const modalSectionTitle = {
  color: colors.primary,
  fontSize: 28,
  fontWeight: "900" as const,
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

const nextActionLabel = {
  color: colors.blue,
  fontSize: 12,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.4,
};

const routePrimaryTitle = {
  color: colors.primary,
  fontSize: 24,
  fontWeight: "900" as const,
  lineHeight: 30,
};

const routeSecondaryTitle = {
  color: colors.primary,
  fontSize: 20,
  fontWeight: "800" as const,
  lineHeight: 26,
};

const routeSubtitle = {
  color: colors.slate500,
  fontSize: 16,
  fontWeight: "500" as const,
};

const destinationCard = {
  marginTop: spacing.md,
  backgroundColor: colors.surfaceLow,
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  padding: spacing.xl,
  alignItems: "flex-start" as const,
  gap: 8,
};

const destinationPin = {
  width: 48,
  height: 48,
  borderRadius: radii.xs,
  backgroundColor: colors.greenSoft,
  justifyContent: "center" as const,
  alignItems: "center" as const,
  marginBottom: 8,
};

const destinationLabel = {
  color: colors.primary,
  fontSize: 13,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.5,
};

const destinationTitle = {
  color: colors.primary,
  fontSize: 24,
  fontWeight: "900" as const,
  textAlign: "left" as const,
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
  padding: spacing.lg,
  gap: spacing.md,
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
  fontSize: 14,
  fontWeight: "700" as const,
  backgroundColor: colors.blueSoft,
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: radii.xs,
  overflow: "hidden" as const,
};

const requestIdBadge = {
  alignSelf: "flex-start" as const,
  backgroundColor: colors.primary,
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: radii.xs,
};

const requestIdText = {
  color: colors.accent,
  fontSize: 13,
  fontWeight: "600" as const,
  letterSpacing: 1,
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
