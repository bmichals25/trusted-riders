import { useCallback, useState } from "react";
import { SymbolView } from "expo-symbols";
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
import { confirmDeclineRideRequest } from "@/lib/ride-action-confirmation";
import { type DispatchedRide } from "@/lib/rides";
import { colors, radii, shadows, spacing } from "@/lib/theme";

export function RideRequestsScreenContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pendingRides, backendError, refreshRides, acceptRide, declineRide } = useDispatch();
  const { impact, notification } = useHaptics();
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <PageTransition>
      <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
        <RideRequestsHeader count={pendingRides.length} topInset={insets.top} />

        <ScrollView
          style={{ flex: 1 }}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 28, gap: spacing.md, flexGrow: 1 }}
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
                    confirmDeclineRideRequest(ride, () => declineRide(ride.id));
                  }}
                />
              </FadeInBlock>
            ))
          ) : (
            <FadeInBlock delay={90}>
              <EmptyRequests refreshing={refreshing} />
            </FadeInBlock>
          )}
        </ScrollView>
      </View>
    </PageTransition>
  );
}

function RideRequestsHeader({ count, topInset }: { count: number; topInset: number }) {
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
          Ride Requests
        </Text>
        <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "700" }}>
          {rideCountLabel(count)}
        </Text>
      </View>
    </View>
  );
}

function EmptyRequests({ refreshing }: { refreshing: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel="No pending ride requests. Pull down to refresh and keep this screen ready for dispatch assignments."
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        borderCurve: "continuous",
        padding: spacing.lg,
        gap: spacing.md,
        alignItems: "center",
        marginTop: spacing.lg,
        borderWidth: 1,
        borderColor: colors.slate100,
        ...shadows.soft,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 54,
          height: 54,
          borderRadius: radii.lg,
          backgroundColor: colors.blueSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SymbolView
          name="tray.fill"
          size={25}
          type="hierarchical"
          tintColor={colors.blueStrong}
          weight="semibold"
        />
      </View>
      <View style={{ gap: 6, alignItems: "center" }}>
        <Text style={{ color: colors.primary, fontSize: 19, fontWeight: "900", lineHeight: 24, textAlign: "center" }}>
          No pending requests
        </Text>
        <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "700", textAlign: "center", lineHeight: 19, maxWidth: 260 }}>
          New ride requests will appear here as dispatch sends them. Pull down to check again.
        </Text>
      </View>
      <View
        style={{
          minHeight: 40,
          alignSelf: "stretch",
          borderRadius: radii.sm,
          backgroundColor: colors.surfaceLow,
          borderWidth: 1,
          borderColor: colors.slate100,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.sm,
        }}
      >
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "900" }} numberOfLines={1}>
          Dispatch watch
        </Text>
        <Text style={{ color: refreshing ? colors.blueStrong : colors.greenStrong, fontSize: 12, fontWeight: "900" }} numberOfLines={1}>
          {refreshing ? "Refreshing" : "Ready"}
        </Text>
      </View>
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
