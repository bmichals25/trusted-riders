// Listens for ride dispatches from the dispatch console via WebSocket relay

import { Platform } from "react-native";

export type RideStatus = "pending" | "accepted" | "en_route" | "picked_up" | "in_transit" | "completed" | "cancelled";
export type TransitType = "Sedan" | "Wheelchair" | "Stretcher" | "Ambulatory";

export type DispatchedRide = {
  id: string;
  passengerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupCoords: { latitude: number; longitude: number };
  dropoffCoords: { latitude: number; longitude: number };
  scheduledDate: string;
  scheduledTime: string;
  transitType: TransitType;
  tripType: "One-Way" | "Round-Trip";
  notes: string;
  emergencyContact: string;
  status: RideStatus;
  createdAt: number;
};

export type DispatchMessage =
  | { type: "ride_dispatched"; ride: DispatchedRide }
  | { type: "ride_cancelled"; rideId: string }
  | { type: "ride_released"; rideId: string }
  | { type: "ride_updated"; ride: DispatchedRide }
  | { type: "ride_deleted"; rideId: string }
  | { type: "status_update"; rideId: string; status: RideStatus }
  | { type: "driver_ack"; rideId: string; status: RideStatus }
  | { type: "gps_update"; driverId: string; driverName: string; lat: number; lon: number; heading: number | null; speed: number | null; battery: number | null; timestamp: string; ride_id: number | null }
  | { type: "driver_disconnect"; driverId: string };

// Public relay URL — works from any device (phone, web, simulator)
// For local dev, override with EXPO_PUBLIC_DISPATCH_RELAY_URL=ws://localhost:3002
const WS_URL =
  process.env.EXPO_PUBLIC_DISPATCH_RELAY_URL ||
  "wss://tr-gps.onrender.com";

export function loadPersistedRides(): DispatchedRide[] {
  return [];
}

export function createDispatchListener(
  onRideDispatched: (ride: DispatchedRide) => void,
  onRideCancelled: (rideId: string) => void,
  onRideReleased: (rideId: string) => void,
  onRideUpdated?: (ride: DispatchedRide) => void,
  onRideDeleted?: (rideId: string) => void,
): {
  sendAck: (rideId: string, status: RideStatus) => void;
  sendLocation: (loc: { driverId: string; driverName: string; lat: number; lon: number; heading: number | null; speed: number | null; battery: number | null; timestamp: string; ride_id: number | null }) => void;
  sendDisconnect: (driverId: string) => void;
  close: () => void;
} {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    try {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => console.log("[driver] relay connected");
      ws.onmessage = (e: MessageEvent) => {
        try {
          const msg: DispatchMessage = JSON.parse(e.data);
          if (msg.type === "ride_dispatched") {
            onRideDispatched(msg.ride);
          } else if (msg.type === "ride_cancelled") {
            onRideCancelled(msg.rideId);
          } else if (msg.type === "ride_released") {
            onRideReleased(msg.rideId);
          } else if (msg.type === "ride_updated") {
            onRideUpdated?.(msg.ride);
          } else if (msg.type === "ride_deleted") {
            onRideDeleted?.(msg.rideId);
          }
        } catch {}
      };
      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws?.close();
    } catch {
      reconnectTimer = setTimeout(connect, 2000);
    }
  }

  connect();

  return {
    sendAck: (rideId: string, status: RideStatus) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "driver_ack", rideId, status } satisfies DispatchMessage));
      }
    },
    sendLocation: (loc: { driverId: string; driverName: string; lat: number; lon: number; heading: number | null; speed: number | null; battery: number | null; timestamp: string; ride_id: number | null }) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "gps_update", ...loc } satisfies DispatchMessage));
      }
    },
    sendDisconnect: (driverId: string) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "driver_disconnect", driverId }));
      }
    },
    close: () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}
