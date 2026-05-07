import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { fetchRides, updateLocation, updateRideStatus } from "./fleet-api";
import { getRideBackendId, type DispatchedRide, type RideStatus } from "./rides";
import { useLocation } from "./location-context";

export type RideStatusNotice = {
  id: string;
  rideId: string;
  passengerName: string;
  previousStatus: RideStatus;
  nextStatus: RideStatus;
};

export type RideAssignmentNotice = {
  id: string;
  ride: DispatchedRide;
};

type DispatchState = {
  rides: DispatchedRide[];
  pendingRides: DispatchedRide[];
  scheduledRides: DispatchedRide[];
  activeRide: DispatchedRide | null;
  statusNotice: RideStatusNotice | null;
  assignmentNotice: RideAssignmentNotice | null;
  dismissStatusNotice: () => void;
  dismissAssignmentNotice: () => void;
  injectRide: (ride: DispatchedRide) => void;
  refreshRides: () => Promise<void>;
  acceptRide: (id: string) => void;
  updateStatus: (id: string, status: RideStatus) => void;
  declineRide: (id: string) => void;
};

const DispatchContext = createContext<DispatchState>({
  rides: [],
  pendingRides: [],
  scheduledRides: [],
  activeRide: null,
  statusNotice: null,
  assignmentNotice: null,
  dismissStatusNotice: () => {},
  dismissAssignmentNotice: () => {},
  injectRide: () => {},
  refreshRides: async () => {},
  acceptRide: () => {},
  updateStatus: () => {},
  declineRide: () => {},
});

export function useDispatch() {
  return useContext(DispatchContext);
}

export function DispatchProvider({
  driverId,
  children,
}: {
  driverName: string;
  driverId: number;
  children: React.ReactNode;
}) {
  const [rides, setRides] = useState<DispatchedRide[]>([]);
  const [statusNotice, setStatusNotice] = useState<RideStatusNotice | null>(null);
  const [assignmentNotice, setAssignmentNotice] = useState<RideAssignmentNotice | null>(null);
  const { location, isTracking } = useLocation();

  const hasLoadedRidesRef = useRef(false);
  const ridesRef = useRef<DispatchedRide[]>([]);
  const locationRef = useRef(location);
  locationRef.current = location;
  const isTrackingRef = useRef(isTracking);

  // Mirrors the current active ride id (as a number, for the backend payload).
  // Null means the driver is online but idle.
  const activeRideIdRef = useRef<number | null>(null);
  const activeRideInState = rides.find(
    (r) => r.status === "en_route" || r.status === "picked_up" || r.status === "in_transit"
  );
  activeRideIdRef.current = activeRideInState ? getRideBackendId(activeRideInState.id) : null;

  const refreshRides = useCallback(async () => {
    const nextRides = await fetchRides(driverId);
    if (hasLoadedRidesRef.current) {
      const previousById = new Map(ridesRef.current.map((ride) => [ride.id, ride]));
      const newRide = nextRides.find((ride) => !previousById.has(ride.id));
      const changedRide = nextRides.find((ride) => {
        const previous = previousById.get(ride.id);
        return previous && previous.status !== ride.status;
      });

      if (newRide) {
        setAssignmentNotice({
          id: `${newRide.id}-${Date.now()}`,
          ride: newRide,
        });
      }

      if (changedRide) {
        const previous = previousById.get(changedRide.id);
        if (previous) {
          setStatusNotice({
            id: `${changedRide.id}-${changedRide.status}-${Date.now()}`,
            rideId: changedRide.id,
            passengerName: changedRide.passengerName,
            previousStatus: previous.status,
            nextStatus: changedRide.status,
          });
        }
      }
    } else {
      hasLoadedRidesRef.current = true;
    }

    ridesRef.current = nextRides;
    setRides(nextRides);
  }, [driverId]);

  const dismissStatusNotice = useCallback(() => {
    setStatusNotice(null);
  }, []);

  const dismissAssignmentNotice = useCallback(() => {
    setAssignmentNotice(null);
  }, []);

  useEffect(() => {
    void refreshRides();
    const interval = setInterval(() => {
      void refreshRides();
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshRides]);

  // Send GPS when location changes.
  useEffect(() => {
    if (isTracking && location) {
      const ts = new Date().toISOString();

      // Also POST to Fleet Tracking API
      updateLocation({
        lat: location.latitude,
        lon: location.longitude,
        timestamp: ts,
        ride_id: activeRideIdRef.current,
      }).then((result) => {
        console.log(`[fleet-api] update_location: ${result} (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`);
      });
    }

    isTrackingRef.current = isTracking;
  }, [location, isTracking]);

  // Periodic re-send: on web, location only fires on change — re-send every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      const loc = locationRef.current;
      if (!loc || !isTrackingRef.current) return;

      const ts = new Date().toISOString();

      updateLocation({
        lat: loc.latitude,
        lon: loc.longitude,
        timestamp: ts,
        ride_id: activeRideIdRef.current,
      }).then((result) => {
        console.log(`[fleet-api] periodic update: ${result}`);
      });
    }, 10000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const injectRide = useCallback((ride: DispatchedRide) => {
    setRides((prev) => {
      if (prev.some((r) => r.id === ride.id)) return prev;
      const next = [ride, ...prev];
      ridesRef.current = next;
      setAssignmentNotice({
        id: `${ride.id}-${Date.now()}`,
        ride,
      });
      return next;
    });
  }, []);

  const acceptRide = useCallback((id: string) => {
    setRides((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, status: "accepted" as RideStatus } : r));
      ridesRef.current = next;
      return next;
    });
    void updateRideStatus(id, "accepted");
  }, []);

  const updateStatus = useCallback((id: string, status: RideStatus) => {
    setRides((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, status } : r));
      ridesRef.current = next;
      return next;
    });
    void updateRideStatus(id, status);
  }, []);

  const declineRide = useCallback((id: string) => {
    setRides((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, status: "cancelled" as RideStatus } : r));
      ridesRef.current = next;
      return next;
    });
    void updateRideStatus(id, "cancelled");
  }, []);

  const pendingRides = rides.filter((r) => r.status === "pending");
  const scheduledRides = rides.filter((r) => r.status === "accepted");
  const activeRide = rides.find(
    (r) => r.status === "en_route" || r.status === "picked_up" || r.status === "in_transit"
  ) ?? null;

  return (
    <DispatchContext.Provider value={{
      rides,
      pendingRides,
      scheduledRides,
      activeRide,
      statusNotice,
      assignmentNotice,
      dismissStatusNotice,
      dismissAssignmentNotice,
      injectRide,
      refreshRides,
      acceptRide,
      updateStatus,
      declineRide,
    }}>
      {children}
    </DispatchContext.Provider>
  );
}
