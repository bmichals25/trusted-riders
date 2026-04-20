// Tiny Platform-aware key/value storage. Uses `localStorage` on web (synchronous
// under the hood but awaited for a uniform API) and `AsyncStorage` on native.
//
// Previously duplicated across lib/fleet-api.ts, components/ui/DriverNameGate.tsx,
// and app/settings.tsx with slightly different error-swallowing behavior.
// Consolidated here so all storage goes through one code path.

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function get(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") return localStorage.getItem(key);
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function set(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") localStorage.setItem(key, value);
    else await AsyncStorage.setItem(key, value);
  } catch {}
}

export async function remove(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") localStorage.removeItem(key);
    else await AsyncStorage.removeItem(key);
  } catch {}
}

// "Secure" variants — TEMPORARILY BACKED BY AsyncStorage, not Keychain/Keystore.
//
// Why: adding `expo-secure-store` to the iOS binary reproduces the same
// iOS 26.3.1 / Expo SDK 55 startup crash we hit with `expo-notifications`
// (see lib/push.ts and TestFlight crash log for build 0.1.0 (8) —
// ObjCTurboModule::performVoidMethodInvocation → objc_exception_rethrow →
// abort on a dispatch worker before any JS runs).
//
// Storing cached credentials in AsyncStorage is a security downgrade
// (plaintext in the app sandbox vs. Keychain encryption), but it's the same
// risk profile as the JWT we already cache there, and the alternative —
// dropping silent re-auth entirely — forces drivers back to the login screen
// every time the backend rotates a session mid-shift.
//
// Restore the Keychain-backed variants once either:
//   1. Expo SDK bumps to a version whose expo-secure-store turbo module
//      survives iOS 26.3.1 init, OR
//   2. We ship a direct Keychain wrapper that doesn't route through an
//      Expo TurboModule.
export async function secureGet(key: string): Promise<string | null> {
  return get(key);
}

export async function secureSet(key: string, value: string): Promise<void> {
  return set(key, value);
}

export async function secureRemove(key: string): Promise<void> {
  return remove(key);
}
