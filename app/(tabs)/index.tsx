import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { FocusTransition } from "@/components/ui/FocusTransition";
import { useStartupPresentation } from "@/components/ui/DriverNameGate";
import { LocationPermissionBanner } from "@/components/ui/LocationPermissionBanner";
import { RideRequestCard } from "@/components/ui/RideRequestCard";
import { HomeBrandHeader } from "@/features/home/home-brand-header";
import {
  CurrentRideCard,
  EmptyRideState,
  LoadingState,
  NextUpcomingRideCard,
  Notice,
  RideRequestsBanner,
  Section,
  UpcomingRideCard,
} from "@/features/home/home-screen-sections";
import { useDispatch } from "@/lib/dispatch-context";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { useLocation } from "@/lib/location-context";
import { showMapProviderOptionsForRide } from "@/lib/map-navigation";
import { confirmDeclineRideRequest } from "@/lib/ride-action-confirmation";
import { type DispatchedRide } from "@/lib/rides";
import { colors, spacing } from "@/lib/theme";

export default function HomeScreen() {
  const router = useRouter();
  const { activeRide, pendingRides, scheduledRides, backendError, hasLoadedRides, refreshRides, acceptRide, declineRide } = useDispatch();
  const { error: locationError } = useLocation();
  const { impact, notification } = useHaptics();
  const { startupAnimationComplete, startupAnimationExiting, startupAnimationVisible } = useStartupPresentation();
  const [refreshing, setRefreshing] = useState(false);
  const homeBottomPadding = 108;
  const shouldShowRideRequests = hasLoadedRides && !backendError && pendingRides.length > 0;
  const blockExitOnBlur = false;
  const replayHomeEntrance = false;
  const homeEntranceReady = !startupAnimationVisible || startupAnimationExiting || startupAnimationComplete;

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
    showMapProviderOptionsForRide(ride);
  }, [impact]);

  return (
    <FocusTransition>
      <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
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

        <ScrollView
          style={{ flex: 1, backgroundColor: colors.surfaceLow }}
          contentInsetAdjustmentBehavior="never"
          scrollEnabled
          bounces
          alwaysBounceVertical
          scrollEventThrottle={16}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: spacing.md,
            paddingBottom: homeBottomPadding,
            gap: spacing.lg,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
        >
          <FadeInBlock
            delay={70}
            duration={480}
            exitOnBlur={blockExitOnBlur}
            ready={homeEntranceReady}
            replayOnFocus={replayHomeEntrance}
          >
            <LocationPermissionBanner />
          </FadeInBlock>

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
                />
              </Section>
            </FadeInBlock>
          ) : shouldShowRideRequests ? (
            <FadeInBlock
              delay={145}
              duration={520}
              distance={16}
              exitOnBlur={blockExitOnBlur}
              ready={homeEntranceReady}
              replayOnFocus={replayHomeEntrance}
            >
              <Section title="Ride Requests" count={pendingRides.length}>
                <View style={{ gap: spacing.md }}>
                  {pendingRides.map((ride, index) => (
                    <FadeInBlock
                      key={ride.id}
                      delay={185 + index * 38}
                      duration={480}
                      exitOnBlur={blockExitOnBlur}
                      ready={homeEntranceReady}
                      replayOnFocus={replayHomeEntrance}
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
                          confirmDeclineRideRequest(ride, () => declineRide(ride.id));
                        }}
                      />
                    </FadeInBlock>
                  ))}
                </View>
              </Section>
            </FadeInBlock>
          ) : hasLoadedRides && !backendError && scheduledRides.length > 0 ? (
            <FadeInBlock
              delay={145}
              duration={520}
              distance={16}
              exitOnBlur={blockExitOnBlur}
              ready={homeEntranceReady}
              replayOnFocus={replayHomeEntrance}
            >
              <Section title="Upcoming Rides" count={scheduledRides.length}>
                <View style={{ gap: spacing.md }}>
                  {scheduledRides.map((ride, index) => {
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
                          />
                        ) : (
                          <UpcomingRideCard
                            ride={ride}
                            onOpen={() => openRideDetails(ride)}
                          />
                        )}
                      </FadeInBlock>
                    );
                  })}
                </View>
              </Section>
            </FadeInBlock>
          ) : hasLoadedRides && !backendError ? (
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
                <LoadingState title="Loading ride information" body="Checking the live backend for current rides and requests." />
              </Section>
            </FadeInBlock>
          )}

          {shouldShowRideRequests && activeRide ? (
            activeRide ? (
              <FadeInBlock
                delay={220}
                duration={500}
                distance={12}
                exitOnBlur={blockExitOnBlur}
                ready={homeEntranceReady}
                replayOnFocus={replayHomeEntrance}
              >
                <View style={{ marginHorizontal: spacing.md }}>
                  <RideRequestsBanner count={pendingRides.length} latestRide={pendingRides[0]} onPress={() => openRideRequestDetails(pendingRides[0])} />
                </View>
              </FadeInBlock>
            ) : null
          ) : null}
        </ScrollView>
      </View>
    </FocusTransition>
  );
}
