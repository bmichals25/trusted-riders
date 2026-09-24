// Round trips (BEN-11) and Ready to Return (BEN-12). Pure helpers: no React Native or network imports, so
// they load in node tests.
//
// Backend contract: every ride payload (GET /api/rides and /api/rides/<id>) carries `trip`:
//   null for a one-way ride, else { id, leg: "outbound" | "return", leg_number, leg_count, label,
//   outbound_ride_id, return_ride_id, other_ride_id, other_ride_status, return_time_open,
//   return_start_time, ready_to_return_at, ready_to_return_note, transport_method, transport_note,
//   can_ready_to_return, needs_return_plan }.
// The two legs are separate rides with their own status. The TR accepts / declines the trip once (the
// backend applies it to both legs). After the outbound leg is completed (the app no longer shows it), the
// return leg offers "Ready to Return" (POST /api/rides/<outbound id>/ready-to-return). The return leg's
// backend status "ready to return" maps to the app's "accepted" (upcoming) status; the trip fields say
// dispatch is arranging the ride home.

export type TripLeg = "outbound" | "return";

export type RideTrip = {
  tripId: string;
  leg: TripLeg;
  legNumber: 1 | 2;
  /** "Leg 1 of 2 · Outbound" */
  label: string;
  outboundRideId: string | null;
  returnRideId: string | null;
  otherRideId: string | null;
  /** Backend status string of the other leg, as sent. */
  otherRideStatus: string | null;
  /** The return leg has no pickup time: it starts when the TR taps Ready to Return. */
  returnTimeOpen: boolean;
  readyToReturnAt: string | null;
  readyToReturnNote: string;
  /** How dispatch arranged the ride home ("TR drives", "Uber (agency code)", …); "" until decided. */
  transportMethod: string;
  transportNote: string;
  /** Outbound dropped off, ride home not started, Ready to Return not tapped yet. */
  canReadyToReturn: boolean;
  /** Ready to Return tapped and the ride home hasn't started: dispatch is arranging it. */
  needsReturnPlan: boolean;
};

type TripCarrier = { id: string; trip?: RideTrip | null };

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function normalizeTrip(raw: unknown): RideTrip | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const trip = raw as Record<string, unknown>;
  const leg = str(trip.leg)?.toLowerCase();
  if (leg !== "outbound" && leg !== "return") return null;
  const tripId = str(trip.id ?? trip.trip_id);
  if (!tripId) return null;
  const legNumber = leg === "outbound" ? 1 : 2;
  return {
    tripId,
    leg,
    legNumber,
    label: str(trip.label) ?? (leg === "outbound" ? "Leg 1 of 2 · Outbound" : "Leg 2 of 2 · Return"),
    outboundRideId: str(trip.outbound_ride_id),
    returnRideId: str(trip.return_ride_id),
    otherRideId: str(trip.other_ride_id),
    otherRideStatus: str(trip.other_ride_status),
    returnTimeOpen: trip.return_time_open === true,
    readyToReturnAt: str(trip.ready_to_return_at),
    readyToReturnNote: str(trip.ready_to_return_note) ?? "",
    transportMethod: str(trip.transport_method) ?? "",
    transportNote: str(trip.transport_note) ?? "",
    canReadyToReturn: trip.can_ready_to_return === true,
    needsReturnPlan: trip.needs_return_plan === true,
  };
}

export function isRoundTripRide(ride: { trip?: RideTrip | null } | null | undefined): boolean {
  return !!ride?.trip;
}

export function isSameTrip(a: { trip?: RideTrip | null }, b: { trip?: RideTrip | null }): boolean {
  return !!a.trip && !!b.trip && a.trip.tripId === b.trip.tripId;
}

/** "Return leg of ride #31" / "Ride home is ride #32" */
export function tripLinkText(ride: { trip?: RideTrip | null }): string {
  const trip = ride.trip;
  if (!trip) return "";
  if (trip.leg === "return") return trip.outboundRideId ? `Return leg of ride #${trip.outboundRideId}` : "Return leg";
  return trip.returnRideId ? `Ride home is ride #${trip.returnRideId}` : "Ride there";
}

/** Short time label for an open return leg (the card shows "date · time"). */
export const OPEN_RETURN_DATE_LABEL = "Ride home";
export const OPEN_RETURN_TIME_LABEL = "when you're ready";

export type ReadyToReturnState = "offer" | "waiting" | "arranged";

/**
 * What the Ready to Return card shows for a ride:
 *  - "offer": the passenger is at the appointment; show the Ready to Return button
 *  - "waiting": the TR tapped it; dispatch is arranging the ride home
 *  - "arranged": dispatch picked how the passenger gets home (transportMethod) but hasn't started the ride
 *  - null: nothing to show (one-way ride, ride home not due or already under way)
 * `sentLocally` covers the moment between a successful tap and the next ride refresh.
 */
export function readyToReturnState(
  ride: { status: string; trip?: RideTrip | null },
  sentLocally = false,
): ReadyToReturnState | null {
  const trip = ride.trip;
  if (!trip) return null;
  const upcoming = ride.status === "pending" || ride.status === "accepted";
  if (trip.leg === "return" && !upcoming) return null;
  if (trip.needsReturnPlan || sentLocally) return trip.transportMethod ? "arranged" : "waiting";
  if (trip.canReadyToReturn) return "offer";
  return null;
}

/**
 * The ride the home screen's Ready to Return card is about: the return leg of a round trip whose passenger
 * is at the appointment (or waiting for dispatch to arrange the ride home). The outbound leg is hidden once
 * completed, so this is normally the return leg.
 */
export function findReadyToReturnRide<T extends { id: string; status: string; trip?: RideTrip | null }>(
  rides: readonly T[],
  sentRideIds: ReadonlySet<string> = new Set(),
): T | null {
  return (
    rides.find((ride) => ride.trip?.leg === "return" && readyToReturnState(ride, sentRideIds.has(ride.id)) !== null) ??
    null
  );
}

/** The ride id to send Ready to Return for: the outbound leg (the backend accepts either leg). */
export function readyToReturnTargetId(ride: TripCarrier): string {
  return ride.trip?.outboundRideId ?? ride.id;
}

/** Suggested notes on the Ready to Return sheet. */
export const READY_TO_RETURN_NOTES = [
  "Appointment ran long",
  "Finished early",
  "Passenger needs extra help",
  "Waiting on paperwork",
] as const;

export const READY_TO_RETURN_NOTE_MAX = 300;

/** Joins a picked suggestion and free text into the note sent to dispatch ("" = no note). */
export function buildReadyToReturnNote(picked: string | null, details: string): string {
  const text = details.trim();
  const note = picked ? (text ? `${picked}: ${text}` : picked) : text;
  return note.slice(0, READY_TO_RETURN_NOTE_MAX);
}
