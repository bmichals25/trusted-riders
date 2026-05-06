import { useEffect, useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDispatch, type RideStatusNotice } from "@/lib/dispatch-context";
import { NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { colors, radii } from "@/lib/theme";
import type { RideStatus } from "@/lib/rides";

const STATUS_LABELS: Record<RideStatus, string> = {
  pending: "pending",
  accepted: "accepted",
  en_route: "in progress",
  picked_up: "picked up",
  in_transit: "in transit",
  completed: "completed",
  cancelled: "cancelled",
};

function getNoticeTitle(notice: RideStatusNotice): string {
  if (notice.nextStatus === "en_route") return "Ride started";
  if (notice.nextStatus === "completed") return "Ride completed";
  if (notice.nextStatus === "cancelled") return "Ride cancelled";
  return "Ride status updated";
}

function getNoticeMessage(notice: RideStatusNotice): string {
  return `${notice.passengerName} changed from ${STATUS_LABELS[notice.previousStatus]} to ${STATUS_LABELS[notice.nextStatus]}.`;
}

export function RideStatusToast() {
  const { statusNotice, dismissStatusNotice } = useDispatch();
  const { notification } = useHaptics();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!statusNotice) return;

    notification(NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 220,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) dismissStatusNotice();
      });
    }, 6000);

    return () => clearTimeout(timer);
  }, [dismissStatusNotice, notification, opacity, statusNotice, translateY]);

  if (!statusNotice) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + 10,
        left: 16,
        right: 16,
        zIndex: 100,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${getNoticeTitle(statusNotice)}. ${getNoticeMessage(statusNotice)}`}
        onPress={dismissStatusNotice}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.slate200,
          borderRadius: radii.sm,
          borderWidth: 1,
          paddingHorizontal: 16,
          paddingVertical: 13,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.16,
          shadowRadius: 24,
          elevation: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: radii.pill,
              backgroundColor: statusNotice.nextStatus === "completed" ? colors.green : colors.blue,
            }}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "900" }}>
              {getNoticeTitle(statusNotice)}
            </Text>
            <Text style={{ color: colors.primarySoft, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
              {getNoticeMessage(statusNotice)}
            </Text>
          </View>
          <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "900" }}>
            OK
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
