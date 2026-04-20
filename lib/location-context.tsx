import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { getActiveRideId, getToken, restoreToken, updateLocation } from "./fleet-api";

const BACKGROUND_TASK_NAME = "trustedriders-background-location";

// Dispatch expects a ping every ~10 seconds regardless of movement. Core
// Location on iOS has no time-based trigger (only distance/events), so we
// configure the native task to sample GPS continuously and throttle POSTs in
// userland. Android honors `timeInterval` directly so the throttle there is
// belt-and-suspenders.
const HEARTBEAT_INTERVAL_MS = 10_000;

// Module-scope so the throttle survives across task handler invocations
// (the handler is called fresh each time Core Location delivers a fix).
let lastPostedAt: number | null = null;

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
//
// The whole body is wrapped in try/catch: an uncaught throw from this block
// propagates through the RN TurboModule bridge and can crash the app. Best to
// drop a single background ping than to crash on launch.
try {
  TaskManager.defineTask(BACKGROUND_TASK_NAME, async ({ data, error }) => {
    try {
      if (error) return;
      if (!data) return;
      const { locations } = data as { locations: Location.LocationObject[] };
      if (!locations?.length) return;

      // When iOS wakes the app in the background to run this task, the React
      // tree doesn't mount — so nothing else rehydrates the in-memory JWT.
      // Without this, every updateLocation below would silently 401.
      if (!getToken()) await restoreToken();

      const rideId = await getActiveRideId();
      const latest = locations[locations.length - 1];

      // Always stash the freshest fix for the UI to flush when it resumes.
      backgroundQueue.push({
        latitude: latest.coords.latitude,
        longitude: latest.coords.longitude,
        heading: latest.coords.heading ?? null,
        speed: latest.coords.speed ?? null,
      });

      // Rate-limit POSTs to one per HEARTBEAT_INTERVAL_MS. On iOS the handler
      // may fire at ~1 Hz (BestForNavigation); on Android it's already capped
      // by timeInterval but the guard makes both platforms behave the same.
      const now = Date.now();
      if (lastPostedAt !== null && now - lastPostedAt < HEARTBEAT_INTERVAL_MS) {
        return;
      }
      lastPostedAt = now;

      void updateLocation({
        lat: latest.coords.latitude,
        lon: latest.coords.longitude,
        timestamp: new Date(latest.timestamp).toISOString(),
        ride_id: rideId,
      });
    } catch (err) {
      // Silent in production; surface in dev so a token-rehydrate or
      // storage failure doesn't show up as "pings just aren't arriving."
      if (__DEV__) {
        console.warn("[location] background task failed:", err);
      }
    }
  });
} catch {
  // defineTask throws if called twice (e.g. during Metro hot reload). Safe to
  // swallow — subsequent invocations keep the first registered task.
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionStatus, setPermissionStatus] =
    useState<Location.PermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  // On web, use the browser Geolocation API directly with maximumAge: 0
  // to force fresh GPS reads (expo-location caches positions)
  const startPoll = useCallback(() => {
    if (pollRef.current) return;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.geolocation) {
      // Use watchPosition for real-time updates on web
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            heading: pos.coords.heading ?? null,
            speed: pos.coords.speed ?? null,
          });
          setError(null);
        },
        () => { /* skip errors */ },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 },
      );
      // Store watchId as interval ref for cleanup
      pollRef.current = watchId as unknown as ReturnType<typeof setInterval>;
      return;
    }
    // Fallback: poll with expo-location
    const poll = async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          heading: loc.coords.heading ?? null,
          speed: loc.coords.speed ?? null,
        });
        setError(null);
      } catch {
        // Skip this tick — next one will retry
      }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
  }, []);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(pollRef.current as unknown as number);
      } else {
        clearInterval(pollRef.current);
      }
      pollRef.current = null;
    }
  }, []);

  const startWatcher = useCallback(async () => {
    // On web, use polling — watchPositionAsync is unreliable
    if (Platform.OS === "web") {
      startPoll();
      return;
    }

    if (subscriptionRef.current) return;

    try {
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 5,
          timeInterval: 2000,
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
  }, [startPoll]);

  const stopWatcher = useCallback(() => {
    stopPoll();
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
  }, [stopPoll]);

  const startBackgroundTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== Location.PermissionStatus.GRANTED) {
        setError("Background location permission denied");
        return;
      }

      const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK_NAME);
      if (isRunning) return;

      // Continuous-sampling profile for reliable 10s heartbeats even when
      // the driver is parked. `pausesUpdatesAutomatically: false` keeps iOS
      // from suspending GPS when it thinks the device is stationary — that's
      // what gives us ping-while-parked. Dropped from BestForNavigation to
      // `High` accuracy to keep drain in the ~8–12%/hr range instead of the
      // ~15–25%/hr BestForNavigation would cost; High still gives street-
      // level accuracy (~10m), which is what dispatch needs. The handler
      // throttles POSTs to HEARTBEAT_INTERVAL_MS regardless of sample rate.
      // On Android, `timeInterval` produces the same cadence natively.
      await Location.startLocationUpdatesAsync(BACKGROUND_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        distanceInterval: 0,
        timeInterval: HEARTBEAT_INTERVAL_MS,
        pausesUpdatesAutomatically: false,
        activityType: Location.ActivityType.AutomotiveNavigation,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "TrustedRiders",
          notificationBody: "Sending your location to dispatch",
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

    // Kick the native background task on too. Without this, iOS suspends the
    // JS runtime ~30–60s after the app backgrounds, killing the 10s interval
    // in dispatch-context and the watchPositionAsync callbacks — pings just
    // stop. The TaskManager handler at module-scope runs outside JS and keeps
    // dispatch fed while the phone is locked. No-op on web.
    if (Platform.OS !== "web") {
      await startBackgroundTracking();
    }
  }, [requestPermission, startWatcher, startBackgroundTracking]);

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
