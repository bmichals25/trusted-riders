// Fleet Tracking API client — handles auth + location updates to Flask backend

import { Platform } from "react-native";

import {
  ApiRequestThrottle,
  type ApiRequestResult,
} from "./api-request-throttle";
import { FLEET_API_URL } from "./config";
import { demoRides } from "./demo-data";
import { DEMO_MODE } from "./demo-mode";
import { shouldSuppressRideFetchError } from "./fleet-fetch-result";
import {
  getRideBackendId,
  mergeRideSummaryAndDetail,
  normalizeRouteGeometry,
  type DispatchedRide,
  type RideCoordinate,
  type RideStatus,
  type TransitType,
} from "./rides";
import * as storage from "./storage";

const TOKEN_KEY = "trustedriders-auth-token";
const ACTIVE_RIDE_KEY = "trustedriders-active-ride";
const RIDE_DETAIL_STORAGE_PREFIX = "trustedriders-ride-detail";

let token: string | null = null;

export type FleetUser = { name: string; email: string };
export type LocationUpdateResult = ApiRequestResult;

export class FleetApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly path: string,
  ) {
    super(message);
    this.name = "FleetApiError";
  }
}

export class FleetApiRefreshSkippedError extends Error {
  constructor(
    public readonly path: string,
  ) {
    super("Ride refresh skipped.");
    this.name = "FleetApiRefreshSkippedError";
  }
}

export function isFleetApiError(error: unknown): error is FleetApiError {
  return error instanceof FleetApiError;
}

export function isFleetApiRefreshSkippedError(error: unknown): error is FleetApiRefreshSkippedError {
  return error instanceof FleetApiRefreshSkippedError;
}

const FLEET_UPSTREAM_UNAVAILABLE_BACKOFF_MS = 5 * 60 * 1000;
const RIDE_DETAIL_CACHE_MS = 60 * 1000;
const PERSISTED_RIDE_DETAIL_CACHE_MS = 24 * 60 * 60 * 1000;
const VISIBLE_RIDE_STATUSES = new Set<RideStatus>([
  "pending",
  "accepted",
  "en_route",
  "picked_up",
  "in_transit",
]);

const requestThrottles = new Map<string, ApiRequestThrottle>();
const rideDetailCache = new Map<string, { expiresAt: number; data: Record<string, unknown> | null }>();
let fleetPausedUntil = 0;

const rideDetailFallbacks: Record<string, Record<string, unknown>> = {
  // Temporary dev fallback from the backend payload shared for ride 174 while
  // the live detail endpoint is returning 500s.
  "174": {
    ride_id: 174,
    status: "in_progress",
    pickup_address: "123 William St, New York, NY 10038, USA",
    dropoff_address: "456 Greenwich St, New York, NY 10013, USA",
    start: { lat: 40.709322, lon: -74.007137 },
    end: { lat: 40.707571, lon: -74.013674 },
    planned_polyline: "g_nwFxmubMeAcAKMIPq@fB_AxBgBlEWn@M\\lAAZTRPjB|CbCXTINc@pAeCjHpAf@bDdApDjA",
    planned_route: [
      { lat: 40.70916, lon: -74.00685 },
      { lat: 40.70951, lon: -74.00651 },
      { lat: 40.70957, lon: -74.00644 },
      { lat: 40.70962, lon: -74.00653 },
      { lat: 40.70987, lon: -74.00705 },
      { lat: 40.71019, lon: -74.00766 },
      { lat: 40.71071, lon: -74.00869 },
      { lat: 40.71083, lon: -74.00893 },
      { lat: 40.7109, lon: -74.00908 },
      { lat: 40.71051, lon: -74.00941 },
      { lat: 40.71037, lon: -74.00952 },
      { lat: 40.71027, lon: -74.00961 },
      { lat: 40.70973, lon: -74.01007 },
      { lat: 40.70894, lon: -74.01073 },
      { lat: 40.70881, lon: -74.01084 },
      { lat: 40.70886, lon: -74.01092 },
      { lat: 40.70904, lon: -74.01133 },
      { lat: 40.70971, lon: -74.01283 },
      { lat: 40.7093, lon: -74.01303 },
      { lat: 40.70848, lon: -74.01338 },
      { lat: 40.70759, lon: -74.01376 },
    ],
    route_polyline: "gnwFroubM|Ixg@",
    route: [
      { lat: 40.709322, lon: -74.007137 },
      { lat: 40.707571, lon: -74.013674 },
    ],
    start_time: "2026-05-20T20:24:00",
  },
};

