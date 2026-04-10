import { GOOGLE_DIRECTIONS_API_KEY } from "./config";

type LatLng = { latitude: number; longitude: number };

export type DirectionsResult = {
  routeCoords: LatLng[];
  distance: string;
  duration: string;
  durationSeconds: number;
  steps: { instruction: string; distance: string }[];
};

// Decode Google's encoded polyline format into coordinate pairs.
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
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
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}

// Simple straight-line fallback when the API key isn't configured or the request fails.
function straightLine(origin: LatLng, destination: LatLng): DirectionsResult {
  return {
    routeCoords: [origin, destination],
    distance: "",
    duration: "",
    durationSeconds: 0,
    steps: [],
  };
}

let cachedResult: { key: string; data: DirectionsResult } | null = null;

function cacheKey(origin: LatLng, destination: LatLng): string {
  return `${origin.latitude.toFixed(4)},${origin.longitude.toFixed(4)}-${destination.latitude.toFixed(4)},${destination.longitude.toFixed(4)}`;
}

export async function getDirections(
  origin: LatLng,
  destination: LatLng,
  waypoints?: LatLng[],
): Promise<DirectionsResult> {
  const key = cacheKey(origin, destination);
  if (cachedResult && cachedResult.key === key) {
    return cachedResult.data;
  }

  if (!GOOGLE_DIRECTIONS_API_KEY) {
    return straightLine(origin, destination);
  }

  try {
    let url =
      `https://maps.googleapis.com/maps/api/directions/json` +
      `?origin=${origin.latitude},${origin.longitude}` +
      `&destination=${destination.latitude},${destination.longitude}` +
      `&key=${GOOGLE_DIRECTIONS_API_KEY}` +
      `&mode=driving`;

    if (waypoints && waypoints.length > 0) {
      const wp = waypoints
        .map((w) => `${w.latitude},${w.longitude}`)
        .join("|");
      url += `&waypoints=${wp}`;
    }

    const response = await fetch(url);
    const json = await response.json();

    if (json.status !== "OK" || !json.routes?.length) {
      return straightLine(origin, destination);
    }

    const route = json.routes[0];
    const leg = route.legs[0];

    const routeCoords = decodePolyline(route.overview_polyline.points);

    const steps = (leg.steps ?? []).map(
      (step: { html_instructions: string; distance: { text: string } }) => ({
        instruction: step.html_instructions.replace(/<[^>]*>/g, ""),
        distance: step.distance.text,
      }),
    );

    const result: DirectionsResult = {
      routeCoords,
      distance: leg.distance.text,
      duration: leg.duration.text,
      durationSeconds: leg.duration.value,
      steps,
    };

    cachedResult = { key, data: result };
    return result;
  } catch {
    return straightLine(origin, destination);
  }
}

// Haversine distance in meters between two coordinates.
export function distanceBetween(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const aVal =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
}
