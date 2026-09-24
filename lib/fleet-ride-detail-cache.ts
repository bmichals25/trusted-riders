import * as storage from "./storage";

export const RIDE_DETAIL_STORAGE_PREFIX = "trustedriders-ride-detail";
const RIDE_DETAIL_CACHE_MS = 60 * 1000;
const PERSISTED_RIDE_DETAIL_CACHE_MS = 24 * 60 * 60 * 1000;

const rideDetailCache = new Map<string, { expiresAt: number; data: Record<string, unknown> | null }>();

export function clearRideDetailCache(): void {
  rideDetailCache.clear();
}

/** Delete every persisted ride detail (addresses, passenger, notes) from the device. */
export async function clearPersistedRideDetails(): Promise<void> {
  await storage.removeByPrefix(`${RIDE_DETAIL_STORAGE_PREFIX}:`);
}

export function getCachedRideDetail(cacheKey: string): Record<string, unknown> | null | undefined {
  const cached = rideDetailCache.get(cacheKey);
  if (!cached || cached.expiresAt <= Date.now()) return undefined;
  return cached.data;
}

export function setCachedRideDetail(cacheKey: string, data: Record<string, unknown> | null): void {
  rideDetailCache.set(cacheKey, { expiresAt: Date.now() + RIDE_DETAIL_CACHE_MS, data });
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
