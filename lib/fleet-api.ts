// Fleet Tracking API client — handles auth + location updates to Flask backend

import { Platform } from "react-native";

import { FLEET_API_URL } from "./config";
import * as storage from "./storage";

const TOKEN_KEY = "trustedriders-auth-token";
const ACTIVE_RIDE_KEY = "trustedriders-active-ride";

let token: string | null = null;

export async function login(email: string, password: string): Promise<{ id: number; name: string; email: string }> {
  const res = await fetch(`${FLEET_API_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  const data = await res.json();
  token = data.token;
  await storage.set(TOKEN_KEY, data.token);
  return data.user;
}

export function getToken(): string | null {
  return token;
}

export async function clearToken(): Promise<void> {
  token = null;
  await storage.remove(TOKEN_KEY);
}

// Rehydrate the in-memory token from persistent storage on app boot.
// Call this once before rendering any authenticated UI.
export async function restoreToken(): Promise<string | null> {
  const stored = await storage.get(TOKEN_KEY);
  if (stored) token = stored;
  return stored;
}

// Active ride tracking — written by MissionScreen so the background location
// TaskManager handler (which runs outside React) can read the current ride id.
export async function setActiveRideId(rideId: number): Promise<void> {
  await storage.set(ACTIVE_RIDE_KEY, String(rideId));
}

export async function clearActiveRideId(): Promise<void> {
  await storage.remove(ACTIVE_RIDE_KEY);
}

export async function getActiveRideId(): Promise<number | null> {
  const stored = await storage.get(ACTIVE_RIDE_KEY);
  if (!stored) return null;
  const n = Number(stored);
  return Number.isFinite(n) ? n : null;
}

/**
 * Registered by `lib/push.ts` when push notifications are re-enabled.
 * Currently unused — see `lib/push.ts` for the disabled-state rationale.
 *
 * @deprecated until push.ts is un-stubbed (tracked in commit history).
 */
export async function registerPushToken(pushToken: string): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(`${FLEET_API_URL}/api/register-push-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ push_token: pushToken, platform: Platform.OS }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function updateLocation(loc: {
  lat: number;
  lon: number;
  timestamp: string;
  ride_id: number | null;
}): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(`${FLEET_API_URL}/api/update_location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(loc),
    });
    if (res.status === 401) {
      await clearToken();
      return false;
    }
    return res.ok;
  } catch {
    // Network error — don't crash, just skip this update
    return false;
  }
}
