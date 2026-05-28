import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

import MapView from "@/components/Map";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { useLocation } from "@/lib/location-context";
import { colors, radii, spacing } from "@/lib/theme";
import { LocationDotMarker } from "./LocationDotMarker";

export function LocationIndicator({
  backendConnected = true,
  backendError,
  compact = false,
}: {
  backendConnected?: boolean;
  backendError?: string | null;
  compact?: boolean;
}) {
  const { impact } = useHaptics();
  const [mapOpen, setMapOpen] = useState(false);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (backendConnected) {
      pulseOpacity.value = withRepeat(
        withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      pulseOpacity.value = 1;
    }
  }, [backendConnected]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));
  const statusColor = backendConnected ? colors.green : colors.error;
  const statusLabel = backendConnected ? "Live" : "Offline";

  return (
    <>
      <Pressable
        onPress={() => {
          impact(ImpactFeedbackStyle.Light);
          setMapOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${statusLabel} status, tap to view map`}
        accessibilityHint={backendConnected ? "Opens the map with server connection status." : backendError ?? "Opens the map with server connection status."}
        hitSlop={8}
        style={({ pressed }) => ({
          minHeight: 40,
          minWidth: compact ? 40 : 74,
          paddingLeft: compact ? 10 : 12,
          paddingRight: compact ? 10 : 14,
          borderRadius: 999,
          backgroundColor: pressed ? colors.surfaceHigh : colors.surfaceLow,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          alignSelf: compact ? "flex-start" : "auto",
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <LiveDot color={statusColor} pulseStyle={backendConnected ? pulseStyle : undefined} />
        {compact ? null : (
          <Text style={{ color: statusColor, fontSize: 12, fontWeight: "900" }} numberOfLines={1}>
            {statusLabel}
          </Text>
        )}
      </Pressable>

      <LocationMapModal
        visible={mapOpen}
        onClose={() => setMapOpen(false)}
        backendConnected={backendConnected}
        backendError={backendError}
      />
    </>
  );
}

function LiveDot({
  color,
  pulseStyle,
}: {
  color: string;
  pulseStyle?: ReturnType<typeof useAnimatedStyle>;
}) {
  return (
    <Animated.View
      style={[
        {
          width: 16,
          height: 16,
          alignItems: "center",
          justifyContent: "center",
        },
        pulseStyle,
      ]}
    >
      <View
        style={{
          width: 11,
          height: 11,
          borderRadius: 5.5,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          width: 5,
          height: 5,
          borderRadius: 2.5,
          backgroundColor: colors.surface,
        }}
      />
    </Animated.View>
  );
}

/**
 * Composite headerRight used only on the home screen — pairs the live/off
 * pill with a gear that pushes to Settings. Other screens just render the
 * bare LocationIndicator (no gear) since they're already downstream of home.
 */
export function HomeHeaderRight() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <LocationIndicator />
      <SettingsIconButton />
    </View>
  );
}

export function SettingsIconButton() {
  const router = useRouter();
  const { impact } = useHaptics();
  return (
    <Pressable
      onPress={() => {
        impact(ImpactFeedbackStyle.Light);
        router.push("/settings");
      }}
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      hitSlop={8}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: radii.xs,
        backgroundColor: pressed ? colors.surfaceHigh : "transparent",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 4,
      })}
    >
      <GearGlyph />
    </Pressable>
  );
}

// Composed from primitive Views so it renders identically across web + iOS
// without pulling in an icon library. 8-spoke dispatch-console gear.
function GearGlyph() {
  const SIZE = 20;
  const SPOKE_W = 3;
  const SPOKE_H = 5;
  const color = colors.primary;
  const center = SIZE / 2;
  const ringOuter = 16;
  const ringInner = 10;
  const hubSize = 5;

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
      {/* 8 teeth arranged around the ring */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <View
          key={deg}
          style={{
            position: "absolute",
            top: center - SPOKE_H / 2,
            left: center - SPOKE_W / 2,
            width: SPOKE_W,
            height: SPOKE_H,
            backgroundColor: color,
            borderRadius: 0.5,
            transform: [
              { rotate: `${deg}deg` },
              { translateY: -ringOuter / 2 + 1 },
            ],
          }}
        />
      ))}
      {/* Outer ring (filled circle) */}
      <View
        style={{
          position: "absolute",
          width: ringOuter,
          height: ringOuter,
          borderRadius: ringOuter / 2,
          backgroundColor: color,
        }}
      />
      {/* Inner cutout to leave a ring */}
      <View
        style={{
          position: "absolute",
          width: ringInner,
          height: ringInner,
          borderRadius: ringInner / 2,
          backgroundColor: colors.surface,
        }}
      />
      {/* Hub */}
      <View
        style={{
          position: "absolute",
          width: hubSize,
          height: hubSize,
          borderRadius: hubSize / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function LocationMapModal({
  visible,
  onClose,
  backendConnected,
  backendError,
}: {
  visible: boolean;
  onClose: () => void;
  backendConnected: boolean;
  backendError?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const { impact, selection } = useHaptics();
  const { location, isTracking, startTracking, stopTracking } = useLocation();
  const mapRef = useRef<MapView | null>(null);

  const center = location
    ? { latitude: location.latitude, longitude: location.longitude }
    : { latitude: 37.782, longitude: -122.413 };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 12,
            paddingHorizontal: spacing.lg,
            backgroundColor: colors.surface,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "800" }}>
              My Location
            </Text>
            <Text style={{ color: isTracking ? colors.green : colors.slate400, fontSize: 13, fontWeight: "600" }}>
              {isTracking ? "Tracking active" : "Tracking off"}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              impact(ImpactFeedbackStyle.Light);
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Close location map"
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              backgroundColor: colors.surfaceLow,
              borderRadius: radii.sm,
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>Done</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={{
              ...center,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            region={location ? { ...center, latitudeDelta: 0.01, longitudeDelta: 0.01 } : undefined}
            showsUserLocation={false}
            showsMyLocationButton={false}
          >
            {location && (
              <LocationDotMarker
                latitude={location.latitude}
                longitude={location.longitude}
              />
            )}
          </MapView>
        </View>

        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.surface,
            gap: spacing.sm,
          }}
        >
          <View
            accessible
            accessibilityLabel={backendConnected ? "Server connected" : "Server disconnected"}
            style={{
              minHeight: 42,
              borderRadius: radii.sm,
              backgroundColor: backendConnected ? colors.greenSoft : colors.errorSoft,
              paddingHorizontal: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: backendConnected ? colors.green : colors.error,
              }}
            />
            <Text
              style={{
                color: backendConnected ? colors.green : colors.error,
                fontSize: 13,
                fontWeight: "800",
                flex: 1,
              }}
              numberOfLines={2}
            >
              {backendConnected ? "Server connected" : backendError ?? "Server disconnected"}
            </Text>
          </View>

          {location && (
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1, backgroundColor: colors.surfaceLow, borderRadius: radii.sm, padding: spacing.sm, gap: 2 }}>
                <Text style={{ color: colors.slate400, fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 }}>
                  Latitude
                </Text>
                <Text selectable style={{ color: colors.primary, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                  {location.latitude.toFixed(6)}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: colors.surfaceLow, borderRadius: radii.sm, padding: spacing.sm, gap: 2 }}>
                <Text style={{ color: colors.slate400, fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 }}>
                  Longitude
                </Text>
                <Text selectable style={{ color: colors.primary, fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
                  {location.longitude.toFixed(6)}
                </Text>
              </View>
            </View>
          )}

          <Pressable
            onPress={() => {
              selection();
              if (isTracking) {
                stopTracking();
              } else {
                startTracking();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={isTracking ? "Stop location tracking" : "Start location tracking"}
            style={{
              backgroundColor: isTracking ? colors.errorSoft : colors.greenSoft,
              borderRadius: radii.sm,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: isTracking ? colors.error : colors.green, fontSize: 13, fontWeight: "700" }}>
              {isTracking ? "Stop Tracking" : "Start Tracking"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
