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

test("chat helpers use the driver-scoped backend contract", () => {
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
  assert.deepEqual(plain(chatApi.buildRideEndMetadata()), { command: "ride_end" });

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

  const rideEndRequest = chatApi.buildSendChatMessageRequest({
    text: "",
    clientMessageId: "driver-ride-end-1",
    metadata: chatApi.buildRideEndMetadata(),
  });
  assert.deepEqual(JSON.parse(rideEndRequest.init.body), {
    text: "",
    client_message_id: "driver-ride-end-1",
    message_metadata: { command: "ride_end" },
  });

  assert.equal(
    chatApi.formatChatTimestamp("2026-05-28T02:43:00", {
      locale: "en-US",
      timeZone: "America/New_York",
    }),
    "10:43 PM",
  );
});

test("push notification helpers register Expo tokens and parse gps requests", () => {
  const scheduledNotifications = [];
  const pushNotifications = loadTsModule("lib/push-notifications.ts", {
    "expo-constants": {
      __esModule: true,
      default: {
        expoConfig: {
          extra: {
            eas: {
              projectId: "project-123",
            },
          },
        },
      },
    },
    "expo-notifications": {
      setNotificationHandler: () => {},
      getPermissionsAsync: async () => ({ granted: true }),
      scheduleNotificationAsync: async (notification) => {
        scheduledNotifications.push(notification);
      },
    },
    expo: { requireOptionalNativeModule: (name) => (name === "ExpoPushTokenManager" ? {} : null) },
    "react-native": {
      Platform: { OS: "ios" },
    },
    "./config": { FLEET_API_URL: "https://example.test" },
    "./demo-mode": { DEMO_MODE: false },
    "./fleet-api": { getToken: () => "token" },
  });

  assert.equal(pushNotifications.getExpoProjectId(), "project-123");
  assert.deepEqual(plain(pushNotifications.buildPushTokenRegistrationRequest({
    expoPushToken: "ExponentPushToken[abc]",
    projectId: "project-123",
    platform: "ios",
  })), {
    path: "/api/push_tokens",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expo_push_token: "ExponentPushToken[abc]",
        push_token: "ExponentPushToken[abc]",
        token: "ExponentPushToken[abc]",
        provider: "expo",
        platform: "ios",
        project_id: "project-123",
      }),
    },
  });
  assert.deepEqual(plain(pushNotifications.readGpsAskNotificationData({
    command: "gps_ask",
    message_id: "m1",
  })), {
    messageId: "m1",
  });
  assert.deepEqual(plain(pushNotifications.readGpsAskNotificationData({
    message_metadata: { command: "gps_ask" },
    chat_message_id: "m2",
  })), {
    messageId: "m2",
  });
  assert.equal(pushNotifications.readGpsAskNotificationData({ command: "gps_yes" }), null);

  return pushNotifications.scheduleLocalGpsAskNotification({ messageId: "m3" }).then(() =>
    pushNotifications.scheduleLocalGpsOffNotification({ messageId: "m4" })
  ).then(() => {
    assert.deepEqual(plain(scheduledNotifications), [{
      content: {
        title: "Dispatch is requesting GPS",
        body: "Tap to approve or deny location sharing.",
        data: {
          command: "gps_ask",
          message_id: "m3",
        },
      },
      trigger: null,
    }, {
      content: {
        title: "GPS tracking turned off",
        body: "Dispatch turned off live location sharing for this ride.",
        data: {
          command: "gps_off",
          message_id: "m4",
        },
      },
      trigger: null,
    }]);
  });
});

function loadPushNotificationsWith(notificationsMock) {
  return loadTsModule("lib/push-notifications.ts", {
    "expo-constants": { __esModule: true, default: { expoConfig: { extra: {} } } },
    "expo-notifications": notificationsMock,
    expo: { requireOptionalNativeModule: (name) => (name === "ExpoPushTokenManager" ? {} : null) },
    "react-native": {
      Platform: { OS: "ios" },
    },
    "./config": { FLEET_API_URL: "https://example.test" },
    "./demo-mode": { DEMO_MODE: false },
    "./fleet-api": { getToken: () => "token" },
  });
}

function fakeResponse(identifier, data, actionIdentifier = "expo.modules.notifications.actions.DEFAULT") {
  return {
    actionIdentifier,
    notification: { date: 1, request: { identifier, content: { data } } },
  };
}

