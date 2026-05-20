import type { ApiRequestResult } from "./api-request-throttle";

export function shouldSuppressRideFetchError(result: ApiRequestResult): boolean {
  return result === "skipped" || result === "paused";
}

export function shouldSuppressRideErrorPanel(status: number): boolean {
  return status === 0;
}
