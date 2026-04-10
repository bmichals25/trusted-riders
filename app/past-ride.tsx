import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline } from "@/components/Map";

import { GradientCard } from "@/components/ui/gradient-card";
import { LocationRow } from "@/components/ui/LocationRow";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useHaptics } from "@/lib/haptics-context";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { colors, radii, spacing } from "@/lib/theme";

const pastRideData: Record<string, {
  name: string;
  type: string;
  date: string;
  duration: string;
  distance: string;
  rating: number;
  pickup: string;
  dropoff: string;
  fare: string;
  pickupCoords: { latitude: number; longitude: number };
  dropoffCoords: { latitude: number; longitude: number };
}> = {
  "William Chen": {
    name: "William Chen",
    type: "Dialysis Transfer",
    date: "Oct 24, 2023",
    duration: "34 min",
    distance: "8.2 mi",
    rating: 5,
    pickup: "88 Willow Court",
    dropoff: "Renal Care Center",
    fare: "$42.50",
    pickupCoords: { latitude: 37.788, longitude: -122.408 },
    dropoffCoords: { latitude: 37.772, longitude: -122.418 },
  },
  "Andrea Torres": {
    name: "Andrea Torres",
    type: "Physical Therapy",
    date: "Oct 22, 2023",
    duration: "22 min",
    distance: "5.1 mi",
    rating: 5,
    pickup: "14 Cypress Lane",
    dropoff: "PT Solutions",
    fare: "$28.00",
    pickupCoords: { latitude: 37.792, longitude: -122.402 },
    dropoffCoords: { latitude: 37.78, longitude: -122.412 },
  },
  "Maya Thompson": {
    name: "Maya Thompson",
    type: "Oncology Appointment",
    date: "Oct 20, 2023",
    duration: "41 min",
    distance: "12.3 mi",
    rating: 4,
    pickup: "302 Magnolia Drive",
    dropoff: "City Medical Center — Oncology",
    fare: "$56.75",
    pickupCoords: { latitude: 37.795, longitude: -122.4 },
    dropoffCoords: { latitude: 37.77, longitude: -122.42 },
  },
  "Jerome Patel": {
    name: "Jerome Patel",
    type: "Cardiology Follow-Up",
    date: "Oct 18, 2023",
    duration: "28 min",
    distance: "6.8 mi",
    rating: 5,
    pickup: "67 Elm Street",
    dropoff: "Heart & Vascular Institute",
    fare: "$35.25",
    pickupCoords: { latitude: 37.785, longitude: -122.405 },
    dropoffCoords: { latitude: 37.775, longitude: -122.415 },
  },
};

export default function PastRideScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { riderName } = useLocalSearchParams<{ riderName: string }>();
  const { impact } = useHaptics();
  const ride = pastRideData[riderName] ?? pastRideData["William Chen"];

  const midLat = (ride.pickupCoords.latitude + ride.dropoffCoords.latitude) / 2;
  const midLng = (ride.pickupCoords.longitude + ride.dropoffCoords.longitude) / 2;

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: colors.surfaceLow }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
    >
      <View style={{ height: 180, borderRadius: radii.md, overflow: "hidden", margin: spacing.md, borderCurve: "continuous" }}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={{
            latitude: midLat,
            longitude: midLng,
            latitudeDelta: 0.035,
            longitudeDelta: 0.035,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
        >
          <Marker coordinate={ride.pickupCoords} title="Pickup" pinColor={colors.blue} />
          <Marker coordinate={ride.dropoffCoords} title="Drop-off" pinColor={colors.green} />
          <Polyline
            coordinates={[ride.pickupCoords, ride.dropoffCoords]}
            strokeColor={colors.blue}
            strokeWidth={3}
          />
        </MapView>
      </View>

      <View style={{ paddingHorizontal: spacing.md, gap: spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ gap: 6, flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <StatusBadge status="completed" />
              <Text style={{ color: colors.slate400, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1.5 }}>
                {ride.date}
              </Text>
            </View>
            <Text style={{ color: colors.primary, fontSize: 28, fontWeight: "900" }}>
              {ride.name}
            </Text>
            <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "500", textTransform: "uppercase" }}>
              {ride.type}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Text style={{ color: colors.primary, fontSize: 24, fontWeight: "900" }}>
              {ride.fare}
            </Text>
            <Text style={{ color: colors.slate400, fontSize: 12, fontWeight: "600", textTransform: "uppercase" }}>
              Fare
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatTile label="Duration" value={ride.duration} />
          <StatTile label="Distance" value={ride.distance} />
          <StatTile label="Rating" value={"★".repeat(ride.rating)} />
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, borderCurve: "continuous", overflow: "hidden" }}>
          <View style={{ padding: spacing.md, gap: 12 }}>
            <LocationRow color={colors.blue} label="Pickup" address={ride.pickup} />
            <View style={{ height: 1, backgroundColor: colors.slate100, marginLeft: 28 }} />
            <LocationRow color={colors.green} label="Drop-off" address={ride.dropoff} />
          </View>
        </View>

        <Pressable onPress={() => { impact(ImpactFeedbackStyle.Light); router.push({ pathname: "/chat", params: { rideId: "past", riderName: ride.name } }); }} accessibilityRole="button" accessibilityLabel="View chat history">
          <GradientCard padding={16}>
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 }}>
              <Text style={{ color: colors.surface, fontSize: 14, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5 }}>
                View Chat History
              </Text>
              <Text style={{ color: colors.surface, fontSize: 14, fontWeight: "800" }}>→</Text>
            </View>
          </GradientCard>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderCurve: "continuous",
      padding: spacing.md,
      alignItems: "center",
      gap: 4,
    }}>
      <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "700" }}>
        {value}
      </Text>
      <Text style={{ color: colors.slate400, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Text>
    </View>
  );
}
