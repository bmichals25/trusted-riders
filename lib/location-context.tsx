import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { getActiveRideId, updateLocation } from "./fleet-api";

const BACKGROUND_TASK_NAME = "trustedriders-background-location";

export type DriverLocation = {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
};

type LocationContextValue = {
  location: DriverLocation | null;
  isTracking: boolean;
  permissionStatus: Location.PermissionStatus | null;
  error: string | null;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  requestPermission: () => Promise<boolean>;
  startBackgroundTracking: () => Promise<void>;
  stopBackgroundTracking: () => Promise<void>;
};

const LocationContext = createContext<LocationContextValue>({
  location: null,
  isTracking: false,
  permissionStatus: null,
  error: null,
  startTracking: async () => {},
  stopTracking: () => {},
  requestPermission: async () => false,
  startBackgroundTracking: async () => {},
  stopBackgroundTracking: async () => {},
});

export function useLocation() {
  return useContext(LocationContext);
}

// Queue for background location updates — flushed when app comes to foreground
let backgroundQueue: DriverLocation[] = [];

// Register the background task at module level (required by expo-task-manager).
// Runs outside the React tree — pulls the active ride id from AsyncStorage and
// POSTs each fix to the Fleet API so dispatch keeps receiving pings while the
// phone is locked. Also appends to `backgroundQueue` so the UI can render the
// most recent position when the app returns to the foreground.
TaskManager.defineTask(BACKGROUND_TASK_NAME, async ({ data, error }) => {
  if (error) return;
  if (!data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations?.length) return;

  const rideId = await getActiveRideId();

  for (const loc of locations) {
    backgroundQueue.push({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      heading: loc.coords.heading ?? null,
      speed: loc.coords.speed ?? null,
    });
    // Fire-and-forget; updateLocation swallows its own network errors.
    void updateLocation({
      lat: loc.coords.latitude,
      lon: loc.coords.longitude,
      timestamp: new Date(loc.timestamp).toISOString(),
      ride_id: rideId,
    });
  }
});

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<Location.PermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const shouldTrackRef = useRef(false);
  const backgroundTrackingRef = useRef(false);

  const requestPermission = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      return status === Location.PermissionStatus.GRANTED;
    } catch {
      setError("Failed to request location permission");
      return false;
    }
  }, []);

  const startWatcher = useCallback(async () => {
    if (subscriptionRef.current) return;

    try {
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 3000,
        },
        (loc) => {
          setLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            heading: loc.coords.heading ?? null,
            speed: loc.coords.speed ?? null,
          });
          setError(null);
        },
      );
      subscriptionRef.current = sub;
    } catch {
      setError("Failed to start location tracking");
    }
  }, []);

  const stopWatcher = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
  }, []);

  const startBackgroundTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        setError("Background location permission denied");
        return;
      }

      const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK_NAME);
      if (isRunning) return;

      await Location.startLocationUpdatesAsync(BACKGROUND_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 25,
        deferredUpdatesInterval: 10000,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "TrustedRiders",
          notificationBody: "Tracking your location during active mission",
          notificationColor: "#2563EB",
        },
      });
      backgroundTrackingRef.current = true;
    } catch {
      setError("Failed to start background tracking");
    }
  }, []);

  const stopBackgroundTracking = useCallback(async () => {
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK_NAME);
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_TASK_NAME);
      }
      backgroundTrackingRef.current = false;
    } catch {
      // Ignore — may not have been started
    }
  }, []);

  const startTracking = useCallback(async () => {
    const granted = await requestPermission();
    if (!granted) {
      setError("Location permission denied");
      return;
    }
    shouldTrackRef.current = true;
    setIsTracking(true);

    // Get an initial position immediately
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        heading: current.coords.heading ?? null,
        speed: current.coords.speed ?? null,
      });
    } catch {
      // Non-critical — the watcher will provide the first update
    }

    await startWatcher();
  }, [requestPermission, startWatcher]);

  const stopTracking = useCallback(() => {
    shouldTrackRef.current = false;
    setIsTracking(false);
    stopWatcher();
    stopBackgroundTracking();
  }, [stopWatcher, stopBackgroundTracking]);

  // Flush background queue and pause/resume on app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextState === "active"
        ) {
          // App came to foreground — flush background queue
          if (backgroundQueue.length > 0) {
            setLocation(backgroundQueue[backgroundQueue.length - 1]);
            backgroundQueue = [];
          }
          // Resume foreground watcher
          if (shouldTrackRef.current && !subscriptionRef.current) {
            startWatcher();
          }
        } else if (nextState.match(/inactive|background/)) {
          // App went to background — stop foreground watcher
          // Background task continues if started
          stopWatcher();
        }
        appStateRef.current = nextState;
      },
    );

    return () => subscription.remove();
  }, [startWatcher, stopWatcher]);

  // On mount, check the current permission without prompting. If already
  // granted (e.g. a returning user), start tracking silently. Otherwise the
  // LocationSetupGate will ask the user to grant permission explicitly.
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      setPermissionStatus(status);
      if (status === Location.PermissionStatus.GRANTED) {
        startTracking();
      }
    });
    return () => {
      stopWatcher();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LocationContext.Provider
      value={{
        location,
        isTracking,
        permissionStatus,
        error,
        startTracking,
        stopTracking,
        requestPermission,
        startBackgroundTracking,
        stopBackgroundTracking,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}
