import { View } from "react-native";
import { Marker } from "@/components/Map";

type Props = {
  latitude: number;
  longitude: number;
};

export function LocationDotMarker({ latitude, longitude }: Props) {
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View />
    </Marker>
  );
}
