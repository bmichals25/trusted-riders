import {
  ApiRequestThrottle,
  type ApiRequestResult,
} from "./api-request-throttle";
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
