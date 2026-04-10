import { useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline } from "react-native-maps";

import { GradientCard } from "@/components/ui/gradient-card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { activeMission } from "@/lib/mock-data";
import { colors, radii, shadows, spacing, type StatusKey } from "@/lib/theme";

const totalStages = 4;

export default function MissionScreen() {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => [292, "74%"], []);
  const [missionStep, setMissionStep] = useState(1);
  const [riderProfileOpen, setRiderProfileOpen] = useState(false);

  const currentTarget =
    missionStep === 1
      ? activeMission.pickup
      : missionStep === 2
        ? activeMission.dropoff
        : missionStep === 3
          ? activeMission.dropoff
          : activeMission.pickup;

  const currentAction =
    missionStep === 1
      ? "Pickup Passenger"
      : missionStep === 2
        ? "Arrive at Facility"
        : missionStep === 3
          ? "Return Pickup"
          : "Arrive Home";

  const missionStatus: StatusKey =
    missionStep === 1
      ? "enRoute"
      : missionStep === 2 || missionStep === 3
        ? "inTransit"
        : "arrived";

  const stageBars = useMemo(() => new Array(totalStages).fill(0), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
      <MissionMap />

      <View
        style={{
          position: "absolute",
          top: insets.top + 16,
          left: 16,
          right: 16,
          gap: 8,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 12,
          }}
        >
          <Text selectable style={statusText}>
            9:41
          </Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <View style={hudPill(16)} />
            <View style={hudPill(8)} />
          </View>
        </View>

        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.8)",
            borderRadius: radii.md,
            borderCurve: "continuous",
            padding: 16,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            ...shadows.floating,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
            <Avatar initials="ER" size={40} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text selectable style={missionEyebrow}>
                  Active Mission
                </Text>
                <StatusBadge status={missionStatus} />
              </View>
              <Text selectable numberOfLines={1} style={missionTarget}>
                {currentTarget}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Text selectable style={etaLabel}>
              ETA
            </Text>
            <Text selectable style={etaValue}>
              {activeMission.eta}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={{
          position: "absolute",
          right: 16,
          bottom: 280,
          gap: 10,
        }}
      >
        <FloatingControl label="➤" />
        <FloatingControl label="◎" />
      </View>

      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        handleIndicatorStyle={{
          width: 48,
          height: 6,
          borderRadius: radii.pill,
          backgroundColor: colors.slate200,
        }}
        backgroundStyle={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: radii.xl,
          borderTopRightRadius: radii.xl,
        }}
        style={shadows.floating}
      >
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: 20,
            gap: spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Pressable onPress={() => setRiderProfileOpen(true)}>
                <Avatar initials="ER" size={56} />
              </Pressable>
              <View style={{ gap: 4 }}>
                <Text selectable style={sheetTitle}>
                  {activeMission.name}
                </Text>
                <Text selectable style={sheetSubtitle}>
                  {activeMission.type}
                </Text>
              </View>
            </View>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: radii.xs,
                backgroundColor: colors.surfaceLow,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.slate500, fontSize: 20 }}>⋯</Text>
            </View>
          </View>

          <View style={{ gap: 16 }}>
            <Text selectable style={stageHeader}>
              Mission Stages
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {stageBars.map((_, index) => (
                <View
                  key={index}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: radii.pill,
                    backgroundColor:
                      missionStep >= index + 1 ? colors.blue : colors.slate100,
                  }}
                />
              ))}
            </View>

            <View style={{ gap: 22, paddingTop: 8 }}>
              <StageRow
                active={missionStep === 1}
                complete={missionStep > 1}
                title="Pickup @ Home"
                value={activeMission.pickup}
              />
              <StageRow
                active={missionStep === 2}
                complete={missionStep > 2}
                title="Drop-off @ Facility"
                value={activeMission.dropoff}
              />

              <View
                style={{
                  paddingTop: 18,
                  borderTopWidth: 1,
                  borderTopColor: colors.slate100,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text style={{ color: colors.slate300, fontSize: 16 }}>↺</Text>
                <Text selectable style={returnLabel}>
                  Return Leg Details
                </Text>
              </View>
              <StageRow
                active={missionStep === 3}
                complete={missionStep > 3}
                title="Return Pickup"
                value={activeMission.dropoff}
              />
              <StageRow
                active={missionStep === 4}
                complete={false}
                title="Arrive Home"
                value={activeMission.pickup}
              />
            </View>
          </View>
        </BottomSheetScrollView>

        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: 14,
            paddingBottom: 26 + insets.bottom,
            backgroundColor: colors.surface,
            gap: 10,
          }}
        >
          <Pressable
            onPress={() =>
              setMissionStep((current) => (current < totalStages ? current + 1 : 1))
            }
          >
            <GradientCard padding={18}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Text style={primaryButtonText}>{currentAction}</Text>
                <Text style={primaryButtonText}>→</Text>
              </View>
            </GradientCard>
          </Pressable>
          <Pressable>
            <Text selectable style={emergencyText}>
              Emergency Assistance
            </Text>
          </Pressable>
        </View>
      </BottomSheet>

      <Modal
        visible={riderProfileOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRiderProfileOpen(false)}
      >
        <Pressable
          onPress={() => setRiderProfileOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(255,255,255,0.46)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={{
              height: "92%",
              backgroundColor: colors.surface,
              borderTopLeftRadius: radii.xl,
              borderTopRightRadius: radii.xl,
              borderCurve: "continuous",
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.xl,
              paddingBottom: spacing.xl,
            }}
          >
            <View style={{ alignItems: "center", gap: 24, paddingBottom: spacing.lg }}>
              <View style={modalHandle} />
              <Avatar initials="ER" size={96} />
              <View style={{ alignItems: "center", gap: 6 }}>
                <Text selectable style={profileName}>
                  {activeMission.name}
                </Text>
                <Text selectable style={profileTier}>
                  Tier 1 Passenger
                </Text>
              </View>
            </View>

            <ScrollView
              contentInsetAdjustmentBehavior="automatic"
              style={{ flex: 1 }}
              contentContainerStyle={{ gap: spacing.xl, paddingBottom: spacing.xl }}
              showsVerticalScrollIndicator={false}
            >
              <View style={medicalCard}>
                <Text selectable style={medicalTitle}>
                  Medical Protocols
                </Text>
                <Text selectable style={medicalBody}>
                  Vision impaired in left eye. Requires steady arm assistance during
                  boarding. Avoid heavy scent in vehicle.
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 14 }}>
                <ProfileTile label="Transit" value="Wheelchair" />
                <ProfileTile label="Age" value={activeMission.age} />
              </View>
            </ScrollView>

            <Pressable onPress={() => setRiderProfileOpen(false)}>
              <GradientCard padding={18}>
                <Text style={primaryButtonText}>Close Protocols</Text>
              </GradientCard>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MissionMap() {
  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={{
        latitude: 37.782,
        longitude: -122.413,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      }}
      showsUserLocation
      showsMyLocationButton={false}
    >
      <Marker
        coordinate={{ latitude: 37.788, longitude: -122.408 }}
        title="Pickup"
        description={activeMission.pickup}
        pinColor={colors.blue}
      />
      <Marker
        coordinate={{ latitude: 37.775, longitude: -122.42 }}
        title="Drop-off"
        description={activeMission.dropoff}
        pinColor={colors.green}
      />
      <Polyline
        coordinates={[
          { latitude: 37.788, longitude: -122.408 },
          { latitude: 37.786, longitude: -122.41 },
          { latitude: 37.783, longitude: -122.412 },
          { latitude: 37.78, longitude: -122.414 },
          { latitude: 37.778, longitude: -122.416 },
          { latitude: 37.776, longitude: -122.418 },
          { latitude: 37.775, longitude: -122.42 },
        ]}
        strokeColor={colors.blue}
        strokeWidth={4}
      />
    </MapView>
  );
}

