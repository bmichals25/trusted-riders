// Tiny Platform-aware key/value storage. Uses `localStorage` on web (synchronous
// under the hood but awaited for a uniform API) and `AsyncStorage` on native.
//
// Previously duplicated across lib/fleet-api.ts, components/ui/DriverNameGate.tsx,
// and app/settings.tsx with slightly different error-swallowing behavior.
// Consolidated here so all storage goes through one code path.

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

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

// Secure variants — backed by iOS Keychain / Android Keystore on native.
// Used for secrets we need to keep off disk in plaintext (currently the cached
// password used for silent re-auth on 401). On web there's no equivalent, so
// we fall through to localStorage with the same API — the web build is dev
// only, so the downgrade is acceptable there.
//
// AFTER_FIRST_UNLOCK is required so the background location TaskManager can
// read the password after the device has been unlocked once since boot; the
// default WHEN_UNLOCKED would block re-auth the moment the phone is locked.
const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export async function secureGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") return localStorage.getItem(key);
    return await SecureStore.getItemAsync(key, SECURE_OPTS);
  } catch {
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value, SECURE_OPTS);
  } catch {}
}

export async function secureRemove(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") localStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key, SECURE_OPTS);
  } catch {}
}
