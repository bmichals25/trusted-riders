export type RideStatus =
  | "pending"
  | "accepted"
  | "en_route"
  | "picked_up"
  | "in_transit"
  | "completed"
  | "cancelled";

export type TransitType = "Sedan" | "Wheelchair" | "Stretcher" | "Ambulatory";
export type RideCoordinate = { latitude: number; longitude: number };

export type DispatchedRide = {
  id: string;
  passengerName: string;
  passengerPhotoUrl: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupCoords: RideCoordinate | null;
  dropoffCoords: RideCoordinate | null;
  routeCoords: RideCoordinate[];
  scheduledDate: string;
  scheduledTime: string;
  transitType: TransitType;
  tripType: "One-Way" | "Round-Trip";
  notes: string;
  emergencyContact: string;
  status: RideStatus;
  createdAt: number;
};

export function normalizeRouteGeometry(value: unknown): RideCoordinate[] {
  if (typeof value === "string" && value.trim()) {
    return decodePolyline(value.trim());
  }

  if (Array.isArray(value)) {
    return value
      .map(normalizeRoutePoint)
      .filter((point): point is RideCoordinate => !!point);
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const nested =
      obj.coordinates ??
      obj.coords ??
      obj.points ??
      obj.path ??
      obj.route ??
      obj.geometry;
    const nestedCoords = normalizeRouteGeometry(nested);
    if (nestedCoords.length > 1) return nestedCoords;

    const encoded =
      obj.polyline ??
      obj.encoded_polyline ??
      obj.encodedPolyline ??
      obj.overview_polyline ??
      obj.overviewPolyline;
    if (typeof encoded === "string") return decodePolyline(encoded);
    if (encoded && typeof encoded === "object") {
      const points = (encoded as Record<string, unknown>).points;
      if (typeof points === "string") return decodePolyline(points);
    }
  }

  return [];
}

export function getRideBackendId(rideId: string): number | null {
  const match = String(rideId).trim().match(/^(?:#|ride[-_]?)?(\d+)$/i);
  if (!match) return null;
  const normalized = Number(match[1]);
  return Number.isSafeInteger(normalized) ? normalized : null;
}

export function hasDetailedRoute(coords: RideCoordinate[] | null | undefined): coords is RideCoordinate[] {
  return Array.isArray(coords) && coords.length > 2;
}

export function hasDrawableRoute(coords: RideCoordinate[] | null | undefined): coords is RideCoordinate[] {
  return Array.isArray(coords) && coords.length > 1;
}

export function mergeRideSummaryAndDetail(
  summary: Record<string, unknown>,
  detail: Record<string, unknown> | null,
): Record<string, unknown> {
  const merged = { ...summary, ...(detail ?? {}) };
  const summaryStatus = pickString(summary, ["status", "ride_status"]);
  if (summaryStatus) {
    merged.status = summaryStatus;
  }
  return merged;
}

function pickString(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function normalizeRoutePoint(point: unknown): RideCoordinate | null {
  if (Array.isArray(point) && point.length >= 2) {
    const first = toNumber(point[0]);
    const second = toNumber(point[1]);
    if (first === null || second === null) return null;

    // GeoJSON uses [longitude, latitude]. A few APIs use [latitude, longitude].
    const lonLat = { latitude: second, longitude: first };
    if (isValidCoordinate(lonLat.latitude, lonLat.longitude)) return lonLat;

    const latLon = { latitude: first, longitude: second };
    if (isValidCoordinate(latLon.latitude, latLon.longitude)) return latLon;

    return null;
  }

  if (!point || typeof point !== "object") return null;
  const obj = point as Record<string, unknown>;
  const latitude = toNumber(obj.latitude ?? obj.lat);
  const longitude = toNumber(obj.longitude ?? obj.lon ?? obj.lng);
  if (latitude === null || longitude === null || !isValidCoordinate(latitude, longitude)) {
    return null;
  }
  return { latitude, longitude };
}

function decodePolyline(encoded: string): RideCoordinate[] {
  const points: RideCoordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    const point = { latitude: lat / 1e5, longitude: lng / 1e5 };
    if (isValidCoordinate(point.latitude, point.longitude)) {
      points.push(point);
    }
  }

  return points;
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
