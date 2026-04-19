import "react-native-gesture-handler";
import "react-native-reanimated";

import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { BackChevron } from "@/components/ui/BackChevron";
import { DriverNameGate } from "@/components/ui/DriverNameGate";
import { HomeHeaderRight, LocationIndicator } from "@/components/ui/LocationIndicator";
import { LocationSetupGate } from "@/components/ui/LocationSetupGate";
import { DispatchProvider } from "@/lib/dispatch-context";
import { HapticsProvider } from "@/lib/haptics-context";
import { LocationProvider } from "@/lib/location-context";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <DriverNameGate>
          {(driverName) => (
            <LocationProvider>
            <HapticsProvider>
            <DispatchProvider driverName={driverName}>
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
                  title: "TrustedRiders",
                  // Replace the wordmark text with the brand logo image.
                  // Height fixed at 32, width derived from the asset's natural
                  // 616×140 aspect ratio (≈4.4:1) so the logo reads cleanly
                  // in the nav bar without cropping or distortion.
                  headerTitle: () => (
                    <Image
                      source={require("../assets/TR_logo.png")}
                      accessibilityLabel="TrustedRiders"
                      resizeMode="contain"
                      // 616×140 natural size → preserved aspect ratio at 44px tall.
                      style={{ width: 194, height: 44 }}
                    />
                  ),
                  // Home is the only screen that surfaces the Settings gear.
                  headerRight: () => <HomeHeaderRight />,
                  animation: "fade",
                  animationDuration: 420,
                  // Home is the root — no back affordance.
                  headerLeft: () => null,
                }}
              />
              <Stack.Screen
                name="mission"
                options={{
                  title: "Active Mission",
                  headerTransparent: true,
                  headerTintColor: colors.primary,
                  headerRight: () => null,
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
            </DispatchProvider>
            </HapticsProvider>
            </LocationProvider>
          )}
        </DriverNameGate>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
