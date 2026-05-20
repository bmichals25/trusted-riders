import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

const API_BASE = "/fleet-api";
const ACCOUNT_STORAGE_KEY = "trustedriders-dashboard-accounts-v1";
const AUTO_START_ADHERENCE_STORAGE_KEY = "trustedriders-dashboard-auto-start-adherence-v1";
const POLL_INTERVAL_MS = 3_000;
const LOCATION_INTERVAL_MS = 10_000;
const SIMULATION_TICK_MS = 1_000;
const SIMULATION_DURATION_MS = 90_000;
const MANUAL_DRIVE_STEP_METERS = 30;
const MANUAL_DRIVE_FAST_STEP_METERS = 120;
const DEFAULT_ROUTE_ADHERENCE = 100;
const DEFAULT_AUTO_START_ROUTE_ADHERENCE = 45;
const DEFAULT_MAP_CENTER: [number, number] = [40.7128, -74.0060];
const OSRM_NEAREST_URL = "https://router.project-osrm.org/nearest/v1/driving";

type FleetUser = {
  id?: number | string;
  name?: string;
  email?: string;
};

type DashboardAccount = {
  id: string;
  label: string;
  email: string;
  password?: string;
  token: string;
  user: FleetUser;
  createdAt: number;
  rides: DashboardRide[];
  rideError: string | null;
  lastRideSync: number | null;
  locationSharing: boolean;
  locationStatus: string;
  lastLocationSync: number | null;
};

type DashboardRide = {
  id: string;
  status: string;
  passengerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupCoords: RideCoordinate | null;
  dropoffCoords: RideCoordinate | null;
  routeCoords: RideCoordinate[];
  scheduledDate: string;
  scheduledTime: string;
  transitType: string;
  tripType: string;
  notes: string;
  createdAt: number;
  raw: Record<string, unknown>;
};

type BrowserLocation = {
  lat: number;
  lon: number;
  accuracy: number | null;
  timestamp: string;
};

type RideCoordinate = {
  latitude: number;
  longitude: number;
};

type LoginState = {
  label: string;
  email: string;
  password: string;
};

type LoginResult = {
  token: string;
  user: FleetUser;
};

type RideNotice = {
  id: string;
  accountLabel: string;
  ride: DashboardRide;
  createdAt: number;
};

type SidebarSection = "accounts" | "add";

type RideSimulation = {
  key: string;
  accountId: string;
  rideId: string;
  startedAt: number;
  progress: number;
  coordinate: RideCoordinate | null;
  running: boolean;
  mode: "auto" | "manual";
  lastPostedAt: number | null;
  status: string;
  error: string | null;
};

type LocationPostLog = {
  id: string;
  createdAt: number;
  accountLabel: string;
  rideId: string;
  lat: number;
  lon: number;
  statusCode: number | null;
  statusText: string;
  ok: boolean;
  message: string;
};

type SimulatedLocationMarker = {
  key: string;
  label: string;
  coordinate: RideCoordinate;
};

type MapRide = DashboardRide & {
  accountLabel: string;
  accountId: string;
};

const blankLogin: LoginState = {
  label: "",
  email: "",
  password: "",
};

function getNotificationPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  return Notification.permission;
}

const statusLabels: Record<string, string> = {
  pending: "Pending",
  requested: "Pending",
  request: "Pending",
  new: "Pending",
  scheduled: "Scheduled",
  booked: "Scheduled",
  assigned: "Scheduled",
  accepted: "Accepted",
  active: "En route",
  in_progress: "In Progress",
  en_route: "En route",
  enroute: "En route",
  on_way: "En route",
  released: "En route",
  picked_up: "Picked up",
  pickedup: "Picked up",
  in_transit: "In transit",
  intransit: "In transit",
  completed: "Completed",
  complete: "Completed",
  done: "Completed",
  cancelled: "Cancelled",
  canceled: "Cancelled",
  declined: "Declined",
};

const statusTone: Record<string, string> = {
  pending: "pending",
  requested: "pending",
  request: "pending",
  new: "pending",
  scheduled: "scheduled",
  booked: "scheduled",
  assigned: "scheduled",
  accepted: "scheduled",
  active: "active",
  in_progress: "active",
  en_route: "active",
  enroute: "active",
  on_way: "active",
  released: "active",
  picked_up: "active",
  pickedup: "active",
  in_transit: "active",
  intransit: "active",
  completed: "complete",
  complete: "complete",
  done: "complete",
  cancelled: "cancelled",
  canceled: "cancelled",
  declined: "cancelled",
};

const routeColors = ["#1d76bd", "#18a058", "#9a5b13", "#b42318", "#596579", "#0f766e"];