test("push taps resolve to the ride or dispatch chat", () => {
  const push = loadPushNotificationsWith({ setNotificationHandler: () => {} });

  assert.equal(
    push.resolveNotificationTapHref({ type: "ride_request", ride_id: 42, url: "trustedriders://ride-details?rideId=42" }),
    "/ride-details?rideId=42",
  );
  assert.equal(
    push.resolveNotificationTapHref({ type: "ride_status", ride_id: 7, status: "cancelled", url: "trustedriders://ride-details?rideId=7" }),
    "/ride-details?rideId=7",
  );
  // url wins; falls back to ride_id when url is missing or not a ride link
  assert.equal(push.resolveNotificationTapHref({ type: "ride_status", ride_id: 9 }), "/ride-details?rideId=9");
  assert.equal(push.resolveNotificationTapHref({ type: "ride_status", ride_id: "9", url: "https://example.test" }), "/ride-details?rideId=9");
  assert.equal(push.resolveNotificationTapHref({ type: "ride_request" }), "/ride-requests");
  assert.equal(push.resolveNotificationTapHref({ type: "ride_status" }), null);
  assert.equal(push.resolveNotificationTapHref({ type: "chat_message", message_id: 5 }), "/chat");
  assert.equal(push.resolveNotificationTapHref({ type: "gps_ask", command: "gps_ask", message_id: 5 }), null);
  assert.equal(push.resolveNotificationTapHref(null), null);

  assert.equal(push.readRideIdFromDeepLink("trustedriders://ride-details?rideId=ride%2012&x=1"), "ride 12");
  assert.equal(push.readRideIdFromDeepLink("trustedriders://chat?rideId=12"), null);
  assert.equal(push.readRideIdFromDeepLink(undefined), null);
});

test("push tap navigation handles cold start once and ignores dismissals", async () => {
  const listeners = [];
  const launch = fakeResponse("launch-1", { type: "ride_request", ride_id: 42, url: "trustedriders://ride-details?rideId=42" });
  const push = loadPushNotificationsWith({
    setNotificationHandler: () => {},
    addNotificationResponseReceivedListener: (listener) => {
      listeners.push(listener);
      return { remove: () => listeners.splice(listeners.indexOf(listener), 1) };
    },
    getLastNotificationResponseAsync: async () => launch,
  });

  const hrefs = [];
  const remove = push.addNotificationTapNavigationListener((href) => hrefs.push(href));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(hrefs, ["/ride-details?rideId=42"]);

  // The same launch response delivered again (listener + remount) navigates only once.
  listeners[0](launch);
  remove();
  const removeAgain = push.addNotificationTapNavigationListener((href) => hrefs.push(href));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(hrefs, ["/ride-details?rideId=42"]);

  listeners[0](fakeResponse("chat-1", { type: "chat_message", message_id: 3 }));
  listeners[0](fakeResponse("chat-2", { type: "chat_message", message_id: 4 }, "com.apple.UNNotificationDismissActionIdentifier"));
  listeners[0](fakeResponse("gps-1", { type: "gps_ask", command: "gps_ask", message_id: 5 }));
  assert.deepEqual(hrefs, ["/ride-details?rideId=42", "/chat"]);
  removeAgain();
  assert.equal(listeners.length, 0);
});

