import { useEffect } from "react";
import { View } from "react-native";
import { Marker } from "react-native-maps";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { colors } from "@/lib/theme";

type Props = {
  latitude: number;
  longitude: number;
  heading: number | null;
};

export function AnimatedDriverMarker({ latitude, longitude, heading }: Props) {
  const animLat = useSharedValue(latitude);
  const animLng = useSharedValue(longitude);
  const animHeading = useSharedValue(heading ?? 0);

  useEffect(() => {
    animLat.value = withTiming(latitude, {
      duration: 1000,
      easing: Easing.linear,
    });
    animLng.value = withTiming(longitude, {
      duration: 1000,
      easing: Easing.linear,
    });
  }, [latitude, longitude, animLat, animLng]);

  useEffect(() => {
    if (heading != null) {
      animHeading.value = withTiming(heading, {
        duration: 500,
        easing: Easing.out(Easing.quad),
      });
    }
  }, [heading, animHeading]);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${animHeading.value}deg` }],
  }));

  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
    >
      <View style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
        {/* Outer pulse ring */}
        <View
          style={{
            position: "absolute",
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: "rgba(37, 99, 235, 0.15)",
          }}
        />
        {/* Inner dot */}
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: colors.blue,
            borderWidth: 3,
            borderColor: colors.surface,
            zIndex: 1,
          }}
        />
        {/* Heading arrow */}
        <Animated.View
          style={[
            {
              position: "absolute",
              top: -4,
              width: 0,
              height: 0,
              borderLeftWidth: 5,
              borderRightWidth: 5,
              borderBottomWidth: 8,
              borderLeftColor: "transparent",
              borderRightColor: "transparent",
              borderBottomColor: colors.blue,
            },
            arrowStyle,
          ]}
        />
      </View>
    </Marker>
  );
}
