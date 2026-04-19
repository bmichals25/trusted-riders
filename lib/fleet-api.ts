// Fleet Tracking API client — handles auth + location updates to Flask backend

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { FLEET_API_URL } from "./config";

const TOKEN_KEY = "trustedriders-auth-token";
const ACTIVE_RIDE_KEY = "trustedriders-active-ride";

let token: string | null = null;

async function writeStorage(key: string, value: string | null): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      return;
    }
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch {}
}

async function readStorage(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") return localStorage.getItem(key);
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<{ id: number; name: string; email: string }> {
  const res = await fetch(`${FLEET_API_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  const data = await res.json();
  token = data.token;
  await writeStorage(TOKEN_KEY, data.token);
  return data.user;
}

export function getToken(): string | null {
  return token;
}

export async function clearToken(): Promise<void> {
  token = null;
  await writeStorage(TOKEN_KEY, null);
}

// Rehydrate the in-memory token from persistent storage on app boot.
// Call this once before rendering any authenticated UI.
export async function restoreToken(): Promise<string | null> {
  const stored = await readStorage(TOKEN_KEY);
  if (stored) token = stored;
  return stored;
}

// Active ride tracking — written by MissionScreen so the background location
// TaskManager handler (which runs outside React) can read the current ride id.
export async function setActiveRideId(rideId: number): Promise<void> {
  await writeStorage(ACTIVE_RIDE_KEY, String(rideId));
}

export async function clearActiveRideId(): Promise<void> {
  await writeStorage(ACTIVE_RIDE_KEY, null);
}

export async function getActiveRideId(): Promise<number | null> {
  const stored = await readStorage(ACTIVE_RIDE_KEY);
  if (!stored) return null;
  const n = Number(stored);
  return Number.isFinite(n) ? n : null;
}

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
