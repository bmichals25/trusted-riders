// Fleet Tracking API client — handles auth + location updates to Flask backend

import { Platform } from "react-native";

import { FLEET_API_URL } from "./config";
import * as storage from "./storage";

const TOKEN_KEY = "trustedriders-auth-token";
const ACTIVE_RIDE_KEY = "trustedriders-active-ride";
// Stored in Keychain/Keystore (not AsyncStorage) so the on-disk value is
// encrypted at rest. Used by the silent re-auth path below.
const CREDENTIALS_EMAIL_KEY = "trustedriders-auth-email";
const CREDENTIALS_PASSWORD_KEY = "trustedriders-auth-password";

let token: string | null = null;

// In-flight re-auth promise — prevents a thundering-herd of parallel login
// calls when multiple requests 401 at the same time (e.g. a location ping and
// a push-token register fire together while the server is rotating tokens).
let reauthInFlight: Promise<boolean> | null = null;

// Listeners fired when re-auth fails and the user must log in again. The
// DriverNameGate subscribes to this so the UI drops back to the login screen
// instead of silently staying on an "authenticated" screen with no token.
type AuthLostListener = () => void;
const authLostListeners = new Set<AuthLostListener>();

export function onAuthLost(listener: AuthLostListener): () => void {
  authLostListeners.add(listener);
  return () => {
    authLostListeners.delete(listener);
  };
}

function emitAuthLost() {
  for (const l of authLostListeners) {
    try {
      l();
    } catch {
      // Listener errors shouldn't break the auth flow
    }
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
  await storage.set(TOKEN_KEY, data.token);
  // Persist credentials for silent re-auth when the backend expires our
  // session. Without this, a 401 mid-shift drops the driver silently and
  // dispatch stops getting pings until the driver notices and re-logs in.
  await storage.secureSet(CREDENTIALS_EMAIL_KEY, email);
  await storage.secureSet(CREDENTIALS_PASSWORD_KEY, password);
  return data.user;
}

export function getToken(): string | null {
  return token;
}

export async function clearToken(): Promise<void> {
  token = null;
  await storage.remove(TOKEN_KEY);
  await storage.secureRemove(CREDENTIALS_EMAIL_KEY);
  await storage.secureRemove(CREDENTIALS_PASSWORD_KEY);
}

// Rehydrate the in-memory token from persistent storage on app boot.
// Call this once before rendering any authenticated UI.
export async function restoreToken(): Promise<string | null> {
  const stored = await storage.get(TOKEN_KEY);
  if (stored) token = stored;
  return stored;
}

// Attempt a silent re-login using the Keychain-stored credentials. Returns
// true on success (in-memory + on-disk token refreshed) and false if no creds
// are cached or the login call itself fails. Single-flight: concurrent calls
// share the same promise so we only hit /api/login once per 401 storm.
async function attemptReauth(): Promise<boolean> {
  if (reauthInFlight) return reauthInFlight;
  reauthInFlight = (async () => {
    try {
      const email = await storage.secureGet(CREDENTIALS_EMAIL_KEY);
      const password = await storage.secureGet(CREDENTIALS_PASSWORD_KEY);
      if (!email || !password) return false;
      const res = await fetch(`${FLEET_API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      token = data.token;
      await storage.set(TOKEN_KEY, data.token);
      return true;
    } catch {
      return false;
    } finally {
      reauthInFlight = null;
    }
  })();
  return reauthInFlight;
}

// Wraps fetch with the Authorization header and a one-shot silent re-auth on
// 401. If the retry still 401s (or re-auth itself fails), clears all auth
// state and fires onAuthLost so the UI can redirect to the login screen.
async function authedFetch(path: string, init: RequestInit): Promise<Response | null> {
  if (!token) return null;
  const doFetch = (tkn: string) =>
    fetch(`${FLEET_API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
        Authorization: `Bearer ${tkn}`,
      },
    });

  const res = await doFetch(token);
  if (res.status !== 401) return res;

  // Session expired or invalidated — try a silent re-login once.
  const ok = await attemptReauth();
  if (!ok || !token) {
    await clearToken();
    emitAuthLost();
    return null;
  }
  const retry = await doFetch(token);
  if (retry.status === 401) {
    // Fresh token still unauthorized — credentials rotated server-side or
    // account disabled. Give up and kick to login.
    await clearToken();
    emitAuthLost();
    return null;
  }
  return retry;
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
  try {
    const res = await authedFetch("/api/register-push-token", {
      method: "POST",
      body: JSON.stringify({ push_token: pushToken, platform: Platform.OS }),
    });
    return res?.ok ?? false;
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
  try {
    const res = await authedFetch("/api/update_location", {
      method: "POST",
      body: JSON.stringify(loc),
    });
    return res?.ok ?? false;
  } catch {
    // Network error — don't crash, just skip this update
    return false;
  }
}