test("gps_ask pushes prompt in-app instead of showing a duplicate banner", async () => {
  let handler = null;
  const received = [];
  const responses = [];
  const presented = [{ request: { identifier: "push-9", content: { data: { type: "gps_ask", command: "gps_ask", message_id: 9 } } } }];
  const scheduled = [];
  const dismissed = [];
  const push = loadPushNotificationsWith({
    setNotificationHandler: (value) => { handler = value; },
    getPermissionsAsync: async () => ({ granted: true }),
    getPresentedNotificationsAsync: async () => presented,
    dismissNotificationAsync: async (identifier) => { dismissed.push(identifier); },
    scheduleNotificationAsync: async (notification) => { scheduled.push(notification); },
    addNotificationReceivedListener: (listener) => { received.push(listener); return { remove() {} }; },
    addNotificationResponseReceivedListener: (listener) => { responses.push(listener); return { remove() {} }; },
    getLastNotificationResponseAsync: async () => fakeResponse("push-9", { type: "gps_ask", command: "gps_ask", message_id: 9 }),
  });

  const events = [];
  push.addGpsAskNotificationListeners((event) => events.push(event));
  await new Promise((resolve) => setTimeout(resolve, 0));
  // Cold start from a gps_ask tap reaches the prompt handler.
  assert.deepEqual(plain(events), [{ messageId: "9", source: "tap" }]);

  received[0]({ request: { identifier: "push-10", content: { data: { type: "gps_ask", command: "gps_ask", message_id: 10 } } } });
  assert.deepEqual(plain(events[1]), { messageId: "10", source: "received" });

  const gpsBehavior = await handler.handleNotification({ request: { content: { data: { command: "gps_ask", message_id: 10 } } } });
  assert.equal(gpsBehavior.shouldShowBanner, false);
  assert.equal(gpsBehavior.shouldShowList, false);
  const rideBehavior = await handler.handleNotification({ request: { content: { data: { type: "ride_request", ride_id: 1 } } } });
  assert.equal(rideBehavior.shouldShowBanner, true);

  // The push for 9 is already in Notification Center: no local duplicate.
  assert.equal(await push.scheduleLocalGpsAskNotification({ messageId: "9" }), false);
  assert.equal(await push.scheduleLocalGpsAskNotification({ messageId: "11" }), true);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].content.data.message_id, "11");

  await push.dismissGpsAskNotifications("9");
  assert.deepEqual(dismissed, ["push-9"]);
});

