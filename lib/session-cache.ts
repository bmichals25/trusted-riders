import * as storage from "./storage";
import { clearPersistedRideDetails, clearRideDetailCache } from "./fleet-ride-detail-cache";

// Device-persisted snapshot of the driver's current ride (restores the card across app restarts).
export const LAST_ACTIVE_RIDE_KEY = "trustedriders-last-active-ride";

// Current ride id for the background location task (written by fleet-api setActiveRideId).
export const ACTIVE_RIDE_KEY = "trustedriders-active-ride";
// Every key this app stores starts with this; sign-out removes all of them.
export const APP_STORAGE_PREFIX = "trustedriders-";

/**
 * Drop everything cached for the signed-in driver. Called whenever the session token is cleared
 * (sign-out or an auth failure) so the next driver on this device never sees the previous driver's rides:
 * the in-memory and persisted ride details, the current ride snapshot and the active ride id.
 */
export async function clearSessionScopedCaches(): Promise<void> {
  clearRideDetailCache();
  await Promise.all([
    clearPersistedRideDetails(),
    storage.remove(LAST_ACTIVE_RIDE_KEY),
    storage.remove(ACTIVE_RIDE_KEY),
  ]);
}

/** Sign-out: remove every "trustedriders-*" key (name, email, caches, ride snapshot, legacy token). */
export async function clearAllAppStorage(): Promise<void> {
  clearRideDetailCache();
  await storage.removeByPrefix(APP_STORAGE_PREFIX);
}
