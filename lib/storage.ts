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
