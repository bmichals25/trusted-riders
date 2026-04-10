import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

import MapView, { Marker } from "@/components/Map";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { useLocation } from "@/lib/location-context";
import { colors, radii, spacing } from "@/lib/theme";

export function LocationIndicator() {
  const { location, isTracking } = useLocation();
  const { impact, selection } = useHaptics();
  const [mapOpen, setMapOpen] = useState(false);
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

  return (
    <>
      <Pressable
        onPress={() => {
          impact(ImpactFeedbackStyle.Light);
          setMapOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={isTracking ? "Location tracking active, tap to view map" : "Location tracking off"}
        style={{ paddingLeft: 12, paddingRight: 16, paddingVertical: 8, marginRight: 4, flexDirection: "row", alignItems: "center", gap: 6 }}
      >
        <Animated.View
          style={[
            {
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: isTracking ? colors.green : colors.slate300,
            },
            isTracking ? pulseStyle : undefined,
          ]}
        />
        <Text style={{ color: isTracking ? colors.green : colors.slate400, fontSize: 13, fontWeight: "600" }}>
          {isTracking ? "Live" : "Off"}
        </Text>
      </Pressable>

      <LocationMapModal
        visible={mapOpen}
        onClose={() => setMapOpen(false)}
      />
    </>
  );
}

function LocationMapModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
            showsUserLocation
            showsMyLocationButton
          >
            {location && (
              <Marker
                coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                title="You"
                pinColor={colors.blue}
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
