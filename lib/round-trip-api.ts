// POST /api/rides/<id>/ready-to-return (BEN-12). See lib/round-trip.ts for the contract.
import { DEMO_MODE } from "./demo-mode";
import { getToken } from "./fleet-api";
import { fleetFetch, readApiErrorMessage } from "./fleet-api-transport";
import { getRideBackendId } from "./rides";

export type ReadyToReturnResult = { ok: boolean; message?: string; duplicate?: boolean };

/** Tell dispatch the passenger is ready to go home. Safe to repeat: the backend answers once per trip. */
export async function sendReadyToReturn(rideId: string, note: string): Promise<ReadyToReturnResult> {
  if (DEMO_MODE) return { ok: true };
  const token = getToken();
  if (!token) return { ok: false, message: "You're signed out. Sign in and try again." };

  const id = encodeURIComponent(String(getRideBackendId(rideId) ?? rideId));
  const path = `/api/rides/${id}/ready-to-return`;
  const { res } = await fleetFetch(
    "POST",
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(note.trim() ? { note: note.trim() } : {}),
    },
    { minIntervalMs: 1000, failureBackoffMs: 0, throttleKey: `POST ${path}` },
  );

  if (!res) return { ok: false, message: "Couldn't reach dispatch. Check your connection and try again." };
  if (res.ok) {
    let duplicate = false;
    try {
      duplicate = (await res.json())?.duplicate === true;
    } catch {
      // A 2xx without a JSON body still means dispatch got it.
    }
    return { ok: true, duplicate };
  }
  if (res.status === 401) return { ok: false, message: "Your session expired. Sign in again." };
  if (res.status === 404) return { ok: false, message: "This ride is no longer assigned to you. Message dispatch." };
  const message = await readApiErrorMessage(res);
  return { ok: false, message: message ?? `Dispatch couldn't record that (${res.status}). Try again or message dispatch.` };
}
