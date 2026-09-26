// Face ID / Touch ID sign-in (2026-09-26).
//
// After a password sign-in the TR can save their sign-in behind biometrics: the email and password go
// into the Keychain / Keystore with requireAuthentication, so they can only be read after Face ID or
// Touch ID on this phone. The item is THIS_DEVICE_ONLY (never backed up or synced), needs a device
// passcode, and iOS invalidates it when the enrolled faces or fingerprints change. "Sign in with Face ID"
// reads it (the system prompt) and signs in exactly like the password form, so it keeps working after
// the 7-day session ends.
//
// Sign-out removes it (a shared phone must not let the next person in); a session that merely expired
// keeps it (lib/sign-out.ts). Changing the password makes the saved one fail, and it is then removed.

import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import * as storage from "./storage";

// Keychain item holding {email, password}.
const CREDENTIALS_KEY = "trustedriders-biometric-sign-in";
// AsyncStorage: the email it belongs to (not a secret), so the sign-in screen can offer the button
// without triggering a Face ID prompt just to find out. A "trustedriders-*" key: sign-out wipes it.
const ENABLED_EMAIL_KEY = "trustedriders-biometric-sign-in-email";

export type BiometricSupport = { available: boolean; label: string };
export type SavedSignIn = { email: string; password: string };

const NOT_AVAILABLE: BiometricSupport = { available: false, label: "Face ID" };

function secureOptions(prompt?: string): SecureStore.SecureStoreOptions {
  return {
    requireAuthentication: true,
    keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    ...(prompt ? { authenticationPrompt: prompt } : {}),
  };
}

/** Whether this phone can do biometric sign-in, and what to call it ("Face ID", "Touch ID"…). */
export async function biometricSupport(): Promise<BiometricSupport> {
  if (Platform.OS === "web") return NOT_AVAILABLE;
  try {
    const [hardware, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    if (!hardware || !enrolled || !SecureStore.canUseBiometricAuthentication()) return NOT_AVAILABLE;
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const label =
      Platform.OS === "ios"
        ? face ? "Face ID" : "Touch ID"
        : face && !finger ? "face unlock" : "fingerprint";
    return { available: true, label };
  } catch {
    // Native module missing (an older binary) or the check failed: just don't offer it.
    return NOT_AVAILABLE;
  }
}

/** The email biometric sign-in is saved for on this phone, or null. */
export async function biometricSignInEmail(): Promise<string | null> {
  return storage.get(ENABLED_EMAIL_KEY);
}

/** Put the "saved for this email" marker back (sign-out wipes every "trustedriders-*" key). */
export async function markBiometricSignIn(email: string): Promise<void> {
  await storage.set(ENABLED_EMAIL_KEY, email);
}

/** Save the sign-in behind biometrics. Resolves false if the phone refused (e.g. no passcode set). */
export async function saveBiometricSignIn(credentials: SavedSignIn, label: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(
      CREDENTIALS_KEY,
      JSON.stringify({ email: credentials.email, password: credentials.password }),
      secureOptions(`Use ${label} to sign in to TrustedRide`),
    );
    await storage.set(ENABLED_EMAIL_KEY, credentials.email);
    return true;
  } catch (err) {
    console.log(`[biometric] save failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Read the saved sign-in (shows the Face ID / Touch ID prompt).
 *   "cancelled": the TR dismissed the prompt; nothing changes.
 *   "unavailable": the item is gone or iOS invalidated it (biometrics changed); it is removed.
 */
export async function readBiometricSignIn(): Promise<SavedSignIn | "cancelled" | "unavailable"> {
  try {
    const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY, secureOptions("Sign in to TrustedRide"));
    const parsed = raw ? (JSON.parse(raw) as Partial<SavedSignIn>) : null;
    if (parsed && typeof parsed.email === "string" && typeof parsed.password === "string") {
      return { email: parsed.email, password: parsed.password };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    if (message.includes("cancel")) return "cancelled";
    console.log(`[biometric] read failed: ${message}`);
  }
  await removeBiometricSignIn();
  return "unavailable";
}

/** Forget the saved sign-in (sign-out, turning it off in Settings, or a password that no longer works). */
export async function removeBiometricSignIn(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CREDENTIALS_KEY, {
      keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
    });
  } catch {
    // nothing saved, or the native module is missing
  }
  await storage.remove(ENABLED_EMAIL_KEY);
}
