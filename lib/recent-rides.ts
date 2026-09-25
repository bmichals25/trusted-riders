// "Recently completed" on Home: rides the TR finished in the last few hours, so they can reopen one and leave
// a note for dispatch (POST /api/rides/<id>/notes works on the TR's own rides whatever their status). Pure
// helpers: no React Native or network imports, so they load in node tests.
//
// Minimum necessary (HIPAA): the window is short, the list is small, and nothing here is written to disk.
// The rows come from the regular GET /api/rides poll and live in memory only.

import { isFinishedBackendStatus } from "./rides";
import { groupRidesByTrip, isFinishedRideStatus, type RideTrip, type TripLegStep } from "./round-trip";

/** How long a finished ride stays on Home. */
export const RECENT_COMPLETED_WINDOW_MS = 24 * 60 * 60 * 1000;
/** At most this many trips on Home. */
export const RECENT_COMPLETED_LIMIT = 5;
/** Finished ride rows worth keeping from a ride list poll (a round trip is two rows). */
export const RECENT_FINISHED_ROW_LIMIT = RECENT_COMPLETED_LIMIT * 2;
// The phone's clock can trail the server's a little; an end time far in the future is bad data.
const CLOCK_SKEW_MS = 60 * 60 * 1000;

type FinishedCarrier = { id: string; status: string; endedAt?: number | null; trip?: RideTrip | null };

export type RecentCompletedTrip<T> = {
  /** Stable list key: "trip-<id>" for a round trip, the ride id for a one-way ride. */
  key: string;
  /**
   * The ride to open: the ride home for a round trip (notes added there sit on the trip's last leg, where
   * dispatch looks), else the ride itself.
   */
  ride: T;
  /** [] for a one-way ride, else Outbound then Ride home. */
  legSteps: TripLegStep[];
  /** When the trip's last leg was completed (epoch ms). */
  completedAt: number;
};

/** A finished ride's end time falls inside the recent window. */
export function endedRecently(endedAt: number | null | undefined, now: number, windowMs = RECENT_COMPLETED_WINDOW_MS): boolean {
  return typeof endedAt === "number" && Number.isFinite(endedAt) && endedAt >= now - windowMs && endedAt <= now + CLOCK_SKEW_MS;
}

/**
 * Trips (round trips grouped by trip id, one-way rides as they are) the TR finished recently, newest first:
 * every listed leg is finished (completed or cancelled), at least one was completed, and the latest completed
 * leg ended inside the window. `rides` is everything the app knows about (unfinished rides too), so a round
 * trip whose ride home is still to come never shows up here.
 */
export function recentCompletedTrips<T extends FinishedCarrier>(
  rides: readonly T[],
  now: number,
  { windowMs = RECENT_COMPLETED_WINDOW_MS, limit = RECENT_COMPLETED_LIMIT }: { windowMs?: number; limit?: number } = {},
): RecentCompletedTrip<T>[] {
  const recent: RecentCompletedTrip<T>[] = [];
  for (const entry of groupRidesByTrip(rides)) {
    const legs = entry.ride.trip
      ? [entry.legs.outbound, entry.legs.return].filter((leg): leg is T => !!leg)
      : [entry.ride];
    if (!legs.every((leg) => isFinishedRideStatus(leg.status))) continue;
    const completedLegs = legs.filter((leg) => leg.status === "completed" && typeof leg.endedAt === "number");
    if (completedLegs.length === 0) continue;
    const completedAt = Math.max(...completedLegs.map((leg) => leg.endedAt as number));
    if (!endedRecently(completedAt, now, windowMs)) continue;
    const returnLeg = entry.legs.return;
    const ride = returnLeg?.status === "completed"
      ? returnLeg
      : completedLegs.reduce((latest, leg) => ((leg.endedAt as number) > (latest.endedAt as number) ? leg : latest));
    recent.push({ key: entry.key, ride, legSteps: finishedTripSteps(entry.legs, entry.legSteps), completedAt });
  }
  return recent.sort((a, b) => b.completedAt - a.completedAt).slice(0, Math.max(0, limit));
}

/**
 * Leg steps for a finished trip. When the ride home isn't listed (another TR drove it, or it was cancelled
 * before the window) the outbound leg's trip block still says how it went.
 */
function finishedTripSteps<T extends FinishedCarrier>(legs: { outbound?: T; return?: T }, steps: TripLegStep[]): TripLegStep[] {
  const otherStatus = legs.outbound?.trip?.otherRideStatus;
  if (legs.return || !legs.outbound || !otherStatus) return steps;
  return [
    { leg: "outbound", state: "done" },
    { leg: "return", state: isFinishedBackendStatus(otherStatus) ? "done" : "upcoming" },
  ];
}

/**
 * Finished ride list rows (as parsed) worth keeping for Home: completed or cancelled rows that ended inside
 * the window, newest first, capped. Cancelled rows are kept so a round trip whose ride home was cancelled
 * still reads as finished.
 */
export function pickRecentFinishedRows<T extends { status: string; endedAt: number | null }>(
  rows: readonly T[],
  now: number,
  { windowMs = RECENT_COMPLETED_WINDOW_MS, limit = RECENT_FINISHED_ROW_LIMIT }: { windowMs?: number; limit?: number } = {},
): T[] {
  return rows
    .filter((row) => isFinishedRideStatus(row.status) && endedRecently(row.endedAt, now, windowMs))
    .sort((a, b) => (b.endedAt as number) - (a.endedAt as number))
    .slice(0, Math.max(0, limit));
}

/** "Completed 12:13 AM", or "Completed Sep 24, 11:50 PM" when it wasn't today. */
export function completedTimeLabel(completedAt: number, now: number): string {
  const date = new Date(completedAt);
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === new Date(now).toDateString()) return `Completed ${time}`;
  return `Completed ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}
