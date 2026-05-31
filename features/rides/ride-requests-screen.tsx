import { useCallback, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackChevron } from "@/components/ui/BackChevron";
import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import { NextUpcomingRideCard, UpcomingRideCard } from "@/features/home/home-screen-sections";
import { useDispatch } from "@/lib/dispatch-context";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { showMapProviderOptionsForRide } from "@/lib/map-navigation";
import { type DispatchedRide } from "@/lib/rides";
import { colors, radii, spacing } from "@/lib/theme";

export function UpcomingRidesScreenContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { scheduledRides, backendError, refreshRides } = useDispatch();
  const { impact } = useHaptics();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshRides();
    } finally {
      setRefreshing(false);
    }
  }, [refreshRides]);

  const openRideDetails = useCallback((ride: DispatchedRide) => {
    impact(ImpactFeedbackStyle.Light);
    router.push(`/ride-details?rideId=${encodeURIComponent(ride.id)}`);
  }, [impact, router]);

  const openNavigation = useCallback((ride: DispatchedRide) => {
    impact(ImpactFeedbackStyle.Light);
    showMapProviderOptionsForRide(ride);
  }, [impact]);

  const renderUpcomingRide = useCallback(
    ({ item, index }: { item: DispatchedRide; index: number }) => {
      const Card = index === 0 ? NextUpcomingRideCard : UpcomingRideCard;
      return (
        <FadeInBlock delay={90 + index * 35}>
          <Card
            ride={item}
            onOpen={() => openRideDetails(item)}
            onNavigate={() => openNavigation(item)}
          />
        </FadeInBlock>
      );
    },
    [openRideDetails, openNavigation],
  );

  return (
    <PageTransition>
      <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
        <UpcomingRidesHeader count={scheduledRides.length} topInset={insets.top} />

        <FlashList
          data={scheduledRides}
          keyExtractor={(ride) => ride.id}
          renderItem={renderUpcomingRide}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 28 }}
          ItemSeparatorComponent={RideSeparator}
          ListHeaderComponent={
            backendError ? (
              <FadeInBlock delay={60}>
                <View style={{ marginBottom: spacing.md }}>
                  <Notice title="Backend rides unavailable" body={backendError} />
                </View>
              </FadeInBlock>
            ) : null
          }
          ListEmptyComponent={
            <FadeInBlock delay={90}>
              <EmptyUpcomingRides refreshing={refreshing} />
            </FadeInBlock>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
        />
      </View>
    </PageTransition>
  );
}

function RideSeparator() {
  return <View style={{ height: spacing.md }} />;
}

function UpcomingRidesHeader({ count, topInset }: { count: number; topInset: number }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        paddingTop: topInset + 10,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
      }}
    >
      <BackChevron />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: colors.primary, fontSize: 20, fontWeight: "900", lineHeight: 25 }}>
          Upcoming Rides
        </Text>
        <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "700" }}>
          {rideCountLabel(count)}
        </Text>
      </View>
    </View>
  );
}

function EmptyUpcomingRides({ refreshing }: { refreshing: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel="No upcoming rides. Pull down to refresh and keep this screen ready for dispatch assignments."
      style={{
        backgroundColor: colors.surfaceLow,
        borderRadius: radii.sm,
        borderCurve: "continuous",
        padding: spacing.lg,
        gap: 6,
        marginTop: spacing.lg,
      }}
    >
      <Text style={{ color: colors.primary, fontSize: 19, fontWeight: "800", lineHeight: 24 }}>
        No upcoming rides
      </Text>
      <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "700", lineHeight: 19 }}>
        {refreshing ? "Checking for assigned rides..." : "Assigned rides appear here. Pull down to refresh."}
      </Text>
    </View>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ backgroundColor: colors.errorSoft, borderRadius: radii.sm, padding: spacing.md, gap: 4 }}>
      <Text style={{ color: colors.error, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.4 }}>
        {title}
      </Text>
      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>{body}</Text>
    </View>
  );
}

function rideCountLabel(count: number) {
  if (count === 0) return "No upcoming rides";
  if (count === 1) return "1 upcoming ride";
  return `${count} upcoming rides`;
}
