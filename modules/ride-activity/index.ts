import { requireOptionalNativeModule } from "expo";

/** Content of the ride Live Activity. PHI-free: it shows on the Lock Screen without unlocking. */
export type RideActivityPayload = {
  rideNumber: string;
  step: "upcoming" | "en_route" | "at_pickup" | "on_board" | "completed" | "cancelled";
  /** Scheduled pickup, epoch milliseconds. */
  pickupAtMs?: number | null;
  /** "Ride home" on a round trip's return leg. */
  legLabel?: string | null;
};

type RideActivityNativeModule = {
  isSupported(): boolean;
  sync(payload: RideActivityPayload | null): Promise<string | null>;
};

// Null on Android, the web, and binaries built before this module existed.
export const RideActivity = requireOptionalNativeModule<RideActivityNativeModule>("RideActivity");
