import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  createDispatchListener,
  loadPersistedRides,
  type DispatchedRide,
  type RideStatus,
} from "./dispatch-channel";
import { useLocation } from "./location-context";
import { updateLocation } from "./fleet-api";

// Stable per-install driver ID
const DRIVER_ID = `driver-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

type DispatchState = {
  rides: DispatchedRide[];
  pendingRides: DispatchedRide[];
  scheduledRides: DispatchedRide[];
  activeRide: DispatchedRide | null;
  injectRide: (ride: DispatchedRide) => void;
  acceptRide: (id: string) => void;
  updateStatus: (id: string, status: RideStatus) => void;
  declineRide: (id: string) => void;
};

const DispatchContext = createContext<DispatchState>({
  rides: [],
  pendingRides: [],
  scheduledRides: [],
  activeRide: null,
  injectRide: () => {},
  acceptRide: () => {},
  updateStatus: () => {},
  declineRide: () => {},
});

export function useDispatch() {
  return useContext(DispatchContext);
}

export function DispatchProvider({ driverName, children }: { driverName: string; children: React.ReactNode }) {
  const [rides, setRides] = useState<DispatchedRide[]>(loadPersistedRides);
  const listenerRef = useRef<ReturnType<typeof createDispatchListener> | null>(null);
  const { location, isTracking } = useLocation();

  const locationRef = useRef(location);
  locationRef.current = location;
  const isTrackingRef = useRef(isTracking);
  const wasTrackingRef = useRef(isTracking);

  // Send GPS when location changes, send disconnect when tracking stops
  useEffect(() => {
    if (isTracking && location && listenerRef.current) {
      const ts = new Date().toISOString();

      listenerRef.current.sendLocation({
        driverId: DRIVER_ID,
        driverName,
        lat: location.latitude,
        lon: location.longitude,
        heading: location.heading,
        speed: location.speed,
        battery: null,
        timestamp: ts,
        ride_id: 1,
      });

      // Also POST to Fleet Tracking API
      updateLocation({
        lat: location.latitude,
        lon: location.longitude,
        timestamp: ts,
        ride_id: 1,
      });
    }

    // Detect tracking → not tracking transition
    if (wasTrackingRef.current && !isTracking && listenerRef.current) {
      listenerRef.current.sendDisconnect(DRIVER_ID);
    }

    wasTrackingRef.current = isTracking;
    isTrackingRef.current = isTracking;
  }, [location, isTracking, driverName, rides]);

  useEffect(() => {
    const listener = createDispatchListener(
      (ride) => {
        setRides((prev) => {
          if (prev.some((r) => r.id === ride.id)) return prev;
          return [ride, ...prev];
        });
      },
      (rideId) => {
        setRides((prev) =>
          prev.map((r) => (r.id === rideId ? { ...r, status: "cancelled" as RideStatus } : r))
        );
      },
      (rideId) => {
        setRides((prev) =>
          prev.map((r) => (r.id === rideId ? { ...r, status: "en_route" as RideStatus } : r))
        );
      },
      (updatedRide) => {
        setRides((prev) =>
          prev.map((r) => (r.id === updatedRide.id ? { ...updatedRide, status: r.status } : r))
        );
      },
      (rideId) => {
        setRides((prev) => prev.filter((r) => r.id !== rideId));
      }
    );
    listenerRef.current = listener;

    // Flush current location if we already have one
    if (isTrackingRef.current && locationRef.current) {
      const ts = new Date().toISOString();
      listener.sendLocation({
        driverId: DRIVER_ID,
        driverName,
        lat: locationRef.current.latitude,
        lon: locationRef.current.longitude,
        heading: locationRef.current.heading,
        speed: locationRef.current.speed,
        battery: null,
        timestamp: ts,
        ride_id: 1,
      });

      updateLocation({
        lat: locationRef.current.latitude,
        lon: locationRef.current.longitude,
        timestamp: ts,
        ride_id: 1,
      });
    }

    return () => listener.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const injectRide = useCallback((ride: DispatchedRide) => {
    setRides((prev) => {
      if (prev.some((r) => r.id === ride.id)) return prev;
      return [ride, ...prev];
    });
  }, []);

  const acceptRide = useCallback((id: string) => {
    setRides((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "accepted" as RideStatus } : r))
    );
    listenerRef.current?.sendAck(id, "accepted");
  }, []);

  const updateStatus = useCallback((id: string, status: RideStatus) => {
    setRides((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    listenerRef.current?.sendAck(id, status);
  }, []);

  const declineRide = useCallback((id: string) => {
    setRides((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "cancelled" as RideStatus } : r))
    );
    listenerRef.current?.sendAck(id, "cancelled");
  }, []);

  const pendingRides = rides.filter((r) => r.status === "pending");
  const scheduledRides = rides.filter((r) => r.status === "accepted");
  const activeRide = rides.find(
    (r) => r.status === "en_route" || r.status === "picked_up" || r.status === "in_transit"
  ) ?? null;

  return (
    <DispatchContext.Provider value={{ rides, pendingRides, scheduledRides, activeRide, injectRide, acceptRide, updateStatus, declineRide }}>
      {children}
    </DispatchContext.Provider>
  );
}
