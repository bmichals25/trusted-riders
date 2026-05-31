import { useMemo, useState } from "react";
import { Pressable, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocationIndicator } from "@/components/ui/LocationIndicator";
import { useDispatch } from "@/lib/dispatch-context";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { useLocation } from "@/lib/location-context";
import { colors, radii, spacing } from "@/lib/theme";

const BRAND_NAME = "TrustedRide Certified";
const LOGO_SOURCE = require("../../assets/trustedride_certified_main_logo_transparent.png");
const LOGO_ASPECT_RATIO = 1409 / 427;
const HEADER_ACTIONS_RESERVED_WIDTH = 48;
const LOGO_OPTICAL_OFFSET_X = -12;

export function HomeBrandHeader({
  backendConnected,
  backendError,
}: {
  backendConnected: boolean;
  backendError: string | null;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { impact } = useHaptics();
  const { clearDispatchUnreadMessages, unreadDispatchMessageCount } = useDispatch();
  const { isTracking } = useLocation();
  const [liveTrackerOpenRequest, setLiveTrackerOpenRequest] = useState(0);
  const compact = width < 430;

  const logoSize = useMemo(() => {
    const centeredAvailableWidth = width - spacing.md * 2 - HEADER_ACTIONS_RESERVED_WIDTH * 2;
    const logoWidth = Math.max(172, Math.min(centeredAvailableWidth, compact ? 184 : 240));

    return {
      width: logoWidth,
      height: Math.round(logoWidth / LOGO_ASPECT_RATIO),
    };
  }, [compact, width]);
  // Keep just enough slack around the logo to clear the 44pt action buttons.
  const headerHeight = Math.max(44, logoSize.height + (compact ? 6 : 10));

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        paddingTop: insets.top + 3,
        paddingBottom: compact ? 7 : 9,
        paddingHorizontal: spacing.md,
      }}
    >
      <View
        style={{
          minHeight: headerHeight,
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Pressable
          onPress={() => {
            impact(ImpactFeedbackStyle.Light);
            setLiveTrackerOpenRequest((request) => request + 1);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${BRAND_NAME}, open live tracker`}
          hitSlop={8}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1,
          }}
        >
          <Image
            source={LOGO_SOURCE}
            accessibilityIgnoresInvertColors
            contentFit="contain"
            style={{
              width: logoSize.width,
              height: logoSize.height,
              flexShrink: 0,
              transform: [{ translateX: LOGO_OPTICAL_OFFSET_X }],
            }}
          />
        </Pressable>
        <View
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            zIndex: 2,
            gap: spacing.sm,
          }}
        >
          <Pressable
            onPress={() => {
              impact(ImpactFeedbackStyle.Light);
              setLiveTrackerOpenRequest((request) => request + 1);
            }}
            accessibilityRole="button"
            accessibilityLabel={isTracking ? "Live location tracking is on" : "Live location tracking is off"}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 44,
              height: 44,
              borderRadius: radii.pill,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <View
              style={{
                width: 13,
                height: 13,
                borderRadius: 6.5,
                backgroundColor: isTracking ? colors.green : colors.slate400,
                borderColor: colors.surface,
                borderWidth: 2,
              }}
            />
          </Pressable>
          <DispatchChatButton
            unreadCount={unreadDispatchMessageCount}
            onPress={() => {
              impact(ImpactFeedbackStyle.Light);
              clearDispatchUnreadMessages();
              router.push("/chat");
            }}
          />
        </View>
        <LocationIndicator
          backendConnected={backendConnected}
          backendError={backendError}
          compact={compact}
          openRequestKey={liveTrackerOpenRequest}
          visible={false}
        />
      </View>
    </View>
  );
}

function DispatchChatButton({ onPress, unreadCount }: { onPress: () => void; unreadCount: number }) {
  const visibleUnreadCount = Math.min(unreadCount, 99);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        unreadCount > 0
          ? `Open dispatch messages, ${visibleUnreadCount} unread`
          : "Open dispatch messages"
      }
      hitSlop={8}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radii.pill,
        backgroundColor: pressed ? colors.surfaceLow : "transparent",
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <MessageGlyph />
      {unreadCount > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 8,
            right: 6,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            paddingHorizontal: 5,
            backgroundColor: colors.blue,
            borderWidth: 2,
            borderColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.surface, fontSize: 10, fontWeight: "900", lineHeight: 12 }}>
            {visibleUnreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function MessageGlyph() {
  return (
    <View
      style={{
        width: 18,
        height: 15,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: colors.blue,
        transform: [{ translateY: -1 }],
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 3,
          bottom: -5,
          width: 8,
          height: 8,
          borderLeftWidth: 2,
          borderBottomWidth: 2,
          borderColor: colors.blue,
          backgroundColor: colors.surfaceLow,
          transform: [{ rotate: "-35deg" }],
        }}
      />
    </View>
  );
}
