import * as storage from "./storage";

const RIDE_DETAIL_STORAGE_PREFIX = "trustedriders-ride-detail";
const RIDE_DETAIL_CACHE_MS = 60 * 1000;
const PERSISTED_RIDE_DETAIL_CACHE_MS = 24 * 60 * 60 * 1000;

const rideDetailCache = new Map<string, { expiresAt: number; data: Record<string, unknown> | null }>();

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

export function getCachedRideDetail(cacheKey: string): Record<string, unknown> | null | undefined {
  const cached = rideDetailCache.get(cacheKey);
  if (!cached || cached.expiresAt <= Date.now()) return undefined;
  return cached.data;
}

export function setCachedRideDetail(cacheKey: string, data: Record<string, unknown> | null): void {
  rideDetailCache.set(cacheKey, { expiresAt: Date.now() + RIDE_DETAIL_CACHE_MS, data });
}

export function getRideDetailFallback(cacheKey: string): Record<string, unknown> | undefined {
  return rideDetailFallbacks[cacheKey];
}

export async function persistRideDetail(cacheKey: string, data: Record<string, unknown>): Promise<void> {
  await storage.set(
    `${RIDE_DETAIL_STORAGE_PREFIX}:${cacheKey}`,
    JSON.stringify({
      expiresAt: Date.now() + PERSISTED_RIDE_DETAIL_CACHE_MS,
      data,
    }),
  );
}

export async function readPersistedRideDetail(cacheKey: string): Promise<Record<string, unknown> | null> {
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
