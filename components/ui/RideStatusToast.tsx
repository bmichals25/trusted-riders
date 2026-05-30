import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
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
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!statusNotice) return;

    notification(NotificationFeedbackType.Success);
    translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
    opacity.value = withTiming(1, { duration: 180 });

    const timer = setTimeout(() => {
      translateY.value = withTiming(-120, { duration: 180 });
      opacity.value = withTiming(0, { duration: 160 }, (finished) => {
        if (finished) runOnJS(dismissStatusNotice)();
      });
    }, 6000);

    return () => clearTimeout(timer);
  }, [dismissStatusNotice, notification, opacity, statusNotice, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!statusNotice) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: "absolute",
          top: insets.top + 10,
          left: 16,
          right: 16,
          zIndex: 100,
        },
        animatedStyle,
      ]}
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
          boxShadow: "0px 10px 24px rgba(15, 23, 42, 0.16)",
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
