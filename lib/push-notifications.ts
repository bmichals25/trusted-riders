import Constants from "expo-constants";
import type * as ExpoNotifications from "expo-notifications";
import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

import { FLEET_API_URL } from "./config";
import { DEMO_MODE } from "./demo-mode";
import { getToken } from "./fleet-api";

type PushTokenRegistrationInput = {
  expoPushToken: string;
  projectId: string;
  platform: string;
};

type GpsAskNotificationData = {
  messageId?: string;
};

type GpsAskNotificationEvent = {
  messageId: string;
  /** "received": delivered while the app is in the foreground; "tap": the driver opened the notification. */
  source: "received" | "tap";
};

type LocalGpsAskNotificationInput = {
  messageId: string;
};

type LocalGpsOffNotificationInput = {
  messageId: string;
};

let notificationHandlerConfigured = false;

export function getExpoProjectId(): string | null {
  const extra = Constants.expoConfig?.extra;
  const eas = extra && typeof extra === "object" ? (extra as Record<string, unknown>).eas : undefined;
  const projectId = eas && typeof eas === "object"
    ? (eas as Record<string, unknown>).projectId
    : undefined;
  return typeof projectId === "string" && projectId.trim() ? projectId.trim() : null;
}

export function buildPushTokenRegistrationRequest({
  expoPushToken,
  projectId,
  platform,
}: PushTokenRegistrationInput): { path: string; init: RequestInit } {
  return {
    path: "/api/push_tokens",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expo_push_token: expoPushToken,
        push_token: expoPushToken,
        token: expoPushToken,
        provider: "expo",
        platform,
        project_id: projectId,
      }),
    },
  };
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (DEMO_MODE || Platform.OS === "web") return null;

  const notifications = getNotificationsModule();
  if (!notifications) {
    console.log("[push] skipped registration: expo-notifications native module unavailable");
    return null;
  }
  configureNotificationHandler(notifications);

  const projectId = getExpoProjectId();
  if (!projectId) {
    console.log("[push] skipped registration: missing EAS project id");
    return null;
  }

  const existingPermission = await notifications.getPermissionsAsync();
  let granted = hasNotificationPermission(existingPermission);
  if (!granted) {
    const requestedPermission = await notifications.requestPermissionsAsync();
    granted = hasNotificationPermission(requestedPermission);
  }
  if (!granted) {
    console.log("[push] skipped registration: notifications permission not granted");
    return null;
  }

  const token = (await notifications.getExpoPushTokenAsync({ projectId })).data;
  await registerPushTokenWithBackend({
    expoPushToken: token,
    projectId,
    platform: Platform.OS,
  });
  return token;
}

