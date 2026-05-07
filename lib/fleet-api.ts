// Fleet Tracking API client — handles auth + location updates to Flask backend

import { Platform } from "react-native";

import {
  ApiRequestThrottle,
  type ApiRequestResult,
} from "./api-request-throttle";
import { FLEET_API_URL } from "./config";
import {
  getRideBackendId,
  type DispatchedRide,
  type RideStatus,
  type TransitType,
} from "./rides";
import * as storage from "./storage";

const TOKEN_KEY = "trustedriders-auth-token";
const DRIVER_ID_KEY = "trustedriders-driver-id";
const ACTIVE_RIDE_KEY = "trustedriders-active-ride";

let token: string | null = null;
let driverId: number | null = null;

export type FleetUser = { id: number; name: string; email: string };
export type LocationUpdateResult = ApiRequestResult;

const FLEET_UPSTREAM_UNAVAILABLE_BACKOFF_MS = 5 * 60 * 1000;
const RIDE_DETAIL_CACHE_MS = 60 * 1000;

const requestThrottles = new Map<string, ApiRequestThrottle>();
const rideDetailCache = new Map<string, { expiresAt: number; data: Record<string, unknown> | null }>();
let fleetPausedUntil = 0;

type FleetFetchResult =
  | { result: "sent" | "failed"; res: Response }
  | { result: "failed" | "skipped" | "paused"; res: null };

type FleetFetchOptions = {
  minIntervalMs?: number;
  failureBackoffMs?: number;
  throttleKey?: string;
};

// One log line per outbound API call. Prints to Metro so the backend team can
// correlate with their server logs. Failures include the response body so 4xx
// validation errors are visible without extra tooling.
async function logApi(
  method: string,
  path: string,
  res: Response | null,
  error?: unknown,
): Promise<void> {
  const ts = new Date().toISOString();
  if (!res) {
    console.log(`[api] ${ts} ${method} ${path} → FAIL (network) ${String(error ?? "")}`);
    return;
  }
  const tag = res.ok ? "OK" : "FAIL";
  let bodyNote = "";
  if (!res.ok) {
    try {
      const clone = res.clone();
      const text = await clone.text();
      bodyNote = text ? ` body=${text.slice(0, 300)}` : "";
    } catch {
      // ignore — logging must never throw
    }
  }
  console.log(`[api] ${ts} ${method} ${path} → ${res.status} ${tag}${bodyNote}`);
}

async function isNgrokUnavailable(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  if (res.headers.get("ngrok-error-code") === "ERR_NGROK_725") return true;

  try {
    const text = await res.clone().text();
    return text.includes("ERR_NGROK_725") || text.includes("network bandwidth limit");
  } catch {
    return false;
  }
}

function pauseFleetApi(reason: string): void {
  fleetPausedUntil = Math.max(fleetPausedUntil, Date.now() + FLEET_UPSTREAM_UNAVAILABLE_BACKOFF_MS);
  console.log(
    `[api] ${new Date().toISOString()} Fleet API → PAUSED for ${Math.round(
      FLEET_UPSTREAM_UNAVAILABLE_BACKOFF_MS / 1000,
    )}s (${reason})`,
  );
}

function getRequestThrottle(
  key: string,
  minIntervalMs: number,
  failureBackoffMs: number,
): ApiRequestThrottle {
  const existing = requestThrottles.get(key);
  if (existing) return existing;

  const next = new ApiRequestThrottle(minIntervalMs, failureBackoffMs);
  requestThrottles.set(key, next);
  return next;
}

