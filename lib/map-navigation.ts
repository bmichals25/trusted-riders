import { ActionSheetIOS, Alert, Linking, Platform } from "react-native";

import { type DispatchedRide } from "@/lib/rides";

type MapProvider = {
  label: string;
  url: string;
};

export function showMapProviderOptionsForRide(ride: DispatchedRide) {
  void showAvailableMapProviderOptionsForRide(ride);
}

async function showAvailableMapProviderOptionsForRide(ride: DispatchedRide) {
  const providers = await availableMapProvidersForRide(ride);

  if (!providers.length) {
    Alert.alert("No map apps found", "No supported map apps are available on this device.");
    return;
  }

  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Choose map provider",
        message: ride.dropoffAddress,
        options: [...providers.map((provider) => provider.label), "Cancel"],
        cancelButtonIndex: providers.length,
      },
      (buttonIndex) => {
        const provider = providers[buttonIndex];
        if (!provider) return;
        openMapProvider(provider);
      },
    );
    return;
  }

  Alert.alert(
    "Choose map provider",
    ride.dropoffAddress,
    [
      ...providers.map((provider) => ({
        text: provider.label,
        onPress: () => openMapProvider(provider),
      })),
      { text: "Cancel", style: "cancel" as const },
    ],
    { cancelable: true },
  );
}

export async function availableMapProvidersForRide(ride: DispatchedRide): Promise<MapProvider[]> {
  const providers = mapProvidersForRide(ride);
  const availability = await Promise.all(
    providers.map(async (provider) => ({
      provider,
      available: await Linking.canOpenURL(provider.url).catch(() => false),
    })),
  );
  return availability
    .filter((item) => item.available)
    .map((item) => item.provider);
}

function openMapProvider(provider: MapProvider) {
  void Linking.openURL(provider.url).catch(() => {
    Alert.alert("Map unavailable", `Could not open ${provider.label}.`);
  });
}

function mapProvidersForRide(ride: DispatchedRide): MapProvider[] {
  const destination = ride.dropoffCoords
    ? `${ride.dropoffCoords.latitude},${ride.dropoffCoords.longitude}`
    : ride.dropoffAddress;
  const encodedDestination = encodeURIComponent(destination);
  const providers: MapProvider[] = [];

  if (Platform.OS === "ios") {
    providers.push({
      label: "Apple Maps",
      url: `http://maps.apple.com/?daddr=${encodedDestination}&dirflg=d`,
    });
  }

  if (Platform.OS === "android") {
    providers.push({
      label: "Google Maps",
      url: `google.navigation:q=${encodedDestination}`,
    });
  } else {
    providers.push({
      label: "Google Maps",
      url: `comgooglemaps://?daddr=${encodedDestination}&directionsmode=driving`,
    });
  }

  providers.push({
    label: "Waze",
    url: `waze://?q=${encodedDestination}&navigate=yes`,
  });

  return providers;
}
