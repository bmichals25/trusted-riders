// Push notification registration for the TrustedRiders operator app.
//
// On a real device:
//   1. ask for notification permission (OS prompt)
//   2. fetch an Expo push token (proxies to APNs on iOS, FCM on Android)
//   3. POST the token to the Flask backend so dispatch can push us rides
//
// Simulators/emulators return `null` silently — they can't receive APNs pushes.
//
// We deliberately do NOT import expo-notifications at module scope — an
// uncaught exception during that module's native init would crash the app
// before the auth gate could render. Instead we lazy-require inside the
// registration function and wrap it in try/catch so a push-subsystem failure
// never blocks app launch.

import { registerPushToken } from "./fleet-api";

// Matches the `expo.extra.eas.projectId` in app.json.
const EAS_PROJECT_ID = "9b68846e-95f5-471a-95d1-452666314e18";

let handlerConfigured = false;

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Lazy-load so any problem in expo-notifications' init is caught here,
    // not at app startup.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require("expo-notifications");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require("expo-device");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require("react-native");

    if (!handlerConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      handlerConfigured = true;
    }

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

    const { data } = await Notifications.getExpoPushTokenAsync({
      projectId: EAS_PROJECT_ID,
    });
    void registerPushToken(data);
    return data;
  } catch (err) {
    // Swallow — push is a nice-to-have, not worth crashing the app over.
    // Worst case the driver doesn't get pushes; foreground + background
    // location still works.
    return null;
  }
}
