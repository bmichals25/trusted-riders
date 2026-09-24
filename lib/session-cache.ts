import * as storage from "./storage";
import { clearRideDetailCache } from "./fleet-ride-detail-cache";

// Device-persisted snapshot of the driver's current ride (restores the card across app restarts).
export const LAST_ACTIVE_RIDE_KEY = "trustedriders-last-active-ride";

/**
 * Drop everything cached for the signed-in driver. Called whenever the session token is cleared
 * (sign-out or an auth failure) so the next driver on this device never sees the previous driver's rides.
 */
export async function clearSessionScopedCaches(): Promise<void> {
  clearRideDetailCache();
  await storage.remove(LAST_ACTIVE_RIDE_KEY);
}
