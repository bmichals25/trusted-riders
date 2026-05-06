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

export function getRideBackendId(rideId: string): number | null {
  const match = String(rideId).trim().match(/^(?:#|ride[-_]?)?(\d+)$/i);
  if (!match) return null;
  const normalized = Number(match[1]);
  return Number.isSafeInteger(normalized) ? normalized : null;
}
