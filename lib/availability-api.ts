// TrustedRider availability API.
//   GET /api/me/availability?days=14   -> {from, days: [{date, status, windows}]}
//   PUT /api/me/availability {days}    -> {days: [...saved]}; 400 {error} for bad input

import { normalizeDay, type AvailabilityDay } from "./availability";
import { DEMO_MODE } from "./demo-mode";
import { expireSession, getToken } from "./fleet-api";
import { fleetFetch, readApiErrorMessage } from "./fleet-api-transport";

export const AVAILABILITY_PATH = "/api/me/availability";
export const AVAILABILITY_DAYS = 14;

export type AvailabilityLoadResult =
  | { kind: "ok"; days: AvailabilityDay[] }
  | { kind: "signed_out" }
  | { kind: "error"; message: string };

export type AvailabilitySaveResult =
  | { kind: "ok"; days: AvailabilityDay[] }
  | { kind: "signed_out" }
  | { kind: "error"; message: string };

function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function isSignedOutStatus(status: number): boolean {
  return status === 401 || status === 422;
}

function localIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function demoDays(): AvailabilityDay[] {
  const today = new Date();
  return Array.from({ length: AVAILABILITY_DAYS }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    return { date: localIsoDay(d), status: null, windows: [] };
  });
}

function parseDays(body: unknown): AvailabilityDay[] | null {
  const raw = (body as { days?: unknown })?.days;
  if (!Array.isArray(raw)) return null;
  const days = raw.map(normalizeDay);
  return days.every(Boolean) ? (days as AvailabilityDay[]) : null;
}

export async function fetchMyAvailability(): Promise<AvailabilityLoadResult> {
  if (DEMO_MODE) return { kind: "ok", days: demoDays() };
  if (!getToken()) return { kind: "signed_out" };
  const path = `${AVAILABILITY_PATH}?days=${AVAILABILITY_DAYS}`;
  const { res } = await fleetFetch("GET", path, { headers: authHeaders() }, {
    minIntervalMs: 1000,
    failureBackoffMs: 0,
    throttleKey: `GET ${AVAILABILITY_PATH}`,
  });
  if (!res) return { kind: "error", message: "Couldn't reach dispatch. Check your connection and try again." };
  if (isSignedOutStatus(res.status)) {
    await expireSession();
    return { kind: "signed_out" };
  }
  if (!res.ok) return { kind: "error", message: (await readApiErrorMessage(res)) ?? `Couldn't load your availability (${res.status}).` };
  try {
    const days = parseDays(await res.json());
    return days ? { kind: "ok", days } : { kind: "error", message: "Couldn't read your availability." };
  } catch {
    return { kind: "error", message: "Couldn't read your availability." };
  }
}

export function buildSaveAvailabilityRequest(days: AvailabilityDay[]): { path: string; init: RequestInit } {
  return {
    path: AVAILABILITY_PATH,
    init: {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({
        days: days.map((d) => ({ date: d.date, status: d.status, windows: d.status === "available" ? d.windows : [] })),
      }),
    },
  };
}

export async function saveMyAvailability(days: AvailabilityDay[]): Promise<AvailabilitySaveResult> {
  if (DEMO_MODE) return { kind: "ok", days };
  if (!getToken()) return { kind: "signed_out" };
  const { path, init } = buildSaveAvailabilityRequest(days);
  const { res } = await fleetFetch("PUT", path, init, { minIntervalMs: 500, failureBackoffMs: 0, throttleKey: `PUT ${path}` });
  if (!res) return { kind: "error", message: "Couldn't reach dispatch. Your changes aren't saved yet; try again." };
  if (isSignedOutStatus(res.status)) {
    await expireSession();
    return { kind: "signed_out" };
  }
  if (!res.ok) return { kind: "error", message: (await readApiErrorMessage(res)) ?? `Couldn't save (${res.status}). Try again.` };
  try {
    const saved = parseDays(await res.json());
    return saved ? { kind: "ok", days: saved } : { kind: "ok", days };
  } catch {
    return { kind: "ok", days };
  }
}
