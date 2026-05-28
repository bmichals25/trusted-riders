import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackChevron } from "@/components/ui/BackChevron";
import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import { RideRequestCard } from "@/components/ui/RideRequestCard";
import { useDispatch } from "@/lib/dispatch-context";
import { ImpactFeedbackStyle, NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { type DispatchedRide } from "@/lib/rides";
import { colors, radii, shadows, spacing } from "@/lib/theme";

export default function RideRequestsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pendingRides, backendError, refreshRides, acceptRide, declineRide } = useDispatch();
  const { impact, notification } = useHaptics();
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <PageTransition>
      <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
        <View
          style={{
            backgroundColor: colors.surface,
            paddingTop: insets.top + 10,
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
              Ride Requests
            </Text>
            <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "700" }}>
              {rideCountLabel(pendingRides.length)}
            </Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 28, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
        >
          {backendError ? (
            <FadeInBlock delay={60}>
              <Notice title="Backend rides unavailable" body={backendError} />
            </FadeInBlock>
          ) : null}

          {pendingRides.length ? (
            pendingRides.map((ride, index) => (
              <FadeInBlock key={ride.id} delay={90 + index * 35}>
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
            ))
          ) : (
            <FadeInBlock delay={90}>
              <EmptyRequests />
            </FadeInBlock>
          )}
        </ScrollView>
      </View>
    </PageTransition>
  );
}

function EmptyRequests() {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, gap: spacing.sm, alignItems: "center", ...shadows.soft }}>
      <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "900", textAlign: "center" }}>
        No pending requests
      </Text>
      <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "700", textAlign: "center", lineHeight: 19 }}>
        New ride requests will appear here as dispatch sends them.
      </Text>
    </View>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderLeftWidth: 4, borderLeftColor: colors.error, borderRadius: radii.sm, padding: spacing.md, gap: 4, ...shadows.soft }}>
      <Text style={{ color: colors.error, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4 }}>
        {title}
      </Text>
      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>{body}</Text>
    </View>
  );
}

function rideCountLabel(count: number) {
  if (count === 0) return "No pending requests";
  if (count === 1) return "1 pending request";
  return `${count} pending requests`;
}
