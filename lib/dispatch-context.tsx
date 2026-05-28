import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import {
  fetchRides,
  getToken,
  isFleetApiError,
  isFleetApiRefreshSkippedError,
  updateLocation,
  updateRideStatus,
} from "./fleet-api";
import {
  buildGpsResponseMetadata,
  getChatCommandType,
  listRideChatMessages,
  sendRideChatMessage,
  type RideChatMessage,
} from "./chat-api";
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
const MAX_TRANSIENT_ACTIVE_RIDE_MISSES = 3;


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
  const { location, isTracking, startTracking } = useLocation();

  const hasLoadedRidesRef = useRef(false);
  const ridesRef = useRef<DispatchedRide[]>([]);
  const missingActiveRideRefreshesRef = useRef(0);

  const processedChatCommandIdsRef = useRef(new Set<string>());
  const chatCommandPollInFlightRef = useRef(false);
  const lastChatCommandMessageIdRef = useRef<string | undefined>(undefined);
  const hasSeededChatCommandCursorRef = useRef(false);
  const gpsPromptOpenRef = useRef(false);
  const gpsSharingApprovedRef = useRef(false);
  const activeRideIdRef = useRef<number | null>(null);
  const locationRef = useRef(location);
  locationRef.current = location;
  const isTrackingRef = useRef(isTracking);
  isTrackingRef.current = isTracking;
  const activeRideInState = rides.find((r) => isCurrentRideStatus(r.status)) ?? null;
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
      nextRides = preserveTransientlyMissingActiveRide(
        ridesRef.current,
        nextRides,
        missingActiveRideRefreshesRef,
      );
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

  useEffect(() => {
    if (!isTracking) {
      gpsSharingApprovedRef.current = false;
    }
  }, [isTracking]);

  useEffect(() => {
    if (DEMO_MODE || !gpsSharingApprovedRef.current || !isTracking || !location) return;

    const ts = new Date().toISOString();
    void updateLocation({
      lat: location.latitude,
      lon: location.longitude,
      timestamp: ts,
      ride_id: activeRideIdRef.current,
    }, "foreground").then((result) => {
      console.log(`[fleet-api] approved update_location foreground: ${result}`);
    });
  }, [location, isTracking]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (DEMO_MODE || !gpsSharingApprovedRef.current || !isTrackingRef.current) return;

      const loc = locationRef.current;
      if (!loc) return;

      const ts = new Date().toISOString();
      void updateLocation({
        lat: loc.latitude,
        lon: loc.longitude,
        timestamp: ts,
        ride_id: activeRideIdRef.current,
      }, "periodic").then((result) => {
        console.log(`[fleet-api] approved update_location periodic: ${result}`);
      });
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const sendGpsResponse = useCallback(async (
    requestMessageId: string,
    approved: boolean,
  ) => {
    gpsSharingApprovedRef.current = approved;

    const metadata = approved
      ? buildGpsResponseMetadata({ command: "gps_yes" })
      : buildGpsResponseMetadata({
          command: "gps_off",
          reason: "denied",
        });

    await sendRideChatMessage({
      rideId: "dispatch",
      text: "",
      sender: "driver",
      senderName: "Driver",
      clientMessageId: `driver-gps-${requestMessageId}-${Date.now()}`,
      metadata: {
        ...metadata,
        request_message_id: requestMessageId,
      },
    });

    if (approved) {
      await startTracking();
    }
  }, [startTracking]);

  const promptForGpsRequest = useCallback((message: RideChatMessage) => {
    if (gpsPromptOpenRef.current) return;
    gpsPromptOpenRef.current = true;

    const handleResponse = (approved: boolean) => {
      gpsPromptOpenRef.current = false;
      void sendGpsResponse(message.id, approved).catch((error) => {
        console.log(
          approved ? "[chat] gps response failed" : "[chat] gps_off response failed",
          error instanceof Error ? error.message : error,
        );
      });
    };

    Alert.alert(
      "Turn on location tracking?",
      "Dispatch is requesting GPS access for this ride.",
      [
        {
          text: "Deny",
          style: "cancel",
          onPress: () => handleResponse(false),
        },
        {
          text: "Turn On",
          onPress: () => handleResponse(true),
        },
      ],
    );
  }, [sendGpsResponse]);

  const processChatCommands = useCallback(async () => {
    if (DEMO_MODE || chatCommandPollInFlightRef.current) return;
    chatCommandPollInFlightRef.current = true;

    try {
      const messages = await listRideChatMessages(
        "dispatch",
        lastChatCommandMessageIdRef.current,
        { includeCommands: true },
      );

      if (!hasSeededChatCommandCursorRef.current) {
        lastChatCommandMessageIdRef.current = messages[messages.length - 1]?.id;
        messages.forEach((message) => processedChatCommandIdsRef.current.add(message.id));
        hasSeededChatCommandCursorRef.current = true;
        return;
      }

      for (const message of messages) {
        lastChatCommandMessageIdRef.current = message.id;
        if (processedChatCommandIdsRef.current.has(message.id)) continue;
        if (message.sender === "driver") continue;

        const command = getChatCommandType(message.metadata);
        if (command !== "gps_ask") continue;
        if (gpsPromptOpenRef.current) break;

        processedChatCommandIdsRef.current.add(message.id);
        promptForGpsRequest(message);
        break;
      }
    } catch (error) {
      console.log("[chat] command poll failed", error instanceof Error ? error.message : error);
    } finally {
      chatCommandPollInFlightRef.current = false;
    }
  }, [promptForGpsRequest]);

  useEffect(() => {
    void processChatCommands();
    const interval = setInterval(() => {
      void processChatCommands();
    }, 5000);

    return () => clearInterval(interval);
  }, [processChatCommands]);

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

export function preserveTransientlyMissingActiveRide(
  previousRides: DispatchedRide[],
  nextRides: DispatchedRide[],
  missingActiveRideRefreshesRef: { current: number },
): DispatchedRide[] {
  const previousActiveRide = previousRides.find((ride) => isCurrentRideStatus(ride.status));
  if (!previousActiveRide) {
    missingActiveRideRefreshesRef.current = 0;
    return nextRides;
  }

  const nextHasCurrentRide = nextRides.some((ride) => isCurrentRideStatus(ride.status));
  const nextHasPreviousActiveRide = nextRides.some((ride) => ride.id === previousActiveRide.id);
  if (nextHasCurrentRide || nextHasPreviousActiveRide) {
    missingActiveRideRefreshesRef.current = 0;
    return nextRides;
  }

  if (missingActiveRideRefreshesRef.current >= MAX_TRANSIENT_ACTIVE_RIDE_MISSES) {
    missingActiveRideRefreshesRef.current = 0;
    return nextRides;
  }

  missingActiveRideRefreshesRef.current += 1;
  console.log(
    `[dispatch] preserving current ride through one transient empty refresh id=${previousActiveRide.id} status=${previousActiveRide.status}`,
  );
  return [previousActiveRide, ...nextRides];
}

function isPendingAddress(value: string): boolean {
  return value.toLowerCase().includes("address pending");
}
