import "react-native-gesture-handler";
import "react-native-reanimated";

import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image, Pressable, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackChevron } from "@/components/ui/BackChevron";
import { DriverNameGate } from "@/components/ui/DriverNameGate";
import { HomeHeaderRight, LocationIndicator } from "@/components/ui/LocationIndicator";
import { LocationSetupGate } from "@/components/ui/LocationSetupGate";
import { RideAssignmentAlert } from "@/components/ui/RideAssignmentAlert";
import { RideStatusToast } from "@/components/ui/RideStatusToast";
import { useDispatch, DispatchProvider } from "@/lib/dispatch-context";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { HapticsProvider } from "@/lib/haptics-context";
import { useHaptics } from "@/lib/haptics-context";
import { LocationProvider } from "@/lib/location-context";
import { colors, radii, shadows } from "@/lib/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <DriverNameGate>
          {(driverSession) => (
            <LocationProvider>
            <HapticsProvider>
            <DispatchProvider driverName={driverSession.name} driverId={driverSession.id}>
            <StatusBar style="dark" />
            <LocationSetupGate>
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: colors.surfaceLow },
                headerShadowVisible: false,
                headerTintColor: colors.primary,
                headerStyle: { backgroundColor: colors.surface },
                headerTitleStyle: {
                  fontWeight: "900",
                  fontSize: 28,
                },
                headerRight: () => <LocationIndicator />,
                headerLeft: () => <BackChevron />,
                headerBackVisible: false,
                animation: "ios_from_right",
                animationDuration: 380,
                gestureEnabled: true,
                gestureDirection: "horizontal",
              }}
            >
              <Stack.Screen
                name="index"
                options={{
                  title: "",
                  header: () => <HomeHeader />,
                  animation: "fade",
                  animationDuration: 420,
                }}
              />
              <Stack.Screen
                name="mission"
                options={{
                  title: "Active Mission",
                  headerTransparent: true,
                  headerTintColor: colors.primary,
                  headerRight: () => <MissionMessageButton />,
                  presentation: "fullScreenModal",
                  animation: "slide_from_bottom",
                  animationDuration: 440,
                  gestureEnabled: true,
                  gestureDirection: "vertical",
                }}
              />
              <Stack.Screen
                name="settings"
                options={{
                  title: "Settings",
                  animation: "slide_from_right",
                  animationDuration: 400,
                  gestureEnabled: true,
                  gestureDirection: "horizontal",
                }}
              />
              <Stack.Screen
                name="scan-qr"
                options={{
                  title: "Scan QR",
                  presentation: "fullScreenModal",
                  animation: "slide_from_bottom",
                  animationDuration: 400,
                  headerTransparent: true,
                  headerTintColor: colors.surface,
                  headerRight: () => null,
                  gestureEnabled: true,
                  gestureDirection: "vertical",
                }}
              />
              <Stack.Screen
                name="chat"
                options={{
                  title: "Admin Chat",
                  animation: "slide_from_bottom",
                  animationDuration: 400,
                  gestureDirection: "vertical",
                }}
              />
              <Stack.Screen
                name="ride-details"
                options={{
                  title: "Ride Details",
                  animation: "slide_from_right",
                  animationDuration: 400,
                }}
              />
              <Stack.Screen
                name="past-ride"
                options={{
                  title: "Ride Summary",
                  animation: "fade_from_bottom",
                  animationDuration: 400,
                }}
              />
              <Stack.Screen
                name="info"
                options={{
                  title: "Info",
                  animation: "slide_from_right",
                  animationDuration: 400,
                }}
              />
            </Stack>
            </LocationSetupGate>
            <RideAssignmentAlert />
            <RideStatusToast />
            </DispatchProvider>
            </HapticsProvider>
            </LocationProvider>
          )}
        </DriverNameGate>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

function MissionMessageButton() {
  const router = useRouter();
  const { activeRide } = useDispatch();
  const { impact } = useHaptics();

  return (
    <Pressable
      onPress={() => {
        impact(ImpactFeedbackStyle.Light);
        router.push({
          pathname: "/chat",
          params: {
            rideId: activeRide?.id ?? "",
            riderName: activeRide?.passengerName ?? "Mission Dispatch",
          },
        });
      }}
      accessibilityRole="button"
      accessibilityLabel="Open mission dispatch messages"
      hitSlop={10}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radii.pill,
        backgroundColor: colors.surfaceFrosted,
        borderWidth: 1,
        borderColor: colors.slate200,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 4,
        opacity: pressed ? 0.68 : 1,
        ...shadows.soft,
      })}
    >
      <MessageGlyph />
    </Pressable>
  );
}

function MessageGlyph() {
  return (
    <View
      style={{
        width: 19,
        height: 15,
        borderWidth: 2,
        borderColor: colors.primary,
        borderRadius: 5,
        position: "relative",
      }}
    >
      <View
        style={{
          position: "absolute",
          left: 3,
          bottom: -5,
          width: 8,
          height: 8,
          backgroundColor: colors.surfaceFrosted,
          borderLeftWidth: 2,
          borderBottomWidth: 2,
          borderColor: colors.primary,
          transform: [{ rotate: "-35deg" }],
        }}
      />
      <Text
        style={{
          color: colors.primary,
          fontSize: 12,
          fontWeight: "900",
          lineHeight: 11,
          textAlign: "center",
          marginTop: -1,
        }}
      >
        ···
      </Text>
    </View>
  );
}

function HomeHeader() {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        paddingTop: insets.top + 10,
        paddingBottom: 16,
        paddingHorizontal: 24,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <Image
        source={require("../assets/TR_logo.png")}
        accessibilityLabel="TrustedRiders"
        resizeMode="contain"
        style={{ width: 170, height: 39, flexShrink: 1 }}
      />
      <HomeHeaderRight />
    </View>
  );
}
