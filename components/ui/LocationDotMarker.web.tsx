import { View } from "react-native";
import { Marker } from "@/components/Map";
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
      // @ts-expect-error Web-only Map marker prop used by components/Map.web.tsx.
      pulseColor={isTracking ? colors.green : colors.slate400}
    >
      <View />
    </Marker>
  );
}
