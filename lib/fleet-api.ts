// Fleet Tracking API client — handles auth + location updates to Flask backend

import { Platform } from "react-native";

import { type ApiRequestResult } from "./api-request-throttle";
import { demoRides } from "./demo-data";
import { DEMO_MODE } from "./demo-mode";
import { shouldSuppressRideFetchError } from "./fleet-fetch-result";
import { FLEET_API_URL } from "./config";
import {
  fleetFetch,
  readApiErrorMessage,
  setSessionRefresher,
  type FleetFetchOptions,
  type SessionRefreshOutcome,
} from "./fleet-api-transport";
import {
  getCachedRideDetail,
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
  parseBackendDate,
  pickString,
  toBackendStatus,
  type FleetUser,
} from "./fleet-normalization";
import { pickRecentFinishedRows } from "./recent-rides";
import * as storage from "./storage";
import { deleteSecureItem, getSecureItem, setSecureItem } from "./secure-token-store";
import { ACTIVE_RIDE_KEY, clearSessionScopedCaches } from "./session-cache";

// Kept in the Keychain/Keystore (lib/secure-token-store.ts), migrated out of AsyncStorage on first read.
const TOKEN_KEY = "trustedriders-auth-token";
// The session's refresh token (POST /api/token/refresh), next to the access token.
const REFRESH_TOKEN_KEY = "trustedriders-refresh-token";

let token: string | null = null;
let refreshToken: string | null = null;
let refreshInFlight: Promise<SessionRefreshOutcome> | null = null;
const sessionExpiredListeners = new Set<() => void>();

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
    await setSecureItem(TOKEN_KEY, token);
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
  refreshToken = typeof data?.refresh_token === "string" && data.refresh_token ? data.refresh_token : null;
  const user = normalizeUser(data.user ?? data.driver ?? data);
  console.log("[auth] login ok");
  await setSecureItem(TOKEN_KEY, authToken);
  if (refreshToken) await setSecureItem(REFRESH_TOKEN_KEY, refreshToken);
  else await deleteSecureItem(REFRESH_TOKEN_KEY);
  return user;
}

export const PASSWORD_RESET_FETCH_OPTIONS: FleetFetchOptions = {
  minIntervalMs: 2000,
  failureBackoffMs: 0,
  throttleKey: "POST /api/forgot-password",
};

// Shown for every successful request, whether or not the email has an account
// (the backend deliberately doesn't say).
export const PASSWORD_RESET_CONFIRMATION = "If that email has an account, we've sent a reset link.";

/**
 * Ask the backend to email a password reset link. The reset itself happens on
 * the web page in that email. Resolves on success; throws an Error with a
 * user-facing message otherwise.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    throw new Error("Enter your email address.");
  }
  if (DEMO_MODE) return;

  const { result, res } = await fleetFetch(
    "POST",
    "/api/forgot-password",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmedEmail }),
    },
    PASSWORD_RESET_FETCH_OPTIONS,
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
    throw new Error(message ?? "Unable to send a reset link. Please try again.");
  }
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
  refreshToken = null;
  await deleteSecureItem(TOKEN_KEY);
  await deleteSecureItem(REFRESH_TOKEN_KEY);
  await clearSessionScopedCaches();
}

/** Called when the session can't be renewed any more (the gate then shows the sign-in screen). */
export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

/** The server refused the session and it couldn't be renewed: drop it and send the TR to sign-in. */
export async function expireSession(): Promise<void> {
  const hadSession = token !== null;
  await clearToken();
  if (!hadSession) return;
  console.log("[auth] session expired: signing out");
  for (const listener of sessionExpiredListeners) {
    try {
      listener();
    } catch {
      // a listener must never break the others
    }
  }
}

/**
 * Renew the session: trade the refresh token for a new access token (POST /api/token/refresh). TR sessions
 * are fixed (backend app/utils/sessions.py): the access token lasts DRIVER_ACCESS_TOKEN_HOURS (12) and the
 * refresh token DRIVER_REFRESH_TOKEN_DAYS (7), so a TR signs in once a week, not every shift. The transport
 * (lib/fleet-api-transport.ts) calls this when a request comes back 401, then retries it once. One refresh
 * at a time: requests that raced on the same expired token share it.
 */
