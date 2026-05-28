import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert, AppState, type AppStateStatus } from "react-native";
import {
  fetchRides,
  clearActiveRideId,
  isFleetApiError,
  isFleetApiRefreshSkippedError,
  setActiveRideId,
  updateLocation,
  updateRideStatus,
} from "./fleet-api";
import {
  getChatCommandType,
  listRideChatMessages,
  sendGpsCommandMessage,
  sendRideChatMessage,
  type RideChatMessage,
} from "./chat-api";
import { demoRides } from "./demo-data";
import { DEMO_MODE } from "./demo-mode";
import { shouldSuppressRideErrorPanel } from "./fleet-fetch-result";
import {
  addGpsAskNotificationListeners,
  registerForPushNotifications,
  scheduleLocalGpsAskNotification,
} from "./push-notifications";
import { getRideBackendId, hasDrawableRoute, type DispatchedRide, type RideStatus } from "./rides";
import { useLocation } from "./location-context";
import * as storage from "./storage";

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
  unreadDispatchMessageCount: number;
  clearDispatchUnreadMessages: () => void;
  dismissStatusNotice: () => void;
  noteIncomingDispatchMessages: (count: number) => void;
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
  unreadDispatchMessageCount: 0,
  clearDispatchUnreadMessages: () => {},
  dismissStatusNotice: () => {},
  noteIncomingDispatchMessages: () => {},
  refreshRides: async () => {},
  acceptRide: () => {},
  declineRide: () => {},
});

const MAX_TRANSIENT_ACTIVE_RIDE_MISSES = 3;
const LAST_ACTIVE_RIDE_KEY = "trustedriders-last-active-ride";

export function isCurrentRideStatus(status: RideStatus): boolean {
  return (
    status === "en_route" ||
    status === "picked_up" ||
    status === "in_transit"
  );
}

export function shouldApplyIncomingGpsOff(command: ReturnType<typeof getChatCommandType>, sender: RideChatMessage["sender"]): boolean {
  return command === "gps_off" && sender !== "driver";
}