async function fleetFetch(
  method: string,
  path: string,
  init: RequestInit,
  options: FleetFetchOptions = {},
): Promise<FleetFetchResult> {
  const now = Date.now();
  if (now < fleetPausedUntil) {
    console.log(`[api] ${new Date().toISOString()} ${method} ${path} → SKIPPED (Fleet API paused)`);
    return { result: "paused", res: null };
  }

  const throttle = getRequestThrottle(
    options.throttleKey ?? `${method} ${path}`,
    options.minIntervalMs ?? 1000,
    options.failureBackoffMs ?? 30000,
  );
  if (!throttle.begin()) {
    console.log(`[api] ${new Date().toISOString()} ${method} ${path} → SKIPPED (rate limited)`);
    return { result: "skipped", res: null };
  }

  let result: Exclude<ApiRequestResult, "skipped"> = "failed";
  try {
    const res = await fetch(`${FLEET_API_URL}${path}`, init);
    if (await isNgrokUnavailable(res)) {
      pauseFleetApi("ngrok bandwidth limit");
      result = "paused";
      return { result, res: null };
    }

    await logApi(method, path, res);
    result = res.ok ? "sent" : "failed";
    return { result, res };
  } catch (err) {
    await logApi(method, path, null, err);
    result = "failed";
    return { result, res: null };
  } finally {
    throttle.finish(result);
  }
}

export async function login(email: string, password: string): Promise<FleetUser> {
  const { res } = await fleetFetch(
    "POST",
    "/api/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    },
    { minIntervalMs: 2000, throttleKey: "POST /api/login" },
  );
  if (!res) throw new Error("Fleet API unavailable");
  if (!res.ok) throw new Error("Invalid credentials");
  const data = await res.json();
  token = data.token;
  const user = normalizeUser(data.user);
  driverId = user.id;
  await storage.set(TOKEN_KEY, data.token);
  await storage.set(DRIVER_ID_KEY, String(user.id));
  return user;
}

export function getToken(): string | null {
  return token;
}

export function getDriverId(): number | null {
  return driverId;
}

