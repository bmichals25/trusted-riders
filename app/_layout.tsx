import "react-native-gesture-handler";
import "react-native-reanimated";

import { Stack, useGlobalSearchParams, usePathname } from "expo-router";
import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo } from "react";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { DriverNameGate } from "@/components/ui/DriverNameGate";
import { DispatchMessageToast } from "@/components/ui/DispatchMessageToast";
import { LocationSetupGate } from "@/components/ui/LocationSetupGate";
import { RideStatusToast } from "@/components/ui/RideStatusToast";
import { DispatchProvider } from "@/lib/dispatch-context";
import { HapticsProvider } from "@/lib/haptics-context";
import { LocationProvider } from "@/lib/location-context";
import { rememberNonChatHref } from "@/lib/navigation-memory";
import { colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppErrorBoundary>
        <DriverNameGate>
          {(driverSession) => (
            <LocationProvider>
            <HapticsProvider>
            <DispatchProvider
              driverName={driverSession.name}
            >
            <StatusBar style="dark" />
            <NavigationMemory />
            <LocationSetupGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="chat"
                options={{
                  animation: "ios_from_right",
                  animationDuration: 280,
                  animationTypeForReplace: "pop",
                  contentStyle: { backgroundColor: colors.surface },
                  gestureEnabled: true,
                  gestureDirection: "horizontal",
                }}
              />
              <Stack.Screen name="ride-requests" />
              <Stack.Screen name="ride-details" />
              <Stack.Screen name="settings/location" />
              <Stack.Screen name="settings/app" />
              <Stack.Screen name="settings/account" />
            </Stack>
            </LocationSetupGate>
            <RideStatusToast />
            <DispatchMessageToast />
            </DispatchProvider>
            </HapticsProvider>
            </LocationProvider>
          )}
        </DriverNameGate>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}

function NavigationMemory() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const href = useMemo(() => {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (key === "returnTo") continue;
      if (Array.isArray(value)) {
        for (const item of value) query.append(key, String(item));
      } else if (value !== undefined) {
        query.set(key, String(value));
      }
    }

    const queryString = query.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }, [params, pathname]);

  useEffect(() => {
    if (!pathname || pathname === "/chat" || pathname.endsWith("/messages")) return;
    rememberNonChatHref(href);
  }, [href, pathname]);

  return null;
}

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state = { message: null };

  static getDerivedStateFromError(error: unknown) {
    return {
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.log("[app] render error", error, info.componentStack);
  }

  render() {
    if (!this.state.message) return this.props.children;

    return (
      <View
        accessibilityRole="alert"
        style={{
          flex: 1,
          backgroundColor: colors.surfaceLow,
          padding: 24,
          justifyContent: "center",
          gap: 14,
        }}
      >
        <Text style={{ color: colors.error, fontSize: 13, fontWeight: "900", textTransform: "uppercase" }}>
          App render error
        </Text>
        <Text style={{ color: colors.primary, fontSize: 24, fontWeight: "900", lineHeight: 30 }}>
          Something prevented the app from rendering.
        </Text>
        <Text selectable style={{ color: colors.slate500, fontSize: 15, fontWeight: "700", lineHeight: 22 }}>
          {this.state.message}
        </Text>
      </View>
    );
  }
}