type FleetFetchResult =
  | { result: "sent" | "failed"; res: Response }
  | { result: "failed" | "skipped" | "paused"; res: null };

type FleetFetchOptions = {
  minIntervalMs?: number;
  failureBackoffMs?: number;
  throttleKey?: string;
};

export const LOGIN_FETCH_OPTIONS: FleetFetchOptions = {
  minIntervalMs: 2000,
  failureBackoffMs: 0,
  throttleKey: "POST /api/login",
};

// One log line per outbound API call. Prints to Metro so the backend team can
// correlate with their server logs. Failures include the response body so 4xx
// validation errors are visible without extra tooling.
async function logApi(
  method: string,
  path: string,
  url: string,
  res: Response | null,
  error?: unknown,
): Promise<void> {
  const ts = new Date().toISOString();
  if (!res) {
    console.log(`[api] ${ts} ${method} ${url} → FAIL (network) ${String(error ?? "")}`);
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
  console.log(`[api] ${ts} ${method} ${url} → ${res.status} ${tag}${bodyNote}`);
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

async function readApiErrorMessage(res: Response): Promise<string | null> {
  try {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await res.clone().json();
      const message = body?.error ?? body?.msg ?? body?.message;
      return typeof message === "string" && message.trim() ? message.trim() : null;
    }

    const text = await res.clone().text();
    const clean = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return clean ? clean.slice(0, 180) : null;
  } catch {
    return null;
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
  const url = `${FLEET_API_URL}${path}`;
  try {
    const res = await fetch(url, init);
    if (await isNgrokUnavailable(res)) {
      pauseFleetApi("ngrok bandwidth limit");
      result = "paused";
      return { result, res: null };
    }

    await logApi(method, path, url, res);
    result = res.ok ? "sent" : "failed";
    return { result, res };
  } catch (err) {
    await logApi(method, path, url, null, err);
    result = "failed";
    return { result, res: null };
  } finally {
    throttle.finish(result);
  }
}

export function normalizeLoginCredentials(email: string, password: string): {
  email: string;
  password: string;
} {
  return {
    email: email.trim(),
    password,
  };
}

export function extractAuthToken(raw: unknown): string | null {
  const body = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const direct = pickString(body, ["token", "access_token", "accessToken", "jwt"]);
  if (direct) return direct;

  for (const key of ["data", "auth", "session"]) {
    const nested = body[key];
    if (nested && typeof nested === "object") {
      const tokenValue = extractAuthToken(nested);
      if (tokenValue) return tokenValue;
    }
  }

  return null;
}

export async function login(email: string, password: string): Promise<FleetUser> {
  const credentials = normalizeLoginCredentials(email, password);
  if (DEMO_MODE) {
    token = "trustedriders-demo-token";
    await storage.set(TOKEN_KEY, token);
    return { name: "Jordan Mitchell", email: credentials.email };
  }

  const { result, res } = await fleetFetch(
    "POST",
    "/api/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    },
    LOGIN_FETCH_OPTIONS,
  );
  if (!res) {
    throw new Error(
      result === "skipped"
        ? "Please wait a moment before trying again."
        : "Fleet API unavailable. Check your connection and try again.",
    );
  }
  if (!res.ok) {
    const message = await readApiErrorMessage(res);
    throw new Error(message ?? (res.status === 401 ? "Invalid email or password" : "Unable to sign in."));
  }
  const data = await res.json();
  const authToken = extractAuthToken(data);
  if (!authToken) {
    throw new Error("Login response did not include an auth token.");
  }

  token = authToken;
  const user = normalizeUser(data.user ?? data.driver ?? data);
  console.log(`[auth] login ok user=${user.email || user.name}`);
  await storage.set(TOKEN_KEY, authToken);
  return user;
}

export function getToken(): string | null {
  return token;
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
  await storage.remove(TOKEN_KEY);
}

// Rehydrate the in-memory token from persistent storage on app boot.
// Call this once before rendering any authenticated UI.
export async function restoreToken(): Promise<string | null> {
  if (DEMO_MODE) {
    token = "trustedriders-demo-token";
    return token;
  }

  const stored = await storage.get(TOKEN_KEY);
  if (stored) token = stored;
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

export async function updateLocation(loc: {
  lat: number;
  lon: number;
  timestamp: string;
  ride_id: number | null;
}, source: "foreground" | "periodic" | "background" = "foreground"): Promise<LocationUpdateResult> {
  if (DEMO_MODE) return "skipped";

  if (!token) {
    console.log(`[fleet-api] update_location ${source}: skipped (missing auth token)`);
    return "skipped";
  }

  const payload = makeLocationPayload(loc);
  const requestId = makeClientRequestId("loc");

  console.log(
    `[fleet-api] update_location ${source} payload=${JSON.stringify(payload)} context=${JSON.stringify({
      request_id: requestId,
      token: tokenFingerprint(token),
      platform: Platform.OS,
    })}`,
  );

  const { result, res } = await fleetFetch(
    "POST",
    "/api/update_location",
    {
      method: "POST",
      headers: {
        ...(authHeaders() ?? {}),
        Accept: "application/json",
        "X-Client-Request-Id": requestId,
      },
      body: JSON.stringify(payload),
    },
    {
      minIntervalMs: 10000,
      failureBackoffMs: 30000,
      throttleKey: "POST /api/update_location",
    },
  );

  if (res && !res.ok) {
    console.log(
      `[fleet-api] update_location ${source} failed status=${res.status} payload=${JSON.stringify(payload)} context=${JSON.stringify({
        request_id: requestId,
        token: tokenFingerprint(token),
        platform: Platform.OS,
      })}`,
    );
  }

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

export function makeLocationPayload(loc: {
  lat: number;
  lon: number;
  timestamp: string;
  ride_id: number | null;
}): {
  lat: number;
  lon: number;
  timestamp: string;
  ride_id?: number;
} {
  const payload: {
    lat: number;
    lon: number;
    timestamp: string;
    ride_id?: number;
  } = {
    lat: loc.lat,
    lon: loc.lon,
    timestamp: loc.timestamp,
  };
  if (typeof loc.ride_id === "number" && Number.isFinite(loc.ride_id)) {
    payload.ride_id = loc.ride_id;
  }
  return payload;
}

function makeClientRequestId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function tokenFingerprint(value: string | null): string | null {
  if (!value) return null;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export async function fetchRides(): Promise<DispatchedRide[]> {
  if (DEMO_MODE) return demoRides;

  const headers = authHeaders();
  if (!headers) {
    throw new FleetApiError(401, "Missing auth token for rides request.", "/api/rides");
  }

  const path = "/api/rides";

  const { result, res } = await fleetFetch(
    "GET",
    path,
    { headers },
    {
      minIntervalMs: 15000,
      failureBackoffMs: 30000,
      throttleKey: "GET /api/rides",
    },
  );

  if (!res) {
    if (shouldSuppressRideFetchError(result)) {
      throw new FleetApiRefreshSkippedError(path);
    }
    throw new FleetApiError(0, "Fleet API unavailable while loading rides.", path);
  }
  if (res.status === 401 || (res.status === 422 && (await isAuthFailure(res)))) {
    await clearToken();
    throw new FleetApiError(res.status, "Session expired while loading rides.", path);
  }
  if (res.status === 404) {
    throw new FleetApiError(res.status, "Ride list endpoint not found.", path);
  }
  if (res.status === 403) {
    const message = await readApiErrorMessage(res);
    throw new FleetApiError(
      res.status,
      message ?? "This account is not allowed to view rides.",
      path,
    );
  }
  if (!res.ok) {
    const message = await readApiErrorMessage(res);
    throw new FleetApiError(res.status, message ?? "Unable to load rides.", path);
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
    console.log(
      `[api] ${path} raw rides (${rawRides.length}): ${rawRides
        .map((ride) => {
          const summary = ride && typeof ride === "object" ? ride as Record<string, unknown> : {};
          const id = pickString(summary, ["id", "ride_id", "rideId", "uuid"]) ?? "?";
          const status = pickString(summary, ["status", "ride_status"]) ?? "?";
          return `${id}:${status} ${describeRoutePayload(summary, { includeKeys: false })}`;
        })
        .join(", ") || "none"}`,
    );

    const visibleRawRides = rawRides.filter((ride) => {
      const summary = ride && typeof ride === "object" ? ride as Record<string, unknown> : {};
      return shouldHydrateRideSummary(summary);
    });
    const skippedCount = rawRides.length - visibleRawRides.length;
    if (skippedCount > 0) {
      console.log(`[api] ${path} skipped detail hydration for ${skippedCount} hidden rides`);
    }

    const detailedRides: Array<DispatchedRide | null> = [];
    for (const ride of visibleRawRides) {
      const summary = ride as Record<string, unknown>;
      const rideId = pickString(summary, ["id", "ride_id", "rideId", "uuid"]);
      const detail = rideId ? await fetchRideDetail(rideId, headers) : null;
      detailedRides.push(normalizeRide(mergeRideSummaryAndDetail(summary, detail)));
    }

    const normalizedRides = detailedRides.filter((ride): ride is DispatchedRide => !!ride);
    console.log(
      `[api] ${path} normalized rides (${normalizedRides.length}): ${normalizedRides
        .map((ride) => `${ride.id}:${ride.status}`)
        .join(", ") || "none"}`,
    );
    return normalizedRides;
  } catch (err) {
    console.log(`[api] failed to parse ${path} response ${String(err)}`);
    throw new FleetApiError(0, "Unable to parse rides response.", path);
  }
}

function shouldHydrateRideSummary(summary: Record<string, unknown>): boolean {
  const rawStatus = pickString(summary, ["status", "ride_status"]);
  const status = rawStatus ? normalizeRideStatus(rawStatus) : "pending";
  return VISIBLE_RIDE_STATUSES.has(status);
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
    // Do not cache transient detail failures. The list endpoint can already
    // identify the ride, and a later detail retry may have the route/address
    // fields needed to render the current ride correctly.
    if (cached?.data) {
      console.log(`[api] ${path} route detail stale-memory ${describeRoutePayload(cached.data)}`);
      return cached.data;
    }
    const persisted = await readPersistedRideDetail(cacheKey);
    if (persisted) {
      console.log(`[api] ${path} route detail persisted ${describeRoutePayload(persisted)}`);
      rideDetailCache.set(cacheKey, { expiresAt: Date.now() + RIDE_DETAIL_CACHE_MS, data: persisted });
      return persisted;
    }
    const fallback = rideDetailFallbacks[cacheKey];
    if (fallback) {
      console.log(`[api] ${path} route detail fallback ${describeRoutePayload(fallback)}`);
      return fallback;
    }
    return null;
  }

  try {
    const body = await res.json();
    const data = extractRideDetail(body);
    console.log(`[api] ${path} route detail ${describeRoutePayload(data)}`);
    rideDetailCache.set(cacheKey, { expiresAt: Date.now() + RIDE_DETAIL_CACHE_MS, data });
    if (data) void persistRideDetail(cacheKey, data);
    return data;
  } catch {
    if (cached?.data) return cached.data;
    const persisted = await readPersistedRideDetail(cacheKey);
    if (persisted) return persisted;
    return null;
  }
}

async function persistRideDetail(cacheKey: string, data: Record<string, unknown>): Promise<void> {
  await storage.set(
    `${RIDE_DETAIL_STORAGE_PREFIX}:${cacheKey}`,
    JSON.stringify({
      expiresAt: Date.now() + PERSISTED_RIDE_DETAIL_CACHE_MS,
      data,
    }),
  );
}

async function readPersistedRideDetail(cacheKey: string): Promise<Record<string, unknown> | null> {
  const raw = await storage.get(`${RIDE_DETAIL_STORAGE_PREFIX}:${cacheKey}`);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { expiresAt?: unknown; data?: unknown };
    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt < Date.now()) {
      await storage.remove(`${RIDE_DETAIL_STORAGE_PREFIX}:${cacheKey}`);
      return null;
    }
    if (!parsed.data || typeof parsed.data !== "object" || Array.isArray(parsed.data)) return null;
    return parsed.data as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractRideDetail(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;

  const record = body as Record<string, unknown>;
  for (const key of ["ride", "data", "result"]) {
    const nested = record[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }

  return record;
}

export async function updateRideStatus(rideId: string, status: RideStatus): Promise<boolean> {
  const headers = authHeaders();
  if (!headers) return false;

  const backendId = getRideBackendId(rideId);
  const id = encodeURIComponent(String(backendId ?? rideId));
  // This legacy driver accept/decline endpoint is used by the current backend
  // but is absent from Suresh's latest OpenAPI. Confirm the replacement before
  // removing this fallback.
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
  return {
    name: pickString(user, ["name", "driver_name", "driverName", "email"]) ?? "Driver",
    email: pickString(user, ["email"]) ?? "",
  };
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
  const createdAtDate = parseBackendDate(createdAtRaw);
  const createdAt = createdAtDate ? createdAtDate.getTime() : Date.now();

  return {
    id,
    passengerName,
    passengerPhotoUrl,
    pickupAddress: pickRideAddress(raw, "pickup") || "Pickup address pending",
    dropoffAddress: pickRideAddress(raw, "dropoff") || "Drop-off address pending",
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
    const value = pickNestedRecord(raw, [objectKey]);
    if (!value) continue;
    const picked = pickString(value, valueKeys);
    if (picked) return picked;
  }
  return null;
}

function pickNestedRecord(raw: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const value = raw[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

function pickRideAddress(raw: Record<string, unknown>, kind: "pickup" | "dropoff"): string | null {
  const directKeys = kind === "pickup"
    ? [
        "pickup_address",
        "pickupAddress",
        "pickup",
        "pickup_location",
        "pickupLocation",
        "origin_address",
        "originAddress",
        "start_address",
        "startAddress",
        "from_address",
        "fromAddress",
        "source_address",
        "sourceAddress",
      ]
    : [
        "dropoff_address",
        "dropoffAddress",
        "drop_off_address",
        "dropOffAddress",
        "destination_address",
        "destinationAddress",
        "dropoff",
        "destination",
        "destination_location",
        "destinationLocation",
        "end_address",
        "endAddress",
        "to_address",
        "toAddress",
      ];

  const direct = pickString(raw, directKeys);
  if (direct) return direct;

  const objectKeys = kind === "pickup"
    ? ["pickup", "pickup_location", "pickupLocation", "origin", "start", "from", "source"]
    : ["dropoff", "drop_off", "dropoff_location", "dropoffLocation", "destination", "end", "to"];
  return pickNestedString(objectKeys.reduce((acc, key) => {
    const value = raw[key];
    if (value && typeof value === "object" && !Array.isArray(value)) acc[key] = value;
    return acc;
  }, {} as Record<string, unknown>), objectKeys, [
    "address",
    "formatted_address",
    "formattedAddress",
    "full_address",
    "fullAddress",
    "label",
    "name",
  ]);
}

function pickCoords(raw: Record<string, unknown>, prefix: "pickup" | "dropoff"): RideCoordinate | null {
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

function pickRouteCoords(raw: Record<string, unknown>): RideCoordinate[] {
  const candidates = getRouteCandidates(raw);

  for (const candidate of candidates) {
    const coords = normalizeRouteGeometry(candidate.value);
    if (coords.length > 1) return coords;
  }

  return [];
}

function getRouteCandidates(raw: Record<string, unknown>): Array<{ name: string; value: unknown }> {
  return [
    { name: "routeCoords", value: raw.routeCoords },
    { name: "route_coords", value: raw.route_coords },
    { name: "plannedRoute", value: raw.plannedRoute },
    { name: "planned_route", value: raw.planned_route },
    { name: "plannedPolyline", value: raw.plannedPolyline },
    { name: "planned_polyline", value: raw.planned_polyline },
    { name: "planned_route_geometry", value: raw.planned_route_geometry },
    { name: "plannedRouteGeometry", value: raw.plannedRouteGeometry },
    { name: "routePoints", value: raw.routePoints },
    { name: "route_points", value: raw.route_points },
    { name: "routeHistory", value: raw.routeHistory },
    { name: "route_history", value: raw.route_history },
    { name: "driverRoute", value: raw.driverRoute },
    { name: "driver_route", value: raw.driver_route },
    { name: "routeGeometry", value: raw.routeGeometry },
    { name: "route_geometry", value: raw.route_geometry },
    { name: "routePolyline", value: raw.routePolyline },
    { name: "route_polyline", value: raw.route_polyline },
    { name: "route", value: raw.route },
  ];
}

function describeRoutePayload(raw: Record<string, unknown> | null, options: { includeKeys?: boolean } = {}): string {
  if (!raw) return "missing-detail";

  const parts = getRouteCandidates(raw)
    .map((candidate) => {
      const coords = normalizeRouteGeometry(candidate.value);
      return coords.length > 0 ? `${candidate.name}:${coords.length}` : null;
    })
    .filter((part): part is string => !!part);

  if (parts.length > 0) return parts.join(", ");
  return options.includeKeys === false ? "no-route-fields" : `no-route-fields keys=${Object.keys(raw).join("|")}`;
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function normalizeRideStatus(status: string): RideStatus {
  const value = status.toLowerCase().replace(/[\/\-\s]+/g, "_");
  if (["requested", "request", "pending", "new"].includes(value)) return "pending";
  if (["scheduled", "scheduled_driver_assigned", "booked", "assigned", "accepted"].includes(value)) return "accepted";
  if (["active", "in_progress", "driver_in_transit", "en_route", "enroute", "on_way", "released"].includes(value)) return "en_route";
  if (["driver_at_pickup", "picked_up", "pickedup"].includes(value)) return "picked_up";
  if (["driver_passenger_in_transit", "in_transit", "intransit"].includes(value)) return "in_transit";
  if (["driver_passenger_at_dropoff", "completed", "complete", "done"].includes(value)) return "completed";
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
  const date = parseBackendDate(value);
  if (!date) return value.split("T")[0] || value;
  if (!Number.isFinite(date.getTime())) return value.split("T")[0] || value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatRideTime(value: string | null): string {
  if (!value) return "Time pending";
  const date = parseBackendDate(value);
  if (!date) return value;
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function parseBackendDate(value: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // The Flask API sends ride timestamps as UTC. Some payloads omit the trailing
  // "Z" (for example, 2026-05-20T20:24:00), which JavaScript otherwise treats
  // as local time. Add Z only for ISO date-time values without an explicit zone.
  const isoDateTimeWithoutZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;
  const normalized = isoDateTimeWithoutZone.test(trimmed) ? `${trimmed}Z` : trimmed;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}
