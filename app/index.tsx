import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  LayoutAnimation,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextStyle,
  UIManager,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  interpolate,
  runOnJS,
} from "react-native-reanimated";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import MapView, { Marker, Polyline } from "react-native-maps";

import { GradientCard } from "@/components/ui/gradient-card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  activeMission,
  pastRides,
  routeSteps,
  scheduledRides,
} from "@/lib/mock-data";
import { colors, radii, shadows, spacing } from "@/lib/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TabKey = "current" | "scheduled" | "past" | "requests";

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey | null>("current");
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [riderProfileOpen, setRiderProfileOpen] = useState(false);
  const [requestsCount, setRequestsCount] = useState(1);

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
    LayoutAnimation.configureNext({
      duration: 320,
      create: {
        type: LayoutAnimation.Types.easeOut,
        property: LayoutAnimation.Properties.opacity,
        duration: 200,
      },
      update: {
        type: LayoutAnimation.Types.spring,
        springDamping: 0.82,
      },
      delete: {
        type: LayoutAnimation.Types.easeOut,
        property: LayoutAnimation.Properties.opacity,
        duration: 180,
      },
    });
    setActiveTab((current) => {
      if (current === tab) return null;

      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(sectionOffsets.current[tab], 0),
          animated: true,
        });
      });

      return tab;
    });
  };

  return (
    <>
      <ScrollView
        ref={scrollViewRef}
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: colors.surfaceLow }}
        contentContainerStyle={{
          paddingBottom: 100,
        }}
      >
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            gap: 6,
          }}
        >
          <AccordionSection
            title="Current Ride"
            active={activeTab === "current"}
            onLayout={handleSectionLayout("current")}
            onPress={() => toggleSection("current")}
          >
            <View style={{ gap: spacing.md }}>
              <Pressable
                onPress={() => setRiderProfileOpen(true)}
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
                <Avatar initials="ER" size={48} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text selectable style={eyebrow}>
                      Active Mission
                    </Text>
                    <StatusBadge status="enRoute" />
                  </View>
                  <Text selectable style={{ color: colors.primary, fontSize: 22, fontWeight: "900" }}>
                    {activeMission.name}
                  </Text>
                  <Text selectable style={{ color: colors.slate500, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    {activeMission.type}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text selectable style={{ color: colors.slate400, fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 }}>ETA</Text>
                  <Text selectable style={{ color: colors.primary, fontSize: 22, fontWeight: "900" }}>{activeMission.eta}</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => router.push("/mission")}
                style={({ pressed }) => ({
                  height: 140,
                  backgroundColor: "#E5EBF2",
                  borderRadius: radii.md,
                  overflow: "hidden",
                  borderCurve: "continuous",
                  transform: [{ scale: pressed ? 0.995 : 1 }],
                })}
              >
                <MiniMap />
                <View style={{ position: "absolute", left: 12, bottom: 12, flexDirection: "row", gap: 8 }}>
                  <View style={{ backgroundColor: "rgba(255,255,255,0.88)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.xs, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 7, height: 7, borderRadius: radii.pill, backgroundColor: colors.blue }} />
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "800" }} numberOfLines={1}>{activeMission.pickup}</Text>
                  </View>
                  <View style={{ backgroundColor: "rgba(255,255,255,0.88)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.xs, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 7, height: 7, borderRadius: radii.pill, backgroundColor: colors.green }} />
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "800" }} numberOfLines={1}>{activeMission.dropoff}</Text>
                  </View>
                </View>
                <View style={{ position: "absolute", right: 12, top: 12, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.xs }}>
                  <Text style={{ color: colors.surface, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 }}>Live GPS</Text>
                </View>
              </Pressable>

              <Pressable onPress={() => router.push("/mission")}>
                <GradientCard padding={16}>
                  <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 }}>
                    <Text style={primaryActionText}>Track Live Mission</Text>
                    <Text style={primaryActionText}>→</Text>
                  </View>
                </GradientCard>
              </Pressable>
            </View>
          </AccordionSection>

          <AccordionSection
            title="Scheduled Rides"
            active={activeTab === "scheduled"}
            onLayout={handleSectionLayout("scheduled")}
            onPress={() => toggleSection("scheduled")}
          >
            <View style={{ gap: spacing.md }}>
              {scheduledRides.map((ride) => (
                <View
                  key={ride.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radii.md,
                    borderCurve: "continuous",
                    padding: 20,
                    flexDirection: "row",
                    gap: 16,
                    ...shadows.soft,
                  }}
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
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <SmallButton label="Details" onPress={() => router.push({ pathname: "/ride-details", params: { rideId: ride.id } })} />
                      <SmallButton label="Admin Chat" filled onPress={() => router.push({ pathname: "/chat", params: { rideId: ride.id, riderName: ride.name } })} />
                    </View>
                  </View>
                    <View
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: radii.md,
                        overflow: "hidden",
                        borderCurve: "continuous",
                      }}
                  >
                    <MapView
                      style={{ flex: 1 }}
                      initialRegion={{
                        latitude: 37.782,
                        longitude: -122.413,
                        latitudeDelta: 0.02,
                        longitudeDelta: 0.02,
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      pitchEnabled={false}
                      rotateEnabled={false}
                      pointerEvents="none"
                    />
                  </View>
                </View>
              ))}
            </View>
          </AccordionSection>

          <AccordionSection
            title="Past Rides"
            active={activeTab === "past"}
            onLayout={handleSectionLayout("past")}
            onPress={() => toggleSection("past")}
          >
            <View style={{ gap: 4 }}>
              {pastRides.map((ride, index) => (
                <Pressable
                  key={ride}
                  onPress={() => router.push({ pathname: "/past-ride", params: { riderName: ride } })}
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
                  <View style={{ gap: 4 }}>
                    <Text selectable style={pastRideName}>
                      {ride}
                    </Text>
                    <Text selectable style={microLabel}>
                      Completed · Oct 2023
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <StatusBadge status="completed" />
                    <Text style={{ color: colors.slate300, fontSize: 18 }}>›</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </AccordionSection>

          <AccordionSection
            title="Ride Requests"
            active={activeTab === "requests"}
            badge={requestsCount > 0 ? String(requestsCount) : undefined}
            onLayout={handleSectionLayout("requests")}
            onPress={() => toggleSection("requests")}
          >
            {requestsCount > 0 ? (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radii.md,
                  padding: spacing.lg,
                  gap: spacing.md,
                  overflow: "hidden",
                  borderCurve: "continuous",
                  ...shadows.soft,
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    backgroundColor: colors.primary,
                  }}
                />
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View>
                    <Text selectable style={requestMinutes}>
                      32
                    </Text>
                    <Text selectable style={microLabel}>
                      Est. Minutes
                    </Text>
                  </View>
                      <View
                        style={{
                          alignSelf: "flex-start",
                          backgroundColor: colors.primary,
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: radii.xs,
                        }}
                      >
                    <Text selectable style={{ color: colors.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1 }}>
                      HIGH PRIORITY
                    </Text>
                  </View>
                </View>
                <View style={{ gap: 4 }}>
                  <Text selectable style={cardTitle}>
                    Thomas O'Malley
                  </Text>
                  <Text selectable style={cardMeta}>
                    Dialysis Transfer - Wheelchair
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setRequestsCount(0);
                    setActiveTab("scheduled");
                  }}
                >
                  <GradientCard padding={18}>
                    <Text style={primaryActionText}>Commit to Mission</Text>
                  </GradientCard>
                </Pressable>
                <Pressable onPress={() => setRequestsCount(0)}>
                  <Text style={declineText}>Decline</Text>
                </Pressable>
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
                <Text selectable style={emptyStateHeading}>
                  All clear
                </Text>
                <Text selectable style={emptyStateText}>
                  No pending ride requests
                </Text>
              </View>
            )}
          </AccordionSection>
        </View>
      </ScrollView>

      <OperatorSheet bottomInset={insets.bottom} />

      <SheetModal
        visible={riderProfileOpen}
        onClose={() => setRiderProfileOpen(false)}
        snapPoints={["56%", "90%"]}
      >
        <View style={{ alignItems: "center", gap: 18, paddingBottom: spacing.lg }}>
          <Avatar initials="ER" size={96} />
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text selectable style={modalTitle}>
              {activeMission.name}
            </Text>
            <Text selectable style={microLabel}>
              Rider Profile & Protocols
            </Text>
          </View>
        </View>
        <BottomSheetScrollView
          contentInsetAdjustmentBehavior="automatic"
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}
          showsVerticalScrollIndicator={false}
        >
          <View style={alertCardStyle}>
            <Text selectable style={alertTitle}>
              Critical Care Notes
            </Text>
            <Text selectable style={alertBody}>
              {activeMission.notes}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 14 }}>
            <InfoTile label="Transit Type" value={activeMission.transit} />
            <InfoTile label="Member Since" value={activeMission.memberSince} />
          </View>

          <View style={{ gap: 10 }}>
            <Text selectable style={microLabel}>
              Emergency Contact
            </Text>
            <View style={infoRowCard}>
              <Text selectable style={infoRowValue}>
                {activeMission.emergencyContact}
              </Text>
              <View style={callPill}>
                <Text style={{ color: colors.surface, fontWeight: "800" }}>Call</Text>
              </View>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text selectable style={microLabel}>
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
            <Text selectable style={protocolCaption}>
              Perfect safety record last 20 trips
            </Text>
          </View>
        </BottomSheetScrollView>
        <Pressable onPress={() => setRiderProfileOpen(false)}>
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
            <Pressable onPress={() => setDirectionsOpen(false)}>
              <Text selectable style={microLabel}>
                Dismiss
              </Text>
            </Pressable>
          </View>
        </View>
        <BottomSheetScrollView
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
              {activeMission.dropoff}
            </Text>
          </View>
        </BottomSheetScrollView>
        <Pressable onPress={() => setDirectionsOpen(false)}>
          <GradientCard padding={18}>
            <Text style={primaryActionText}>Return to Map</Text>
          </GradientCard>
        </Pressable>
      </SheetModal>

    </>
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
    <View onLayout={onLayout} style={{ marginBottom: 6 }}>
      <Pressable
        onPress={onPress}
        style={{
          backgroundColor: active ? colors.surface : colors.surfaceHigh,
          paddingHorizontal: spacing.md,
          paddingVertical: 18,
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
              <Text style={{ color: colors.surface, fontSize: 10, fontWeight: "900" }}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={{ color: colors.primary, fontSize: 18 }}>
          {active ? "⌄" : "›"}
        </Text>
      </Pressable>
      {active ? (
        <View
          style={{
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md,
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
  const sheetRef = useRef<BottomSheet>(null);
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const flipProgress = useSharedValue(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  const flipCard = useCallback(() => {
    const toValue = cardFlipped ? 0 : 1;
    flipProgress.value = withTiming(toValue, { duration: 400, easing: Easing.out(Easing.quad) });
    setCardFlipped(!cardFlipped);
  }, [cardFlipped]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const clamped = Math.max(0, Math.min(1, cardFlipped ? 1 - e.translationX / 200 : e.translationX / -200));
      flipProgress.value = clamped;
    })
    .onEnd((e) => {
      const shouldFlip = Math.abs(e.translationX) > 60;
      if (shouldFlip) {
        const newVal = cardFlipped ? 0 : 1;
        flipProgress.value = withTiming(newVal, { duration: 250 });
        runOnJS(setCardFlipped)(!cardFlipped);
      } else {
        flipProgress.value = withTiming(cardFlipped ? 1 : 0, { duration: 250 });
      }
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(flipCard)();
  });

  const cardGesture = Gesture.Exclusive(panGesture, tapGesture);

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 1], [0, 180]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: "hidden" as const,
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(flipProgress.value, [0, 1], [180, 360]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY}deg` }],
      backfaceVisibility: "hidden" as const,
      position: "absolute" as const,
      top: 0, left: 0, right: 0, bottom: 0,
    };
  });

  // Collapsed: just the header row + safe area
  const collapsedHeight = 68 + bottomInset;
  // Expanded: fill up to the navigation header (status bar + nav bar = insets.top + 44)
  const { height: screenHeight } = Dimensions.get("window");
  const expandedHeight = screenHeight - insets.top - 44;
  const snapPoints = useMemo(() => [collapsedHeight, expandedHeight], [collapsedHeight, expandedHeight]);

  // Card height fills available space dynamically
  const cardHeight = Math.min(expandedHeight - 68 - 140 - bottomInset, 420);

  const handleToggle = useCallback(() => {
    if (expanded) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.snapToIndex(1);
    }
  }, [expanded]);

  const handleSheetChange = useCallback((index: number) => {
    setExpanded(index > 0);
    if (index === 0) {
      setCardFlipped(false);
      flipProgress.value = withTiming(0, { duration: 200 });
    }
  }, []);

  return (
    <BottomSheet
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      handleComponent={null}
      onChange={handleSheetChange}
      backgroundStyle={{
        backgroundColor: colors.primary,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
      }}
      animateOnMount={false}
      overDragResistanceFactor={4}
    >
      <BottomSheetView style={{ flex: 1, paddingBottom: bottomInset }}>
        <Pressable
          onPress={handleToggle}
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: 14,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 28, height: 28, borderRadius: radii.xs, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: colors.slate300, fontSize: 14 }}>⛊</Text>
            </View>
            <View>
              <Text selectable style={operatorName}>
                User #Ben123
              </Text>
              <Text selectable style={{ color: colors.slate400, fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
                Tap to show ID badge
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.slate300, fontSize: 18 }}>
            {expanded ? "✕" : "⌃"}
          </Text>
        </Pressable>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, flex: 1 }}>
          <View style={{ height: 1, backgroundColor: colors.primarySoft }} />

          <GestureDetector gesture={cardGesture}>
          <View style={{ height: cardHeight }}>
            <Animated.View style={[{ backgroundColor: colors.surface, borderRadius: 12, borderCurve: "continuous", overflow: "hidden", height: cardHeight }, frontAnimatedStyle]}>
              <View style={{ padding: 20, gap: 18, flex: 1 }}>
                <View style={{ flexDirection: "row", gap: 16 }}>
                  <View
                    style={{
                      width: 80,
                      height: 96,
                      borderRadius: radii.sm,
                      backgroundColor: colors.primary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.surface, fontSize: 28, fontWeight: "900" }}>BD</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4, justifyContent: "center" }}>
                    <Text selectable style={{ color: colors.primary, fontSize: 24, fontWeight: "900" }}>
                      Ben Driver
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      <Text selectable style={{ color: colors.slate500, fontSize: 12, fontWeight: "700" }}>
                        ID: 099-242
                      </Text>
                      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.slate300 }} />
                      <Text selectable style={{ color: colors.green, fontSize: 10, fontWeight: "800", textTransform: "uppercase" }}>
                        Active
                      </Text>
                    </View>
                    <Text selectable style={{ color: colors.slate400, fontSize: 11, fontWeight: "600" }}>
                      Certified since March 2024
                    </Text>
                  </View>
                </View>

                <View style={{ height: 1, backgroundColor: colors.slate100 }} />

                <View style={{ gap: 10 }}>
                  <Text style={{ color: colors.slate400, fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5 }}>
                    Certifications
                  </Text>
                  {[
                    { label: "TrustedRiders Certified", date: "Mar 2024", icon: "◆" },
                    { label: "ADA Compliance", date: "Jun 2024", icon: "◆" },
                    { label: "Wheelchair Assist", date: "Mar 2024", icon: "◆" },
                    { label: "First Aid / CPR", date: "Jan 2025", icon: "+" },
                  ].map((cert) => (
                    <View key={cert.label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 20, height: 20, borderRadius: radii.xs, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: colors.green, fontSize: 8, fontWeight: "900" }}>{cert.icon}</Text>
                        </View>
                        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>{cert.label}</Text>
                      </View>
                      <Text style={{ color: colors.slate400, fontSize: 11, fontWeight: "600" }}>{cert.date}</Text>
                    </View>
                  ))}
                </View>

                <View style={{ flex: 1 }} />

                <View style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ color: colors.slate400, fontSize: 10, fontWeight: "700" }}>Tap or swipe to show QR</Text>
                  <Text style={{ color: colors.slate300, fontSize: 12 }}>↻</Text>
                </View>
              </View>
            </Animated.View>

            <Animated.View style={[{ backgroundColor: colors.surface, borderRadius: 12, borderCurve: "continuous", overflow: "hidden", height: cardHeight }, backAnimatedStyle]}>
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 24 }}>
                <View
                  style={{
                    width: 180,
                    height: 180,
                    backgroundColor: colors.surfaceLow,
                    borderRadius: radii.md,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: colors.slate100,
                  }}
                >
                  <View style={{ gap: 3, alignItems: "center" }}>
                    {[0, 1, 2, 3, 4, 5, 6].map((row) => (
                      <View key={row} style={{ flexDirection: "row", gap: 3 }}>
                        {[0, 1, 2, 3, 4, 5, 6].map((col) => (
                          <View
                            key={col}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 2,
                              backgroundColor:
                                (row < 3 && col < 3) || (row < 3 && col > 3) || (row > 3 && col < 3)
                                  ? (row + col) % 2 === 0 ? colors.primary : colors.surface
                                  : (row * col + row) % 3 === 0 ? colors.primary : colors.slate200,
                            }}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                </View>

                <View style={{ alignItems: "center", gap: 6 }}>
                  <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "900" }}>
                    Ben Driver
                  </Text>
                  <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "700" }}>
                    ID: 099-242
                  </Text>
                  <Text style={{ color: colors.slate400, fontSize: 10, fontWeight: "600", textAlign: "center", lineHeight: 16, paddingHorizontal: 20 }}>
                    Scan to verify operator identity and certification status
                  </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Text style={{ color: colors.slate400, fontSize: 10, fontWeight: "700" }}>Tap or swipe to show ID</Text>
                  <Text style={{ color: colors.slate300, fontSize: 12 }}>↻</Text>
                </View>
              </View>
            </Animated.View>
          </View>
          </GestureDetector>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={() => setLocationEnabled((c) => !c)}
              style={{
                flex: 1,
                borderRadius: radii.md,
                borderCurve: "continuous",
                backgroundColor: locationEnabled ? "rgba(22, 163, 74, 0.15)" : "rgba(220, 38, 38, 0.15)",
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text selectable style={{
                color: locationEnabled ? "#86EFAC" : "#FCA5A5",
                fontSize: 10,
                fontWeight: "900",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}>
                {locationEnabled ? "Location On" : "Location Off"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/settings")}
              style={{
                flex: 1,
                borderRadius: radii.md,
                borderCurve: "continuous",
                backgroundColor: colors.primarySoft,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text selectable style={{ color: colors.slate300, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 }}>
                Settings
              </Text>
            </Pressable>
          </View>

          <Pressable
            style={{
              borderRadius: radii.md,
              borderCurve: "continuous",
              backgroundColor: "rgba(220, 38, 38, 0.2)",
              paddingVertical: 16,
              alignItems: "center",
            }}
          >
            <Text selectable style={{ color: "#FCA5A5", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5 }}>
              Emergency
            </Text>
          </Pressable>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}

function Avatar({ initials, size }: { initials: string; size: number }) {
  return (
    <GradientCard padding={0} borderRadius={size / 2}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          selectable
          style={{
            color: colors.surface,
            fontSize: size * 0.34,
            fontWeight: "900",
          }}
        >
          {initials}
        </Text>
      </View>
    </GradientCard>
  );
}

function MiniMap() {
  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={{
        latitude: 37.782,
        longitude: -122.413,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      }}
      scrollEnabled={false}
      zoomEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
      pointerEvents="none"
    >
      <Marker
        coordinate={{ latitude: 37.788, longitude: -122.408 }}
        title="Pickup"
        pinColor={colors.blue}
      />
      <Marker
        coordinate={{ latitude: 37.775, longitude: -122.42 }}
        title="Drop-off"
        pinColor={colors.green}
      />
      <Polyline
        coordinates={[
          { latitude: 37.788, longitude: -122.408 },
          { latitude: 37.783, longitude: -122.412 },
          { latitude: 37.778, longitude: -122.416 },
          { latitude: 37.775, longitude: -122.42 },
        ]}
        strokeColor={colors.blue}
        strokeWidth={3}
      />
    </MapView>
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
      <Text selectable style={microLabel}>
        {label}
      </Text>
      <Text selectable style={infoTileValue}>
        {value}
      </Text>
    </View>
  );
}

function SmallButton({ label, filled, onPress }: { label: string; filled?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          backgroundColor: filled ? colors.blue : colors.surfaceLow,
          borderRadius: radii.xs,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <Text
          selectable
          style={{
            color: filled ? colors.surface : colors.primary,
            fontSize: 10,
            fontWeight: "800",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const eyebrow = {
  color: colors.slate400,
  fontSize: 10,
  fontWeight: "700" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 2,
};

const primaryActionText = {
  color: colors.surface,
  fontSize: 13,
  fontWeight: "900" as const,
  textAlign: "center" as const,
  letterSpacing: 1.5,
  textTransform: "uppercase" as const,
};

const sectionTitle = {
  color: colors.primary,
  fontSize: 15,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 0.5,
};

const timeBadge = {
  color: colors.blue,
  fontSize: 12,
  fontWeight: "900" as const,
  backgroundColor: colors.blueSoft,
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: radii.xs,
  overflow: "hidden" as const,
};

const microLabel = {
  color: colors.slate400,
  fontSize: 10,
  fontWeight: "800" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};

const cardTitle = {
  color: colors.primary,
  fontSize: 22,
  fontWeight: "900" as const,
};

const cardMeta = {
  color: colors.slate500,
  fontSize: 12,
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
};

const pastRideName = {
  color: colors.primary,
  fontSize: 15,
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
  fontSize: 10,
  fontWeight: "800" as const,
  textAlign: "center" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.5,
};

const emptyStateHeading = {
  color: colors.primary,
  fontSize: 15,
  fontWeight: "800" as const,
};

const emptyStateText = {
  color: colors.slate400,
  fontSize: 11,
  fontWeight: "700" as const,
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
  backgroundColor: "rgba(220, 38, 38, 0.06)",
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  padding: spacing.lg,
  gap: 10,
};

const alertTitle = {
  color: colors.error,
  fontSize: 11,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.3,
};

const alertBody = {
  color: colors.primary,
  fontSize: 15,
  fontWeight: "600" as const,
  lineHeight: 22,
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
  fontSize: 15,
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
  fontSize: 10,
  fontWeight: "700" as const,
  textTransform: "uppercase" as const,
};

const nextActionLabel = {
  color: colors.blue,
  fontSize: 10,
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
  fontSize: 14,
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
  fontSize: 12,
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

const infoTileValue = {
  color: colors.primary,
  fontSize: 16,
  fontWeight: "800" as const,
};
