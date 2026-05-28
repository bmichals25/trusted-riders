import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
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
import { sendGpsCommandMessage } from "@/lib/chat-api";
import { colors, radii, spacing } from "@/lib/theme";
import { LocationDotMarker } from "./LocationDotMarker";

export function LocationIndicator({
  backendConnected = true,
  backendError,
  compact = false,
  openRequestKey,
  visible = true,
}: {
  backendConnected?: boolean;
  backendError?: string | null;
  compact?: boolean;
  openRequestKey?: number;
  visible?: boolean;
}) {
  const { impact } = useHaptics();
  const { isTracking } = useLocation();
  const [mapOpen, setMapOpen] = useState(false);
  const lastOpenRequestKeyRef = useRef(openRequestKey);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (isTracking) {
      pulseOpacity.value = withRepeat(
        withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      pulseOpacity.value = 1;
    }
  }, [isTracking]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));
  const statusColor = isTracking ? colors.green : colors.slate400;
  const statusLabel = isTracking ? "Tracking active" : "Tracking off";

  useEffect(() => {
    if (openRequestKey === undefined || lastOpenRequestKeyRef.current === openRequestKey) return;

    lastOpenRequestKeyRef.current = openRequestKey;
    setMapOpen(true);
  }, [openRequestKey]);

  return (
    <>
      {visible ? (
        <Pressable
          onPress={() => {
            impact(ImpactFeedbackStyle.Light);
            setMapOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${statusLabel} status, tap to view map`}
          accessibilityHint={backendConnected ? "Opens the map with tracking and server status." : backendError ?? "Opens the map with tracking and server status."}
          hitSlop={8}
          style={({ pressed }) => ({
            minHeight: 40,
            minWidth: 28,
            paddingHorizontal: 8,
            borderRadius: 999,
            backgroundColor: pressed ? colors.surfaceLow : "transparent",
            alignItems: "center",
            justifyContent: "center",
            alignSelf: compact ? "flex-start" : "auto",
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <LiveDot color={statusColor} pulseStyle={isTracking ? pulseStyle : undefined} />
        </Pressable>
      ) : null}

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
          width: 14,
          height: 14,
          alignItems: "center",
          justifyContent: "center",
        },
        pulseStyle,
      ]}
    >
      <View
        style={{
          width: 9,
          height: 9,
          borderRadius: 4.5,
          backgroundColor: color,
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
  const {
    location,
    isTracking,
    hasAlwaysLocationAccess,
    error: locationError,
    startTracking,
    stopTracking,
  } = useLocation();
  const mapRef = useRef<MapView | null>(null);

  const center = location
    ? { latitude: location.latitude, longitude: location.longitude }
    : { latitude: 37.782, longitude: -122.413 };
  const trackingLabel = isTracking ? "Broadcasting" : "Paused";
  const backgroundLabel = hasAlwaysLocationAccess ? "Always ready" : "Needs Always";
  const statusTone = isTracking ? colors.green : colors.slate400;

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
            alignItems: "flex-start",
            gap: spacing.md,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "900", lineHeight: 27 }}>
              Live Location
            </Text>
            <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "800", lineHeight: 18 }} numberOfLines={2}>
              {isTracking
                ? "Dispatch is receiving GPS updates for the active ride."
                : "Tracking stays off until approved by the chaperone or dispatch."}
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
              minWidth: 54,
              minHeight: 38,
              paddingHorizontal: 14,
              backgroundColor: colors.surfaceLow,
              borderRadius: radii.sm,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "900" }}>Done</Text>
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
                isTracking={isTracking}
              />
            )}
          </MapView>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: spacing.md,
              right: spacing.md,
              top: spacing.md,
              borderRadius: radii.md,
              backgroundColor: colors.surfaceFrosted,
              borderWidth: 1,
              borderColor: colors.ghostBorder,
              padding: spacing.sm,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radii.sm,
                backgroundColor: isTracking ? colors.greenSoft : colors.slate100,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SymbolView
                name="location.fill"
                size={17}
                type="hierarchical"
                tintColor={isTracking ? colors.greenStrong : colors.primarySoft}
                weight="semibold"
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "900" }} numberOfLines={1}>
                {trackingLabel}
              </Text>
              <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "800" }} numberOfLines={1}>
                Background: {backgroundLabel}
              </Text>
            </View>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusTone }} />
          </View>
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
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TelemetryPill
              label="Tracking"
              value={trackingLabel}
              tone={isTracking ? "good" : "muted"}
            />
            <TelemetryPill
              label="Background"
              value={backgroundLabel}
              tone={hasAlwaysLocationAccess ? "good" : "warning"}
            />
          </View>

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

          {locationError ? (
            <Text style={{ color: colors.amberStrong, fontSize: 12, fontWeight: "800", lineHeight: 17 }}>
              {locationError}
            </Text>
          ) : (
            <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "800", lineHeight: 17 }}>
              Always permission is required when tracking is active so dispatch keeps receiving updates while the phone is locked.
            </Text>
          )}

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
                void sendGpsCommandMessage("gps_off").catch((error) => {
                  console.log("[location] gps_off command failed", error instanceof Error ? error.message : error);
                });
              } else {
                void startTracking().then((trackingStarted) => {
                  if (trackingStarted) {
                    void sendGpsCommandMessage("gps_yes").catch((error) => {
                      console.log("[location] gps_yes command failed", error instanceof Error ? error.message : error);
                    });
                  }
                });
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={isTracking ? "Stop location tracking" : "Start location tracking"}
            style={{
              minHeight: 52,
              backgroundColor: isTracking ? colors.errorSoft : colors.green,
              borderRadius: radii.sm,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: isTracking ? colors.error : colors.surface, fontSize: 15, fontWeight: "900" }}>
              {isTracking ? "Stop Live Tracking" : "Start Live Tracking"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function TelemetryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warning" | "muted";
}) {
  const palette = tone === "good"
    ? { bg: colors.greenSoft, value: colors.greenStrong }
    : tone === "warning"
      ? { bg: colors.amberSoft, value: colors.amberStrong }
      : { bg: colors.surfaceLow, value: colors.primarySoft };

  return (
    <View
      style={{
        flex: 1,
        minHeight: 52,
        borderRadius: radii.sm,
        backgroundColor: palette.bg,
        paddingHorizontal: spacing.sm,
        justifyContent: "center",
        gap: 2,
      }}
    >
      <Text style={{ color: colors.slate500, fontSize: 10, fontWeight: "900", letterSpacing: 0.9, textTransform: "uppercase" }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color: palette.value, fontSize: 13, fontWeight: "900" }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
