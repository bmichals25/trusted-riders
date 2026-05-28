import {
  normalizeRouteGeometry,
  type DispatchedRide,
  type RideCoordinate,
  type RideStatus,
  type TransitType,
} from "./rides";

export type FleetUser = { name: string; email: string };

export function normalizeUser(raw: unknown): FleetUser {
  const user = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    name: pickString(user, ["name", "driver_name", "driverName", "email"]) ?? "Driver",
    email: pickString(user, ["email"]) ?? "",
  };
}

export function normalizeRide(raw: Record<string, unknown>): DispatchedRide | null {
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

export function pickString(raw: Record<string, unknown>, keys: string[]): string | null {
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
  const objectKeys = prefix === "pickup"
    ? ["pickup", "pickup_location", "pickupLocation", "origin", "from", "source"]
    : ["dropoff", "drop_off", "dropoff_location", "dropoffLocation", "destination", "to"];
  const direct =
    raw[`${prefix}Coords`] ??
    raw[`${prefix}_coords`] ??
    routeEndpoint ??
    objectKeys.map((key) => raw[key]).find((value) => value && typeof value === "object" && !Array.isArray(value));
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
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

export function describeRoutePayload(raw: Record<string, unknown> | null, options: { includeKeys?: boolean } = {}): string {
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

export function toBackendStatus(status: RideStatus): string {
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
