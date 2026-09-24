// Passenger profile photos for the assigned Trusted Rider.
//
// The photo only comes from GET /api/rides/<ride_id>/passenger-photo on the configured Fleet API, with
// the session token in the Authorization header (never in the URL, so it can't end up in logs or an
// image cache key). The server answers 404 once the TR may no longer see the passenger (ride finished,
// not their ride, agreement not accepted); the Avatar then shows initials.
//
// Privacy: images are held in expo-image's memory cache only (<Avatar> sets cachePolicy="memory"), never
// written to AsyncStorage or the ride caches; those keep just the has-photo flag and timestamp.
// Sign-out clears the memory cache (clearPassengerPhotoCache), so the next TR on a shared phone can't
// be served the previous TR's passengers from memory.

import { Image, type ImageSource } from "expo-image";
import { useMemo } from "react";

import { FLEET_API_URL } from "./config";
import { DEMO_MODE } from "./demo-mode";
import { getToken } from "./fleet-api";
import { getRideBackendId, type DispatchedRide } from "./rides";

/** thumb: 128×128 (cards); full: up to 512×512 (ride details). */
export type PassengerPhotoSize = "thumb" | "full";

type PhotoRide = Pick<DispatchedRide, "id" | "passengerHasPhoto" | "passengerPhotoUpdatedAt">;

/** Relative API path; `v` only busts caches when the photo changes (the server ignores it). */
export function buildPassengerPhotoPath(
  backendRideId: number,
  size: PassengerPhotoSize,
  updatedAt: string | null,
): string {
  const version = updatedAt ? `&v=${encodeURIComponent(updatedAt)}` : "";
  return `/api/rides/${backendRideId}/passenger-photo?size=${size}${version}`;
}

/**
 * Image source for the ride's passenger photo, or null when there is nothing to load: no photo, a
 * demo ride (never hits the network), a ride without a backend id, or no session token.
 */
export function passengerPhotoSource(
  ride: PhotoRide,
  size: PassengerPhotoSize,
  token: string | null,
  options: { baseUrl?: string; demoMode?: boolean } = {},
): ImageSource | null {
  if (options.demoMode ?? DEMO_MODE) return null;
  if (!ride.passengerHasPhoto || !token) return null;
  const backendRideId = getRideBackendId(ride.id);
  if (backendRideId === null) return null;
  const baseUrl = options.baseUrl ?? FLEET_API_URL;
  return {
    uri: `${baseUrl}${buildPassengerPhotoPath(backendRideId, size, ride.passengerPhotoUpdatedAt ?? null)}`,
    headers: { Authorization: `Bearer ${token}` },
  };
}

/** The ride's passenger photo source for <Avatar source>, using the current session token. */
export function usePassengerPhotoSource(ride: PhotoRide, size: PassengerPhotoSize): ImageSource | null {
  const token = getToken();
  const { id, passengerHasPhoto, passengerPhotoUpdatedAt } = ride;
  return useMemo(
    () => passengerPhotoSource({ id, passengerHasPhoto, passengerPhotoUpdatedAt }, size, token),
    [id, passengerHasPhoto, passengerPhotoUpdatedAt, size, token],
  );
}

/** Sign-out: drop decoded passenger photos from memory. Nothing was written to disk to clear. */
export async function clearPassengerPhotoCache(): Promise<void> {
  try {
    await Image.clearMemoryCache();
  } catch {
    // native module unavailable (tests, old binary): nothing cached to clear
  }
}
