import "react-native-gesture-handler";
import "react-native-reanimated";

import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { LocationIndicator } from "@/components/ui/LocationIndicator";
import { DispatchProvider } from "@/lib/dispatch-context";
import { HapticsProvider } from "@/lib/haptics-context";
import { LocationProvider } from "@/lib/location-context";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <DispatchProvider>
        <HapticsProvider>
        <LocationProvider>
        <StatusBar style="dark" />
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
            animation: "ios_from_right",
            animationDuration: 280,
            gestureEnabled: true,
            gestureDirection: "horizontal",
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: "TrustedRiders",
              animation: "fade",
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
              animationDuration: 350,
              gestureEnabled: true,
              gestureDirection: "vertical",
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              title: "Settings",
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="chat"
            options={{
              title: "Admin Chat",
              animation: "slide_from_bottom",
              animationDuration: 300,
              gestureDirection: "vertical",
            }}
          />
          <Stack.Screen
            name="ride-details"
            options={{ title: "Ride Details" }}
          />
          <Stack.Screen
            name="past-ride"
            options={{
              title: "Ride Summary",
              animation: "fade_from_bottom",
              animationDuration: 300,
            }}
          />
        </Stack>
        </LocationProvider>
        </HapticsProvider>
        </DispatchProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