test("gps_ask tracker prompts each message id at most once across sources", () => {
  const { createGpsAskTracker, normalizeGpsAskMessageId } = loadTsModule("lib/gps-ask-dedupe.ts");
  assert.equal(normalizeGpsAskMessageId(12), "12");
  assert.equal(normalizeGpsAskMessageId(" 12 "), "12");
  assert.equal(normalizeGpsAskMessageId(""), null);

  // Chat poll while backgrounded: one local banner, then the tap prompts once.
  const tracker = createGpsAskTracker();
  assert.equal(tracker.claimLocalNotification("m1"), true);
  assert.equal(tracker.claimLocalNotification("m1"), false);
  assert.equal(tracker.claimPrompt("m1"), true);
  assert.equal(tracker.claimPrompt("m1"), false);
  assert.equal(tracker.hasPrompted("m1"), true);

  // Push already delivered: the poll must not add a local banner, but a prompt is still allowed once.
  tracker.markNotified(2);
  assert.equal(tracker.claimLocalNotification("2"), false);
  assert.equal(tracker.claimPrompt("2"), true);
  assert.equal(tracker.claimPrompt(2), false);

  // Prompted in the foreground first: no local banner afterwards.
  assert.equal(tracker.claimPrompt("m3"), true);
  assert.equal(tracker.claimLocalNotification("m3"), false);
  assert.equal(tracker.claimPrompt(""), false);
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
    "./fleet-api": { getRecentlyTerminalRideIds: () => new Set() },
    "./session-cache": { LAST_ACTIVE_RIDE_KEY: "trustedriders-last-active-ride" },
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
  assert.equal(dispatchContext.isUpcomingRideStatus("pending"), true);
  assert.equal(dispatchContext.isUpcomingRideStatus("accepted"), true);
  assert.equal(dispatchContext.isUpcomingRideStatus("en_route"), false);
  assert.equal(dispatchContext.isUpcomingRideStatus("picked_up"), false);
  assert.equal(dispatchContext.isUpcomingRideStatus("in_transit"), false);
  assert.equal(dispatchContext.isUpcomingRideStatus("completed"), false);
  assert.equal(dispatchContext.isUpcomingRideStatus("cancelled"), false);
  const scheduledStatuses = ["pending", "accepted", "en_route", "completed"]
    .filter((status) => dispatchContext.isUpcomingRideStatus(status));
  assert.deepEqual(scheduledStatuses, ["pending", "accepted"]);
  const dispatchSource = fs.readFileSync(path.join(root, "lib/dispatch-context.tsx"), "utf8");
  assert.match(dispatchSource, /rides\.filter\(\(r\) => isUpcomingRideStatus\(r\.status\)\)/);
  assert.equal(dispatchContext.shouldStopTrackingAfterGpsResponse(false), true);
  assert.equal(dispatchContext.shouldStopTrackingAfterGpsResponse(true), false);
  assert.equal(dispatchContext.shouldApplyIncomingGpsOff("gps_off", "dispatch"), true);
  assert.equal(dispatchContext.shouldApplyIncomingGpsOff("gps_off", "admin"), true);
  assert.equal(dispatchContext.shouldApplyIncomingGpsOff("gps_off", "driver"), false);
  assert.equal(dispatchContext.shouldApplyIncomingGpsOff("gps_ask", "dispatch"), false);
  assert.equal(dispatchContext.shouldEndGpsAtRideEndpoint(undefined, { id: "184", status: "completed" }), true);
  assert.equal(dispatchContext.shouldEndGpsAtRideEndpoint({ id: "184", status: "in_transit" }, { id: "184", status: "completed" }), true);
  assert.equal(dispatchContext.shouldEndGpsAtRideEndpoint({ id: "184", status: "completed" }, { id: "184", status: "completed" }), false);
  assert.equal(dispatchContext.shouldEndGpsAtRideEndpoint({ id: "184", status: "in_transit" }, { id: "184", status: "cancelled" }), false);
  assert.equal(
    dispatchContext.shouldAutoCompleteRideAtDropoff(
      { status: "in_transit", dropoffCoords: { latitude: 40.7401, longitude: -73.9998 } },
      { latitude: 40.7402, longitude: -73.9997 },
    ),
    true,
  );
  // "picked_up" = driver arrived at pickup (passenger not yet on board): never auto-complete, even near dropoff.
  assert.equal(
    dispatchContext.shouldAutoCompleteRideAtDropoff(
      { status: "picked_up", dropoffCoords: { latitude: 40.7401, longitude: -73.9998 } },
      { latitude: 40.7402, longitude: -73.9997 },
    ),
    false,
  );
  assert.equal(
    dispatchContext.shouldAutoCompleteRideAtDropoff(
      { status: "en_route", dropoffCoords: { latitude: 40.7401, longitude: -73.9998 } },
      { latitude: 40.7402, longitude: -73.9997 },
    ),
    false,
  );
  assert.equal(
    dispatchContext.shouldAutoCompleteRideAtDropoff(
      { status: "in_transit", dropoffCoords: { latitude: 40.7401, longitude: -73.9998 } },
      { latitude: 40.7501, longitude: -74.0128 },
    ),
    false,
  );
  assert.equal(
    Math.round(dispatchContext.distanceMetersBetween(
      { latitude: 40.7401, longitude: -73.9998 },
      { latitude: 40.7402, longitude: -73.9997 },
    )),
    14,
  );

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
    [{ ...activeRide, status: "accepted" }, pendingRide],
    missingRefreshes,
  );
  assert.deepEqual(plain(preserved.map((ride) => `${ride.id}:${ride.status}`)), ["184:in_transit", "200:pending"]);
  assert.equal(missingRefreshes.current, 3);

  preserved = dispatchContext.preserveTransientlyMissingActiveRide(
    preserved,
    [{ ...activeRide, status: "completed" }, pendingRide],
    missingRefreshes,
  );
  assert.deepEqual(plain(preserved.map((ride) => `${ride.id}:${ride.status}`)), ["184:completed", "200:pending"]);
  assert.equal(missingRefreshes.current, 0);

  const statusRegressionRefreshes = { current: 0 };
  preserved = dispatchContext.preserveTransientlyMissingActiveRide(
    [activeRide, pendingRide],
    [{ ...activeRide, status: "accepted" }, pendingRide],
    statusRegressionRefreshes,
  );
  assert.deepEqual(plain(preserved.map((ride) => `${ride.id}:${ride.status}`)), ["184:in_transit", "200:pending"]);
  assert.equal(statusRegressionRefreshes.current, 1);

  const exhaustedStatusRegressionRefreshes = { current: 3 };
  preserved = dispatchContext.preserveTransientlyMissingActiveRide(
    [activeRide, pendingRide],
    [{ ...activeRide, status: "accepted" }, pendingRide],
    exhaustedStatusRegressionRefreshes,
  );
  assert.deepEqual(plain(preserved.map((ride) => `${ride.id}:${ride.status}`)), ["184:accepted", "200:pending"]);
  assert.equal(exhaustedStatusRegressionRefreshes.current, 0);

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
    plain(await dispatchContext.preserveStartupActiveRide([{ ...activeRide, status: "accepted" }, pendingRide], false).then((rides) => rides.map((ride) => `${ride.id}:${ride.status}`))),
    ["184:in_transit", "200:pending"],
  );
  assert.deepEqual(
    plain(await dispatchContext.preserveStartupActiveRide([{ ...activeRide, status: "completed" }, pendingRide], false).then((rides) => rides.map((ride) => `${ride.id}:${ride.status}`))),
    ["184:completed", "200:pending"],
  );
  assert.deepEqual(
    plain(await dispatchContext.preserveStartupActiveRide([pendingRide], true).then((rides) => rides.map((ride) => ride.id))),
    ["200"],
  );
});