export function App() {
  const [accounts, setAccounts] = useState<DashboardAccount[]>(loadAccounts);
  const [login, setLogin] = useState<LoginState>(blankLogin);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedRideKey, setSelectedRideKey] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarSection, setSidebarSection] = useState<SidebarSection>("accounts");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [location, setLocation] = useState<BrowserLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [watchingLocation, setWatchingLocation] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(getNotificationPermission);
  const [notices, setNotices] = useState<RideNotice[]>([]);
  const [simulations, setSimulations] = useState<Record<string, RideSimulation>>({});
  const [routeAdherence, setRouteAdherence] = useState<Record<string, number>>({});
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [autoStartAdherence, setAutoStartAdherence] = useState(loadAutoStartAdherence);
  const [manualRideKey, setManualRideKey] = useState<string | null>(null);
  const [sessionPasswordDrafts, setSessionPasswordDrafts] = useState<Record<string, string>>({});
  const [locationPostLogs, setLocationPostLogs] = useState<LocationPostLog[]>([]);
  const accountsRef = useRef(accounts);
  const locationRef = useRef(location);
  const watchingLocationRef = useRef(watchingLocation);
  const simulationsRef = useRef(simulations);
  const routeAdherenceRef = useRef(routeAdherence);
  const autoStartEnabledRef = useRef(autoStartEnabled);
  const autoStartAdherenceRef = useRef(autoStartAdherence);
  const manualRideKeyRef = useRef(manualRideKey);
  const sessionPasswordDraftsRef = useRef(sessionPasswordDrafts);
  const simulationTickRef = useRef(0);
  const knownRideIdsRef = useRef<Map<string, Set<string>>>(new Map());
  const autoStartAttemptedKeysRef = useRef<Set<string>>(new Set());
  const refreshingAccountIdsRef = useRef<Set<string>>(new Set());
  const postingSimulationKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    accountsRef.current = accounts;
    saveAccounts(accounts);
  }, [accounts]);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    watchingLocationRef.current = watchingLocation;
  }, [watchingLocation]);

  useEffect(() => {
    simulationsRef.current = simulations;
  }, [simulations]);

  useEffect(() => {
    routeAdherenceRef.current = routeAdherence;
  }, [routeAdherence]);

  useEffect(() => {
    autoStartEnabledRef.current = autoStartEnabled;
  }, [autoStartEnabled]);

  useEffect(() => {
    autoStartAdherenceRef.current = autoStartAdherence;
    saveAutoStartAdherence(autoStartAdherence);
  }, [autoStartAdherence]);

  useEffect(() => {
    manualRideKeyRef.current = manualRideKey;
  }, [manualRideKey]);

  useEffect(() => {
    sessionPasswordDraftsRef.current = sessionPasswordDrafts;
  }, [sessionPasswordDrafts]);

  useEffect(() => {
    void refreshAllAccounts(accountsRef.current);
    const timer = window.setInterval(() => {
      void refreshAllAccounts(accountsRef.current);
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!watchingLocation) return undefined;
    if (!navigator.geolocation) {
      setLocationError("This browser does not support geolocation.");
      setWatchingLocation(false);
      return undefined;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          timestamp: new Date(position.timestamp).toISOString(),
        });
        setLocationError(null);
      },
      (error) => {
        setLocationError(error.message || "Unable to read browser location.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [watchingLocation]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void postLocationForSharingAccounts();
    }, LOCATION_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void tickRideSimulations();
    }, SIMULATION_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedRideKey) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedRideKey(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedRideKey]);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? null;
  const visibleAccounts = selectedAccount ? [selectedAccount] : accounts;
  const allRides = accounts.flatMap((account) =>
    account.rides.map((ride) => ({ ...ride, accountLabel: account.label, accountId: account.id })),
  );
  const visibleAllRides = allRides.filter(isDashboardVisibleRide);
  const filteredAccounts = visibleAccounts.map((account) => ({
    ...account,
    rides: filterRides(account.rides.filter(isDashboardVisibleRide), query, statusFilter),
  }));
  const mapRides: MapRide[] = filteredAccounts.flatMap((account) =>
    account.rides.map((ride) => ({ ...ride, accountLabel: account.label, accountId: account.id })),
  );
  const selectedMapRide = mapRides.find((ride) => getRideKey(ride.accountId, ride.id) === selectedRideKey) ?? null;
  const selectedSimulationMarker = selectedMapRide ? getSimulationMarkers(simulations, [selectedMapRide]) : [];

  const setRideRouteAdherence = (accountId: string, rideId: string, value: number) => {
    const key = getRideKey(accountId, rideId);
    const adherence = clampAdherence(value);
    routeAdherenceRef.current = {
      ...routeAdherenceRef.current,
      [key]: adherence,
    };
    setRouteAdherence((current) => ({ ...current, [key]: adherence }));
  };

  const setRideRouteAdherenceByKey = (key: string, value: number) => {
    const adherence = clampAdherence(value);
    if (routeAdherenceRef.current[key] === adherence) return;
    routeAdherenceRef.current = {
      ...routeAdherenceRef.current,
      [key]: adherence,
    };
    setRouteAdherence((current) => ({ ...current, [key]: adherence }));
  };

  const totals = useMemo(() => {
    const active = visibleAllRides.filter((ride) => canSimulateRide(ride)).length;
    const pending = visibleAllRides.filter((ride) => isWaitingRide(ride)).length;
    const sharing = Object.values(simulations).filter((simulation) => simulation.running).length;
    return { rides: visibleAllRides.length, active, pending, sharing };
  }, [visibleAllRides, simulations]);

  const canUseBrowserNotifications = typeof window !== "undefined" && "Notification" in window;

  const openSidebarSection = (section: SidebarSection) => {
    setSidebarSection(section);
    setSidebarCollapsed(false);
  };

  const updateLogin = (key: keyof LoginState, value: string) => {
    setLogin((current) => ({ ...current, [key]: value }));
  };

  const addAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const email = login.email.trim();
      const password = login.password;
      const { token, user } = await loginDriverAccount(email, password);
      const account: DashboardAccount = {
        id: crypto.randomUUID(),
        label: login.label.trim() || user.name || email,
        email,
        password,
        token,
        user,
        createdAt: Date.now(),
        rides: [],
        rideError: null,
        lastRideSync: null,
        locationSharing: false,
        locationStatus: "Location sharing is off.",
        lastLocationSync: null,
      };

      setAccounts((current) => [account, ...current]);
      setSelectedAccountId(account.id);
      setLogin(blankLogin);
      void refreshAccount(account);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const removeAccount = (accountId: string) => {
    knownRideIdsRef.current.delete(accountId);
    autoStartAttemptedKeysRef.current.forEach((key) => {
      if (key.startsWith(`${accountId}:`)) autoStartAttemptedKeysRef.current.delete(key);
    });
    setSessionPasswordDrafts((current) => {
      const next = { ...current };
      delete next[accountId];
      return next;
    });
    setAccounts((current) => current.filter((account) => account.id !== accountId));
    if (selectedAccountId === accountId) setSelectedAccountId(null);
  };

  const updateSessionPasswordDraft = (accountId: string, password: string) => {
    setSessionPasswordDrafts((current) => ({ ...current, [accountId]: password }));
  };

  const recordLocationPostLog = (log: Omit<LocationPostLog, "id" | "createdAt">) => {
    setLocationPostLogs((current) => [
      {
        ...log,
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: Date.now(),
      },
      ...current,
    ].slice(0, 40));
  };

  const requestBrowserNotifications = async () => {
    if (!canUseBrowserNotifications) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  };

  const dismissNotice = (noticeId: string) => {
    setNotices((current) => current.filter((notice) => notice.id !== noticeId));
  };

  const announceNewRide = useCallback((account: DashboardAccount, ride: DashboardRide) => {
    const notice: RideNotice = {
      id: `${account.id}-${ride.id}-${Date.now()}`,
      accountLabel: account.label,
      ride,
      createdAt: Date.now(),
    };
    setNotices((current) => [notice, ...current].slice(0, 5));

    if (canUseBrowserNotifications && Notification.permission === "granted") {
      new Notification(`New TrustedRiders ride: ${account.label}`, {
        body: `${ride.passengerName} · ${ride.pickupAddress || ride.id}`,
        tag: `${account.id}-${ride.id}`,
      });
    }
  }, [canUseBrowserNotifications]);

  const toggleLocationSharing = async (accountId: string) => {
    const account = accountsRef.current.find((item) => item.id === accountId);
    if (!account) return;

    if (!account.locationSharing) {
      setWatchingLocation(true);
      setAccounts((current) =>
        current.map((item) =>
          item.id === accountId
            ? { ...item, locationSharing: true, locationStatus: "Waiting for browser location..." }
            : item,
        ),
      );
      await postLocationForAccount(account);
      return;
    }

    setAccounts((current) =>
      current.map((item) =>
        item.id === accountId
          ? { ...item, locationSharing: false, locationStatus: "Location sharing is off." }
          : item,
      ),
    );
  };

  const startRideSimulation = (account: DashboardAccount, ride: DashboardRide, options: { selectRide?: boolean } = {}) => {
    const shouldSelectRide = options.selectRide ?? true;
    const key = getRideKey(account.id, ride.id);
    const adherence = routeAdherenceRef.current[key] ?? DEFAULT_ROUTE_ADHERENCE;
    const route = getAdherentRoute(ride, adherence, key);
    if (!canSimulateRide(ride)) {
      setManualRideKey((current) => current === key ? null : current);
      if (manualRideKeyRef.current === key) manualRideKeyRef.current = null;
      setSimulations((current) => ({
        ...current,
        [key]: {
          key,
          accountId: account.id,
          rideId: ride.id,
          startedAt: Date.now(),
          progress: 0,
          coordinate: route[0] ?? null,
          running: false,
          mode: "auto",
          lastPostedAt: null,
          status: "Waiting for backend In Progress",
          error: "Start Ride is enabled only after the backend moves this ride out of Pending and into In Progress.",
        },
      }));
      return;
    }

    if (route.length < 2) {
      console.warn("[sim-location] Start Ride missing usable route", getRideRouteDebug(account, ride, key, route));
      setManualRideKey((current) => current === key ? null : current);
      if (manualRideKeyRef.current === key) manualRideKeyRef.current = null;
      setSimulations((current) => ({
        ...current,
        [key]: {
          key,
          accountId: account.id,
          rideId: ride.id,
          startedAt: Date.now(),
          progress: 0,
          coordinate: route[0] ?? null,
          running: false,
          mode: "auto",
          lastPostedAt: null,
          status: "Route missing",
          error: "This ride does not include enough backend coordinates to simulate movement.",
        },
      }));
      return;
    }

    const existing = simulationsRef.current[key];
    const resumeProgress = existing && existing.progress > 0 && existing.progress < 1 ? existing.progress : 0;
    const coordinate = getSimulationCoordinate(ride, route, resumeProgress);
    const simulation: RideSimulation = {
      key,
      accountId: account.id,
      rideId: ride.id,
      startedAt: Date.now() - resumeProgress * SIMULATION_DURATION_MS,
      progress: resumeProgress,
      coordinate,
      running: true,
      mode: "auto",
      lastPostedAt: existing?.lastPostedAt ?? null,
      status: "Posting fake live coordinates.",
      error: null,
    };

    if (shouldSelectRide) setSelectedRideKey(key);
    manualRideKeyRef.current = manualRideKeyRef.current === key ? null : manualRideKeyRef.current;
    setManualRideKey((current) => current === key ? null : current);
    simulationsRef.current = {
      ...simulationsRef.current,
      [key]: simulation,
    };
    setSimulations(simulationsRef.current);
    void postSimulatedLocation(account, ride, coordinate, key);
  };

  const applyAutoStartForRides = (account: DashboardAccount, rides: DashboardRide[]) => {
    if (!autoStartEnabledRef.current) return;
    const autoStartAdherenceValue = autoStartAdherenceRef.current;

    rides.forEach((ride) => {
      const key = getRideKey(account.id, ride.id);
      setRideRouteAdherenceByKey(key, autoStartAdherenceValue);

      if (!canSimulateRide(ride)) return;

      const simulation = simulationsRef.current[key];
      if (simulation?.running || simulation?.mode === "manual") return;
      const route = getAdherentRoute(ride, autoStartAdherenceValue, key);
      if (route.length < 2) {
        console.warn("[sim-location] Auto-Start waiting for usable route", getRideRouteDebug(account, ride, key, route));
        return;
      }
      if (autoStartAttemptedKeysRef.current.has(key) && !simulation?.error) return;

      autoStartAttemptedKeysRef.current.add(key);
      startRideSimulation(account, ride, { selectRide: false });
    });
  };

  const toggleAutoStart = () => {
    setAutoStartEnabled((current) => {
      const next = !current;
      autoStartEnabledRef.current = next;
      if (next) {
        accountsRef.current.forEach((account) => applyAutoStartForRides(account, account.rides));
      }
      return next;
    });
  };

  const updateAutoStartAdherence = (value: number) => {
    const adherence = clampAdherence(value);
    autoStartAdherenceRef.current = adherence;
    setAutoStartAdherence(adherence);
    if (autoStartEnabledRef.current) {
      accountsRef.current.forEach((account) => applyAutoStartForRides(account, account.rides));
    }
  };

  const clearResolvedRouteMissingSimulations = (account: DashboardAccount, rides: DashboardRide[]) => {
    const ridesById = new Map(rides.map((ride) => [ride.id, ride]));
    setSimulations((current) => {
      let changed = false;
      const next = { ...current };

      Object.values(current).forEach((simulation) => {
        if (simulation.accountId !== account.id || !isRouteMissingSimulation(simulation)) return;
        const ride = ridesById.get(simulation.rideId);
        if (!ride) return;

        const adherence = routeAdherenceRef.current[simulation.key] ?? DEFAULT_ROUTE_ADHERENCE;
        const route = getAdherentRoute(ride, adherence, simulation.key);
        if (route.length < 2) return;

        changed = true;
        next[simulation.key] = {
          ...simulation,
          coordinate: simulation.coordinate ?? route[0] ?? null,
          status: canSimulateRide(ride) ? "Ready to simulate." : "Waiting for backend In Progress.",
          error: null,
        };
      });

      if (changed) simulationsRef.current = next;
      return changed ? next : current;
    });
  };

  const stopTerminalRideSimulations = (account: DashboardAccount, rides: DashboardRide[]) => {
    const terminalRideById = new Map(rides.filter(isTerminalRide).map((ride) => [ride.id, ride]));
    if (terminalRideById.size === 0) return;

    setSimulations((current) => {
      let changed = false;
      const next = { ...current };

      Object.values(current).forEach((simulation) => {
        if (simulation.accountId !== account.id || !simulation.running) return;
        const ride = terminalRideById.get(simulation.rideId);
        if (!ride) return;

        changed = true;
        next[simulation.key] = {
          ...simulation,
          running: false,
          mode: "auto",
          status: `Stopped: backend marked ride ${statusLabels[ride.status]?.toLowerCase() ?? ride.status}.`,
          error: null,
        };
      });

      if (changed) simulationsRef.current = next;
      return changed ? next : current;
    });
  };

  useEffect(() => {
    if (!autoStartEnabled) return;
    accounts.forEach((account) => applyAutoStartForRides(account, account.rides));
  }, [accounts, autoStartEnabled, autoStartAdherence]);

  const resetRideSimulation = (account: DashboardAccount, ride: DashboardRide) => {
    const route = getDrawableRoute(ride);
    const key = getRideKey(account.id, ride.id);
    const coordinate = ride.pickupCoords ?? route[0] ?? null;
    setSimulations((current) => ({
      ...current,
      [key]: {
        key,
        accountId: account.id,
        rideId: ride.id,
        startedAt: Date.now(),
        progress: 0,
        coordinate,
        running: false,
        mode: current[key]?.mode ?? "auto",
        lastPostedAt: null,
        status: coordinate ? "Reset to pickup." : "Route missing.",
        error: coordinate ? null : "This ride does not include a pickup coordinate to reset to.",
      },
    }));

    if (coordinate) {
      void postSimulatedLocation(account, ride, coordinate, key);
    }
  };

  const pauseRideSimulation = (accountId: string, rideId: string) => {
    const key = getRideKey(accountId, rideId);
    setManualRideKey((current) => current === key ? null : current);
    setSimulations((current) => {
      const existing = current[key];
      if (!existing) return current;
      return {
        ...current,
        [key]: {
          ...existing,
          running: false,
          mode: "auto",
          status: "Paused.",
        },
      };
    });
  };

  const toggleManualRideSimulation = async (account: DashboardAccount, ride: DashboardRide) => {
    const key = getRideKey(account.id, ride.id);
    if (manualRideKeyRef.current === key) {
      manualRideKeyRef.current = null;
      setManualRideKey(null);
      const existing = simulationsRef.current[key];
      if (!existing) return;
      const next = {
        ...simulationsRef.current,
        [key]: {
          ...existing,
          running: false,
          mode: "auto" as const,
          status: "Manual mode paused.",
        },
      };
      simulationsRef.current = next;
      setSimulations(next);
      return;
    }

    if (!canSimulateRide(ride)) {
      setSimulations((current) => ({
        ...current,
        [key]: {
          key,
          accountId: account.id,
          rideId: ride.id,
          startedAt: Date.now(),
          progress: 0,
          coordinate: getManualStartCoordinate(ride),
          running: false,
          mode: "manual",
          lastPostedAt: null,
          status: "Waiting for backend In Progress",
          error: "Manual Drive is enabled only after the backend moves this ride out of Pending and into In Progress.",
        },
      }));
      return;
    }

    const existing = simulationsRef.current[key];
    const startingCoordinate = existing?.coordinate ?? getManualStartCoordinate(ride);
    if (!startingCoordinate) {
      setSimulations((current) => ({
        ...current,
        [key]: {
          key,
          accountId: account.id,
          rideId: ride.id,
          startedAt: Date.now(),
          progress: 0,
          coordinate: null,
          running: false,
          mode: "manual",
          lastPostedAt: null,
          status: "Location missing",
          error: "Manual Drive needs a pickup, current, or route coordinate to start from.",
        },
      }));
      return;
    }

    let coordinate: RideCoordinate;
    try {
      coordinate = await snapCoordinateToRoad(startingCoordinate);
    } catch (error) {
      setSimulations((current) => ({
        ...current,
        [key]: {
          key,
          accountId: account.id,
          rideId: ride.id,
          startedAt: Date.now(),
          progress: 0,
          coordinate: startingCoordinate,
          running: false,
          mode: "manual",
          lastPostedAt: existing?.lastPostedAt ?? null,
          status: "Street snap failed.",
          error: error instanceof Error ? error.message : "Could not snap this location to a city street.",
        },
      }));
      return;
    }

    const previousManualKey = manualRideKeyRef.current;
    const manualSimulation: RideSimulation = {
      key,
      accountId: account.id,
      rideId: ride.id,
      startedAt: Date.now(),
      progress: existing?.progress ?? 0,
      coordinate,
      running: false,
      mode: "manual",
      lastPostedAt: existing?.lastPostedAt ?? null,
      status: "Manual street mode: use arrow keys to drive.",
      error: null,
    };
    const next = { ...simulationsRef.current };
    if (previousManualKey && previousManualKey !== key && next[previousManualKey]) {
      next[previousManualKey] = {
        ...next[previousManualKey],
        running: false,
        mode: "auto",
        status: "Manual mode paused.",
      };
    }
    next[key] = manualSimulation;

    setSelectedRideKey(key);
    manualRideKeyRef.current = key;
    setManualRideKey(key);
    simulationsRef.current = next;
    setSimulations(next);
    void postSimulatedLocation(account, ride, coordinate, key);
  };

  const nudgeManualRideSimulation = useCallback(async (movement: { northMeters: number; eastMeters: number }) => {
    const key = manualRideKeyRef.current;
    if (!key) return;

    const simulation = simulationsRef.current[key];
    if (!simulation || simulation.mode !== "manual") {
      setManualRideKey(null);
      return;
    }

    const account = accountsRef.current.find((item) => item.id === simulation.accountId);
    const ride = account?.rides.find((item) => item.id === simulation.rideId);
    if (!account || !ride) {
      setManualRideKey(null);
      setSimulations((current) => ({
        ...current,
        [key]: {
          ...simulation,
          running: false,
          mode: "auto",
          status: "Ride no longer available.",
          error: "The account or ride disappeared from the latest backend response.",
        },
      }));
      return;
    }

    const baseCoordinate = simulation.coordinate ?? getManualStartCoordinate(ride);
    if (!baseCoordinate) {
      setSimulations((current) => ({
        ...current,
        [key]: {
          ...simulation,
          running: false,
          status: "Location missing.",
          error: "Manual Drive needs a pickup, current, or route coordinate to move from.",
        },
      }));
      return;
    }

    const target = offsetCoordinate(baseCoordinate, movement.northMeters, movement.eastMeters);
    let coordinate: RideCoordinate;
    try {
      coordinate = await snapCoordinateToRoad(target);
    } catch (error) {
      setSimulations((current) => ({
        ...current,
        [key]: {
          ...simulation,
          status: "Street snap failed.",
          error: error instanceof Error ? error.message : "Could not snap this move to a city street.",
        },
      }));
      return;
    }

    const nextSimulation: RideSimulation = {
      ...simulation,
      coordinate,
      running: false,
      mode: "manual",
      status: "Manual street mode: use arrow keys to drive.",
      error: null,
    };

    simulationsRef.current = {
      ...simulationsRef.current,
      [key]: nextSimulation,
    };
    setSimulations((current) => ({
      ...current,
      [key]: nextSimulation,
    }));

    console.log("[sim-location] manual key move", {
      account: account.label,
      rideId: ride.id,
      northMeters: movement.northMeters,
      eastMeters: movement.eastMeters,
      lat: Number(coordinate.latitude.toFixed(6)),
      lon: Number(coordinate.longitude.toFixed(6)),
    });
    await postSimulatedLocation(account, ride, coordinate, key);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = manualRideKeyRef.current;
      if (!key) return;

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const fastStep = event.shiftKey ? MANUAL_DRIVE_FAST_STEP_METERS : MANUAL_DRIVE_STEP_METERS;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        void nudgeManualRideSimulation({ northMeters: fastStep, eastMeters: 0 });
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        void nudgeManualRideSimulation({ northMeters: -fastStep, eastMeters: 0 });
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        void nudgeManualRideSimulation({ northMeters: 0, eastMeters: -fastStep });
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        void nudgeManualRideSimulation({ northMeters: 0, eastMeters: fastStep });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nudgeManualRideSimulation]);

  const tickRideSimulations = useCallback(async () => {
    const now = Date.now();
    const tick = ++simulationTickRef.current;
    const current = simulationsRef.current;
    const next = { ...current };
    const posts: Array<{
      account: DashboardAccount;
      ride: DashboardRide;
      coordinate: RideCoordinate;
      key: string;
      progress: number;
    }> = [];

    Object.values(current).forEach((simulation) => {
      if (!simulation.running) return;

      const account = accountsRef.current.find((item) => item.id === simulation.accountId);
      const ride = account?.rides.find((item) => item.id === simulation.rideId);
      if (!account || !ride) {
        next[simulation.key] = {
          ...simulation,
          running: false,
          status: "Ride no longer available.",
          error: "The account or ride disappeared from the latest backend response.",
        };
        return;
      }

      if (isTerminalRide(ride)) {
        next[simulation.key] = {
          ...simulation,
          running: false,
          mode: "auto",
          status: `Stopped: backend marked ride ${statusLabels[ride.status]?.toLowerCase() ?? ride.status}.`,
          error: null,
        };
        return;
      }

      const adherence = routeAdherenceRef.current[simulation.key] ?? DEFAULT_ROUTE_ADHERENCE;
      const route = getAdherentRoute(ride, adherence, simulation.key);
      if (route.length < 2) {
        console.warn("[sim-location] Running simulation lost usable route", getRideRouteDebug(account, ride, simulation.key, route));
        next[simulation.key] = {
          ...simulation,
          running: false,
          status: "Route missing.",
          error: "This ride does not include enough backend coordinates to simulate movement.",
        };
        return;
      }

      const progress = Math.min(1, (now - simulation.startedAt) / SIMULATION_DURATION_MS);
      const coordinate = getSimulationCoordinate(ride, route, progress);
      next[simulation.key] = {
        ...simulation,
        progress,
        coordinate,
        status: progress >= 1 ? "Arrived at drop-off." : "Posting fake live coordinates.",
        running: progress < 1,
      };
      posts.push({ account, ride, coordinate, key: simulation.key, progress });
    });

    if (posts.length > 0) {
      console.log(`[sim-location] tick ${tick}`, {
        activeSimulations: posts.length,
        intervalMs: SIMULATION_TICK_MS,
        updates: posts.map(({ account, ride, coordinate, progress }) => ({
          account: account.label,
          rideId: ride.id,
          progress: Number(progress.toFixed(4)),
          lat: Number(coordinate.latitude.toFixed(6)),
          lon: Number(coordinate.longitude.toFixed(6)),
        })),
      });
    }

    simulationsRef.current = next;
    setSimulations(next);

    await Promise.all(posts.map(({ account, ride, coordinate, key }) => postSimulatedLocation(account, ride, coordinate, key)));
  }, []);

  const postSimulatedLocation = async (
    account: DashboardAccount,
    ride: DashboardRide,
    coordinate: RideCoordinate,
    key: string,
  ) => {
    if (postingSimulationKeysRef.current.has(key)) return;
    postingSimulationKeysRef.current.add(key);
    let responseStatus: number | null = null;
    let responseStatusText = "";
    try {
      let activeAccount = account;
      const backendRideId = getRideBackendId(ride.id);
      const payload: Record<string, unknown> = {
        lat: coordinate.latitude,
        lon: coordinate.longitude,
        timestamp: new Date().toISOString(),
      };
      if (backendRideId !== null) payload.ride_id = backendRideId;

      const requestLabel = `[sim-location] ${account.label} ride=${ride.id}`;
      console.log(`${requestLabel} POST /api/update_location`, {
        backendUrl: "https://trdev.tailff74b1.ts.net/api/update_location",
        accountLabel: account.label,
        ride: {
          id: ride.id,
          backendRideId,
          status: ride.status,
        },
        payload,
      });

      let res = await apiFetch("/api/update_location", {
        method: "POST",
        headers: authHeaders(activeAccount.token),
        body: JSON.stringify(payload),
      }, { attempts: 1, timeoutMs: 3_000 });
      responseStatus = res.status;
      responseStatusText = res.statusText;
      if (isAuthResponse(res)) {
        activeAccount = await reauthenticateAccount(activeAccount, sessionPasswordDraftsRef.current[activeAccount.id]);
        setAccounts((current) =>
          current.map((item) => item.id === activeAccount.id ? { ...item, ...activeAccount } : item),
        );
        res = await apiFetch("/api/update_location", {
          method: "POST",
          headers: authHeaders(activeAccount.token),
          body: JSON.stringify(payload),
        }, { attempts: 1, timeoutMs: 3_000 });
        responseStatus = res.status;
        responseStatusText = res.statusText;
      }
      if (!res.ok) {
        const message = await readError(res, "Simulated location update failed.");
        console.warn(`${requestLabel} response ${res.status} ${res.statusText}`, { message, payload });
        throw new Error(message);
      }

      let responseBody: unknown = null;
      try {
        responseBody = await res.clone().json();
      } catch {
        try {
          responseBody = await res.clone().text();
        } catch {
          responseBody = null;
        }
      }
      console.log(`${requestLabel} response ${res.status} ${res.statusText}`, {
        payload,
        responseBody,
      });
      recordLocationPostLog({
        accountLabel: account.label,
        rideId: ride.id,
        lat: coordinate.latitude,
        lon: coordinate.longitude,
        statusCode: res.status,
        statusText: res.statusText,
        ok: true,
        message: "Posted fake live coordinate",
      });

      setSimulations((current) => {
        const existing = current[key];
        if (!existing) return current;
        return {
          ...current,
          [key]: {
            ...existing,
            lastPostedAt: Date.now(),
            error: null,
            status: existing.status,
          },
        };
      });
    } catch (error) {
      const aborted = isRequestAbortError(error);
      recordLocationPostLog({
        accountLabel: account.label,
        rideId: ride.id,
        lat: coordinate.latitude,
        lon: coordinate.longitude,
        statusCode: responseStatus,
        statusText: responseStatusText,
        ok: false,
        message: aborted ? "Location post timed out; next tick will retry." : error instanceof Error ? error.message : "Simulated location update failed.",
      });
      setSimulations((current) => {
        const existing = current[key];
        if (!existing) return current;
        return {
          ...current,
          [key]: {
            ...existing,
            error: aborted ? null : error instanceof Error ? error.message : "Simulated location update failed.",
            status: aborted ? existing.status : "Backend post failed.",
          },
        };
      });
    } finally {
      postingSimulationKeysRef.current.delete(key);
    }
  };

  const refreshAllAccounts = useCallback(async (nextAccounts: DashboardAccount[]) => {
    await Promise.all(nextAccounts.map((account) => refreshAccount(account)));
  }, [announceNewRide]);

  const refreshAccount = useCallback(async (account: DashboardAccount) => {
    if (refreshingAccountIdsRef.current.has(account.id)) return;
    refreshingAccountIdsRef.current.add(account.id);
    try {
      let activeAccount = account;
      let rides: DashboardRide[];
      try {
        rides = await fetchAccountRides(activeAccount);
      } catch (error) {
        if (!(error instanceof AuthExpiredError)) throw error;
        activeAccount = await reauthenticateAccount(activeAccount, sessionPasswordDraftsRef.current[account.id]);
        rides = await fetchAccountRides(activeAccount);
      }
      const nextRideIds = new Set(rides.map((ride) => ride.id));
      const previousRideIds = knownRideIdsRef.current.get(account.id);
      if (previousRideIds) {
        const newRides = rides.filter((ride) => !previousRideIds.has(ride.id));
        newRides.forEach((ride) => announceNewRide(account, ride));
      }
      knownRideIdsRef.current.set(account.id, nextRideIds);
      stopTerminalRideSimulations(activeAccount, rides);
      clearResolvedRouteMissingSimulations(activeAccount, rides);
      applyAutoStartForRides(activeAccount, rides);

      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id
            ? { ...item, ...activeAccount, rides, rideError: null, lastRideSync: Date.now() }
            : item,
        ),
      );
      setSessionPasswordDrafts((current) => {
        if (!current[account.id]) return current;
        const next = { ...current };
        delete next[account.id];
        return next;
      });
    } catch (error) {
      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id
            ? {
                ...item,
                rideError: isRequestAbortError(error)
                  ? item.rideError
                  : error instanceof Error ? error.message : "Unable to load rides.",
                lastRideSync: Date.now(),
              }
            : item,
        ),
      );
    } finally {
      refreshingAccountIdsRef.current.delete(account.id);
    }
  }, []);

  const postLocationForSharingAccounts = useCallback(async () => {
    const sharingAccounts = accountsRef.current.filter((account) => account.locationSharing);
    await Promise.all(sharingAccounts.map((account) => postLocationForAccount(account)));
  }, []);

  const postLocationForAccount = useCallback(async (account: DashboardAccount) => {
    const currentLocation = locationRef.current;
    if (!watchingLocationRef.current) {
      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id ? { ...item, locationStatus: "Browser GPS is off." } : item,
        ),
      );
      return;
    }

    if (!currentLocation) {
      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id ? { ...item, locationStatus: "Waiting for browser location..." } : item,
        ),
      );
      return;
    }

    let responseStatus: number | null = null;
    let responseStatusText = "";
    try {
      let activeAccount = account;
      let res = await apiFetch("/api/update_location", {
        method: "POST",
        headers: authHeaders(activeAccount.token),
        body: JSON.stringify({
          lat: currentLocation.lat,
          lon: currentLocation.lon,
          timestamp: new Date().toISOString(),
        }),
      }, { attempts: 1, timeoutMs: 1_500 });
      responseStatus = res.status;
      responseStatusText = res.statusText;
      if (isAuthResponse(res)) {
        activeAccount = await reauthenticateAccount(activeAccount, sessionPasswordDraftsRef.current[activeAccount.id]);
        setAccounts((current) =>
          current.map((item) => item.id === activeAccount.id ? { ...item, ...activeAccount } : item),
        );
        res = await apiFetch("/api/update_location", {
          method: "POST",
          headers: authHeaders(activeAccount.token),
          body: JSON.stringify({
            lat: currentLocation.lat,
            lon: currentLocation.lon,
            timestamp: new Date().toISOString(),
          }),
        }, { attempts: 1, timeoutMs: 1_500 });
        responseStatus = res.status;
        responseStatusText = res.statusText;
      }

      if (!res.ok) throw new Error(await readError(res, "Location update failed."));
      recordLocationPostLog({
        accountLabel: account.label,
        rideId: "browser-gps",
        lat: currentLocation.lat,
        lon: currentLocation.lon,
        statusCode: res.status,
        statusText: res.statusText,
        ok: true,
        message: "Posted browser GPS coordinate",
      });

      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id
            ? {
                ...item,
                locationStatus: `Posted ${formatClock(Date.now())}`,
                lastLocationSync: Date.now(),
              }
            : item,
        ),
      );
    } catch (error) {
      const currentLocation = locationRef.current;
      recordLocationPostLog({
        accountLabel: account.label,
        rideId: "browser-gps",
        lat: currentLocation?.lat ?? 0,
        lon: currentLocation?.lon ?? 0,
        statusCode: typeof responseStatus === "number" ? responseStatus : null,
        statusText: typeof responseStatusText === "string" ? responseStatusText : "",
        ok: false,
        message: error instanceof Error ? error.message : "Location update failed.",
      });
      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id
            ? {
                ...item,
                locationStatus: error instanceof Error ? error.message : "Location update failed.",
                lastLocationSync: Date.now(),
              }
            : item,
        ),
      );
    }
  }, []);

  return (
    <div className="shell">
      <style>{css}</style>
      <div className="notice-region" aria-live="polite" aria-relevant="additions">
        {notices.map((notice) => (
          <div className="ride-notice" key={notice.id}>
            <div>
              <strong>New ride for {notice.accountLabel}</strong>
              <p>{notice.ride.passengerName} · {notice.ride.pickupAddress || notice.ride.id}</p>
            </div>
            <button onClick={() => dismissNotice(notice.id)} aria-label="Dismiss ride notification">Dismiss</button>
          </div>
        ))}
      </div>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">TR</span>
          <div>
            <h1>Ride Session Dashboard</h1>
            <p>Driver-account ride polling and fake ride simulation</p>
          </div>
        </div>
        <div className="backend-chip">
          <span className="live-dot" />
          <span>Backend: https://trdev.tailff74b1.ts.net</span>
        </div>
      </header>

      <main className={sidebarCollapsed ? "layout sidebar-collapsed" : "layout"}>
        <aside className={sidebarCollapsed ? "sidebar collapsed" : "sidebar"}>
          <div className="sidebar-shell">
            <div className="sidebar-top">
              {!sidebarCollapsed ? (
                <div>
                  <h2>Dashboard Menu</h2>
                  <p>Accounts and ride simulation</p>
                </div>
              ) : null}
              <button
                className="sidebar-toggle"
                onClick={() => setSidebarCollapsed((current) => !current)}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? "☰" : "←"}
              </button>
            </div>

            <nav className="sidebar-nav" aria-label="Dashboard sidebar">
              <button
                className={sidebarSection === "accounts" ? "sidebar-nav-item active" : "sidebar-nav-item"}
                onClick={() => openSidebarSection("accounts")}
                aria-current={sidebarSection === "accounts" ? "page" : undefined}
                aria-pressed={sidebarSection === "accounts"}
                aria-label={`Show accounts, ${accounts.length} connected`}
              >
                <span aria-hidden="true">A</span>
                {!sidebarCollapsed ? <><strong>Accounts</strong><em>{accounts.length}</em></> : null}
              </button>
              <button
                className={sidebarSection === "add" ? "sidebar-nav-item active" : "sidebar-nav-item"}
                onClick={() => openSidebarSection("add")}
                aria-current={sidebarSection === "add" ? "page" : undefined}
                aria-pressed={sidebarSection === "add"}
                aria-label="Show add driver login form"
              >
                <span aria-hidden="true">+</span>
                {!sidebarCollapsed ? <><strong>Add driver</strong><em>Login</em></> : null}
              </button>
            </nav>

            {!sidebarCollapsed ? (
              <div className="sidebar-section">
                {sidebarSection === "accounts" ? (
                  <>
                    <h3>Accounts</h3>
                    <button
                      className={selectedAccountId === null ? "account-tab active" : "account-tab"}
                      onClick={() => setSelectedAccountId(null)}
                      aria-current={selectedAccountId === null ? "true" : undefined}
                    >
                      <span>All accounts</span>
                      <strong>{visibleAllRides.length}</strong>
                    </button>
                    <div className="account-list">
                      {accounts.map((account) => (
                        <button
                          key={account.id}
                          className={selectedAccountId === account.id ? "account-tab active" : "account-tab"}
                          onClick={() => setSelectedAccountId(account.id)}
                          aria-current={selectedAccountId === account.id ? "true" : undefined}
                        >
                          <span>{account.label}</span>
                          <strong>{account.rides.filter(isDashboardVisibleRide).length}</strong>
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                {sidebarSection === "add" ? (
                  <>
                    <h3>Add Driver Login</h3>
                    <form className="login-form" onSubmit={addAccount}>
                      <label>
                        Label
                        <input value={login.label} onChange={(event) => updateLogin("label", event.target.value)} placeholder="Suresh test driver" />
                      </label>
                      <label>
                        Email
                        <input required type="email" value={login.email} onChange={(event) => updateLogin("email", event.target.value)} placeholder="driver@example.com" />
                      </label>
                      <label>
                        Password
                        <input required type="password" value={login.password} onChange={(event) => updateLogin("password", event.target.value)} placeholder="Password" />
                      </label>
                      {loginError ? <p className="error-text">{loginError}</p> : null}
                      <button className="primary-button" type="submit" disabled={isLoggingIn}>
                        {isLoggingIn ? "Connecting..." : "Add Account"}
                      </button>
                    </form>
                  </>
                ) : null}

              </div>
            ) : null}
          </div>
        </aside>

        <section className="content">
          <div className="metrics">
            <Metric label="Total rides" value={totals.rides} />
            <Metric label="Open rides" value={totals.active} />
            <Metric label="Pending" value={totals.pending} />
            <Metric label="Simulating" value={totals.sharing} />
          </div>

          {selectedMapRide ? (
            <RideMap
              title={`Ride ${selectedMapRide.id}`}
              subtitle={`${selectedMapRide.passengerName} · ${selectedMapRide.accountLabel}`}
              rides={[selectedMapRide]}
              currentLocation={location}
              simulatedLocations={selectedSimulationMarker}
              routeAdherence={routeAdherence}
              onClose={() => setSelectedRideKey(null)}
            />
          ) : null}

          <div className="toolbar" aria-label="Ride filters and actions">
            <label className="toolbar-field">
              <span>Search rides</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rider, ride ID, pickup, drop-off" />
            </label>
            <label className="toolbar-field">
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Open rides</option>
              <option value="pending">Pending</option>
              <option value="scheduled">Scheduled / accepted</option>
              <option value="active">In progress</option>
              </select>
            </label>
            <button
              className={autoStartEnabled ? "auto-start-toggle active" : "auto-start-toggle"}
              onClick={toggleAutoStart}
              aria-pressed={autoStartEnabled}
              title={`Auto-Start sets new rides to ${autoStartAdherence}% adherence and starts backend-eligible rides`}
            >
              <span>{autoStartEnabled ? "Auto-Start On" : "Auto-Start"}</span>
              <em>{autoStartAdherence}%</em>
            </button>
            <label className="toolbar-field auto-start-adherence-field">
              <span>Auto-start adherence {autoStartAdherence}%</span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={autoStartAdherence}
                onChange={(event) => updateAutoStartAdherence(Number(event.target.value))}
                aria-label="Auto-start route adherence percentage"
              />
            </label>
            <button className="secondary-button" onClick={() => void refreshAllAccounts(accountsRef.current)}>
              Refresh Now
            </button>
            {canUseBrowserNotifications && notificationPermission !== "granted" ? (
              <button className="secondary-button" onClick={() => void requestBrowserNotifications()}>
                Enable Notifications
              </button>
            ) : null}
          </div>

          <LocationPostLogs logs={locationPostLogs} onClear={() => setLocationPostLogs([])} />

          {accounts.length === 0 ? (
            <div className="empty-state">
              <h2>No driver accounts connected</h2>
              <p>Add one or more mobile-app logins to see each account’s incoming rides from the backend.</p>
            </div>
          ) : (
            <div className="account-columns">
              {filteredAccounts.map((account) => (
                <AccountColumn
                  key={account.id}
                  account={account}
                  selectedRideKey={selectedRideKey}
                  simulations={simulations}
                  onSelectRide={(ride) => setSelectedRideKey(getRideKey(account.id, ride.id))}
                  onStartRide={(ride) => startRideSimulation(account, ride)}
                  onStopRide={(ride) => pauseRideSimulation(account.id, ride.id)}
                  onManualRide={(ride) => toggleManualRideSimulation(account, ride)}
                  onResetRide={(ride) => resetRideSimulation(account, ride)}
                  routeAdherence={routeAdherence}
                  onRouteAdherenceChange={(ride, value) => setRideRouteAdherence(account.id, ride.id, value)}
                  sessionPasswordDraft={sessionPasswordDrafts[account.id] ?? ""}
                  onSessionPasswordChange={(password) => updateSessionPasswordDraft(account.id, password)}
                  onRefresh={() => void refreshAccount(account)}
                  onRemove={() => removeAccount(account.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function AccountColumn({
  account,
  selectedRideKey,
  simulations,
  onSelectRide,
  onStartRide,
  onStopRide,
  onManualRide,
  onResetRide,
  routeAdherence,
  onRouteAdherenceChange,
  sessionPasswordDraft,
  onSessionPasswordChange,
  onRefresh,
  onRemove,
}: {
  account: DashboardAccount;
  selectedRideKey: string | null;
  simulations: Record<string, RideSimulation>;
  onSelectRide: (ride: DashboardRide) => void;
  onStartRide: (ride: DashboardRide) => void;
  onStopRide: (ride: DashboardRide) => void;
  onManualRide: (ride: DashboardRide) => void;
  onResetRide: (ride: DashboardRide) => void;
  routeAdherence: Record<string, number>;
  onRouteAdherenceChange: (ride: DashboardRide, value: number) => void;
  sessionPasswordDraft: string;
  onSessionPasswordChange: (password: string) => void;
  onRefresh: () => void;
  onRemove: () => void;
}) {
  const activeSimulations = account.rides.filter((ride) => {
    const simulation = simulations[getRideKey(account.id, ride.id)];
    return simulation?.running || simulation?.mode === "manual";
  }).length;
  const needsSessionRenewal = Boolean(account.rideError && isSessionRenewalError(account.rideError) && !account.password);
  return (
    <section className="account-column">
      <div className="account-header">
        <div>
          <h2>{account.label}</h2>
          <p>{account.email}</p>
          <p>User ID: {account.user.id ?? "unknown"}</p>
        </div>
        <button className="danger-button" onClick={onRemove} aria-label={`Remove ${account.label}`}>
          Remove
        </button>
      </div>
      <div className="account-actions">
        <button className="secondary-button" onClick={onRefresh}>Refresh</button>
      </div>
      <div className="sync-row">
        <span>Rides: {account.lastRideSync ? formatClock(account.lastRideSync) : "not synced"}</span>
        <span>{activeSimulations ? `${activeSimulations} ride simulation${activeSimulations === 1 ? "" : "s"} active` : "No ride simulations active"}</span>
      </div>
      {account.rideError ? <p className="error-banner">{account.rideError}</p> : null}
      {needsSessionRenewal ? (
        <form className="session-renewal" onSubmit={(event) => { event.preventDefault(); onRefresh(); }}>
          <label>
            Password to renew session
            <input
              required
              type="password"
              value={sessionPasswordDraft}
              onChange={(event) => onSessionPasswordChange(event.target.value)}
              placeholder="Enter password once"
            />
          </label>
          <button className="secondary-button" type="submit">Save & Refresh</button>
        </form>
      ) : null}
      {account.rides.length === 0 ? (
        <div className="empty-column">
          <p>No rides for this account yet.</p>
        </div>
      ) : (
        <div className="ride-stack">
          {account.rides.map((ride) => (
            <RideCard
              key={ride.id}
              ride={ride}
              accountId={account.id}
              accountLabel={account.label}
              simulation={simulations[getRideKey(account.id, ride.id)]}
              adherence={routeAdherence[getRideKey(account.id, ride.id)] ?? DEFAULT_ROUTE_ADHERENCE}
              selected={selectedRideKey === getRideKey(account.id, ride.id)}
              onSelect={() => onSelectRide(ride)}
              onStartRide={() => onStartRide(ride)}
              onStopRide={() => onStopRide(ride)}
              onManualRide={() => onManualRide(ride)}
              onResetRide={() => onResetRide(ride)}
              onAdherenceChange={(value) => onRouteAdherenceChange(ride, value)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RideCard({
  ride,
  accountId,
  accountLabel,
  simulation,
  adherence,
  selected,
  onSelect,
  onStartRide,
  onStopRide,
  onManualRide,
  onResetRide,
  onAdherenceChange,
}: {
  ride: DashboardRide;
  accountId: string;
  accountLabel: string;
  simulation?: RideSimulation;
  adherence: number;
  selected: boolean;
  onSelect: () => void;
  onStartRide: () => void;
  onStopRide: () => void;
  onManualRide: () => void;
  onResetRide: () => void;
  onAdherenceChange: (value: number) => void;
}) {
  const tone = statusTone[ride.status] ?? "scheduled";
  const canStartRide = canSimulateRide(ride);
  const manualActive = simulation?.mode === "manual";
  const playbackLabel = simulation?.running
    ? "Pause Ride"
    : simulation && simulation.progress > 0 && simulation.progress < 1
      ? "Resume Ride"
      : "Start Ride";
  const progressValue = Math.round(Math.max(0, Math.min(1, simulation?.progress ?? 0)) * 100);
  const simulationStatus = simulation?.status ?? (canStartRide ? "Ready to simulate." : "Waiting for backend In Progress.");
  const lastPostText = simulation?.error
    ? "Last backend post failed."
    : simulation?.lastPostedAt
      ? `Last backend post succeeded at ${formatClock(simulation.lastPostedAt)}`
      : "No fake coordinates posted yet.";
  const mapRide: MapRide = { ...ride, accountId, accountLabel };
  const simulationMarker = getSimulationMarkers(
    simulation ? { [simulation.key]: simulation } : {},
    [mapRide],
  );
  return (
    <article className={selected ? "ride-card selected" : "ride-card"}>
      <div className="ride-card-layout">
        <button className="ride-mini-map-button" onClick={onSelect} aria-label={`Open full map for ride ${ride.id}`}>
          <MiniRideMap ride={mapRide} simulatedLocations={simulationMarker} routeAdherence={{ [getRideKey(accountId, ride.id)]: adherence }} />
        </button>
        <button className="ride-detail-button" onClick={onSelect} aria-label={`Open ride ${ride.id} full-size map`}>
          <div className="ride-top">
            <strong>{ride.id}</strong>
            <span className={`status ${tone}`}>{statusLabels[ride.status] ?? (ride.status || "Unknown")}</span>
          </div>
          <h3>{ride.passengerName}</h3>
          <p className="ride-meta">{[ride.scheduledDate, ride.scheduledTime].filter(Boolean).join(" ") || "No scheduled time"}</p>
          <p className="ride-meta">{[ride.transitType, ride.tripType].filter(Boolean).join(" / ") || "Transport details pending"}</p>
          <div className="route">
            <RouteLine color="blue" label="Pickup" value={ride.pickupAddress} />
            <RouteLine color="green" label="Drop-off" value={ride.dropoffAddress} />
          </div>
          {ride.notes ? <p className="notes">{ride.notes}</p> : null}
        </button>
      </div>
      <div className="simulation-row">
        <div>
          <strong>{simulationStatus}</strong>
          {simulation ? (
            <div
              className="playback-progress"
              role="progressbar"
              aria-label={`Ride playback ${progressValue} percent`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressValue}
            >
              <span style={{ width: `${progressValue}%` }} />
            </div>
          ) : null}
          <span>{lastPostText}</span>
          {simulation?.error ? <em>{simulation.error}</em> : null}
          <label className="adherence-control">
            <span>Route adherence {adherence}%</span>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={adherence}
              onChange={(event) => onAdherenceChange(Number(event.target.value))}
              aria-label={`Route adherence for ride ${ride.id}`}
            />
          </label>
        </div>
        <div className="simulation-actions">
          <button
            className={manualActive ? "stop-button" : "secondary-button"}
            onClick={onManualRide}
            disabled={!manualActive && !canStartRide}
            title={manualActive ? "Exit keyboard driving mode" : "Use arrow keys to move the fake driver around nearby city streets"}
          >
            {manualActive ? "Exit Manual" : "Manual Drive"}
          </button>
          <button className="secondary-button" onClick={onResetRide} title="Reset fake driver marker to the pickup coordinate and post it to the backend">
            Reset Location
          </button>
          <button
            className={simulation?.running ? "stop-button" : "primary-button"}
            onClick={simulation?.running ? onStopRide : onStartRide}
            disabled={!simulation?.running && !canStartRide}
            title={!canStartRide ? "Waiting for backend status: In Progress" : undefined}
          >
            {playbackLabel}
          </button>
        </div>
      </div>
    </article>
  );
}

function RouteLine({ color, label, value }: { color: "blue" | "green"; label: string; value: string }) {
  return (
    <div className="route-line">
      <span className={`route-dot ${color}`} />
      <div>
        <span>{label}</span>
        <p>{value || "Not provided by backend"}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LocationPostLogs({ logs, onClear }: { logs: LocationPostLog[]; onClear: () => void }) {
  const [accountFilter, setAccountFilter] = useState("all");
  const [rideFilter, setRideFilter] = useState("all");
  const accountOptions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.accountLabel))).sort((a, b) => a.localeCompare(b));
  }, [logs]);
  const rideOptions = useMemo(() => {
    return Array.from(
      new Set(
        logs
          .filter((log) => accountFilter === "all" || log.accountLabel === accountFilter)
          .map((log) => log.rideId),
      ),
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [accountFilter, logs]);
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (accountFilter !== "all" && log.accountLabel !== accountFilter) return false;
      if (rideFilter !== "all" && log.rideId !== rideFilter) return false;
      return true;
    });
  }, [accountFilter, logs, rideFilter]);

  const updateAccountFilter = (value: string) => {
    setAccountFilter(value);
    setRideFilter("all");
  };

  return (
    <section className="location-log-panel" aria-label="Location post logs">
      <div className="location-log-header">
        <div>
          <h2>Location post logs</h2>
          <p>Latest `/api/update_location` requests from simulated rides and browser GPS. Showing {filteredLogs.length} of {logs.length}.</p>
        </div>
        <button className="secondary-button" onClick={onClear} disabled={logs.length === 0}>
          Clear
        </button>
      </div>
      <div className="location-log-filters">
        <label>
          Account
          <select value={accountFilter} onChange={(event) => updateAccountFilter(event.target.value)} disabled={logs.length === 0}>
            <option value="all">All accounts</option>
            {accountOptions.map((accountLabel) => (
              <option key={accountLabel} value={accountLabel}>{accountLabel}</option>
            ))}
          </select>
        </label>
        <label>
          Ride
          <select value={rideFilter} onChange={(event) => setRideFilter(event.target.value)} disabled={logs.length === 0}>
            <option value="all">All rides</option>
            {rideOptions.map((rideId) => (
              <option key={rideId} value={rideId}>{rideId === "browser-gps" ? "Browser GPS" : `Ride ${rideId}`}</option>
            ))}
          </select>
        </label>
      </div>
      {logs.length === 0 ? (
        <p className="location-log-empty">No location posts recorded in this page session yet.</p>
      ) : filteredLogs.length === 0 ? (
        <p className="location-log-empty">No location posts match these filters.</p>
      ) : (
        <div className="location-log-list">
          {filteredLogs.map((log) => (
            <div className="location-log-row" key={log.id}>
              <span className={log.ok ? "location-log-status ok" : "location-log-status error"}>
                {log.ok ? "OK" : "FAIL"}
              </span>
              <span>{formatClock(log.createdAt)}</span>
              <strong>{log.accountLabel}</strong>
              <span>Ride {log.rideId}</span>
              <code>{log.lat.toFixed(6)}, {log.lon.toFixed(6)}</code>
              <span>{log.statusCode ? `${log.statusCode} ${log.statusText}` : "No response"}</span>
              <span>{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MiniRideMap({
  ride,
  simulatedLocations,
  routeAdherence,
}: {
  ride: MapRide;
  simulatedLocations: SimulatedLocationMarker[];
  routeAdherence: Record<string, number>;
}) {
  return (
    <LeafletRideMap
      className="mini-map-frame"
      rides={[ride]}
      currentLocation={null}
      simulatedLocations={simulatedLocations}
      routeAdherence={routeAdherence}
      interactive={false}
      showTiles
      showAttribution={false}
      maxZoom={13}
    />
  );
}

function RideMap({
  title,
  subtitle,
  rides,
  currentLocation,
  simulatedLocations,
  routeAdherence,
  onClose,
}: {
  title: string;
  subtitle: string;
  rides: MapRide[];
  currentLocation: BrowserLocation | null;
  simulatedLocations: SimulatedLocationMarker[];
  routeAdherence: Record<string, number>;
  onClose: () => void;
}) {
  const mappedRideCount = rides.filter((ride) => getDrawableRoute(ride).length > 1 || ride.pickupCoords || ride.dropoffCoords).length;

  return (
    <section className="map-panel">
      <div className="map-header">
        <div>
          <button className="back-button" onClick={onClose} aria-label="Back to rides">
            <span aria-hidden="true">←</span>
            Back to rides
          </button>
          <h2>{title}</h2>
          <p>{subtitle} · {mappedRideCount} mapped ride</p>
        </div>
        <div className="map-header-actions">
          <div className="map-legend" aria-label="Map legend">
            <span><i className="legend-dot pickup" />Pickup</span>
            <span><i className="legend-dot dropoff" />Drop-off</span>
            <span><i className="legend-line" />Preset route</span>
            <span><i className="legend-line variation" />Adherence route</span>
          </div>
        </div>
      </div>
      <LeafletRideMap
        className="map-frame"
        rides={rides}
        currentLocation={currentLocation}
        simulatedLocations={simulatedLocations}
        routeAdherence={routeAdherence}
        interactive
        showTiles
        showAttribution
        maxZoom={19}
      />
    </section>
  );
}

function LeafletRideMap({
  className,
  rides,
  currentLocation,
  simulatedLocations,
  routeAdherence,
  interactive,
  showTiles,
  showAttribution,
  maxZoom,
}: {
  className: string;
  rides: MapRide[];
  currentLocation: BrowserLocation | null;
  simulatedLocations: SimulatedLocationMarker[];
  routeAdherence: Record<string, number>;
  interactive: boolean;
  showTiles: boolean;
  showAttribution: boolean;
  maxZoom: number;
}) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const userMovedMapRef = useRef(false);
  const autoFittingMapRef = useRef(false);
  const fitSignatureRef = useRef("");

  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;

    const map = L.map(mapElRef.current, {
      zoomControl: interactive,
      attributionControl: showAttribution,
      maxZoom,
      scrollWheelZoom: interactive,
      dragging: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
    }).setView(DEFAULT_MAP_CENTER, 12);

    if (showTiles) {
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
    }

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    if (interactive) {
      const markUserMoved = () => {
        if (autoFittingMapRef.current) return;
        userMovedMapRef.current = true;
      };
      map.on("zoomstart", markUserMoved);
      map.on("dragstart", markUserMoved);
      map.on("movestart", markUserMoved);
      mapElRef.current.addEventListener("wheel", markUserMoved, { passive: true });
      mapElRef.current.addEventListener("mousedown", markUserMoved);
      mapElRef.current.addEventListener("touchstart", markUserMoved, { passive: true });
      mapElRef.current.addEventListener("keydown", markUserMoved);
    }
    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      autoFittingMapRef.current = false;
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [interactive, showTiles, showAttribution, maxZoom]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    const fitSignature = rides
      .map((ride) => `${ride.accountId}:${ride.id}:${routeAdherence[getRideKey(ride.accountId, ride.id)] ?? DEFAULT_ROUTE_ADHERENCE}`)
      .join("|");
    if (fitSignature !== fitSignatureRef.current) {
      fitSignatureRef.current = fitSignature;
      userMovedMapRef.current = false;
    }

    layer.clearLayers();
    const bounds = L.latLngBounds([]);

    rides.forEach((ride, index) => {
      const color = routeColors[index % routeColors.length];
      const route = getDrawableRoute(ride);

      if (route.length > 1) {
        const latLngs = route.map(toLatLng);
        L.polyline(latLngs, { color, weight: 4, opacity: 0.82 }).addTo(layer);
        latLngs.forEach((point) => bounds.extend(point));
      }

      const adherence = routeAdherence[getRideKey(ride.accountId, ride.id)] ?? DEFAULT_ROUTE_ADHERENCE;
      const adherenceRoute = getAdherentRoute(ride, adherence, getRideKey(ride.accountId, ride.id));
      if (adherence < 100 && adherenceRoute.length > 1) {
        const adherenceLatLngs = adherenceRoute.map(toLatLng);
        L.polyline(adherenceLatLngs, {
          color: "#f59e0b",
          weight: 3,
          opacity: 0.86,
          dashArray: "8 7",
        }).addTo(layer);
        adherenceLatLngs.forEach((point) => bounds.extend(point));
      }

      if (ride.pickupCoords) {
        const pickup = toLatLng(ride.pickupCoords);
        L.circleMarker(pickup, {
          radius: 7,
          color: "#ffffff",
          weight: 2,
          fillColor: "#1d76bd",
          fillOpacity: 1,
        })
          .bindPopup(`<strong>${escapeHtml(ride.passengerName)}</strong><br/>Pickup: ${escapeHtml(ride.pickupAddress || "Not provided")}<br/>${escapeHtml(ride.accountLabel)}`)
          .addTo(layer);
        bounds.extend(pickup);
      }

      if (ride.dropoffCoords) {
        const dropoff = toLatLng(ride.dropoffCoords);
        L.circleMarker(dropoff, {
          radius: 7,
          color: "#ffffff",
          weight: 2,
          fillColor: "#18a058",
          fillOpacity: 1,
        })
          .bindPopup(`<strong>${escapeHtml(ride.passengerName)}</strong><br/>Drop-off: ${escapeHtml(ride.dropoffAddress || "Not provided")}<br/>${escapeHtml(ride.accountLabel)}`)
          .addTo(layer);
        bounds.extend(dropoff);
      }
    });

    if (currentLocation) {
      const driver = L.latLng(currentLocation.lat, currentLocation.lon);
      L.circleMarker(driver, {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: "#152238",
        fillOpacity: 1,
      }).bindPopup("Browser GPS location").addTo(layer);
      bounds.extend(driver);
    }

    simulatedLocations.forEach((marker) => {
      const point = toLatLng(marker.coordinate);
      L.circleMarker(point, {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: "#f59e0b",
        fillOpacity: 1,
      }).bindPopup(escapeHtml(marker.label)).addTo(layer);
      bounds.extend(point);
    });

    if (bounds.isValid() && (!interactive || !userMovedMapRef.current)) {
      autoFittingMapRef.current = true;
      map.fitBounds(bounds.pad(0.18), { maxZoom });
      window.setTimeout(() => {
        autoFittingMapRef.current = false;
      }, 0);
    } else if (!bounds.isValid()) {
      map.setView(DEFAULT_MAP_CENTER, 11);
    }
    window.setTimeout(() => map.invalidateSize(), 0);
  }, [rides, currentLocation, simulatedLocations, routeAdherence, maxZoom]);

  return <div className={className} ref={mapElRef} />;
}

async function fetchAccountRides(account: DashboardAccount): Promise<DashboardRide[]> {
  const rawRides = await fetchRideList(account);
  const rides = rawRides
    .map((summary) => normalizeRide(summary))
    .filter((ride): ride is DashboardRide => Boolean(ride))
    .sort((a, b) => b.createdAt - a.createdAt);

  const hydratedRides = [...rides];
  const detailRideIndexes = rides
    .map((ride, index) => ({ ride, index }))
    .filter(({ ride }) => shouldFetchRideDetail(ride));

  for (let index = 0; index < detailRideIndexes.length; index += 3) {
    const batch = detailRideIndexes.slice(index, index + 3);
    await Promise.all(batch.map(async ({ ride, index: rideIndex }) => {
      try {
        const detail = await fetchRideDetail(ride.id, account.token);
        hydratedRides[rideIndex] = detail ? normalizeRide({ ...ride.raw, ...detail }) ?? ride : ride;
      } catch (error) {
        if (!isRequestAbortError(error)) {
          console.info("[rides] detail hydration skipped", {
            accountLabel: account.label,
            rideId: ride.id,
            message: error instanceof Error ? error.message : "Unable to fetch ride detail.",
          });
        }
      }
    }));
  }

  return hydratedRides.sort((a, b) => b.createdAt - a.createdAt);
}

async function fetchRideList(account: DashboardAccount): Promise<Record<string, unknown>[]> {
  const primary = await apiFetch("/api/rides", { headers: authHeaders(account.token) }, { attempts: 1, timeoutMs: 3_000 });
  if (primary.ok) return extractArray(await primary.json(), ["rides", "data", "results"]);

  if (isTokenExpiredResponse(primary)) {
    throw new AuthExpiredError(await readError(primary, "Session expired."));
  }

  if (primary.status !== 403 && primary.status !== 404) {
    throw new Error(await readError(primary, "Unable to load rides."));
  }

  const userId = account.user.id;
  if (userId === undefined || userId === null || userId === "") {
    throw new Error("Ride endpoint /api/rides was not found and this login did not return a user ID for /api/drivers/{id}/rides.");
  }

  const fallback = await apiFetch(
    `/api/drivers/${encodeURIComponent(String(userId))}/rides`,
    { headers: authHeaders(account.token) },
    { attempts: 1, timeoutMs: 3_000 },
  );
  if (isAuthResponse(fallback)) {
    throw new AuthExpiredError(await readError(fallback, "Session expired."));
  }
  if (!fallback.ok) throw new Error(await readError(fallback, "Unable to load driver rides."));
  return extractArray(await fallback.json(), ["rides", "data", "results"]);
}

async function fetchRideDetail(rideId: string, token: string): Promise<Record<string, unknown> | null> {
  const backendId = getRideBackendId(rideId);
  const id = encodeURIComponent(String(backendId ?? rideId));
  const res = await apiFetch(`/api/rides/${id}`, { headers: authHeaders(token) }, { attempts: 1, timeoutMs: 2_500 });
  if (!res.ok) return null;
  const body = await res.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  for (const key of ["ride", "data", "result"]) {
    const nested = record[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
  }
  return record;
}

function shouldFetchRideDetail(ride: DashboardRide): boolean {
  if (!isDashboardVisibleRide(ride)) return false;
  return !ride.pickupCoords || !ride.dropoffCoords || ride.routeCoords.length < 2;
}

function normalizeRide(raw: Record<string, unknown>): DashboardRide | null {
  const id = pickString(raw, ["id", "ride_id", "rideId", "uuid"]);
  if (!id) return null;

  const pickupDate = pickString(raw, ["pickup_date", "scheduled_date", "scheduledDate", "ride_date", "date", "start_time", "startTime"]);
  const pickupTime = pickString(raw, ["pickup_time", "scheduled_time", "scheduledTime", "ride_time", "time", "start_time", "startTime"]);
  const createdAtValue = pickString(raw, ["created_at", "createdAt", "start_time", "startTime"]);

  return {
    id,
    status: normalizeStatus(pickString(raw, ["status", "ride_status"]) ?? ""),
    passengerName:
      pickString(raw, ["passenger_name", "rider_name", "passengerName", "client_name", "customer_name", "name"]) ||
      pickNestedString(raw, ["passenger", "rider", "client", "customer"], ["name", "full_name", "fullName"]) ||
      "Rider pending",
    pickupAddress:
      pickString(raw, ["pickup_address", "pickupAddress", "pickup"]) ||
      pickNestedString(raw, ["start", "pickup"], ["address", "name"]) ||
      "",
    dropoffAddress:
      pickString(raw, ["dropoff_address", "dropoffAddress", "destination_address", "dropoff"]) ||
      pickNestedString(raw, ["end", "dropoff", "destination"], ["address", "name"]) ||
      "",
    pickupCoords: normalizeCoordinate(
      raw.pickupCoords ??
      raw.pickup_coords ??
      raw.start ??
      raw.pickup ??
      {
        lat: raw.pickup_latitude ?? raw.pickup_lat,
        lon: raw.pickup_longitude ?? raw.pickup_lon ?? raw.pickup_lng,
      },
    ),
    dropoffCoords: normalizeCoordinate(
      raw.dropoffCoords ??
      raw.dropoff_coords ??
      raw.end ??
      raw.dropoff ??
      raw.destination ??
      {
        lat: raw.dropoff_latitude ?? raw.dropoff_lat,
        lon: raw.dropoff_longitude ?? raw.dropoff_lon ?? raw.dropoff_lng,
      },
    ),
    routeCoords: normalizeRouteGeometry(
      raw.route ??
      raw.route_coords ??
      raw.routeCoords ??
      raw.route_points ??
      raw.routePoints ??
      raw.route_geometry ??
      raw.routeGeometry ??
      raw.planned_route ??
      raw.plannedRoute ??
      raw.planned_route_geometry ??
      raw.plannedRouteGeometry ??
      raw.path ??
      raw.geometry ??
      raw.polyline ??
      raw.encoded_polyline ??
      raw.encodedPolyline,
    ),
    scheduledDate: formatDatePart(pickupDate),
    scheduledTime: formatTimePart(pickupTime),
    transitType: pickString(raw, ["transit_type", "transitType", "vehicle_type", "vehicle"]) || "Vehicle pending",
    tripType: pickString(raw, ["trip_type", "tripType", "ride_type"]) || "",
    notes:
      pickString(raw, ["notes", "care_notes", "special_instructions"]) ||
      pickNestedString(raw, ["passenger", "rider", "client", "customer"], ["notes", "care_notes", "special_instructions"]) ||
      "",
    createdAt: toTimestamp(createdAtValue) ?? Date.now(),
    raw,
  };
}

function filterRides(rides: DashboardRide[], query: string, statusFilter: string): DashboardRide[] {
  const needle = query.trim().toLowerCase();
  return rides.filter((ride) => {
    if (statusFilter !== "all" && (statusTone[ride.status] ?? ride.status) !== statusFilter) return false;
    if (!needle) return true;
    return [ride.id, ride.passengerName, ride.pickupAddress, ride.dropoffAddress, ride.status]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
}

function isDashboardVisibleRide(ride: DashboardRide): boolean {
  return !isTerminalRide(ride);
}

function isWaitingRide(ride: DashboardRide): boolean {
  return ["pending", "requested", "request", "new", "scheduled", "booked", "assigned", "accepted"].includes(ride.status);
}

function isTerminalRide(ride: DashboardRide): boolean {
  return ["completed", "complete", "done", "cancelled", "canceled", "declined"].includes(ride.status);
}

function isRouteMissingSimulation(simulation: RideSimulation): boolean {
  return simulation.status.toLowerCase().includes("route missing") || Boolean(simulation.error?.toLowerCase().includes("enough backend coordinates"));
}

function getRideKey(accountId: string, rideId: string): string {
  return `${accountId}:${rideId}`;
}

function canSimulateRide(ride: DashboardRide): boolean {
  return ["in_progress", "inprogress", "active", "en_route", "enroute", "on_way", "released", "picked_up", "pickedup", "in_transit", "intransit"].includes(ride.status);
}

function getSimulationMarkers(
  simulations: Record<string, RideSimulation>,
  rides: MapRide[],
): SimulatedLocationMarker[] {
  return rides
    .map((ride) => {
      const simulation = simulations[getRideKey(ride.accountId, ride.id)];
      if (!simulation?.coordinate) return null;
      return {
        key: simulation.key,
        label: `${ride.accountLabel} driving ride ${ride.id}`,
        coordinate: simulation.coordinate,
      };
    })
    .filter((marker): marker is SimulatedLocationMarker => Boolean(marker));
}

function getDrawableRoute(ride: DashboardRide): RideCoordinate[] {
  const route = ride.routeCoords.length > 1
    ? [...ride.routeCoords]
    : [ride.pickupCoords, ride.dropoffCoords].filter((coord): coord is RideCoordinate => Boolean(coord));

  if (route.length < 2) return route;

  const exactRoute = [...route];
  if (ride.pickupCoords) exactRoute[0] = ride.pickupCoords;
  if (ride.dropoffCoords) exactRoute[exactRoute.length - 1] = ride.dropoffCoords;
  return dedupeAdjacentRouteCoordinates(exactRoute);
}

function dedupeAdjacentRouteCoordinates(route: RideCoordinate[]): RideCoordinate[] {
  return route.filter((coordinate, index) => {
    if (index === 0) return true;
    return distanceMeters(route[index - 1], coordinate) > 0.05;
  });
}

function getRideRouteDebug(account: DashboardAccount, ride: DashboardRide, key: string, route: RideCoordinate[]) {
  return {
    account: account.label,
    rideId: ride.id,
    key,
    status: ride.status,
    drawableRouteLength: route.length,
    backendRouteLength: ride.routeCoords.length,
    hasPickupCoords: Boolean(ride.pickupCoords),
    hasDropoffCoords: Boolean(ride.dropoffCoords),
    pickupCoords: ride.pickupCoords,
    dropoffCoords: ride.dropoffCoords,
    rawKeys: Object.keys(ride.raw).sort(),
  };
}

function getAdherentRoute(ride: DashboardRide, adherence: number, key: string): RideCoordinate[] {
  const route = getDrawableRoute(ride);
  const normalizedAdherence = clampAdherence(adherence);
  if (normalizedAdherence >= 100 || route.length < 2) return route;

  const variance = (100 - normalizedAdherence) / 100;
  const maxOffsetMeters = 180 * variance;
  const workingRoute = route.length === 2
    ? [
        route[0],
        interpolateRoute(route, 0.33),
        interpolateRoute(route, 0.66),
        route[1],
      ]
    : route;

  return workingRoute.map((point, index) => {
    if (index === 0 || index === workingRoute.length - 1) return point;

    const before = workingRoute[index - 1];
    const after = workingRoute[index + 1];
    const directionLat = after.latitude - before.latitude;
    const directionLon = after.longitude - before.longitude;
    const length = Math.hypot(directionLat, directionLon);
    if (length <= 0) return point;

    const seed = hashToUnit(`${key}:${index}`);
    const sign = seed > 0.5 ? 1 : -1;
    const wave = Math.sin(index * 1.7 + seed * Math.PI * 2);
    const offsetMeters = maxOffsetMeters * (0.45 + Math.abs(wave) * 0.55) * sign;
    const normalLat = -directionLon / length;
    const normalLon = directionLat / length;
    const northMeters = normalLat * offsetMeters;
    const eastMeters = normalLon * offsetMeters * Math.cos(toRadians(point.latitude));
    return offsetCoordinate(point, northMeters, eastMeters);
  });
}

function getSimulationCoordinate(ride: DashboardRide, route: RideCoordinate[], progress: number): RideCoordinate {
  if (progress >= 0.995 && ride.dropoffCoords) return ride.dropoffCoords;
  if (progress <= 0.001 && ride.pickupCoords) return ride.pickupCoords;
  return interpolateRoute(route, progress);
}

function getManualStartCoordinate(ride: DashboardRide): RideCoordinate | null {
  return ride.pickupCoords ?? ride.routeCoords[0] ?? ride.dropoffCoords ?? null;
}

function interpolateRoute(route: RideCoordinate[], progress: number): RideCoordinate {
  if (route.length === 0) return { latitude: 37.7749, longitude: -122.4194 };
  if (route.length === 1) return route[0];

  const segments = route.slice(0, -1).map((point, index) => {
    const next = route[index + 1];
    return {
      from: point,
      to: next,
      distance: distanceMeters(point, next),
    };
  });
  const totalDistance = segments.reduce((sum, segment) => sum + segment.distance, 0);
  if (totalDistance <= 0) return route[0];

  let targetDistance = Math.max(0, Math.min(1, progress)) * totalDistance;
  for (const segment of segments) {
    if (targetDistance <= segment.distance) {
      const t = segment.distance === 0 ? 0 : targetDistance / segment.distance;
      return {
        latitude: segment.from.latitude + (segment.to.latitude - segment.from.latitude) * t,
        longitude: segment.from.longitude + (segment.to.longitude - segment.from.longitude) * t,
      };
    }
    targetDistance -= segment.distance;
  }

  return route[route.length - 1];
}

function offsetCoordinate(coordinate: RideCoordinate, northMeters: number, eastMeters: number): RideCoordinate {
  const latitude = coordinate.latitude + northMeters / 111_320;
  const metersPerLongitudeDegree = 111_320 * Math.cos(toRadians(coordinate.latitude));
  const longitude = coordinate.longitude + eastMeters / Math.max(1, metersPerLongitudeDegree);
  return { latitude, longitude };
}

function clampAdherence(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ROUTE_ADHERENCE;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hashToUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

async function snapCoordinateToRoad(coordinate: RideCoordinate): Promise<RideCoordinate> {
  const url = `${OSRM_NEAREST_URL}/${coordinate.longitude},${coordinate.latitude}?number=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Street snap failed with ${res.status}.`);

  const body = await res.json() as unknown;
  if (!isRecord(body) || body.code !== "Ok") throw new Error("Street snap service did not return a drivable road point.");
  const waypoints = body.waypoints;
  if (!Array.isArray(waypoints) || !isRecord(waypoints[0])) throw new Error("Street snap service returned no nearby street.");

  const location = waypoints[0].location;
  const snapped = normalizeRoutePoint(location);
  if (!snapped) throw new Error("Street snap service returned an invalid coordinate.");
  return snapped;
}

function distanceMeters(a: RideCoordinate, b: RideCoordinate): number {
  const earthRadius = 6_371_000;
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRadians(value: number): number {
  return value * Math.PI / 180;
}

function toLatLng(coord: RideCoordinate): L.LatLng {
  return L.latLng(coord.latitude, coord.longitude);
}

function normalizeRouteGeometry(value: unknown): RideCoordinate[] {
  if (typeof value === "string" && value.trim()) {
    return decodePolyline(value.trim());
  }

  if (Array.isArray(value)) {
    return value
      .map(normalizeRoutePoint)
      .filter((point): point is RideCoordinate => Boolean(point));
  }

  if (isRecord(value)) {
    const nested = value.coordinates ?? value.coords ?? value.points ?? value.path ?? value.route ?? value.geometry;
    const nestedCoords = normalizeRouteGeometry(nested);
    if (nestedCoords.length > 1) return nestedCoords;

    const encoded = value.polyline ?? value.encoded_polyline ?? value.encodedPolyline ?? value.overview_polyline ?? value.overviewPolyline;
    if (typeof encoded === "string") return decodePolyline(encoded);
    if (isRecord(encoded) && typeof encoded.points === "string") return decodePolyline(encoded.points);
  }

  return [];
}

function normalizeCoordinate(value: unknown): RideCoordinate | null {
  if (!value) return null;
  if (Array.isArray(value)) return normalizeRoutePoint(value);
  if (!isRecord(value)) return null;

  const direct = normalizeRoutePoint(value);
  if (direct) return direct;

  const nested = value.location ?? value.coords ?? value.coordinate ?? value.coordinates;
  return normalizeCoordinate(nested);
}

function normalizeRoutePoint(point: unknown): RideCoordinate | null {
  if (Array.isArray(point) && point.length >= 2) {
    const first = toNumber(point[0]);
    const second = toNumber(point[1]);
    if (first === null || second === null) return null;

    const lonLat = { latitude: second, longitude: first };
    if (isValidCoordinate(lonLat.latitude, lonLat.longitude)) return lonLat;

    const latLon = { latitude: first, longitude: second };
    if (isValidCoordinate(latLon.latitude, latLon.longitude)) return latLon;
    return null;
  }

  if (!isRecord(point)) return null;
  const latitude = toNumber(point.latitude ?? point.lat);
  const longitude = toNumber(point.longitude ?? point.lon ?? point.lng);
  if (latitude === null || longitude === null || !isValidCoordinate(latitude, longitude)) return null;
  return { latitude, longitude };
}

function decodePolyline(encoded: string): RideCoordinate[] {
  const points: RideCoordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    const point = { latitude: lat / 1e5, longitude: lng / 1e5 };
    if (isValidCoordinate(point.latitude, point.longitude)) points.push(point);
  }

  return points;
}

function toNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function loadAccounts(): DashboardAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DashboardAccount[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((account) => ({
      ...account,
      rides: [],
      rideError: null,
      lastRideSync: null,
      locationSharing: false,
      locationStatus: "Location sharing is off.",
      lastLocationSync: null,
    }));
  } catch {
    return [];
  }
}

function saveAccounts(accounts: DashboardAccount[]) {
  const stored = accounts.map(({ rides, rideError, lastRideSync, locationSharing, locationStatus, lastLocationSync, ...account }) => account);
  localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(stored));
}

function loadAutoStartAdherence(): number {
  try {
    const raw = localStorage.getItem(AUTO_START_ADHERENCE_STORAGE_KEY);
    if (!raw) return DEFAULT_AUTO_START_ROUTE_ADHERENCE;
    return clampAdherence(Number(raw));
  } catch {
    return DEFAULT_AUTO_START_ROUTE_ADHERENCE;
  }
}

function saveAutoStartAdherence(value: number) {
  localStorage.setItem(AUTO_START_ADHERENCE_STORAGE_KEY, String(clampAdherence(value)));
}

class AuthExpiredError extends Error {
  constructor(message = "Session expired. Re-enter this account password to continue.") {
    super(message);
    this.name = "AuthExpiredError";
  }
}

async function loginDriverAccount(email: string, password: string): Promise<LoginResult> {
  const res = await apiFetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, "Login failed."));
  }

  const body = await res.json();
  const token = pickString(body, ["token", "access_token", "jwt"]);
  if (!token) throw new Error("Login response did not include a token.");

  return {
    token,
    user: normalizeUser(body.user ?? body.driver ?? body.account ?? {}),
  };
}

async function reauthenticateAccount(account: DashboardAccount, passwordOverride = ""): Promise<DashboardAccount> {
  const password = account.password || passwordOverride;
  if (!password) {
    throw new AuthExpiredError("Session expired. Enter this account password below, then click Save & Refresh.");
  }

  const { token, user } = await loginDriverAccount(account.email, password);
  console.info("[auth] refreshed expired driver token", {
    accountLabel: account.label,
    userId: user.id ?? account.user.id ?? "unknown",
  });
  return {
    ...account,
    password,
    token,
    user: {
      ...account.user,
      ...user,
    },
  };
}

function isAuthResponse(res: Response): boolean {
  return res.status === 401 || res.status === 403;
}

function isTokenExpiredResponse(res: Response): boolean {
  return res.status === 401;
}

function isSessionRenewalError(message: string): boolean {
  return message.toLowerCase().includes("session expired");
}

function isRequestAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "AbortError" || error.message.toLowerCase().includes("aborted");
}

async function apiFetch(path: string, init: RequestInit = {}, options: { attempts?: number; timeoutMs?: number } = {}) {
  const url = `${API_BASE}${path}`;
  let lastError: unknown = null;
  const attempts = options.attempts ?? 3;
  const timeoutMs = options.timeoutMs ?? 8_000;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      if (!isRequestAbortError(error)) console.warn("[fleet-api] network fetch failed, retrying", {
        path,
        attempt,
        message: error instanceof Error ? error.message : "Network request failed.",
      });
      await delay(350 * attempt);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Network request failed.");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function authHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function normalizeUser(raw: unknown): FleetUser {
  const user = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return {
    id: pickString(user, ["id", "driver_id", "driverId", "user_id", "userId"]),
    name: pickString(user, ["name", "driver_name", "driverName", "email"]),
    email: pickString(user, ["email"]),
  };
}

function extractArray(body: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(body)) return body.filter(isRecord);
  if (!isRecord(body)) return [];
  for (const key of keys) {
    const value = body[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function pickNestedString(record: Record<string, unknown>, parents: string[], keys: string[]): string | undefined {
  for (const parent of parents) {
    const nested = record[parent];
    if (!isRecord(nested)) continue;
    const value = pickString(nested, keys);
    if (value) return value;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeStatus(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_") || "pending";
}

function getRideBackendId(rideId: string): number | null {
  const match = String(rideId).trim().match(/^(?:#|ride[-_]?)?(\d+)$/i);
  if (!match) return null;
  const normalized = Number(match[1]);
  return Number.isSafeInteger(normalized) ? normalized : null;
}

function formatDatePart(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.includes("T") ? value.split("T")[0] : value;
  return date.toISOString().split("T")[0];
}

function formatTimePart(value?: string): string {
  if (!value) return "";
  if (/^\d{1,2}:\d{2}/.test(value)) return value.slice(0, 5);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function formatClock(value: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(value);
}

function toTimestamp(value?: string): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await res.clone().json();
      const message = body?.error ?? body?.msg ?? body?.message;
      if (typeof message === "string" && message.trim()) return message.trim();
    }
    const text = await res.clone().text();
    if (text.trim()) return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220);
  } catch {
    // Keep the original fallback.
  }
  return fallback;
}

const css = `
* { box-sizing: border-box; }
html, body, #root { min-height: 100%; margin: 0; }
body {
  font-family: "DM Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f4f7fb;
  color: #152238;
}
button, input, select { font: inherit; }
button { cursor: pointer; }
.shell {
  min-height: 100vh;
  overflow-x: clip;
}
.notice-region {
  position: fixed;
  top: 90px;
  right: 18px;
  z-index: 1100;
  display: grid;
  gap: 10px;
  width: min(390px, calc(100vw - 36px));
}
.ride-notice {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  padding: 13px;
  border: 1px solid #b9d8f2;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(21, 34, 56, 0.16);
}
.ride-notice strong {
  display: block;
  color: #113b65;
  font-size: 14px;
  line-height: 1.25;
}
.ride-notice p {
  margin-top: 3px;
  color: #526174;
  font-size: 13px;
  line-height: 1.35;
}
.ride-notice button {
  border: 0;
  background: transparent;
  color: #1d76bd;
  font-size: 12px;
  font-weight: 900;
}
.topbar {
  min-height: 76px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  background: #ffffff;
  border-bottom: 1px solid #dbe4ef;
  position: sticky;
  top: 0;
  z-index: 1000;
}
.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: #113b65;
  color: #fff;
  font-weight: 900;
  letter-spacing: 0;
  flex: 0 0 auto;
}
h1, h2, h3, p { margin: 0; }
.brand h1 { font-size: 20px; line-height: 1.1; }
.brand p, .backend-chip, .muted { color: #66758a; font-size: 13px; }
.backend-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  max-width: 100%;
  min-width: 0;
}
.backend-chip span:last-child {
  min-width: 0;
  overflow-wrap: anywhere;
}
.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #18a058;
}
.layout {
  display: grid;
  grid-template-columns: 330px minmax(0, 1fr);
  gap: 22px;
  padding: 22px;
  transition: grid-template-columns 160ms ease;
  align-items: start;
}
.layout.sidebar-collapsed {
  grid-template-columns: 74px minmax(0, 1fr);
}
.sidebar, .content { min-width: 0; }
.content {
  position: relative;
  z-index: 0;
}
.sidebar {
  align-self: start;
  position: sticky;
  top: 98px;
  z-index: 10;
}
.sidebar-shell, .account-column, .empty-state {
  background: #fff;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
}
.sidebar-shell {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 12px;
  padding: 12px;
}
.sidebar.collapsed .sidebar-shell {
  padding: 9px;
}
.sidebar-top {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 10px;
}
.sidebar-top h2 {
  font-size: 15px;
  line-height: 1.2;
}
.sidebar-top p {
  margin-top: 3px;
  color: #66758a;
  font-size: 12px;
  line-height: 1.35;
}
.sidebar-toggle {
  width: 44px;
  height: 44px;
  border: 1px solid #d5e1ee;
  border-radius: 8px;
  background: #eef4fa;
  color: #173957;
  font-weight: 900;
  flex: 0 0 auto;
}
.sidebar-nav {
  display: grid;
  gap: 8px;
}
.sidebar-nav-item {
  min-height: 52px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  background: #fff;
  color: #33445b;
  padding: 6px 9px;
  text-align: left;
}
.sidebar.collapsed .sidebar-nav-item {
  grid-template-columns: 34px;
  justify-content: center;
  padding: 6px;
}
.sidebar-nav-item > span {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: #eef4fa;
  color: #173957;
  font-weight: 900;
}
.sidebar-nav-item strong {
  display: block;
  font-size: 14px;
  line-height: 1.2;
}
.sidebar-nav-item em {
  justify-self: end;
  color: #66758a;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}
.sidebar-nav-item.active {
  border-color: #1d76bd;
  background: #edf7ff;
  color: #124469;
}
.sidebar-nav-item.active > span {
  background: #1d76bd;
  color: #fff;
}
.sidebar-section {
  border-top: 1px solid #e3ebf4;
  padding-top: 12px;
}
.sidebar-section h3, .account-header h2 {
  font-size: 15px;
  margin-bottom: 12px;
}
.login-form { display: grid; gap: 12px; }
label {
  display: grid;
  gap: 6px;
  color: #4b5b70;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}
input, select {
  width: 100%;
  min-height: 44px;
  border: 1px solid #ccd8e6;
  border-radius: 8px;
  padding: 0 11px;
  color: #152238;
  background: #fff;
  outline: none;
}
input:focus, select:focus { border-color: #1d76bd; box-shadow: 0 0 0 3px rgba(29,118,189,0.12); }
.primary-button, .secondary-button, .danger-button, .stop-button {
  min-height: 44px;
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0 12px;
  font-weight: 800;
}
.primary-button { background: #1d76bd; color: #fff; }
.primary-button:disabled,
.secondary-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.secondary-button { background: #eef4fa; color: #173957; border-color: #d5e1ee; }
.danger-button { background: #fff2f2; color: #b42318; border-color: #ffd0d0; }
.stop-button { background: #152238; color: #fff; }
.error-text, .error-banner { color: #b42318; font-size: 13px; font-weight: 700; }
.error-banner {
  background: #fff2f2;
  border: 1px solid #ffd0d0;
  border-radius: 8px;
  padding: 10px;
}
.location-box { display: grid; gap: 12px; }
dl { display: grid; gap: 8px; margin: 0; }
dl div { display: flex; justify-content: space-between; gap: 10px; }
dt { color: #66758a; font-size: 12px; font-weight: 700; }
dd { margin: 0; font-size: 13px; font-weight: 900; }
.account-list { display: grid; gap: 8px; margin-top: 8px; }
.account-tab {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  background: #fff;
  color: #33445b;
  padding: 0 11px;
  text-align: left;
}
.account-tab.active { border-color: #1d76bd; background: #edf7ff; color: #124469; }
.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.metric {
  background: #fff;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  padding: 14px;
}
.metric span { display: block; color: #66758a; font-size: 12px; font-weight: 800; text-transform: uppercase; }
.metric strong { display: block; margin-top: 4px; font-size: 28px; }
.map-panel {
  background: #fff;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 16px;
}
.map-header {
  min-height: 62px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 13px 14px;
  border-bottom: 1px solid #dbe4ef;
}
.map-header h2 {
  font-size: 16px;
  line-height: 1.2;
  margin-bottom: 3px;
}
.map-header p {
  color: #66758a;
  font-size: 13px;
  line-height: 1.35;
}
.back-button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  margin-bottom: 9px;
  border: 1px solid #c9d8e8;
  border-radius: 8px;
  background: #eef4fa;
  color: #173957;
  padding: 0 11px;
  font-size: 13px;
  font-weight: 900;
}
.back-button span {
  font-size: 17px;
  line-height: 1;
}
.back-button:hover {
  background: #e2edf8;
  border-color: #b8ccdf;
}
.map-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #526174;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}
.map-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.map-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  display: inline-block;
}
.legend-dot.pickup { background: #1d76bd; }
.legend-dot.dropoff { background: #18a058; }
.legend-line {
  width: 18px;
  height: 4px;
  border-radius: 999px;
  display: inline-block;
  background: #1d76bd;
}
.legend-line.variation {
  background: #f59e0b;
}
.map-frame {
  position: relative;
  z-index: 0;
  isolation: isolate;
  contain: layout paint;
  overflow: hidden;
  height: clamp(320px, 42vh, 520px);
  width: 100%;
  background: #e8eef5;
}
.toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) 180px auto minmax(180px, 220px) auto auto;
  align-items: end;
  gap: 10px;
  margin-bottom: 16px;
}
.toolbar-field {
  display: grid;
  gap: 5px;
  color: #526174;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}
.toolbar-field span {
  display: block;
}
.auto-start-adherence-field input {
  min-height: 24px;
  padding: 0;
  accent-color: #f59e0b;
}
.auto-start-toggle {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid #d5e1ee;
  border-radius: 8px;
  padding: 0 12px;
  background: #eef4fa;
  color: #173957;
  font-weight: 900;
  white-space: nowrap;
}
.auto-start-toggle em {
  min-width: 34px;
  border-radius: 999px;
  padding: 3px 7px;
  background: #ffffff;
  color: #8a5a00;
  font-size: 12px;
  font-style: normal;
}
.auto-start-toggle.active {
  border-color: #f59e0b;
  background: #fff7df;
  color: #6d4300;
}
.location-log-panel {
  display: grid;
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  background: #fff;
}
.location-log-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}
.location-log-header h2 {
  font-size: 15px;
  line-height: 1.2;
  margin-bottom: 3px;
}
.location-log-header p,
.location-log-empty {
  color: #66758a;
  font-size: 12px;
  line-height: 1.35;
}
.location-log-filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(160px, 220px));
  gap: 10px;
  align-items: end;
}
.location-log-list {
  display: grid;
  gap: 6px;
  max-height: 220px;
  overflow: auto;
}
.location-log-row {
  display: grid;
  grid-template-columns: 44px 82px minmax(80px, 1fr) 76px 150px 88px minmax(160px, 1.4fr);
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 6px 8px;
  border: 1px solid #e3ebf4;
  border-radius: 8px;
  color: #526174;
  font-size: 12px;
}
.location-log-row strong {
  color: #24354d;
}
.location-log-row code {
  color: #152238;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
}
.location-log-status {
  justify-self: start;
  border-radius: 999px;
  padding: 3px 7px;
  font-size: 10px;
  font-weight: 900;
}
.location-log-status.ok {
  background: #e5f7ed;
  color: #126c3c;
}
.location-log-status.error {
  background: #ffe4e4;
  color: #a41916;
}
.empty-state {
  min-height: 280px;
  display: grid;
  place-content: center;
  text-align: center;
  gap: 8px;
  padding: 32px;
}
.empty-state h2 { font-size: 22px; }
.empty-state p { color: #66758a; }
.account-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
  gap: 16px;
}
.account-column {
  position: relative;
  z-index: 0;
  padding: 14px;
  display: grid;
  gap: 12px;
  align-content: start;
  min-width: 0;
}
.account-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 14px;
}
.account-header p {
  color: #66758a;
  font-size: 13px;
  line-height: 1.45;
}
.account-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.sync-row {
  display: grid;
  gap: 4px;
  color: #66758a;
  font-size: 12px;
  line-height: 1.35;
}
.session-renewal {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 10px;
  padding: 10px;
  border: 1px solid #ffd0d0;
  border-radius: 8px;
  background: #fff8f8;
}
.empty-column {
  min-height: 140px;
  display: grid;
  place-items: center;
  color: #66758a;
  background: #f8fbfe;
  border: 1px dashed #cad8e7;
  border-radius: 8px;
}
.ride-stack { display: grid; gap: 10px; }
.ride-card {
  position: relative;
  z-index: 0;
  isolation: isolate;
  border: 1px solid #dbe4ef;
  border-radius: 8px;
  padding: 0;
  background: #fbfdff;
  overflow: hidden;
}
.ride-card.selected {
  border-color: #1d76bd;
  box-shadow: 0 0 0 3px rgba(29, 118, 189, 0.12);
}
.ride-card-layout {
  position: relative;
  z-index: 0;
  display: grid;
  grid-template-columns: minmax(150px, 28%) minmax(0, 1fr);
  align-items: stretch;
  min-height: 168px;
}
.ride-mini-map-button,
.ride-detail-button {
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
  text-align: left;
}
.ride-mini-map-button {
  border-right: 1px solid #dbe4ef;
  min-height: 168px;
  overflow: hidden;
  display: block;
  position: relative;
  z-index: 0;
}
.ride-detail-button {
  display: block;
  width: 100%;
  padding: 12px;
}
.ride-detail-button:hover {
  background: #f6faff;
}
.mini-map-frame {
  position: relative;
  z-index: 0;
  isolation: isolate;
  contain: layout paint;
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 168px;
  background: #e8eef5;
}
.map-frame .leaflet-container,
.mini-map-frame .leaflet-container {
  z-index: 0;
}
.map-frame .leaflet-pane,
.mini-map-frame .leaflet-pane,
.map-frame .leaflet-top,
.map-frame .leaflet-bottom,
.mini-map-frame .leaflet-top,
.mini-map-frame .leaflet-bottom {
  z-index: 1;
}
.map-frame .leaflet-pane,
.mini-map-frame .leaflet-pane {
  z-index: 1;
}
.map-frame .leaflet-control-container,
.mini-map-frame .leaflet-control-container {
  position: relative;
  z-index: 2;
}
.ride-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.ride-top strong { font-size: 13px; color: #415169; }
.status {
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}
.status.pending { background: #fff2ca; color: #8a5a00; }
.status.scheduled { background: #dcecff; color: #15528a; }
.status.active { background: #e5f7ed; color: #126c3c; }
.status.complete { background: #e8ebef; color: #526174; }
.status.cancelled { background: #ffe4e4; color: #a41916; }
.ride-card h3 {
  font-size: 16px;
  margin-bottom: 6px;
}
.ride-meta {
  color: #66758a;
  font-size: 13px;
  line-height: 1.4;
}
.route { display: grid; gap: 9px; margin-top: 12px; }
.route-line {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  gap: 9px;
  align-items: start;
}
.route-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  margin-top: 5px;
}
.route-dot.blue { background: #1d76bd; }
.route-dot.green { background: #18a058; }
.route-line span { color: #66758a; font-size: 11px; font-weight: 900; text-transform: uppercase; }
.route-line p { color: #24354d; font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; }
.notes {
  margin-top: 12px;
  border-top: 1px solid #e2eaf3;
  padding-top: 10px;
  color: #415169;
  font-size: 13px;
  line-height: 1.45;
}
.simulation-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-top: 1px solid #dbe4ef;
  padding: 10px 12px;
  background: #fff;
}
.simulation-row > div {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.simulation-row strong {
  color: #24354d;
  font-size: 13px;
}
.simulation-row span {
  color: #66758a;
  font-size: 12px;
  line-height: 1.35;
}
.playback-progress {
  width: min(220px, 100%);
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: #e3ebf4;
  margin: 4px 0;
}
.playback-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #1d76bd;
}
.adherence-control {
  display: grid;
  gap: 5px;
  max-width: 280px;
  margin-top: 6px;
  color: #526174;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}
.adherence-control input {
  min-height: 24px;
  padding: 0;
  accent-color: #f59e0b;
}
.simulation-row em {
  color: #b42318;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
  line-height: 1.35;
}
.simulation-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  flex: 0 0 auto;
}
@media (max-width: 1120px) {
  .topbar { height: auto; align-items: start; flex-direction: column; gap: 10px; padding: 16px; position: relative; }
  .layout { grid-template-columns: 1fr; padding: 16px; }
  .layout.sidebar-collapsed { grid-template-columns: 1fr; }
  .sidebar { position: static; z-index: auto; }
  .sidebar.collapsed .sidebar-shell { width: 74px; }
  .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .map-header { align-items: start; flex-direction: column; }
  .map-header-actions { align-items: start; justify-content: flex-start; }
  .map-legend { flex-wrap: wrap; }
  .toolbar { grid-template-columns: 1fr; }
  .location-log-filters {
    grid-template-columns: 1fr;
  }
  .location-log-row {
    grid-template-columns: 44px 82px minmax(90px, 1fr);
  }
  .location-log-row span:nth-child(n+5),
  .location-log-row code {
    grid-column: 1 / -1;
  }
}
@media (max-width: 720px) {
  .ride-card-layout { grid-template-columns: 1fr; }
  .ride-mini-map-button { border-right: 0; border-bottom: 1px solid #dbe4ef; min-height: 150px; }
  .mini-map-frame { min-height: 150px; }
  .simulation-row { align-items: stretch; flex-direction: column; }
  .simulation-actions { justify-content: stretch; }
  .simulation-actions button { flex: 1; }
}
@media (max-width: 520px) {
  .topbar, .layout { padding-left: 12px; padding-right: 12px; }
  .brand { align-items: start; }
  .brand > div { min-width: 0; }
  .brand h1 { font-size: 18px; }
  .backend-chip { width: 100%; overflow-wrap: anywhere; }
  .metrics { grid-template-columns: 1fr; }
  .account-header { flex-direction: column; }
  .account-actions { width: 100%; }
  .account-actions button { flex: 1; }
  .session-renewal { grid-template-columns: 1fr; }
}
`;