function StageRow({
  active,
  complete,
  title,
  value,
}: {
  active: boolean;
  complete: boolean;
  title: string;
  value: string;
}) {
  const opacity = complete ? 0.45 : active ? 1 : 0.22;

  return (
    <View style={{ flexDirection: "row", gap: 16, opacity }}>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: radii.xs,
          backgroundColor: complete || active ? colors.blueSoft : colors.surfaceLow,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        {complete ? (
          <Text style={{ color: colors.blue, fontSize: 12, fontWeight: "900" }}>✓</Text>
        ) : active ? (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: radii.pill,
              backgroundColor: colors.blue,
            }}
          />
        ) : null}
      </View>
      <View style={{ gap: 4, flex: 1 }}>
        <Text selectable style={stageTitle}>
          {title}
        </Text>
        <Text selectable style={stageValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ProfileTile({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surfaceLow,
        borderRadius: radii.md,
        borderCurve: "continuous",
        padding: spacing.md,
        gap: 4,
      }}
    >
      <Text selectable style={tileLabel}>
        {label}
      </Text>
      <Text selectable style={tileValue}>
        {value}
      </Text>
    </View>
  );
}

function FloatingControl({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: radii.pill,
          backgroundColor: "rgba(255,255,255,0.7)",
          justifyContent: "center",
          alignItems: "center",
          ...shadows.floating,
        }}
      >
        <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "800" }}>{label}</Text>
      </View>
    </Pressable>
  );
}