test("schedule model includes active rides in calendar views", () => {
  const scheduleModel = loadTsModule("features/schedule/schedule-model.ts", {
    "@/lib/rides": {},
    "@/lib/theme": {},
  });

  assert.equal(scheduleModel.isCalendarRideStatus("pending"), true);
  assert.equal(scheduleModel.isCalendarRideStatus("accepted"), true);
  assert.equal(scheduleModel.isCalendarRideStatus("en_route"), true);
  assert.equal(scheduleModel.isCalendarRideStatus("picked_up"), true);
  assert.equal(scheduleModel.isCalendarRideStatus("in_transit"), true);
  assert.equal(scheduleModel.isCalendarRideStatus("completed"), false);
  assert.equal(scheduleModel.isCalendarRideStatus("cancelled"), false);

  assert.equal(scheduleModel.scheduleStatusKey({ status: "pending" }), "scheduled");
  assert.equal(scheduleModel.scheduleStatusKey({ status: "accepted" }), "scheduled");
  assert.equal(scheduleModel.scheduleStatusKey({ status: "en_route" }), "enRoute");
  assert.equal(scheduleModel.scheduleStatusKey({ status: "picked_up" }), "arrived");
  assert.equal(scheduleModel.scheduleStatusKey({ status: "in_transit" }), "inTransit");
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

  // Driver status updates use the dispatch dashboard's vocabulary, and round-trip back to the same app status.
  const pairs = [
    ["en_route", "driver in transit"],
    ["picked_up", "driver at pickup"],
    ["in_transit", "driver/passenger in transit"],
    ["completed", "driver/passenger at dropoff"],
  ];
  for (const [appStatus, backendStatus] of pairs) {
    assert.equal(fleetNormalization.toBackendStatus(appStatus), backendStatus);
    assert.equal(fleetNormalization.normalizeRideStatus(backendStatus), appStatus);
  }
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

test("password reset helper posts the trimmed email to /api/forgot-password", async () => {
  const calls = [];
  let nextResponse = new Response(JSON.stringify({ message: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  const fleetApi = loadTsModule("lib/fleet-api.ts", {
    react: {},
    "react-native": { Platform: { OS: "ios" } },
    "./api-request-throttle": { ApiRequestThrottle: class {} },
    "./config": { FLEET_API_URL: "https://example.test" },
    "./demo-data": { demoRides: [] },
    "./demo-mode": { DEMO_MODE: false },
    "./fleet-api-transport": {
      fleetFetch: async (method, path, init, options) => {
        calls.push({ method, path, body: JSON.parse(init.body), throttleKey: options.throttleKey });
        return nextResponse
          ? { result: nextResponse.ok ? "sent" : "failed", res: nextResponse }
          : { result: "failed", res: null };
      },
      readApiErrorMessage: async (res) => (await res.clone().json()).error ?? null,
    },
    "./fleet-fetch-result": { shouldSuppressRideFetchError: () => false },
    "./fleet-normalization": {},
    "./rides": {},
    "./storage": {},
  });

  await fleetApi.requestPasswordReset("  Driver@Example.com ");
  assert.deepEqual(plain(calls), [{
    method: "POST",
    path: "/api/forgot-password",
    body: { email: "Driver@Example.com" },
    throttleKey: "POST /api/forgot-password",
  }]);
  assert.equal(
    fleetApi.PASSWORD_RESET_CONFIRMATION,
    "If that email has an account, we've sent a reset link.",
  );

  await assert.rejects(fleetApi.requestPasswordReset("   "), /Enter your email address/);
  assert.equal(calls.length, 1);

  nextResponse = new Response(JSON.stringify({ error: "Email required" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
  await assert.rejects(fleetApi.requestPasswordReset("x@example.com"), /Email required/);

  nextResponse = null;
  await assert.rejects(fleetApi.requestPasswordReset("x@example.com"), /Fleet API unavailable/);
});