function authHeaders(): HeadersInit | null {
  if (!token) return null;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function clearToken(): Promise<void> {
  token = null;
  driverId = null;
  await storage.remove(TOKEN_KEY);
  await storage.remove(DRIVER_ID_KEY);
}

// Rehydrate the in-memory token from persistent storage on app boot.
// Call this once before rendering any authenticated UI.
export async function restoreToken(): Promise<string | null> {
  const [stored, storedDriverId] = await Promise.all([
    storage.get(TOKEN_KEY),
    storage.get(DRIVER_ID_KEY),
  ]);
  if (stored) token = stored;
  driverId = parseDriverId(storedDriverId);
  return stored;
}

// Active ride tracking — written by MissionScreen so the background location
// TaskManager handler (which runs outside React) can read the current ride id.
export async function setActiveRideId(rideId: number): Promise<void> {
  await storage.set(ACTIVE_RIDE_KEY, String(rideId));
}

export async function clearActiveRideId(): Promise<void> {
  await storage.remove(ACTIVE_RIDE_KEY);
}

export async function getActiveRideId(): Promise<number | null> {
  const stored = await storage.get(ACTIVE_RIDE_KEY);
  if (!stored) return null;
  const n = Number(stored);
  return Number.isFinite(n) ? n : null;
}

/**
 * Registered by `lib/push.ts` when push notifications are re-enabled.
 * Currently unused — see `lib/push.ts` for the disabled-state rationale.
 *
 * @deprecated until push.ts is un-stubbed (tracked in commit history).
 */
export async function registerPushToken(pushToken: string): Promise<boolean> {
  if (!token) return false;
  const { res } = await fleetFetch(
    "POST",
    "/api/register-push-token",
    {
      method: "POST",
      headers: authHeaders() ?? undefined,
      body: JSON.stringify({ push_token: pushToken, platform: Platform.OS }),
    },
    { minIntervalMs: 60000, throttleKey: "POST /api/register-push-token" },
  );
  return !!res?.ok;
}

export async function updateLocation(loc: {
  lat: number;
  lon: number;
  timestamp: string;
  ride_id: number | null;
}): Promise<LocationUpdateResult> {
  if (!token) return "skipped";

  const { result, res } = await fleetFetch(
    "POST",
    "/api/update_location",
    {
      method: "POST",
      headers: authHeaders() ?? undefined,
      body: JSON.stringify(loc),
    },
    {
      minIntervalMs: 10000,
      failureBackoffMs: 30000,
      throttleKey: "POST /api/update_location",
    },
  );

  // 401 is the standard "token missing/invalid" response.
  // 422 with a JWT-shaped message is Flask-JWT-Extended's way of saying the
  // signature doesn't verify — happens when the backend rotates its
  // JWT_SECRET_KEY. Same remedy either way: drop the dead token so the
  // auth gate forces a fresh login.
  if (res && (res.status === 401 || (res.status === 422 && (await isAuthFailure(res))))) {
    await clearToken();
    return "failed";
  }
  return result;
}

export async function fetchRides(driverIdOverride?: number): Promise<DispatchedRide[]> {
  const headers = authHeaders();
  if (!headers) return [];

  const idForPoll = driverIdOverride ?? driverId;
  if (!idForPoll) return [];
  const path = `/api/drivers/${encodeURIComponent(String(idForPoll))}/rides`;

  const { res } = await fleetFetch(
    "GET",
    path,
    { headers },
    {
      minIntervalMs: 15000,
      failureBackoffMs: 30000,
      throttleKey: `GET /api/drivers/${idForPoll}/rides`,
    },
  );

  if (!res) return [];
  if (res.status === 401 || (res.status === 422 && (await isAuthFailure(res)))) {
    await clearToken();
    return [];
  }
  if (res.status === 404) {
    return [];
  }
  if (!res.ok) {
    return [];
  }

  try {
    const body = await res.json();
    const rawRides: unknown[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.rides)
        ? body.rides
        : Array.isArray(body?.data)
          ? body.data
          : [];

    const detailedRides: Array<DispatchedRide | null> = [];
    for (const ride of rawRides) {
      const summary = ride as Record<string, unknown>;
      const rideId = pickString(summary, ["id", "ride_id", "rideId", "uuid"]);
      const detail = rideId ? await fetchRideDetail(rideId, headers) : null;
      detailedRides.push(normalizeRide({ ...summary, ...(detail ?? {}) }));
    }

    return detailedRides.filter((ride): ride is DispatchedRide => !!ride);
  } catch (err) {
    console.log(`[api] failed to parse ${path} response ${String(err)}`);
    return [];
  }
}

async function fetchRideDetail(rideId: string, headers: HeadersInit): Promise<Record<string, unknown> | null> {
  const backendId = getRideBackendId(rideId);
  const id = encodeURIComponent(String(backendId ?? rideId));
  const path = `/api/rides/${id}`;
  const cacheKey = String(backendId ?? rideId);
  const cached = rideDetailCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const { res } = await fleetFetch(
    "GET",
    path,
    { headers },
    {
      minIntervalMs: 1000,
      failureBackoffMs: 30000,
      throttleKey: `GET /api/rides/${cacheKey}`,
    },
  );

  if (!res?.ok) {
    rideDetailCache.set(cacheKey, { expiresAt: Date.now() + RIDE_DETAIL_CACHE_MS, data: null });
    return null;
  }

  try {
    const body = await res.json();
    const data = body && typeof body === "object" ? body as Record<string, unknown> : null;
    rideDetailCache.set(cacheKey, { expiresAt: Date.now() + RIDE_DETAIL_CACHE_MS, data });
    return data;
  } catch {
    rideDetailCache.set(cacheKey, { expiresAt: Date.now() + RIDE_DETAIL_CACHE_MS, data: null });
    return null;
  }
}

export async function updateRideStatus(rideId: string, status: RideStatus): Promise<boolean> {
  const headers = authHeaders();
  if (!headers) return false;

  const backendId = getRideBackendId(rideId);
  const id = encodeURIComponent(String(backendId ?? rideId));
  const path = `/api/rides/${id}/status`;
  const { res } = await fleetFetch(
    "PATCH",
    path,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: toBackendStatus(status) }),
    },
    {
      minIntervalMs: 2000,
      failureBackoffMs: 30000,
      throttleKey: `PATCH /api/rides/${id}/status`,
    },
  );

  if (!res) return false;
  if (res.status === 401 || (res.status === 422 && (await isAuthFailure(res)))) {
    await clearToken();
    return false;
  }
  return res.ok;
}