function Avatar({ initials, size }: { initials: string; size: number }) {
  return (
    <GradientCard padding={0} borderRadius={size / 2}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          selectable
          style={{
            color: colors.surface,
            fontSize: size * 0.34,
            fontWeight: "900",
          }}
        >
          {initials}
        </Text>
      </View>
    </GradientCard>
  );
}

function hudPill(width: number) {
  return {
    width,
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  };
}

const statusText = {
  color: colors.primary,
  fontSize: 12,
  fontWeight: "900" as const,
};

const missionEyebrow = {
  color: colors.blue,
  fontSize: 10,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.5,
};

const missionTarget = {
  color: colors.primary,
  fontSize: 14,
  fontWeight: "800" as const,
};

const etaLabel = {
  color: colors.slate400,
  fontSize: 10,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
};

const etaValue = {
  color: colors.primary,
  fontSize: 15,
  fontWeight: "900" as const,
};

const sheetTitle = {
  color: colors.primary,
  fontSize: 30,
  fontWeight: "900" as const,
};

const sheetSubtitle = {
  color: colors.blue,
  fontSize: 10,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};

const stageHeader = {
  color: colors.slate400,
  fontSize: 10,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.5,
};

const returnLabel = {
  color: colors.slate300,
  fontSize: 10,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.5,
};

const stageTitle = {
  color: colors.slate500,
  fontSize: 11,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
};

const stageValue = {
  color: colors.primary,
  fontSize: 15,
  fontWeight: "800" as const,
};

const primaryButtonText = {
  color: colors.surface,
  fontSize: 13,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.8,
};

const emergencyText = {
  color: colors.slate400,
  fontSize: 10,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  textAlign: "center" as const,
  letterSpacing: 1.4,
};

const modalHandle = {
  width: 48,
  height: 5,
  borderRadius: radii.pill,
  backgroundColor: colors.slate200,
};

const profileName = {
  color: colors.primary,
  fontSize: 34,
  fontWeight: "900" as const,
  textAlign: "center" as const,
};

const profileTier = {
  color: colors.blue,
  fontSize: 11,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.4,
};

const medicalCard = {
  backgroundColor: "rgba(220, 38, 38, 0.06)",
  borderRadius: radii.md,
  borderCurve: "continuous" as const,
  padding: spacing.lg,
  gap: 10,
};

const medicalTitle = {
  color: colors.error,
  fontSize: 11,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
  letterSpacing: 1.3,
};

const medicalBody = {
  color: colors.primary,
  fontSize: 15,
  fontWeight: "700" as const,
  lineHeight: 22,
};

const tileLabel = {
  color: colors.slate400,
  fontSize: 10,
  fontWeight: "900" as const,
  textTransform: "uppercase" as const,
};

const tileValue = {
  color: colors.primary,
  fontSize: 16,
  fontWeight: "800" as const,
};
