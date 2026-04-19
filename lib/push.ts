// Push notification registration for the TrustedRiders operator app.
//
// On a real device:
//   1. ask for notification permission (OS prompt)
//   2. fetch an Expo push token (proxies to APNs on iOS, FCM on Android)
//   3. POST the token to the Flask backend so dispatch can push us rides
//
// Simulators/emulators return `null` silently — they can't receive APNs pushes.

import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { registerPushToken } from "./fleet-api";

// Foreground behavior — when a push lands while the app is open we still want
// the banner and sound to fire so the driver notices a new ride.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Matches the `expo.extra.eas.projectId` in app.json. Hardcoded so a plain
// file read (not a runtime Constants call) gives us the value the push
// service expects.
const EAS_PROJECT_ID = "9b68846e-95f5-471a-95d1-452666314e18";

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({
      projectId: EAS_PROJECT_ID,
    });
    // Fire-and-forget — if the backend doesn't yet accept the endpoint, the
    // client silently succeeds so this doesn't block the login flow.
    void registerPushToken(data);
    return data;
  } catch {
    return null;
  }
}
