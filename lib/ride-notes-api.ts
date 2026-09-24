// Ride notes for the assigned TR (BEN-13): GET/POST /api/rides/<id>/notes.

import { isAgreementRequiredBody } from "./agreement-events";
import { demoRides } from "./demo-data";
import { DEMO_MODE } from "./demo-mode";
import { getToken } from "./fleet-api";
import { fleetFetch, readApiErrorMessage } from "./fleet-api-transport";
import { normalizeRideNote, normalizeRideNotes } from "./fleet-normalization";
import { getRideBackendId, type RideNote } from "./rides";

export const RIDE_NOTE_MAX_LENGTH = 2000;

export class RideNotesError extends Error {
  constructor(
    /** HTTP status, or 0 when the request never got a response. */
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RideNotesError";
  }
}

export function buildRideNotesPath(rideId: string): string {
  const backendId = getRideBackendId(rideId);
  return `/api/rides/${encodeURIComponent(String(backendId ?? rideId))}/notes`;
}

/** Trimmed note text, or a driver-facing reason it can't be sent. */
export function validateRideNoteText(text: string): { ok: true; text: string } | { ok: false; message: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, message: "Write a note first." };
  if (trimmed.length > RIDE_NOTE_MAX_LENGTH) {
    return { ok: false, message: `Notes can be up to ${RIDE_NOTE_MAX_LENGTH} characters.` };
  }
  return { ok: true, text: trimmed };
}

export async function fetchRideNotes(rideId: string): Promise<RideNote[]> {
  if (DEMO_MODE) return demoNotesFor(rideId).slice();

  const path = buildRideNotesPath(rideId);
  const { result, res } = await fleetFetch(
    "GET",
    path,
    { headers: requireAuthHeaders() },
    { minIntervalMs: 1000, failureBackoffMs: 0, throttleKey: `GET ${path}` },
  );
  if (!res) {
    throw new RideNotesError(0, result === "skipped" ? "Notes are already loading." : "Couldn't load notes. Check your connection.");
  }
  if (!res.ok) throw await toRideNotesError(res, "Couldn't load notes.");

  const body = await res.json().catch(() => null);
  const rawNotes = Array.isArray(body) ? body : body && typeof body === "object" ? (body as Record<string, unknown>).notes : null;
  return normalizeRideNotes(rawNotes);
}

export async function addRideNote(rideId: string, text: string, authorName = "You"): Promise<RideNote> {
  const valid = validateRideNoteText(text);
  if (!valid.ok) throw new RideNotesError(400, valid.message);

  if (DEMO_MODE) {
    const note: RideNote = {
      id: `demo-note-${Date.now()}`,
      authorRole: "tr",
      authorName,
      text: valid.text,
      createdAt: new Date().toISOString(),
    };
    demoNotesFor(rideId).push(note);
    return note;
  }

  const path = buildRideNotesPath(rideId);
  const { result, res } = await fleetFetch(
    "POST",
    path,
    {
      method: "POST",
      headers: requireAuthHeaders(),
      body: JSON.stringify({ text: valid.text }),
    },
    { minIntervalMs: 500, failureBackoffMs: 0, throttleKey: `POST ${path}` },
  );
  if (!res) {
    throw new RideNotesError(0, result === "skipped" ? "Still sending your last note." : "Couldn't reach dispatch. Check your connection and try again.");
  }
  if (!res.ok) throw await toRideNotesError(res, "Couldn't add the note. Try again.");

  const body = await res.json().catch(() => null);
  const note = normalizeRideNote(body && typeof body === "object" && "note" in body ? (body as Record<string, unknown>).note : body);
  if (!note) throw new RideNotesError(0, "Note sent, but the response was unreadable. Pull to refresh.");
  return note;
}

function requireAuthHeaders(): HeadersInit {
  const token = getToken();
  if (!token) throw new RideNotesError(401, "You're signed out. Sign in and try again.");
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function toRideNotesError(res: Response, fallback: string): Promise<RideNotesError> {
  if (res.status === 401) return new RideNotesError(401, "Your session expired. Sign in again.");
  if (res.status === 403) {
    // The transport already re-opened the agreement screen for this 403 (BEN-20); just explain it here.
    const body = await res.clone().json().catch(() => null);
    if (isAgreementRequiredBody(body)) {
      return new RideNotesError(403, "Accept the Trusted Rider agreement to see and add ride notes.");
    }
  }
  if (res.status === 404 || res.status === 403) return new RideNotesError(res.status, "This ride is no longer assigned to you.");
  const message = res.status === 400 ? await readApiErrorMessage(res) : null;
  return new RideNotesError(res.status, message ?? fallback);
}

// Demo mode keeps notes in memory for the app session, seeded from the demo rides.
const demoNotesByRide = new Map<string, RideNote[]>();

function demoNotesFor(rideId: string): RideNote[] {
  let notes = demoNotesByRide.get(rideId);
  if (!notes) {
    notes = (demoRides.find((ride) => ride.id === rideId)?.rideNotes ?? []).slice();
    demoNotesByRide.set(rideId, notes);
  }
  return notes;
}
