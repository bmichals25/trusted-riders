// The ride Live Activity (Lock Screen card + Dynamic Island): which ride it shows and what it says.
// Native side: modules/ride-activity (ActivityKit bridge) and ios/TrustedRideLiveActivity (the SwiftUI views).
//
// It is readable without unlocking the phone, so it carries no PHI: the ride number, the step and the pickup
// time. Never add passenger names, addresses, phone numbers or notes to the payload.

import type { RideActivityPayload } from "../modules/ride-activity";
import type { DispatchedRide, RideStatus } from "./rides";
import { tripDisplayNumber } from "./round-trip";

export type { RideActivityPayload };

/** An accepted ride shows from this long before pickup... */
export const UPCOMING_WINDOW_MS = 2 * 60 * 60 * 1000;
/** ...until this long after it (the server starts the ride once the TR's GPS is live). */
export const OVERDUE_GRACE_MS = 60 * 60 * 1000;

export function rideActivityStep(status: RideStatus): RideActivityPayload["step"] {
  switch (status) {
    case "en_route":
      return "en_route";
    case "picked_up":
      return "at_pickup";
    case "in_transit":
      return "on_board";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "upcoming";
  }
}

function isAcceptedUpcoming(ride: DispatchedRide): boolean {
  return (ride.status === "pending" || ride.status === "accepted") && !ride.awaitingAcceptance;
}

/**
 * The ride to show: the current ride (en route, at pickup, on board), else the accepted ride with the next
 * pickup within UPCOMING_WINDOW_MS (or up to OVERDUE_GRACE_MS past it). Rides still waiting for the TR's
 * answer and rides without a pickup time are never shown.
 */
export function pickLiveActivityRide(
  activeRide: DispatchedRide | null,
  rides: DispatchedRide[],
  now = Date.now(),
): DispatchedRide | null {
  if (activeRide) return activeRide;
  let best: DispatchedRide | null = null;
  for (const ride of rides) {
    if (!isAcceptedUpcoming(ride) || typeof ride.pickupAt !== "number") continue;
    const untilPickup = ride.pickupAt - now;
    if (untilPickup > UPCOMING_WINDOW_MS || untilPickup < -OVERDUE_GRACE_MS) continue;
    if (!best || ride.pickupAt < (best.pickupAt as number)) best = ride;
  }
  return best;
}

export function rideActivityPayload(ride: DispatchedRide, status: RideStatus = ride.status): RideActivityPayload {
  return {
    rideNumber: tripDisplayNumber(ride),
    step: rideActivityStep(status),
    pickupAtMs: typeof ride.pickupAt === "number" ? ride.pickupAt : null,
    legLabel: ride.trip?.leg === "return" ? "Ride home" : null,
  };
}

/**
 * What to send when the shown ride is no longer the one to show: its final state if it just finished (the
 * native side ends it, leaving "Ride complete" up for a few minutes), else null (end it now).
 */
export function finishedRidePayload(
  previous: DispatchedRide,
  recentlyFinished: DispatchedRide[],
): RideActivityPayload | null {
  const finished = recentlyFinished.find((ride) => ride.id === previous.id);
  if (finished?.status === "completed" || finished?.status === "cancelled") {
    return rideActivityPayload(previous, finished.status);
  }
  return null;
}
