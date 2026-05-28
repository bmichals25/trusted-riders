// Fleet Tracking API client — handles auth + location updates to Flask backend

import { Platform } from "react-native";

import { type ApiRequestResult } from "./api-request-throttle";
import { demoRides } from "./demo-data";
import { DEMO_MODE } from "./demo-mode";
import { shouldSuppressRideFetchError } from "./fleet-fetch-result";
import {
  fleetFetch,
  readApiErrorMessage,
  type FleetFetchOptions,
} from "./fleet-api-transport";
import {
  getCachedRideDetail,
  getRideDetailFallback,
  persistRideDetail,
  readPersistedRideDetail,
  setCachedRideDetail,
} from "./fleet-ride-detail-cache";
import {
  getRideBackendId,
  mergeRideSummaryAndDetail,
  type DispatchedRide,
  type RideStatus,
} from "./rides";
import {
  describeRoutePayload,
  normalizeRide,
  normalizeRideStatus,
  normalizeUser,
  pickString,
  toBackendStatus,
  type FleetUser,
} from "./fleet-normalization";
import * as storage from "./storage";

const TOKEN_KEY = "trustedriders-auth-token";
const ACTIVE_RIDE_KEY = "trustedriders-active-ride";

let token: string | null = null;

export type { FleetUser } from "./fleet-normalization";
export { normalizeRideStatus } from "./fleet-normalization";
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

const VISIBLE_RIDE_STATUSES = new Set<RideStatus>([
  "pending",
  "accepted",
  "en_route",
  "picked_up",
  "in_transit",
]);


export const LOGIN_FETCH_OPTIONS: FleetFetchOptions = {
  minIntervalMs: 2000,
  failureBackoffMs: 0,
  throttleKey: "POST /api/login",
};

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
  const cached = getCachedRideDetail(cacheKey);
  if (cached !== undefined) {
    return cached;
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
    if (cached) {
      console.log(`[api] ${path} route detail stale-memory ${describeRoutePayload(cached)}`);
      return cached;
    }
    const persisted = await readPersistedRideDetail(cacheKey);
    if (persisted) {
      console.log(`[api] ${path} route detail persisted ${describeRoutePayload(persisted)}`);
      setCachedRideDetail(cacheKey, persisted);
      return persisted;
    }
    const fallback = getRideDetailFallback(cacheKey);
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
    setCachedRideDetail(cacheKey, data);
    if (data) void persistRideDetail(cacheKey, data);
    return data;
  } catch {
    if (cached) return cached;
    const persisted = await readPersistedRideDetail(cacheKey);
    if (persisted) return persisted;
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