export function refreshSession(staleToken: string | null): Promise<SessionRefreshOutcome> {
  if (token && staleToken && token !== staleToken) {
    return Promise.resolve({ kind: "refreshed", token });
  }
  if (!refreshInFlight) {
    refreshInFlight = requestNewAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function requestNewAccessToken(): Promise<SessionRefreshOutcome> {
  if (DEMO_MODE || !refreshToken) return { kind: "expired" };
  let res: Response;
  try {
    res = await fetch(`${FLEET_API_URL}/api/token/refresh`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${refreshToken}` },
    });
  } catch {
    console.log("[auth] session refresh: network error, keeping the session");
    return { kind: "unavailable" };
  }
  if (res.ok) {
    let data: Record<string, unknown> | null = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    const next = extractAuthToken(data);
    if (!next) return { kind: "unavailable" };
    token = next;
    await setSecureItem(TOKEN_KEY, next);
    const rotated = data?.refresh_token;
    if (typeof rotated === "string" && rotated) {
      refreshToken = rotated;
      await setSecureItem(REFRESH_TOKEN_KEY, rotated);
    }
    console.log("[auth] session refreshed");
    return { kind: "refreshed", token: next };
  }
  if (res.status === 401 || res.status === 422) {
    console.log(`[auth] session refresh refused (${res.status})`);
    refreshToken = null;
    await deleteSecureItem(REFRESH_TOKEN_KEY);
    return { kind: "expired" };
  }
  console.log(`[auth] session refresh failed (${res.status}), keeping the session`);
  return { kind: "unavailable" };
}

setSessionRefresher(refreshSession);

/**
 * Best-effort POST /api/logout: the server revokes this token (and its session) so a copy of it is
 * useless after sign-out. Never throws; gives up after a few seconds when offline.
 */
export async function logoutFromServer(timeoutMs = 5000): Promise<void> {
  if (DEMO_MODE || !token) return;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    await fleetFetch(
      "POST",
      "/api/logout",
      {
        method: "POST",
        headers: { ...(authHeaders() ?? {}), Accept: "application/json" },
        ...(controller ? { signal: controller.signal } : {}),
      },
      { minIntervalMs: 0, failureBackoffMs: 0, throttleKey: "POST /api/logout" },
    );
  } catch {
    // offline or already expired: the local sign-out still happens
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Rehydrate the in-memory token from persistent storage on app boot.
// Call this once before rendering any authenticated UI.
export async function restoreToken(): Promise<string | null> {
  if (DEMO_MODE) {
    token = "trustedriders-demo-token";
    return token;
  }

  const stored = await getSecureItem(TOKEN_KEY);
  if (stored) token = stored;
  refreshToken = await getSecureItem(REFRESH_TOKEN_KEY);
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
    await expireSession();
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

export type RideList = {
  /** Rides the TR still has to do or is doing (hydrated with ride detail). */
  rides: DispatchedRide[];
  /**
   * Rides finished (completed or cancelled) in the last 24 hours, newest first and capped
   * (lib/recent-rides.ts), so Home can offer "Add a note" after a ride. Kept in memory only.
   */
  recentlyFinished: DispatchedRide[];
};

/** The TR's current and upcoming rides. */
export async function fetchRides(): Promise<DispatchedRide[]> {
  return (await fetchRideList()).rides;
}

/** One GET /api/rides: the TR's current and upcoming rides, plus the ones they finished recently. */
export async function fetchRideList(): Promise<RideList> {
  if (DEMO_MODE) return { rides: demoRides, recentlyFinished: [] };

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
      // Low enough that a ride push or returning to the app can refresh right away.
      minIntervalMs: 3000,
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
    await expireSession();
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

    recentlyTerminalRideIds = new Set(
      rawRides.flatMap((ride) => {
        const summary = ride && typeof ride === "object" ? ride as Record<string, unknown> : {};
        const id = pickString(summary, ["id", "ride_id", "rideId", "uuid"]);
        const rawStatus = pickString(summary, ["status", "ride_status"]);
        const status = rawStatus ? normalizeRideStatus(rawStatus) : null;
        return id && (status === "completed" || status === "cancelled") ? [id] : [];
      }),
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
    const recentlyFinished = await hydrateRecentlyFinishedRides(rawRides, headers);
    return { rides: normalizedRides, recentlyFinished };
  } catch (err) {
    console.log(`[api] failed to parse ${path} response ${String(err)}`);
    throw new FleetApiError(0, "Unable to parse rides response.", path);
  }
}

// Backend ids of rides the latest /api/rides response reported as completed/cancelled. Lets the dispatch
// context drop a finished current ride immediately instead of treating its absence as a network blip.
let recentlyTerminalRideIds = new Set<string>();

export function getRecentlyTerminalRideIds(): ReadonlySet<string> {
  return recentlyTerminalRideIds;
}

// A finished ride's detail barely changes (its notes load separately), so it's kept in memory longer.
const FINISHED_RIDE_DETAIL_CACHE_MS = 10 * 60 * 1000;

/**
 * The TR's recently finished rides (lib/recent-rides.ts). Completed rides get their ride detail (addresses,
 * route) for the ride details screen; it is never written to disk. Cancelled rows only tell a round trip's
 * story, so they stay as the list row.
 */
async function hydrateRecentlyFinishedRides(rawRides: unknown[], headers: HeadersInit): Promise<DispatchedRide[]> {
  const rows = rawRides.flatMap((ride) => {
    if (!ride || typeof ride !== "object" || Array.isArray(ride)) return [];
    const summary = ride as Record<string, unknown>;
    const rawStatus = pickString(summary, ["status", "ride_status"]);
    if (!rawStatus) return [];
    const endedAt = parseBackendDate(pickString(summary, ["end_time", "endTime"]))?.getTime() ?? null;
    return [{ summary, status: normalizeRideStatus(rawStatus), endedAt }];
  });
  const finished: DispatchedRide[] = [];
  for (const row of pickRecentFinishedRows(rows, Date.now())) {
    const rideId = pickString(row.summary, ["id", "ride_id", "rideId", "uuid"]);
    const detail = rideId && row.status === "completed"
      ? await fetchRideDetail(rideId, headers, { persist: false, cacheMs: FINISHED_RIDE_DETAIL_CACHE_MS })
      : null;
    const ride = normalizeRide(mergeRideSummaryAndDetail(row.summary, detail));
    if (ride) finished.push(ride);
  }
  return finished;
}

function shouldHydrateRideSummary(summary: Record<string, unknown>): boolean {
  const rawStatus = pickString(summary, ["status", "ride_status"]);
  const status = rawStatus ? normalizeRideStatus(rawStatus) : "pending";
  return VISIBLE_RIDE_STATUSES.has(status);
}

async function fetchRideDetail(
  rideId: string,
  headers: HeadersInit,
  { persist = true, cacheMs }: { persist?: boolean; cacheMs?: number } = {},
): Promise<Record<string, unknown> | null> {
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
    return null;
  }

  try {
    const body = await res.json();
    const data = extractRideDetail(body);
    console.log(`[api] ${path} route detail ${describeRoutePayload(data)}`);
    setCachedRideDetail(cacheKey, data, cacheMs);
    if (data && persist) void persistRideDetail(cacheKey, data);
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
      // Keyed per target status: a quick "arrived" -> "on board" -> "completed" sequence must never drop a step.
      throttleKey: `PATCH /api/rides/${id}/status ${status}`,
    },
  );

  if (!res) return false;
  if (res.status === 401 || (res.status === 422 && (await isAuthFailure(res)))) {
    await expireSession();
    return false;
  }
  return res.ok;
}

export type RideRequestResponse = "accept" | "decline";

/** Driver accepts or declines a ride dispatch assigned to them. Declining hands it back to dispatch. */
export async function respondToRideRequest(
  rideId: string,
  response: RideRequestResponse,
  reason?: string,
): Promise<{ ok: boolean; message?: string }> {
  const headers = authHeaders();
  if (!headers) return { ok: false, message: "You're signed out. Sign in and try again." };

  const backendId = getRideBackendId(rideId);
  const id = encodeURIComponent(String(backendId ?? rideId));
  const path = `/api/rides/${id}/status`;
  const { res } = await fleetFetch(
    "PATCH",
    path,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(
        response === "accept"
          ? { status: "accepted" }
          : { status: "declined", ...(reason?.trim() ? { reason: reason.trim().slice(0, 300) } : {}) },
      ),
    },
    { minIntervalMs: 1000, failureBackoffMs: 0, throttleKey: `PATCH ${path} ${response}` },
  );

  if (!res) return { ok: false, message: "Couldn't reach dispatch. Check your connection and try again." };
  if (res.status === 401 || (res.status === 422 && (await isAuthFailure(res)))) {
    await expireSession();
    return { ok: false, message: "Your session expired. Sign in again." };
  }
  if (res.status === 409) return { ok: false, message: "This ride has already started, so it can't be changed here. Message dispatch instead." };
  if (res.status === 404) return { ok: false, message: "This ride is no longer assigned to you." };
  if (res.status === 403) {
    // e.g. the Trusted Rider agreement hasn't been accepted yet (the agreement screen opens on its own).
    const message = await readApiErrorMessage(res);
    if (message) return { ok: false, message };
  }
  return res.ok ? { ok: true } : { ok: false, message: `Dispatch couldn't record that (${res.status}). Try again.` };
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
