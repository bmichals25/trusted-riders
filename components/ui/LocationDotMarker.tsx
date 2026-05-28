import { View } from "react-native";
import { Marker } from "react-native-maps";

import { colors } from "@/lib/theme";

type Props = {
  latitude: number;
  longitude: number;
  isTracking: boolean;
};

export function LocationDotMarker({ latitude, longitude, isTracking }: Props) {
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={20}
    >
      <View style={{ width: 26, height: 26, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: isTracking ? colors.green : colors.slate400,
            borderWidth: 3,
            borderColor: colors.surface,
          }}
        />
      </View>
    </Marker>
  );
}
