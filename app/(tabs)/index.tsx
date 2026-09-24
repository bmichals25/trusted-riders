import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { FocusTransition } from "@/components/ui/FocusTransition";
import { useStartupPresentation } from "@/components/ui/DriverNameGate";
import { LocationPermissionBanner } from "@/components/ui/LocationPermissionBanner";
import { HomeBrandHeader } from "@/features/home/home-brand-header";
import { ReadyToReturnCard } from "@/features/rides/ready-to-return";
import {
  CurrentRideCard,
  EmptyRideState,
  LoadingState,
  NextUpcomingRideCard,
  Notice,
  Section,
  UpcomingRideCard,
} from "@/features/home/home-screen-sections";
import { useDispatch } from "@/lib/dispatch-context";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { useLocation } from "@/lib/location-context";
import { showMapProviderOptionsForRide } from "@/lib/map-navigation";
import { type DispatchedRide } from "@/lib/rides";
import { findReadyToReturnRide } from "@/lib/round-trip";
import { colors, spacing } from "@/lib/theme";

export default function HomeScreen() {
  const router = useRouter();
  const { activeRide, scheduledRides, backendError, hasLoadedRides, refreshRides, advanceRideStatus, respondToRide } = useDispatch();
  const { error: locationError, permissionStatus } = useLocation();
  const { impact } = useHaptics();
  const { startupAnimationComplete, startupAnimationExiting, startupAnimationVisible } = useStartupPresentation();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  // Floating tab bar clearance (76) + bottom safe-area inset so the last ride
  // card clears the bar on every device. Floored at 108 so nothing clips on no-inset devices.
  const homeBottomPadding = Math.max(insets.bottom + 76, 108);
  // Only mount the location banner block when it actually has something to show.
  // Otherwise the FadeInBlock wrapper renders an empty Animated.View that still
  // counts as a flex child, injecting a phantom `gap: spacing.lg` (24) at the top.
  const showLocationBanner = permissionStatus === "denied";
  const blockExitOnBlur = false;
  const replayHomeEntrance = false;
  const homeEntranceReady = !startupAnimationVisible || startupAnimationExiting || startupAnimationComplete;
  // Round trip: passenger at the appointment -> "Ready to Return" card instead of a plain upcoming card.
  const readyRide = activeRide ? null : findReadyToReturnRide(scheduledRides);
  const upcomingRides = readyRide ? scheduledRides.filter((ride) => ride.id !== readyRide.id) : scheduledRides;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshRides();
    } finally {
      setRefreshing(false);
    }
  }, [refreshRides]);

  const openChat = useCallback((ride: DispatchedRide) => {
    impact(ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/chat",
      params: { rideId: ride.id, riderName: ride.passengerName },
    });
  }, [impact, router]);

  const openRideDetails = useCallback((ride: DispatchedRide) => {
    impact(ImpactFeedbackStyle.Light);
    router.push(`/ride-details?rideId=${encodeURIComponent(ride.id)}`);
  }, [impact, router]);

  const openNavigation = useCallback((ride: DispatchedRide) => {
    impact(ImpactFeedbackStyle.Light);
    showMapProviderOptionsForRide(ride);
  }, [impact]);

  return (
    <FocusTransition>
      <View style={{ flex: 1, minHeight: windowHeight, backgroundColor: colors.surfaceLow, flexDirection: "column-reverse" }}>
        {/* column-reverse: the ScrollView is declared first so it becomes the native
            first-descendant (subviews[0]), which react-native-screens requires in order to
            scroll the active tab to the top when its bottom tab is re-tapped. Yoga still lays
            the ScrollView out below the header that is declared after it. */}
        {/* Ride lists below stay inline rather than FlashList: they're bounded short and
            mutually exclusive, and nesting a virtualized list inside this hero ScrollView
            would break virtualization. The full unbounded upcoming list lives in ride-requests-screen. */}
        <ScrollView
          style={{ flex: 1, backgroundColor: colors.surfaceLow }}
          contentInsetAdjustmentBehavior="never"
          scrollEnabled
          bounces
          alwaysBounceVertical
          scrollEventThrottle={16}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: spacing.sm,
            paddingBottom: homeBottomPadding,
            gap: spacing.md,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
        >
          {showLocationBanner ? (
            <FadeInBlock
              delay={70}
              duration={480}
              exitOnBlur={blockExitOnBlur}
              ready={homeEntranceReady}
              replayOnFocus={replayHomeEntrance}
            >
              <LocationPermissionBanner />
            </FadeInBlock>
          ) : null}

          {backendError ? (
            <FadeInBlock
              delay={110}
              duration={480}
              exitOnBlur={blockExitOnBlur}
              ready={homeEntranceReady}
              replayOnFocus={replayHomeEntrance}
            >
              <Notice tone="error" title="Backend rides unavailable" body={backendError} />
            </FadeInBlock>
          ) : null}

          {locationError ? (
            <FadeInBlock
              delay={130}
              duration={480}
              exitOnBlur={blockExitOnBlur}
              ready={homeEntranceReady}
              replayOnFocus={replayHomeEntrance}
            >
              <Notice tone="warning" title="Location warning" body={locationError} />
            </FadeInBlock>
          ) : null}

          {readyRide ? (
            <FadeInBlock
              delay={140}
              duration={520}
              distance={16}
              exitOnBlur={blockExitOnBlur}
              ready={homeEntranceReady}
              replayOnFocus={replayHomeEntrance}
            >
              <Section title="Ride Home">
                <ReadyToReturnCard
                  ride={readyRide}
                  onOpen={() => openRideDetails(readyRide)}
                  onChat={() => openChat(readyRide)}
                />
              </Section>
            </FadeInBlock>
          ) : null}

          {activeRide ? (
            <FadeInBlock
              delay={145}
              duration={520}
              distance={16}
              exitOnBlur={blockExitOnBlur}
              ready={homeEntranceReady}
              replayOnFocus={replayHomeEntrance}
            >
              <Section title="Current Ride">
                <CurrentRideCard
                  ride={activeRide}
                  onOpen={() => openRideDetails(activeRide)}
                  onChat={() => openChat(activeRide)}
                  onNavigate={() => openNavigation(activeRide)}
                  onAdvance={(next) => advanceRideStatus(activeRide, next)}
                />
              </Section>
            </FadeInBlock>
          ) : hasLoadedRides && !backendError && upcomingRides.length > 0 ? (
            <FadeInBlock
              delay={145}
              duration={520}
              distance={16}
              exitOnBlur={blockExitOnBlur}
              ready={homeEntranceReady}
              replayOnFocus={replayHomeEntrance}
            >
              <Section title="Upcoming Rides" count={upcomingRides.length}>
                <View style={{ gap: spacing.md }}>
                  {upcomingRides.map((ride, index) => {
                    const isNextUpcomingRide = index === 0;
                    return (
                      <FadeInBlock
                        key={ride.id}
                        delay={185 + index * 38}
                        duration={480}
                        exitOnBlur={blockExitOnBlur}
                        ready={homeEntranceReady}
                        replayOnFocus={replayHomeEntrance}
                        distance={10}
                      >
                        {isNextUpcomingRide ? (
                          <NextUpcomingRideCard
                            ride={ride}
                            onOpen={() => openRideDetails(ride)}
                            onNavigate={() => openNavigation(ride)}
                            onRespond={respondToRide}
                          />
                        ) : (
                          <UpcomingRideCard
                            ride={ride}
                            onOpen={() => openRideDetails(ride)}
                            onNavigate={() => openNavigation(ride)}
                            onRespond={respondToRide}
                          />
                        )}
                      </FadeInBlock>
                    );
                  })}
                </View>
              </Section>
            </FadeInBlock>
          ) : readyRide ? null : hasLoadedRides && !backendError ? (
            <FadeInBlock
              delay={145}
              duration={520}
              distance={16}
              exitOnBlur={blockExitOnBlur}
              ready={homeEntranceReady}
              replayOnFocus={replayHomeEntrance}
            >
              <Section title="Current Ride">
                <EmptyRideState refreshing={refreshing} onRefresh={onRefresh} />
              </Section>
            </FadeInBlock>
          ) : (
            <FadeInBlock
              delay={145}
              duration={520}
              distance={16}
              exitOnBlur={blockExitOnBlur}
              ready={homeEntranceReady}
              replayOnFocus={replayHomeEntrance}
            >
              <Section title="Current Ride">
                <LoadingState title="Loading ride information" body="Checking dispatch…" />
              </Section>
            </FadeInBlock>
          )}
        </ScrollView>

        <FadeInBlock
          delay={0}
          distance={8}
          duration={460}
          exitOnBlur={blockExitOnBlur}
          ready={homeEntranceReady}
          replayOnFocus={replayHomeEntrance}
        >
          <HomeBrandHeader backendConnected={!backendError} backendError={backendError} />
        </FadeInBlock>
      </View>
    </FocusTransition>
  );
}
