import { useCallback, useRef, useState } from "react";
import { Linking, RefreshControl, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { FocusTransition } from "@/components/ui/FocusTransition";
import { LocationPermissionBanner } from "@/components/ui/LocationPermissionBanner";
import { RideRequestCard } from "@/components/ui/RideRequestCard";
import { HomeBrandHeader } from "@/features/home/home-brand-header";
import {
  CurrentRideCard,
  EmptyRideState,
  LoadingState,
  navigationUrlForRide,
  Notice,
  RideRequestsBanner,
  Section,
} from "@/features/home/home-screen-sections";
import { useDispatch } from "@/lib/dispatch-context";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { useLocation } from "@/lib/location-context";
import { type DispatchedRide } from "@/lib/rides";
import { colors, spacing } from "@/lib/theme";

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
  const blockExitOnBlur = false;

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
    <FocusTransition>
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
          <FadeInBlock delay={60} exitOnBlur={blockExitOnBlur}>
            <LocationPermissionBanner />
          </FadeInBlock>

          {backendError ? (
            <FadeInBlock delay={105} exitOnBlur={blockExitOnBlur}>
              <Notice tone="error" title="Backend rides unavailable" body={backendError} />
            </FadeInBlock>
          ) : null}

          {locationError ? (
            <FadeInBlock delay={125} exitOnBlur={blockExitOnBlur}>
              <Notice tone="warning" title="Location warning" body={locationError} />
            </FadeInBlock>
          ) : null}

          {!hasLoadedRides && !backendError ? (
            <FadeInBlock delay={150} exitOnBlur={blockExitOnBlur}>
              <Section title="Current Ride">
                <LoadingState title="Loading ride information" body="Checking the live backend for current rides and requests." />
              </Section>
            </FadeInBlock>
          ) : activeRide ? (
            <FadeInBlock delay={150} exitOnBlur={blockExitOnBlur}>
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
            <FadeInBlock delay={150} exitOnBlur={blockExitOnBlur}>
              <Section title="Current Ride">
                <EmptyRideState />
              </Section>
            </FadeInBlock>
          ) : null}

          {shouldShowRideRequests ? (
            activeRide ? (
              <FadeInBlock delay={205} exitOnBlur={blockExitOnBlur}>
                <View style={{ marginHorizontal: spacing.md }}>
                  <RideRequestsBanner count={pendingRides.length} latestRide={pendingRides[0]} onPress={() => openRideRequestDetails(pendingRides[0])} />
                </View>
              </FadeInBlock>
            ) : (
              <FadeInBlock delay={205} exitOnBlur={blockExitOnBlur}>
                <Section title="Ride Requests" count={pendingRides.length}>
                  <View style={{ gap: spacing.md }}>
                    {pendingRides.map((ride, index) => (
                      <FadeInBlock
                        key={ride.id}
                        delay={260 + index * 45}
                        exitOnBlur={blockExitOnBlur}
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
    </FocusTransition>
  );
}
