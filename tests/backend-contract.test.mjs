import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadTsModule(relativePath, mocks = {}) {
  const filename = path.join(root, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  const context = {
    AbortController,
    Headers,
    Response,
    clearTimeout,
    console,
    fetch,
    module,
    exports: module.exports,
    require(specifier) {
      if (specifier in mocks) return mocks[specifier];
      if (specifier.startsWith(".")) return {};
      return require(specifier);
    },
    setTimeout,
  };
  vm.runInNewContext(compiled, context, { filename });
  return module.exports;
}

test("chat helpers use the chaperone-scoped backend contract", () => {
  const chatApi = loadTsModule("lib/chat-api.ts", {
    "./config": { FLEET_API_URL: "https://example.test" },
    "./demo-data": {},
    "./demo-mode": { DEMO_MODE: false },
    "./fleet-api": { getToken: () => "token" },
  });

  assert.equal(chatApi.buildListChatMessagesPath(), "/api/chat/messages");
  assert.equal(
    chatApi.buildListChatMessagesPath("42"),
    "/api/chat/messages?after_id=42",
  );

  const request = chatApi.buildSendChatMessageRequest({
    text: "ETA is five minutes",
    clientMessageId: "client-1",
    metadata: { ride_id: "174" },
  });
  assert.equal(request.path, "/api/chat/messages");
  assert.deepEqual(JSON.parse(request.init.body), {
    text: "ETA is five minutes",
    client_message_id: "client-1",
    message_metadata: { ride_id: "174" },
  });

  const message = chatApi.normalizeChatMessage({
    id: 7,
    text: "Copy",
    sender: "admin",
    sender_name: "Dispatch",
    client_message_id: null,
    message_metadata: { source: "dispatch" },
    created_at: "2026-05-28T12:00:00Z",
  });
  assert.deepEqual(plain(message), {
    id: "7",
    ride_id: "dispatch",
    text: "Copy",
    sender: "admin",
    sender_name: "Dispatch",
    client_message_id: null,
    metadata: { source: "dispatch" },
    created_at: "2026-05-28T12:00:00Z",
  });

  const echoedDriverMessage = chatApi.normalizeChatMessage({
    id: 8,
    text: "I am here",
    sender: "admin",
    sender_name: "Dispatch",
    client_message_id: "driver-123",
    created_at: "2026-05-28T12:01:00Z",
  });
  assert.equal(echoedDriverMessage.sender, "driver");
  assert.equal(echoedDriverMessage.sender_name, "Driver");
  assert.equal(
    chatApi.normalizeChatMessage({ id: 9, message: "Backend used message field" }).text,
    "Backend used message field",
  );
  assert.equal(
    chatApi.normalizeChatMessage({ id: 10, content: "Backend used content field" }).text,
    "Backend used content field",
  );
  assert.deepEqual(
    plain(chatApi.unwrapCreateMessageResponse({ id: 11, message: "Not a wrapper" })),
    { id: 11, message: "Not a wrapper" },
  );
  assert.deepEqual(
    plain(chatApi.unwrapCreateMessageResponse({
      message: { id: 12, text: "Wrapped message" },
    })),
    { id: 12, text: "Wrapped message" },
  );
  assert.equal(chatApi.isDisplayableChatMessage(chatApi.normalizeChatMessage({ id: 13, text: "" })), false);
  assert.equal(
    chatApi.isDisplayableChatMessage(chatApi.normalizeChatMessage({
      id: 14,
      metadata: { type: "mission_command_status" },
    })),
    true,
  );
  assert.equal(
    chatApi.isDisplayableChatMessage(chatApi.normalizeChatMessage({
      id: 15,
      metadata: { type: "gps_ask" },
    })),
    false,
  );
  assert.equal(chatApi.getChatCommandType({ type: "gps_ask" }), "gps_ask");
  assert.equal(chatApi.getChatCommandType({ command: "gps_yes" }), "gps_yes");
  assert.equal(chatApi.getChatCommandType("gps_ask"), "gps_ask");
  assert.equal(chatApi.getChatCommandType({ type: "unknown" }), null);
  assert.deepEqual(plain(chatApi.buildGpsResponseMetadata("gps_yes")), { command: "gps_yes" });
  assert.deepEqual(plain(chatApi.buildGpsResponseMetadata("gps_off")), { command: "gps_off" });

  const gpsRequest = chatApi.buildSendChatMessageRequest({
    text: "",
    clientMessageId: "driver-gps-1",
    metadata: { command: "gps_yes" },
  });
  assert.deepEqual(JSON.parse(gpsRequest.init.body), {
    text: "",
    client_message_id: "driver-gps-1",
    message_metadata: { command: "gps_yes" },
  });

  assert.equal(
    chatApi.formatChatTimestamp("2026-05-28T02:43:00", {
      locale: "en-US",
      timeZone: "America/New_York",
    }),
    "10:43 PM",
  );
});

test("fleet helpers map Suresh statuses and include active ride location context", () => {
  const fleetNormalization = loadTsModule("lib/fleet-normalization.ts", {
    "./rides": {
      normalizeRouteGeometry: () => [],
    },
  });
  const fleetApi = loadTsModule("lib/fleet-api.ts", {
    react: {},
    "react-native": { Platform: { OS: "ios" } },
    "./api-request-throttle": { ApiRequestThrottle: class {} },
    "./config": { FLEET_API_URL: "https://example.test" },
    "./demo-data": { demoRides: [] },
    "./demo-mode": { DEMO_MODE: false },
    "./fleet-fetch-result": { shouldSuppressRideFetchError: () => false },
    "./fleet-normalization": fleetNormalization,
    "./rides": {
      getRideBackendId: () => null,
      mergeRideSummaryAndDetail: (summary, detail) => ({ ...summary, ...(detail ?? {}) }),
      normalizeRouteGeometry: () => [],
    },
    "./storage": {},
  });

  assert.equal(fleetApi.normalizeRideStatus("scheduled-driver assigned"), "accepted");
  assert.equal(fleetApi.normalizeRideStatus("driver in transit"), "en_route");
  assert.equal(fleetApi.normalizeRideStatus("driver at pickup"), "picked_up");
  assert.equal(fleetApi.normalizeRideStatus("driver/passenger in transit"), "in_transit");
  assert.equal(fleetApi.normalizeRideStatus("driver/passenger at dropoff"), "completed");

  assert.deepEqual(plain(fleetApi.makeLocationPayload({
    lat: 40.7,
    lon: -74,
    timestamp: "2026-05-28T12:00:00Z",
    ride_id: 174,
  })), {
    lat: 40.7,
    lon: -74,
    timestamp: "2026-05-28T12:00:00Z",
    ride_id: 174,
  });
  assert.deepEqual(plain(fleetApi.makeLocationPayload({
    lat: 40.7,
    lon: -74,
    timestamp: "2026-05-28T12:00:00Z",
    ride_id: null,
  })), {
    lat: 40.7,
    lon: -74,
    timestamp: "2026-05-28T12:00:00Z",
  });
});

test("dispatch helpers keep scheduled rides separate from current ride candidates", async () => {
  const storage = new Map();
  const dispatchContext = loadTsModule("lib/dispatch-context.tsx", {
    react: {
      createContext: (value) => ({ value }),
      useCallback: (fn) => fn,
      useContext: (ctx) => ctx.value,
      useEffect: () => {},
      useRef: (current) => ({ current }),
      useState: (value) => [value, () => {}],
    },
    "react-native": { Alert: { alert: () => {} } },
    "./fleet-api": {},
    "./chat-api": {},
    "./demo-data": { demoRides: [] },
    "./demo-mode": { DEMO_MODE: false },
    "./fleet-fetch-result": { shouldSuppressRideErrorPanel: () => false },
    "./rides": {
      getRideBackendId: () => null,
      hasDrawableRoute: () => false,
    },
    "./location-context": { useLocation: () => ({ location: null, isTracking: false }) },
    "./storage": {
      get: async (key) => storage.get(key) ?? null,
      set: async (key, value) => {
        storage.set(key, value);
      },
      remove: async (key) => {
        storage.delete(key);
      },
    },
  });

  assert.equal(dispatchContext.isCurrentRideStatus("accepted"), false);
  assert.equal(dispatchContext.isCurrentRideStatus("en_route"), true);
  assert.equal(dispatchContext.isCurrentRideStatus("picked_up"), true);
  assert.equal(dispatchContext.isCurrentRideStatus("in_transit"), true);
  assert.equal(dispatchContext.isCurrentRideStatus("pending"), false);
  assert.equal(dispatchContext.isCurrentRideStatus("completed"), false);
  assert.equal(dispatchContext.shouldStopTrackingAfterGpsResponse(false), true);
  assert.equal(dispatchContext.shouldStopTrackingAfterGpsResponse(true), false);
  assert.equal(dispatchContext.shouldEndGpsAtRideEndpoint(undefined, { id: "184", status: "completed" }), true);
  assert.equal(dispatchContext.shouldEndGpsAtRideEndpoint({ id: "184", status: "in_transit" }, { id: "184", status: "completed" }), true);
  assert.equal(dispatchContext.shouldEndGpsAtRideEndpoint({ id: "184", status: "completed" }, { id: "184", status: "completed" }), false);
  assert.equal(dispatchContext.shouldEndGpsAtRideEndpoint({ id: "184", status: "in_transit" }, { id: "184", status: "cancelled" }), false);

  const activeRide = {
    id: "184",
    passengerName: "Ava Passenger",
    passengerPhotoUrl: "",
    pickupAddress: "67 West St",
    dropoffAddress: "420 W 14th St",
    pickupCoords: null,
    dropoffCoords: null,
    routeCoords: [],
    scheduledDate: "May 28",
    scheduledTime: "8:30 AM",
    transitType: "Wheelchair",
    tripType: "One-Way",
    notes: "",
    emergencyContact: "",
    status: "in_transit",
    createdAt: 1,
  };
  const pendingRide = { ...activeRide, id: "200", status: "pending" };
  const missingRefreshes = { current: 0 };

  let preserved = dispatchContext.preserveTransientlyMissingActiveRide(
    [activeRide, pendingRide],
    [pendingRide],
    missingRefreshes,
  );
  assert.deepEqual(plain(preserved.map((ride) => ride.id)), ["184", "200"]);
  assert.equal(missingRefreshes.current, 1);

  preserved = dispatchContext.preserveTransientlyMissingActiveRide(
    preserved,
    [pendingRide],
    missingRefreshes,
  );
  assert.deepEqual(plain(preserved.map((ride) => ride.id)), ["184", "200"]);
  assert.equal(missingRefreshes.current, 2);

  preserved = dispatchContext.preserveTransientlyMissingActiveRide(
    preserved,
    [{ ...activeRide, status: "completed" }, pendingRide],
    missingRefreshes,
  );
  assert.deepEqual(plain(preserved.map((ride) => `${ride.id}:${ride.status}`)), ["184:completed", "200:pending"]);
  assert.equal(missingRefreshes.current, 0);

  const exhaustedMissingRefreshes = { current: 3 };
  preserved = dispatchContext.preserveTransientlyMissingActiveRide(
    [activeRide, pendingRide],
    [pendingRide],
    exhaustedMissingRefreshes,
  );
  assert.deepEqual(plain(preserved.map((ride) => ride.id)), ["200"]);
  assert.equal(exhaustedMissingRefreshes.current, 0);

  storage.set("trustedriders-last-active-ride", JSON.stringify(activeRide));
  const startupPreserved = await dispatchContext.preserveStartupActiveRide([pendingRide], false);
  assert.deepEqual(plain(startupPreserved.map((ride) => ride.id)), ["184", "200"]);
  assert.deepEqual(
    plain(await dispatchContext.preserveStartupActiveRide([pendingRide], true).then((rides) => rides.map((ride) => ride.id))),
    ["200"],
  );
});

test("fleet normalization maps backend ride shapes into mobile ride models", () => {
  const fleetNormalization = loadTsModule("lib/fleet-normalization.ts", {
    "./rides": {
      normalizeRouteGeometry: (value) => Array.isArray(value)
        ? value.map((point) => ({
            latitude: Number(point.lat ?? point.latitude),
            longitude: Number(point.lon ?? point.lng ?? point.longitude),
          })).filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
        : [],
    },
  });

  const ride = fleetNormalization.normalizeRide({
    ride_id: 184,
    status: "driver/passenger in transit",
    passenger: {
      full_name: "Ava Passenger",
      accessibility_notes: "Needs curbside handoff",
    },
    pickup: {
      address: "67 West St, Brooklyn, NY",
      lat: "40.71",
      lon: "-74.01",
    },
    destination: {
      formatted_address: "420 W 14th St, New York, NY",
    },
    end: {
      latitude: 40.74,
      longitude: -74.0,
    },
    planned_route: [
      { lat: 40.71, lon: -74.01 },
      { lat: 40.74, lon: -74.0 },
    ],
    start_time: "2026-05-28T12:30:00",
    vehicle_type: "wheelchair van",
    trip_type: "round trip",
    contact_phone: "555-0100",
  });

  assert.deepEqual(plain(ride), {
    id: "184",
    passengerName: "Ava Passenger",
    passengerPhotoUrl: "",
    pickupAddress: "67 West St, Brooklyn, NY",
    dropoffAddress: "420 W 14th St, New York, NY",
    pickupCoords: {
      latitude: 40.71,
      longitude: -74.01,
    },
    dropoffCoords: {
      latitude: 40.74,
      longitude: -74,
    },
    routeCoords: [
      {
        latitude: 40.71,
        longitude: -74.01,
      },
      {
        latitude: 40.74,
        longitude: -74,
      },
    ],
    scheduledDate: "May 28",
    scheduledTime: "8:30 AM",
    transitType: "Wheelchair",
    tripType: "Round-Trip",
    notes: "Needs curbside handoff",
    emergencyContact: "555-0100",
    status: "in_transit",
    createdAt: Date.parse("2026-05-28T12:30:00Z"),
  });

  assert.equal(
    fleetNormalization.describeRoutePayload({
      planned_route: [
        { lat: 40.71, lon: -74.01 },
        { lat: 40.74, lon: -74 },
      ],
    }),
    "planned_route:2",
  );
});

test("login helpers preserve passwords and accept common auth token shapes", () => {
  const fleetNormalization = loadTsModule("lib/fleet-normalization.ts", {
    "./rides": {
      normalizeRouteGeometry: () => [],
    },
  });
  const fleetApi = loadTsModule("lib/fleet-api.ts", {
    react: {},
    "react-native": { Platform: { OS: "ios" } },
    "./api-request-throttle": { ApiRequestThrottle: class {} },
    "./config": { FLEET_API_URL: "https://example.test" },
    "./demo-data": { demoRides: [] },
    "./demo-mode": { DEMO_MODE: false },
    "./fleet-fetch-result": { shouldSuppressRideFetchError: () => false },
    "./fleet-normalization": fleetNormalization,
    "./rides": {
      getRideBackendId: () => null,
      mergeRideSummaryAndDetail: (summary, detail) => ({ ...summary, ...(detail ?? {}) }),
      normalizeRouteGeometry: () => [],
    },
    "./storage": {},
  });

  assert.deepEqual(
    plain(fleetApi.normalizeLoginCredentials(" driver@example.com ", " pass with spaces ")),
    { email: "driver@example.com", password: " pass with spaces " },
  );
  assert.equal(fleetApi.extractAuthToken({ token: "plain-token" }), "plain-token");
  assert.equal(fleetApi.extractAuthToken({ access_token: "snake-token" }), "snake-token");
  assert.equal(fleetApi.extractAuthToken({ accessToken: "camel-token" }), "camel-token");
  assert.equal(fleetApi.extractAuthToken({ data: { token: "nested-token" } }), "nested-token");
  assert.equal(fleetApi.extractAuthToken({ auth: { access_token: "nested-access-token" } }), "nested-access-token");
  assert.equal(fleetApi.extractAuthToken({ token: "" }), null);
  assert.equal(fleetApi.extractAuthToken({}), null);
  assert.equal(fleetApi.LOGIN_FETCH_OPTIONS.failureBackoffMs, 0);
});
