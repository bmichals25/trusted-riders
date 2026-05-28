import Constants from "expo-constants";
import type * as ExpoNotifications from "expo-notifications";
import { NativeModules, Platform } from "react-native";

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
};

type LocalGpsAskNotificationInput = {
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

export async function scheduleLocalGpsAskNotification({
  messageId,
}: LocalGpsAskNotificationInput): Promise<void> {
  if (DEMO_MODE || Platform.OS === "web") return;

  const notifications = getNotificationsModule();
  if (!notifications) return;
  configureNotificationHandler(notifications);

  const existingPermission = await notifications.getPermissionsAsync();
  if (!hasNotificationPermission(existingPermission)) return;

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
}

export function addGpsAskNotificationListeners(
  onGpsAsk: (event: GpsAskNotificationEvent) => void,
): () => void {
  const notifications = getNotificationsModule();
  if (!notifications) return () => {};
  configureNotificationHandler(notifications);

  const handleData = (raw: unknown, fallbackId: string) => {
    const gpsAsk = readGpsAskNotificationData(raw);
    if (!gpsAsk) return;
    onGpsAsk({ messageId: gpsAsk.messageId ?? fallbackId });
  };

  const received = notifications.addNotificationReceivedListener((notification) => {
    handleData(notification.request.content.data, notification.request.identifier);
  });
  const response = notifications.addNotificationResponseReceivedListener((notificationResponse) => {
    const notification = notificationResponse.notification;
    handleData(notification.request.content.data, notification.request.identifier);
  });

  return () => {
    received.remove();
    response.remove();
  };
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
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  notificationHandlerConfigured = true;
}

function getNotificationsModule(): typeof ExpoNotifications | null {
  if (!NativeModules.ExpoPushTokenManager) return null;

  try {
    // Lazy load because existing development clients may not include the native
    // ExpoPushTokenManager module until the client is rebuilt.
    return require("expo-notifications") as typeof ExpoNotifications;
  } catch {
    return null;
  }
}
