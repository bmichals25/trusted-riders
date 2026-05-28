import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  fetchRides,
  isFleetApiError,
  isFleetApiRefreshSkippedError,
  updateLocation,
  updateRideStatus,
} from "./fleet-api";
import { demoRides } from "./demo-data";
import { DEMO_MODE } from "./demo-mode";
import { shouldSuppressRideErrorPanel } from "./fleet-fetch-result";
import { getRideBackendId, hasDrawableRoute, type DispatchedRide, type RideStatus } from "./rides";
import { useLocation } from "./location-context";

export type RideStatusNotice = {
  id: string;
  rideId: string;
  passengerName: string;
  previousStatus: RideStatus;
  nextStatus: RideStatus;
};

type DispatchState = {
  rides: DispatchedRide[];
  pendingRides: DispatchedRide[];
  scheduledRides: DispatchedRide[];
  activeRide: DispatchedRide | null;
  backendError: string | null;
  hasLoadedRides: boolean;
  statusNotice: RideStatusNotice | null;
  dismissStatusNotice: () => void;
  refreshRides: () => Promise<void>;
  acceptRide: (id: string) => void;
  declineRide: (id: string) => void;
};

const DispatchContext = createContext<DispatchState>({
  rides: [],
  pendingRides: [],
  scheduledRides: [],
  activeRide: null,
  backendError: null,
  hasLoadedRides: false,
  statusNotice: null,
  dismissStatusNotice: () => {},
  refreshRides: async () => {},
  acceptRide: () => {},
  declineRide: () => {},
});

export function isCurrentRideStatus(status: RideStatus): boolean {
  return (
    status === "accepted" ||
    status === "en_route" ||
    status === "picked_up" ||
    status === "in_transit"
  );
}

export function useDispatch() {
  return useContext(DispatchContext);
}

