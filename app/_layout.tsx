import "react-native-gesture-handler";
import "react-native-reanimated";

import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.surfaceLow },
            headerShadowVisible: false,
            headerTintColor: colors.primary,
            headerStyle: { backgroundColor: colors.surface },
            headerTitleStyle: {
              fontWeight: "800",
            },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: "TrustedRiders",
            }}
          />
          <Stack.Screen
            name="mission"
            options={{
              title: "Active Mission",
              headerTransparent: true,
              headerTintColor: colors.primary,
            }}
          />
          <Stack.Screen
            name="settings"
            options={{ title: "Settings" }}
          />
          <Stack.Screen
            name="chat"
            options={{ title: "Admin Chat" }}
          />
          <Stack.Screen
            name="ride-details"
            options={{ title: "Ride Details" }}
          />
          <Stack.Screen
            name="past-ride"
            options={{ title: "Ride Summary" }}
          />
        </Stack>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