export async function registerPushTokenWithBackend(input: PushTokenRegistrationInput): Promise<void> {
  const request = buildPushTokenRegistrationRequest(input);
  const token = getToken();
  const headers = {
    ...(request.init.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${FLEET_API_URL}${request.path}`, {
    ...request.init,
    headers,
  });
  if (!res.ok) {
    throw new Error(`Push token registration failed (${res.status})`);
  }
}

export function readGpsAskNotificationData(raw: unknown): GpsAskNotificationData | null {
  const record = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const metadata = record.message_metadata && typeof record.message_metadata === "object" && !Array.isArray(record.message_metadata)
    ? record.message_metadata as Record<string, unknown>
    : {};
  const command = record.command ?? record.type ?? metadata.command ?? metadata.type;
  if (command !== "gps_ask") return null;

  const messageId = pickString(record, ["message_id", "chat_message_id", "id"])
    ?? pickString(metadata, ["message_id", "chat_message_id", "id"]);
  return messageId ? { messageId } : {};
}

/** Resolves true when a local notification was scheduled, false when it was skipped. */
export async function scheduleLocalGpsAskNotification({
  messageId,
}: LocalGpsAskNotificationInput): Promise<boolean> {
  if (DEMO_MODE || Platform.OS === "web") return false;

  const notifications = getNotificationsModule();
  if (!notifications) return false;
  configureNotificationHandler(notifications);

  const existingPermission = await notifications.getPermissionsAsync();
  if (!hasNotificationPermission(existingPermission)) return false;

  // The backend's gps_ask push may already be sitting in Notification Center; don't add a second banner.
  const presented = await getPresentedGpsAskNotificationIds(notifications, messageId);
  if (presented.length > 0) return false;

  await notifications.scheduleNotificationAsync({
    content: {
      title: "Dispatch is requesting GPS",
      body: "Tap to approve or deny location sharing.",
      data: {
        command: "gps_ask",
        message_id: messageId,
      },
    },
    trigger: null,
  });
  return true;
}

/** Remove any gps_ask banners (push or local) for a request the driver has already been prompted about. */
export async function dismissGpsAskNotifications(messageId: string): Promise<void> {
  if (DEMO_MODE || Platform.OS === "web") return;
  const notifications = getNotificationsModule();
  if (!notifications || typeof notifications.dismissNotificationAsync !== "function") return;
  const identifiers = await getPresentedGpsAskNotificationIds(notifications, messageId);
  await Promise.all(identifiers.map((identifier) => notifications.dismissNotificationAsync(identifier)));
}

async function getPresentedGpsAskNotificationIds(
  notifications: typeof ExpoNotifications,
  messageId: string,
): Promise<string[]> {
  if (typeof notifications.getPresentedNotificationsAsync !== "function") return [];
  try {
    const presented = await notifications.getPresentedNotificationsAsync();
    return presented
      .filter((notification) => readGpsAskNotificationData(notification.request.content.data)?.messageId === messageId)
      .map((notification) => notification.request.identifier);
  } catch {
    return [];
  }
}

export async function scheduleLocalGpsOffNotification({
  messageId,
}: LocalGpsOffNotificationInput): Promise<void> {
  if (DEMO_MODE || Platform.OS === "web") return;

  const notifications = getNotificationsModule();
  if (!notifications) return;
  configureNotificationHandler(notifications);

  const existingPermission = await notifications.getPermissionsAsync();
  if (!hasNotificationPermission(existingPermission)) return;

  await notifications.scheduleNotificationAsync({
    content: {
      title: "GPS tracking turned off",
      body: "Dispatch turned off live location sharing for this ride.",
      data: {
        command: "gps_off",
        message_id: messageId,
      },
    },
    trigger: null,
  });
}

export function addGpsAskNotificationListeners(
  onGpsAsk: (event: GpsAskNotificationEvent) => void,
): () => void {
  const notifications = getNotificationsModule();
  if (!notifications) return () => {};
  configureNotificationHandler(notifications);

  const handleData = (raw: unknown, fallbackId: string, source: GpsAskNotificationEvent["source"]) => {
    const gpsAsk = readGpsAskNotificationData(raw);
    if (!gpsAsk) return;
    onGpsAsk({ messageId: gpsAsk.messageId ?? fallbackId, source });
  };

  const handleResponse = (notificationResponse: ExpoNotifications.NotificationResponse) => {
    if (!isOpenNotificationResponse(notificationResponse)) return;
    const notification = notificationResponse.notification;
    handleData(notification.request.content.data, notification.request.identifier, "tap");
  };

  const received = notifications.addNotificationReceivedListener((notification) => {
    handleData(notification.request.content.data, notification.request.identifier, "received");
  });
  const response = notifications.addNotificationResponseReceivedListener(handleResponse);

  // Cold start: the tap that launched the app arrives before this listener existed.
  let active = true;
  void readLastNotificationResponse(notifications).then((last) => {
    if (active && last) handleResponse(last);
  });

  return () => {
    active = false;
    received.remove();
    response.remove();
  };
}

export type NotificationTapData = Record<string, unknown>;

/**
 * Where a tapped push should take the driver, as an expo-router href.
 * ride_request / ride_status -> the ride (same route as trustedriders://ride-details?rideId=<id>),
 * chat_message -> dispatch chat. gps_ask is handled by the GPS prompt, not navigation.
 */
export function resolveNotificationTapHref(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as NotificationTapData;
  const type = typeof data.type === "string" ? data.type.trim().toLowerCase() : "";

  if (type === "chat_message") return "/chat";
  if (type !== "ride_request" && type !== "ride_status") return null;

  const rideId = readRideIdFromDeepLink(data.url) ?? pickString(data, ["ride_id", "rideId"]);
  if (rideId) return `/ride-details?rideId=${encodeURIComponent(rideId)}`;
  return type === "ride_request" ? "/ride-requests" : null;
}

/** Reads rideId from trustedriders://ride-details?rideId=<id> (or /ride-details?rideId=<id>). */
export function readRideIdFromDeepLink(url: unknown): string | null {
  if (typeof url !== "string" || !/ride-details/i.test(url)) return null;
  const match = url.match(/[?&]rideId=([^&#]+)/);
  if (!match) return null;
  try {
    const value = decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
    return value || null;
  } catch {
    return null;
  }
}

const handledTapResponseIds = new Set<string>();

/**
 * Calls onTap once per tapped notification with a navigation target, including the tap that
 * cold-started the app. The handled-set is module level so a remount (sign out / sign in) never
 * replays the launch notification.
 */
export function addNotificationTapNavigationListener(onTap: (href: string) => void): () => void {
  const notifications = getNotificationsModule();
  if (!notifications) return () => {};
  configureNotificationHandler(notifications);

  const handleResponse = (notificationResponse: ExpoNotifications.NotificationResponse) => {
    if (!isOpenNotificationResponse(notificationResponse)) return;
    const request = notificationResponse.notification.request;
    const href = resolveNotificationTapHref(request.content.data);
    if (!href) return;
    const key = request.identifier || `${href}@${notificationResponse.notification.date}`;
    if (handledTapResponseIds.has(key)) return;
    handledTapResponseIds.add(key);
    // The native side keeps the last response for the whole process; clear it so a JS reload
    // (dev refresh or OTA update) doesn't replay an old tap and reopen a finished ride.
    void clearLastNotificationResponse(notifications);
    onTap(href);
  };

  const response = notifications.addNotificationResponseReceivedListener(handleResponse);
  let active = true;
  void readLastNotificationResponse(notifications).then((last) => {
    if (active && last) handleResponse(last);
  });

  return () => {
    active = false;
    response.remove();
  };
}

function isOpenNotificationResponse(notificationResponse: ExpoNotifications.NotificationResponse): boolean {
  // Swiping a notification away is a response too (iOS dismiss action); only a real open counts.
  return !/dismiss/i.test(notificationResponse.actionIdentifier ?? "");
}

async function clearLastNotificationResponse(notifications: typeof ExpoNotifications): Promise<void> {
  try {
    if (typeof notifications.clearLastNotificationResponseAsync === "function") {
      await notifications.clearLastNotificationResponseAsync();
    } else if (typeof notifications.clearLastNotificationResponse === "function") {
      notifications.clearLastNotificationResponse();
    }
  } catch (error) {
    console.log("[push] could not clear last notification response", error instanceof Error ? error.message : error);
  }
}

async function readLastNotificationResponse(
  notifications: typeof ExpoNotifications,
): Promise<ExpoNotifications.NotificationResponse | null> {
  try {
    if (typeof notifications.getLastNotificationResponseAsync === "function") {
      return await notifications.getLastNotificationResponseAsync();
    }
    if (typeof notifications.getLastNotificationResponse === "function") {
      return notifications.getLastNotificationResponse();
    }
  } catch (error) {
    console.log("[push] last notification response unavailable", error instanceof Error ? error.message : error);
  }
  return null;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function hasNotificationPermission(permission: unknown): boolean {
  if (!permission || typeof permission !== "object") return false;
  const record = permission as Record<string, unknown>;
  return record.granted === true || record.status === "granted";
}

function configureNotificationHandler(notifications: typeof ExpoNotifications): void {
  if (notificationHandlerConfigured) return;
  notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // In the foreground a gps_ask opens the in-app prompt directly; a banner on top would be a duplicate.
      const show = !readGpsAskNotificationData(notification?.request?.content?.data);
      return {
        shouldPlaySound: show,
        shouldSetBadge: false,
        shouldShowAlert: show,
        shouldShowBanner: show,
        shouldShowList: show,
      };
    },
  });
  notificationHandlerConfigured = true;
}

function getNotificationsModule(): typeof ExpoNotifications | null {
  // Expo modules register with expo-modules-core, not React Native's NativeModules, so under the New
  // Architecture `NativeModules.ExpoPushTokenManager` is always undefined and push never registered.
  if (!requireOptionalNativeModule("ExpoPushTokenManager")) return null;

  try {
    // Lazy load because existing development clients may not include the native
    // ExpoPushTokenManager module until the client is rebuilt.
    return require("expo-notifications") as typeof ExpoNotifications;
  } catch {
    return null;
  }
}
