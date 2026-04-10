// Dispatch channel — communicates with the driver app via WebSocket relay

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

export type TrackedDriver = {
  driverId: string;
  name: string;
  lat: number;
  lon: number;
  heading: number | null;
  speed: number | null;
  battery: number | null;
  timestamp: string;
  ride_id: number | null;
  status: "tracking" | "offline";
  lastUpdate: number;
};

export type DispatchMessage =
  | { type: "ride_dispatched"; ride: DispatchedRide }
  | { type: "ride_cancelled"; rideId: string }
  | { type: "ride_released"; rideId: string }
  | { type: "ride_updated"; ride: DispatchedRide }
  | { type: "ride_deleted"; rideId: string }
  | { type: "status_update"; rideId: string; status: RideStatus }
  | { type: "driver_ack"; rideId: string; status: RideStatus }
  | { type: "tracker_list"; trackers: TrackedDriver[] };

// Public relay — works from phone, web, or local dev
const WS_URL = import.meta.env.VITE_DISPATCH_RELAY_URL || "wss://tr-gps.onrender.com";
const STORAGE_KEY = "trustedriders-dispatch-rides";

export function saveRides(rides: DispatchedRide[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rides));
}

export function loadRides(): DispatchedRide[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function createChannel(onMessage: (msg: DispatchMessage) => void): {
  send: (msg: DispatchMessage) => void;
  close: () => void;
} {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => console.log("[dispatch] relay connected");
    ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data));
      } catch {}
    };
    ws.onclose = () => {
      // Auto-reconnect
      reconnectTimer = setTimeout(connect, 2000);
    };
    ws.onerror = () => ws?.close();
  }

  connect();

  return {
    send: (msg) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    },
    close: () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };
}

let idCounter = Date.now();
export function generateRideId(): string {
  return `#${(++idCounter % 100000).toString().padStart(5, "0")}`;
}
