import { requireOptionalNativeModule } from "expo";

/**
 * Content of the ride Live Activity. The Lock Screen card (readable on a locked phone) shows only the ride
 * number, step, pickup time and ETA; passengerName and the photo appear only in the Dynamic Island's expanded
 * view, which iOS shows only on an unlocked phone (ios/TrustedRideLiveActivity/RideLiveActivity.swift).
 */
export type RideActivityPayload = {
  rideNumber: string;
  step: "upcoming" | "en_route" | "at_pickup" | "on_board" | "completed" | "cancelled";
  /** Scheduled pickup, epoch milliseconds. */
  pickupAtMs?: number | null;
  /** "Ride home" on a round trip's return leg. */
  legLabel?: string | null;
  /** Expected arrival at pickup while en route, epoch milliseconds. */
  etaAtMs?: number | null;
  passengerName?: string | null;
  /** From savePassengerPhoto(). */
  photoFile?: string | null;
};

type RideActivityNativeModule = {
  isSupported(): boolean;
  sync(payload: RideActivityPayload | null): Promise<string | null>;
  /** Downloads the photo (authenticated thumb URL) into the App Group; resolves with its file name. */
  savePassengerPhoto(rideNumber: string, url: string, token: string): Promise<string | null>;
  /** Apple Maps driving time in seconds to the pickup, from the given position or else the phone's; or null. */
  drivingEta(toLat: number, toLon: number, fromLat?: number | null, fromLon?: number | null): Promise<number | null>;
};

// Null on Android, the web, and binaries built before this module existed.
export const RideActivity = requireOptionalNativeModule<RideActivityNativeModule>("RideActivity");
