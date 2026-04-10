import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";

import { GradientCard } from "@/components/ui/gradient-card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { colors, radii, spacing } from "@/lib/theme";

const rideData: Record<string, {
  name: string;
  type: string;
  vehicle: string;
  time: string;
  pickup: string;
  dropoff: string;
  notes: string;
  emergencyContact: string;
  pickupCoords: { latitude: number; longitude: number };
  dropoffCoords: { latitude: number; longitude: number };
}> = {
  "#8829": {
    name: "Sarah Jenkins",
    type: "Physical Therapy",
    vehicle: "Sedan",
    time: "4:45 PM",
    pickup: "456 Oak Avenue",
    dropoff: "PT Solutions — 789 Health Blvd",
    notes: "Has difficulty with steps. Use side entrance at pickup. Prefers radio off.",
    emergencyContact: "David Jenkins (555-0342)",
    pickupCoords: { latitude: 37.785, longitude: -122.41 },
    dropoffCoords: { latitude: 37.775, longitude: -122.42 },
  },
  "#8830": {
    name: "Martin Lewis",
    type: "Cardiology Follow-Up",
    vehicle: "Wheelchair Van",
    time: "5:20 PM",
    pickup: "22 Birch Street",
    dropoff: "City Medical Center — Cardiology Wing",
    notes: "Oxygen tank must remain upright. Needs 5 extra minutes for boarding.",
    emergencyContact: "Angela Lewis (555-0187)",
    pickupCoords: { latitude: 37.79, longitude: -122.405 },
    dropoffCoords: { latitude: 37.77, longitude: -122.415 },
  },
};

export default function RideDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const ride = rideData[rideId] ?? rideData["#8829"];

  const midLat = (ride.pickupCoords.latitude + ride.dropoffCoords.latitude) / 2;
  const midLng = (ride.pickupCoords.longitude + ride.dropoffCoords.longitude) / 2;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.surfaceLow }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View style={{ height: 200, borderRadius: radii.md, overflow: "hidden", margin: spacing.md, borderCurve: "continuous" }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={{
            latitude: midLat,
            longitude: midLng,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
        >
          <Marker
            coordinate={ride.pickupCoords}
            title="Pickup"
            pinColor={colors.blue}
          />
          <Marker
            coordinate={ride.dropoffCoords}
            title="Drop-off"
            pinColor={colors.green}
          />
        </MapView>
      </View>

      <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <StatusBadge status="scheduled" />
            <Text style={{ color: colors.slate400, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5 }}>
              {ride.time}
            </Text>
          </View>
          <Text style={{ color: colors.primary, fontSize: 28, fontWeight: "900" }}>
            {ride.name}
          </Text>
          <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "600", textTransform: "uppercase" }}>
            {ride.type} — {ride.vehicle}
          </Text>
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderCurve: "continuous", overflow: "hidden" }}>
          <View style={{ padding: spacing.md, gap: 12 }}>
            <LocationRow color={colors.blue} label="Pickup" address={ride.pickup} />
            <View style={{ height: 1, backgroundColor: colors.slate100, marginLeft: 28 }} />
            <LocationRow color={colors.green} label="Drop-off" address={ride.dropoff} />
          </View>
        </View>

        <View style={{
          backgroundColor: "rgba(220, 38, 38, 0.06)",
          borderRadius: radii.md,
          borderCurve: "continuous",
          padding: spacing.md,
          gap: 8,
        }}>
          <Text style={{ color: colors.error, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.3 }}>
            Care Notes
          </Text>
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600", lineHeight: 20 }}>
            {ride.notes}
          </Text>
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderCurve: "continuous", padding: spacing.md, gap: 8 }}>
          <Text style={{ color: colors.slate400, fontSize: 10, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.3 }}>
            Emergency Contact
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "700" }}>
              {ride.emergencyContact}
            </Text>
            <View style={{ backgroundColor: colors.primary, borderRadius: radii.xs, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ color: colors.surface, fontSize: 11, fontWeight: "800" }}>Call</Text>
            </View>
          </View>
        </View>

        <Pressable onPress={() => router.push({ pathname: "/chat", params: { rideId, riderName: ride.name } })}>
          <GradientCard padding={16}>
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 }}>
              <Text style={{ color: colors.surface, fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5 }}>
                Admin Chat
              </Text>
              <Text style={{ color: colors.surface, fontSize: 13, fontWeight: "900" }}>→</Text>
            </View>
          </GradientCard>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function LocationRow({ color, label, address }: { color: string; label: string; address: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.slate400, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
          {label}
        </Text>
        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700" }}>
          {address}
        </Text>
      </View>
    </View>
  );
}