export function DispatchProvider({
  children,
}: {
  driverName: string;
  children: React.ReactNode;
}) {
  const [rides, setRides] = useState<DispatchedRide[]>([]);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [hasLoadedRides, setHasLoadedRides] = useState(false);
  const [statusNotice, setStatusNotice] = useState<RideStatusNotice | null>(null);
  const { location, isTracking } = useLocation();

  const hasLoadedRidesRef = useRef(false);
  const ridesRef = useRef<DispatchedRide[]>([]);
  const locationRef = useRef(location);
  locationRef.current = location;
  const isTrackingRef = useRef(isTracking);

  // Mirrors the current active ride id (as a number, for the backend payload).
  // Null means the driver is online but idle.
  const activeRideIdRef = useRef<number | null>(null);
  const activeRideInState = rides.find((r) => isCurrentRideStatus(r.status));
  activeRideIdRef.current = activeRideInState ? getRideBackendId(activeRideInState.id) : null;

  const refreshRides = useCallback(async () => {
    if (DEMO_MODE) {
      setBackendError(null);
      ridesRef.current = demoRides;
      setRides(demoRides);
      hasLoadedRidesRef.current = true;
      setHasLoadedRides(true);
      return;
    }

    let nextRides: DispatchedRide[];
    try {
      const fetchedRides = await fetchRides();
      const previousById = new Map(ridesRef.current.map((ride) => [ride.id, ride]));
      nextRides = fetchedRides.map((ride) => mergeSparseRideDetail(previousById.get(ride.id), ride));
      setBackendError(null);
    } catch (error) {
      if (isFleetApiRefreshSkippedError(error)) {
        setBackendError(null);
        if (!hasLoadedRidesRef.current) {
          hasLoadedRidesRef.current = true;
          setHasLoadedRides(true);
        }
        return;
      }
      if (isFleetApiError(error)) {
        if (shouldSuppressRideErrorPanel(error.status)) {
          setBackendError(null);
          return;
        }
        setBackendError(
          `${error.message} (${error.status})`,
        );
      } else {
        setBackendError("Unable to load driver rides from the backend.");
      }
      setHasLoadedRides(true);
      return;
    }

    if (hasLoadedRidesRef.current) {
      const previousById = new Map(ridesRef.current.map((ride) => [ride.id, ride]));
      const newRide = nextRides.find((ride) => !previousById.has(ride.id));
      const changedRide = nextRides.find((ride) => {
        const previous = previousById.get(ride.id);
        return previous && previous.status !== ride.status;
      });
      const removedRides = ridesRef.current.filter(
        (ride) => !nextRides.some((nextRide) => nextRide.id === ride.id),
      );

      if (newRide) {
        console.log(`[dispatch] new ride from API id=${newRide.id} status=${newRide.status}`);
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

      if (removedRides.length > 0) {
        console.log(
          `[dispatch] rides removed by successful API response: ${removedRides
            .map((ride) => `${ride.id}:${ride.status}`)
            .join(", ")}`,
        );
      }
    } else {
      hasLoadedRidesRef.current = true;
    }

    ridesRef.current = nextRides;
    setRides(nextRides);
    setHasLoadedRides(true);
  }, []);

  const dismissStatusNotice = useCallback(() => {
    setStatusNotice(null);
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
      if (DEMO_MODE) return;

      const ts = new Date().toISOString();

      // Also POST to Fleet Tracking API
      updateLocation({
        lat: location.latitude,
        lon: location.longitude,
        timestamp: ts,
        ride_id: activeRideIdRef.current,
      }, "foreground").then((result) => {
        console.log(`[fleet-api] update_location foreground: ${result} (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`);
      });
    }

    isTrackingRef.current = isTracking;
  }, [location, isTracking]);

  // Periodic re-send: on web, location only fires on change — re-send every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      if (DEMO_MODE) return;

      const loc = locationRef.current;
      if (!loc || !isTrackingRef.current) return;

      const ts = new Date().toISOString();

      updateLocation({
        lat: loc.latitude,
        lon: loc.longitude,
        timestamp: ts,
        ride_id: activeRideIdRef.current,
      }, "periodic").then((result) => {
        console.log(`[fleet-api] update_location periodic: ${result}`);
      });
    }, 10000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptRide = useCallback((id: string) => {
    setRides((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, status: "accepted" as RideStatus } : r));
      ridesRef.current = next;
      return next;
    });
    if (!DEMO_MODE) void updateRideStatus(id, "accepted");
  }, []);

  const declineRide = useCallback((id: string) => {
    setRides((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, status: "cancelled" as RideStatus } : r));
      ridesRef.current = next;
      return next;
    });
    if (!DEMO_MODE) void updateRideStatus(id, "cancelled");
  }, []);

  const pendingRides = rides.filter((r) => r.status === "pending");
  const scheduledRides = rides.filter((r) => r.status === "accepted");
  const activeRide = rides.find((r) => isCurrentRideStatus(r.status)) ?? null;

  return (
    <DispatchContext.Provider value={{
      rides,
      pendingRides,
      scheduledRides,
      activeRide,
      backendError,
      hasLoadedRides,
      statusNotice,
      dismissStatusNotice,
      refreshRides,
      acceptRide,
      declineRide,
    }}>
      {children}
    </DispatchContext.Provider>
  );
}

function mergeSparseRideDetail(previous: DispatchedRide | undefined, next: DispatchedRide): DispatchedRide {
  if (!previous) return next;

  const nextHasRoute = hasDrawableRoute(next.routeCoords);
  const previousHasRoute = hasDrawableRoute(previous.routeCoords);
  const pickupAddress = isPendingAddress(next.pickupAddress) ? previous.pickupAddress : next.pickupAddress;
  const dropoffAddress = isPendingAddress(next.dropoffAddress) ? previous.dropoffAddress : next.dropoffAddress;

  return {
    ...next,
    pickupAddress,
    dropoffAddress,
    pickupCoords: next.pickupCoords ?? previous.pickupCoords,
    dropoffCoords: next.dropoffCoords ?? previous.dropoffCoords,
    routeCoords: nextHasRoute || !previousHasRoute ? next.routeCoords : previous.routeCoords,
  };
}

function isPendingAddress(value: string): boolean {
  return value.toLowerCase().includes("address pending");
}
