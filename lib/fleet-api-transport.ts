import {
  ApiRequestThrottle,
  type ApiRequestResult,
} from "./api-request-throttle";
import { detectAgreementRequired } from "./agreement-events";
import { FLEET_API_URL } from "./config";

const FLEET_UPSTREAM_UNAVAILABLE_BACKOFF_MS = 5 * 60 * 1000;

const requestThrottles = new Map<string, ApiRequestThrottle>();
let fleetPausedUntil = 0;

export type FleetFetchResult =
  | { result: "sent" | "failed"; res: Response }
  | { result: "failed" | "skipped" | "paused"; res: null };

export type FleetFetchOptions = {
  minIntervalMs?: number;
  failureBackoffMs?: number;
  throttleKey?: string;
};

/**
 * What renewing an expired session gave (lib/fleet-api.ts refreshSession):
 *   refreshed: a new access token, so the request is retried once with it;
 *   expired: the refresh token was refused too, so the caller sees the 401 and the TR signs in again;
 *   unavailable: offline or a server error, so the request counts as failed and the session is kept.
 */
export type SessionRefreshOutcome =
  | { kind: "refreshed"; token: string }
  | { kind: "expired" }
  | { kind: "unavailable" };

type SessionRefresher = (staleToken: string) => Promise<SessionRefreshOutcome>;

let sessionRefresher: SessionRefresher | null = null;

/** Set once by lib/fleet-api.ts (the transport can't import it: fleet-api imports the transport). */
export function setSessionRefresher(refresher: SessionRefresher | null): void {
  sessionRefresher = refresher;
}

// Requests that carry no access token, or that must not trigger a refresh themselves.
const NO_SESSION_REFRESH_PATHS = new Set(["/api/login", "/api/token/refresh", "/api/logout"]);

function bearerToken(init: RequestInit): string | null {
  const value = new Headers(init.headers).get("Authorization");
  const match = value ? /^Bearer\s+(.+)$/i.exec(value) : null;
  return match ? match[1] : null;
}

/**
 * 401, or Flask-JWT-Extended's 422 for a token it can't verify (e.g. after a JWT_SECRET_KEY rotation). A 422
 * with any other message is an ordinary validation error.
 */
export async function isSessionFailure(res: Response): Promise<boolean> {
  if (res.status === 401) return true;
  if (res.status !== 422) return false;
  try {
    const body = await res.clone().json();
    const msg = typeof body?.msg === "string" ? body.msg.toLowerCase() : "";
    return msg.includes("signature") || msg.includes("token") || msg.includes("authorization");
  } catch {
    return false;
  }
}

/**
 * A request rejected because its access token expired: renew the session and retry once. TR access tokens
 * last 12 hours and the refresh token 7 days (backend app/utils/sessions.py), so without this a TR was
 * signed out at every 12-hour mark.
 */
async function retryWithRefreshedSession(
  method: string,
  path: string,
  url: string,
  init: RequestInit,
  res: Response,
): Promise<Response | null | "unchanged"> {
  const stale = bearerToken(init);
  if (!stale || !sessionRefresher || NO_SESSION_REFRESH_PATHS.has(path)) return "unchanged";
  if (!(await isSessionFailure(res))) return "unchanged";

  await logApi(method, path, url, res);
  const outcome = await sessionRefresher(stale);
  if (outcome.kind === "expired") return "unchanged";
  if (outcome.kind === "unavailable") return null;

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${outcome.token}`);
  return fetch(url, { ...init, headers });
}

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

export async function readApiErrorMessage(res: Response): Promise<string | null> {
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

export async function fleetFetch(
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
    let res = await fetch(url, init);
    const retried = await retryWithRefreshedSession(method, path, url, init, res);
    if (retried === null) {
      // Couldn't renew the session right now (offline, server error): like a network failure, keep the session.
      result = "failed";
      return { result, res: null };
    }
    if (retried !== "unchanged") res = retried;
    if (await isNgrokUnavailable(res)) {
      pauseFleetApi("ngrok bandwidth limit");
      result = "paused";
      return { result, res: null };
    }

    await logApi(method, path, url, res);
    // 403 {"code": "agreement_required"}: bring the Trusted Rider agreement back up (BEN-20).
    if (res.status === 403) await detectAgreementRequired(res);
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