function isTerminalRideStatus(status: RideStatus): boolean {
  return status === "completed" || status === "cancelled";
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
  const [unreadDispatchMessageCount, setUnreadDispatchMessageCount] = useState(0);
  const { location, isTracking, startTracking, stopTracking } = useLocation();

  const hasLoadedRidesRef = useRef(false);
  const ridesRef = useRef<DispatchedRide[]>([]);
  const missingActiveRideRefreshesRef = useRef(0);

  const processedChatCommandIdsRef = useRef(new Set<string>());
  const chatCommandPollInFlightRef = useRef(false);
  const lastChatCommandMessageIdRef = useRef<string | undefined>(undefined);
  const hasSeededChatCommandCursorRef = useRef(false);
  const gpsPromptOpenRef = useRef(false);
  const queuedGpsPromptRef = useRef<RideChatMessage | null>(null);
  const locallyNotifiedGpsRequestIdsRef = useRef(new Set<string>());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const gpsSharingApprovedRef = useRef(false);
  const sentEndpointGpsOffRideIdsRef = useRef(new Set<string>());
  const activeRideIdRef = useRef<number | null>(null);
  const locationRef = useRef(location);
  locationRef.current = location;
  const isTrackingRef = useRef(isTracking);
  isTrackingRef.current = isTracking;
  if (!isTracking) {
    gpsSharingApprovedRef.current = false;
  }
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
      nextRides = await preserveStartupActiveRide(nextRides, hasLoadedRidesRef.current);
      await persistCurrentRideSnapshot(nextRides);
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
          if (!hasLoadedRidesRef.current) {
            hasLoadedRidesRef.current = true;
            setHasLoadedRides(true);
          }
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

      for (const ride of nextRides) {
        const previous = previousById.get(ride.id);
        if (
          shouldEndGpsAtRideEndpoint(previous, ride) &&
          !sentEndpointGpsOffRideIdsRef.current.has(ride.id)
        ) {
          sentEndpointGpsOffRideIdsRef.current.add(ride.id);
          gpsSharingApprovedRef.current = false;
          stopTracking();
          void sendGpsCommandMessage("gps_off").catch((error) => {
            console.log("[dispatch] endpoint gps_off command failed", error instanceof Error ? error.message : error);
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
  }, [stopTracking]);

  const dismissStatusNotice = useCallback(() => {
    setStatusNotice(null);
  }, []);

  const clearDispatchUnreadMessages = useCallback(() => {
    setUnreadDispatchMessageCount(0);
  }, []);

  const noteIncomingDispatchMessages = useCallback((count: number) => {
    if (count <= 0) return;
    setUnreadDispatchMessageCount((current) => current + count);
  }, []);

  useEffect(() => {
    void refreshRides();
    const interval = setInterval(() => {
      void refreshRides();
    }, 30000);

    return () => clearInterval(interval);
  }, [refreshRides]);

  useEffect(() => {
    if (isTracking) {
      gpsSharingApprovedRef.current = true;
    } else {
      gpsSharingApprovedRef.current = false;
    }
  }, [isTracking]);

  useEffect(() => {
    if (!isTracking) {
      void clearActiveRideId();
      return;
    }

    const activeRideId = activeRideIdRef.current;
    if (activeRideId) {
      void setActiveRideId(activeRideId);
    } else {
      void clearActiveRideId();
    }
  }, [activeRideInState?.id, isTracking]);

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

    if (approved) {
      const trackingStarted = await startTracking();
      if (!trackingStarted) {
        gpsSharingApprovedRef.current = false;
        return;
      }
      await sendRideChatMessage({
        rideId: "dispatch",
        text: "",
        sender: "driver",
        senderName: "Driver",
        clientMessageId: `driver-gps-${requestMessageId}-${Date.now()}`,
        metadata: { command: "gps_yes" },
      });
    } else if (shouldStopTrackingAfterGpsResponse(approved)) {
      stopTracking();
    }
  }, [startTracking, stopTracking]);

  const promptForGpsRequest = useCallback((message: RideChatMessage) => {
    if (gpsPromptOpenRef.current) return;
    queuedGpsPromptRef.current = null;
    gpsPromptOpenRef.current = true;

    const handleResponse = (approved: boolean) => {
      gpsPromptOpenRef.current = false;
      void sendGpsResponse(message.id, approved).catch((error) => {
        console.log(
          approved ? "[chat] gps response failed" : "[chat] gps deny handling failed",
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

  const handleGpsRequest = useCallback((message: RideChatMessage) => {
    if (appStateRef.current === "active") {
      promptForGpsRequest(message);
      return;
    }

    queuedGpsPromptRef.current = message;
    if (locallyNotifiedGpsRequestIdsRef.current.has(message.id)) return;
    locallyNotifiedGpsRequestIdsRef.current.add(message.id);
    void scheduleLocalGpsAskNotification({ messageId: message.id }).catch((error) => {
      console.log("[push] local gps_ask notification failed", error instanceof Error ? error.message : error);
    });
  }, [promptForGpsRequest]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
      if (nextState !== "active") return;
      const queuedMessage = queuedGpsPromptRef.current;
      if (!queuedMessage || gpsPromptOpenRef.current) return;
      promptForGpsRequest(queuedMessage);
    });

    return () => subscription.remove();
  }, [promptForGpsRequest]);

  useEffect(() => {
    if (DEMO_MODE) return;
    void registerForPushNotifications().catch((error) => {
      console.log("[push] registration failed", error instanceof Error ? error.message : error);
    });
  }, []);

  useEffect(() => {
    if (DEMO_MODE) return;
    return addGpsAskNotificationListeners(({ messageId }) => {
      if (gpsPromptOpenRef.current) return;
      processedChatCommandIdsRef.current.add(messageId);
      promptForGpsRequest({
        id: messageId,
        ride_id: "dispatch",
        text: "",
        sender: "dispatch",
        sender_name: "Dispatch",
        client_message_id: null,
        metadata: { command: "gps_ask" },
        created_at: new Date().toISOString(),
      });
    });
  }, [promptForGpsRequest]);

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
        if (shouldApplyIncomingGpsOff(command, message.sender)) {
          processedChatCommandIdsRef.current.add(message.id);
          gpsSharingApprovedRef.current = false;
          stopTracking();
          continue;
        }
        if (command !== "gps_ask") continue;
        if (gpsPromptOpenRef.current) break;

        processedChatCommandIdsRef.current.add(message.id);
        handleGpsRequest(message);
        break;
      }
    } catch (error) {
      console.log("[chat] command poll failed", error instanceof Error ? error.message : error);
    } finally {
      chatCommandPollInFlightRef.current = false;
    }
  }, [handleGpsRequest]);

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
  const activeRide = activeRideInState;

  return (
    <DispatchContext.Provider value={{
      rides,
      pendingRides,
      scheduledRides,
      activeRide,
      backendError,
      hasLoadedRides,
      statusNotice,
      unreadDispatchMessageCount,
      clearDispatchUnreadMessages,
      dismissStatusNotice,
      noteIncomingDispatchMessages,
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
  if (nextHasCurrentRide) {
    missingActiveRideRefreshesRef.current = 0;
    return nextRides;
  }

  const nextPreviousActiveRide = nextRides.find((ride) => ride.id === previousActiveRide.id);
  if (nextPreviousActiveRide) {
    if (isTerminalRideStatus(nextPreviousActiveRide.status)) {
      missingActiveRideRefreshesRef.current = 0;
      return nextRides;
    }

    if (missingActiveRideRefreshesRef.current >= MAX_TRANSIENT_ACTIVE_RIDE_MISSES) {
      missingActiveRideRefreshesRef.current = 0;
      return nextRides;
    }

    missingActiveRideRefreshesRef.current += 1;
    console.log(
      `[dispatch] preserving current ride through transient status regression id=${previousActiveRide.id} previous=${previousActiveRide.status} next=${nextPreviousActiveRide.status}`,
    );
    return nextRides.map((ride) =>
      ride.id === previousActiveRide.id
        ? { ...ride, status: previousActiveRide.status }
        : ride,
    );
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

export async function preserveStartupActiveRide(
  nextRides: DispatchedRide[],
  hasLoadedRides: boolean,
): Promise<DispatchedRide[]> {
  if (hasLoadedRides || nextRides.some((ride) => isCurrentRideStatus(ride.status))) {
    return nextRides;
  }

  const storedActiveRide = await readLastActiveRideSnapshot();
  if (!storedActiveRide) return nextRides;

  const returnedRide = nextRides.find((ride) => ride.id === storedActiveRide.id);
  if (returnedRide) {
    if (isTerminalRideStatus(returnedRide.status)) {
      await clearLastActiveRideSnapshot();
      return nextRides;
    }

    if (!isCurrentRideStatus(returnedRide.status)) {
      console.log(
        `[dispatch] preserving cached current ride through startup status regression id=${storedActiveRide.id} previous=${storedActiveRide.status} next=${returnedRide.status}`,
      );
      return nextRides.map((ride) =>
        ride.id === storedActiveRide.id
          ? { ...ride, status: storedActiveRide.status }
          : ride,
      );
    }

    return nextRides;
  }

  console.log(
    `[dispatch] restoring cached current ride during startup gap id=${storedActiveRide.id} status=${storedActiveRide.status}`,
  );
  return [storedActiveRide, ...nextRides];
}

async function persistCurrentRideSnapshot(rides: DispatchedRide[]): Promise<void> {
  const currentRide = rides.find((ride) => isCurrentRideStatus(ride.status));
  if (!currentRide) return;
  await storage.set(LAST_ACTIVE_RIDE_KEY, JSON.stringify(currentRide));
}

async function readLastActiveRideSnapshot(): Promise<DispatchedRide | null> {
  const raw = await storage.get(LAST_ACTIVE_RIDE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as DispatchedRide;
    return parsed && typeof parsed.id === "string" && isCurrentRideStatus(parsed.status)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

async function clearLastActiveRideSnapshot(): Promise<void> {
  await storage.remove(LAST_ACTIVE_RIDE_KEY);
}

export function shouldStopTrackingAfterGpsResponse(approved: boolean): boolean {
  return !approved;
}

export function shouldEndGpsAtRideEndpoint(
  previousRide: Pick<DispatchedRide, "id" | "status"> | undefined,
  nextRide: Pick<DispatchedRide, "id" | "status">,
): boolean {
  return nextRide.status === "completed" && previousRide?.status !== "completed";
}

function isPendingAddress(value: string): boolean {
  return value.toLowerCase().includes("address pending");
}
