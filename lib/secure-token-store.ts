// Auth token storage (BEN-29): the iOS Keychain / Android Keystore via expo-secure-store, not
// AsyncStorage (plain files that end up in device backups).
//
// expo-secure-store is a native module: until the dev client / release build is rebuilt with it
// (pod install + `npx expo run:ios`), `requireOptionalNativeModule` returns null and the token
// falls back to AsyncStorage exactly as before, so an old binary keeps working.
//
// A token left in AsyncStorage by an older build is moved into the secure store on first read and
// then deleted from AsyncStorage.

import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

import * as storage from "./storage";

type SecureStoreOptions = { keychainAccessible?: number };

type SecureStoreNativeModule = {
  getValueWithKeyAsync(key: string, options: SecureStoreOptions): Promise<string | null>;
  setValueWithKeyAsync(value: string, key: string, options: SecureStoreOptions): Promise<void>;
  deleteValueWithKeyAsync(key: string, options: SecureStoreOptions): Promise<void>;
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY?: number;
};

let nativeModule: SecureStoreNativeModule | null | undefined;

function secureStore(): SecureStoreNativeModule | null {
  if (Platform.OS === "web") return null;
  if (nativeModule === undefined) {
    try {
      nativeModule = requireOptionalNativeModule<SecureStoreNativeModule>("ExpoSecureStore");
    } catch {
      nativeModule = null;
    }
    if (!nativeModule && __DEV__) {
      console.warn("[secure-store] native module missing; rebuild the app (pod install + expo run:ios). Using AsyncStorage for now.");
    }
  }
  return nativeModule ?? null;
}

function options(module: SecureStoreNativeModule): SecureStoreOptions {
  // The background location task runs while the phone is locked, so the token must be readable
  // after the first unlock since boot. THIS_DEVICE_ONLY: never restored onto another device.
  return typeof module.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY === "number"
    ? { keychainAccessible: module.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }
    : {};
}

export function isSecureStoreAvailable(): boolean {
  return secureStore() !== null;
}

export async function getSecureItem(key: string): Promise<string | null> {
  const module = secureStore();
  if (!module) return storage.get(key);

  let value: string | null = null;
  try {
    value = await module.getValueWithKeyAsync(key, options(module));
  } catch {
    value = null;
  }
  if (value) return value;

  // One-time migration from AsyncStorage (older builds).
  const legacy = await storage.get(key);
  if (!legacy) return null;
  try {
    await module.setValueWithKeyAsync(legacy, key, options(module));
    await storage.remove(key);
  } catch {
    // Keep the legacy copy if the keychain write failed, so the driver stays signed in.
  }
  return legacy;
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  const module = secureStore();
  if (!module) {
    await storage.set(key, value);
    return;
  }
  try {
    await module.setValueWithKeyAsync(value, key, options(module));
    await storage.remove(key); // never leave a plain copy behind
  } catch {
    await storage.set(key, value);
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  const module = secureStore();
  if (module) {
    try {
      await module.deleteValueWithKeyAsync(key, options(module));
    } catch {}
  }
  await storage.remove(key);
}