async function isAuthFailure(res: Response): Promise<boolean> {
  try {
    const body = await res.clone().json();
    const msg = typeof body?.msg === "string" ? body.msg.toLowerCase() : "";
    return (
      msg.includes("signature") ||
      msg.includes("token") ||
      msg.includes("authorization")
    );
  } catch {
    return false;
  }
}

function normalizeUser(raw: unknown): FleetUser {
  const user = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const id = parseDriverId(user.id);
  if (!id) throw new Error("Login response missing driver id");

  return {
    id,
    name: pickString(user, ["name", "driver_name", "driverName", "email"]) ?? `Driver #${id}`,
    email: pickString(user, ["email"]) ?? "",
  };
}

function parseDriverId(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function normalizeRide(raw: Record<string, unknown>): DispatchedRide | null {
  if (!raw || typeof raw !== "object") return null;

  const id = pickString(raw, ["id", "ride_id", "rideId", "uuid"]);
  if (!id) return null;

  const pickupDate = pickString(raw, ["pickup_date", "scheduled_date", "scheduledDate", "ride_date", "date", "start_time", "startTime"]);
  const pickupTime = pickString(raw, ["pickup_time", "scheduled_time", "scheduledTime", "ride_time", "time", "start_time", "startTime"]);
  const passengerName =
    pickString(raw, ["passenger_name", "rider_name", "passengerName", "client_name", "customer_name", "name"]) ||
    pickNestedString(raw, ["passenger", "rider", "client", "customer"], ["name", "full_name", "fullName"]) ||
    `Ride #${id}`;
  const passengerPhotoUrl =
    pickString(raw, [
      "passenger_photo_url",
      "passengerPhotoUrl",
      "rider_photo_url",
      "riderPhotoUrl",
      "client_photo_url",
      "clientPhotoUrl",
      "profile_photo_url",
      "profilePhotoUrl",
      "avatar_url",
      "avatarUrl",
      "photo_url",
      "photoUrl",
    ]) ||
    pickNestedString(raw, ["passenger", "rider", "client", "customer"], [
      "photo_url",
      "photoUrl",
      "profile_photo_url",
      "profilePhotoUrl",
      "avatar_url",
      "avatarUrl",
    ]) ||
    "";
  const createdAtRaw = pickString(raw, ["created_at", "createdAt", "start_time", "startTime"]);
  const createdAt = createdAtRaw ? Date.parse(createdAtRaw) : Date.now();

  return {
    id,
    passengerName,
    passengerPhotoUrl,
    pickupAddress: pickString(raw, ["pickup_address", "pickupAddress", "pickup"]) || "Pickup address pending",
    dropoffAddress:
      pickString(raw, ["dropoff_address", "dropoffAddress", "destination_address", "dropoff"]) ||
      "Drop-off address pending",
    pickupCoords: pickCoords(raw, "pickup"),
    dropoffCoords: pickCoords(raw, "dropoff"),
    routeCoords: pickRouteCoords(raw),
    scheduledDate: formatRideDate(pickupDate ?? pickupTime),
    scheduledTime: formatRideTime(pickupTime),
    transitType: normalizeTransitType(pickString(raw, ["transit_type", "transitType", "vehicle_type", "vehicle"])),
    tripType: normalizeTripType(pickString(raw, ["trip_type", "tripType", "ride_type"])),
    notes:
      pickString(raw, ["notes", "care_notes", "careNotes", "special_instructions", "specialInstructions", "special_conditions", "specialConditions", "conditions", "medical_conditions", "medicalConditions", "accessibility_notes", "accessibilityNotes"]) ||
      pickNestedString(raw, ["passenger", "rider", "client", "customer"], ["notes", "care_notes", "careNotes", "special_conditions", "specialConditions", "conditions", "medical_conditions", "medicalConditions", "accessibility_notes", "accessibilityNotes"]) ||
      "",
    emergencyContact: pickString(raw, ["emergency_contact", "emergencyContact", "contact_phone"]) || "",
    status: normalizeRideStatus(pickString(raw, ["status", "ride_status"]) || ""),
    createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
  };
}

function pickString(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function pickNestedString(raw: Record<string, unknown>, objectKeys: string[], valueKeys: string[]): string | null {
  for (const objectKey of objectKeys) {
    const value = raw[objectKey];
    if (!value || typeof value !== "object") continue;
    const picked = pickString(value as Record<string, unknown>, valueKeys);
    if (picked) return picked;
  }
  return null;
}

function pickCoords(raw: Record<string, unknown>, prefix: "pickup" | "dropoff"): { latitude: number; longitude: number } | null {
  const routeEndpoint = prefix === "pickup" ? raw.start : raw.end;
  const direct = raw[`${prefix}Coords`] ?? raw[`${prefix}_coords`] ?? routeEndpoint;
  if (direct && typeof direct === "object") {
    const obj = direct as Record<string, unknown>;
    const latitude = toNumber(obj.latitude ?? obj.lat);
    const longitude = toNumber(obj.longitude ?? obj.lon ?? obj.lng);
    if (latitude !== null && longitude !== null) return { latitude, longitude };
  }

  const latitude = toNumber(raw[`${prefix}_latitude`] ?? raw[`${prefix}_lat`]);
  const longitude = toNumber(raw[`${prefix}_longitude`] ?? raw[`${prefix}_lon`] ?? raw[`${prefix}_lng`]);
  if (latitude !== null && longitude !== null) return { latitude, longitude };
  return null;
}

function pickRouteCoords(raw: Record<string, unknown>): { latitude: number; longitude: number }[] {
  // The backend's `route[]` field is a driver breadcrumb trail, not planned
  // pickup-to-dropoff geometry. Only consume explicitly named route geometry
  // fields so stale tracking pings cannot stretch ride maps across the globe.
  const value =
    raw.routeCoords ??
    raw.route_coords ??
    raw.plannedRoute ??
    raw.planned_route ??
    raw.routeGeometry ??
    raw.route_geometry;
  if (!Array.isArray(value)) return [];

  return value
    .map((point) => {
      if (!point || typeof point !== "object") return null;
      const obj = point as Record<string, unknown>;
      const latitude = toNumber(obj.latitude ?? obj.lat);
      const longitude = toNumber(obj.longitude ?? obj.lon ?? obj.lng);
      if (latitude === null || longitude === null || !isValidCoordinate(latitude, longitude)) {
        return null;
      }
      return { latitude, longitude };
    })
    .filter((point): point is { latitude: number; longitude: number } => !!point);
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function normalizeRideStatus(status: string): RideStatus {
  const value = status.toLowerCase().replace(/[-\s]/g, "_");
  if (["requested", "request", "pending", "new"].includes(value)) return "pending";
  if (["scheduled", "booked", "assigned", "accepted"].includes(value)) return "accepted";
  if (["active", "in_progress", "en_route", "enroute", "on_way", "released"].includes(value)) return "en_route";
  if (["picked_up", "pickedup"].includes(value)) return "picked_up";
  if (["in_transit", "intransit"].includes(value)) return "in_transit";
  if (["completed", "complete", "done"].includes(value)) return "completed";
  if (["cancelled", "canceled", "declined"].includes(value)) return "cancelled";
  return "pending";
}

function toBackendStatus(status: RideStatus): string {
  return status === "cancelled" ? "cancelled" : status;
}

function normalizeTransitType(value: string | null): TransitType {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("wheel")) return "Wheelchair";
  if (normalized.includes("stretch")) return "Stretcher";
  if (normalized.includes("ambul")) return "Ambulatory";
  return "Sedan";
}

function normalizeTripType(value: string | null): "One-Way" | "Round-Trip" {
  return value?.toLowerCase().includes("round") ? "Round-Trip" : "One-Way";
}

function formatRideDate(value: string | null): string {
  if (!value) return "Today";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value.split("T")[0] || value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatRideTime(value: string | null): string {
  if (!value) return "Time pending";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
