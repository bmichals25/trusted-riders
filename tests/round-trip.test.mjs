// Round trips (BEN-11) / Ready to Return (BEN-12): lib/round-trip.ts and its use in ride normalization.
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
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    console,
    require(specifier) {
      if (specifier in mocks) return mocks[specifier];
      if (specifier.startsWith(".")) return {};
      throw new Error(`unexpected import ${specifier}`);
    },
  }, { filename });
  return module.exports;
}

const roundTrip = loadTsModule("lib/round-trip.ts");
const rides = loadTsModule("lib/rides.ts", { "./round-trip": roundTrip });
const fleet = loadTsModule("lib/fleet-normalization.ts", { "./rides": rides, "./round-trip": roundTrip });

// Shapes as GET /api/rides + /api/rides/<id> send them (backend app/services/round_trip.py trip_payload).
function backendTrip(overrides = {}) {
  return {
    id: 31, leg: "return", leg_number: 2, leg_count: 2, label: "Leg 2 of 2 · Return",
    outbound_ride_id: 31, return_ride_id: 32, other_ride_id: 31, other_ride_status: "driver/passenger at dropoff",
    other_ride_driver_id: 4, return_time_open: true, return_start_time: null, ready_to_return_at: null,
    ready_to_return_note: null, transport_method: null, transport_note: null,
    can_ready_to_return: true, needs_return_plan: false,
    ...overrides,
  };
}

function backendRide(overrides = {}) {
  return {
    ride_id: 32, status: "driver accepted", driver_accepted: true, start_time: null,
    pickup_address: "Yale New Haven Hospital, 20 York St", dropoff_address: "12 Elm St, New Haven, CT",
    trip: backendTrip(), ...overrides,
  };
}

test("normalizeTrip maps the backend trip block and ignores one-way rides", () => {
  assert.deepEqual(plain(roundTrip.normalizeTrip(backendTrip())), {
    tripId: "31", leg: "return", legNumber: 2, label: "Leg 2 of 2 · Return",
    outboundRideId: "31", returnRideId: "32", otherRideId: "31", otherRideStatus: "driver/passenger at dropoff",
    returnTimeOpen: true, readyToReturnAt: null, readyToReturnNote: "", transportMethod: "", transportNote: "",
    canReadyToReturn: true, needsReturnPlan: false,
  });
  assert.equal(roundTrip.normalizeTrip(null), null);
  assert.equal(roundTrip.normalizeTrip({ id: 3, leg: "sideways" }), null);
  assert.equal(roundTrip.normalizeTrip({ leg: "outbound" }), null);
  const outbound = roundTrip.normalizeTrip({ id: 31, leg: "outbound", return_ride_id: 32 });
  assert.equal(outbound.label, "Leg 1 of 2 · Outbound");
  assert.equal(roundTrip.tripLinkText({ trip: outbound }), "Ride home is ride #32");
  assert.equal(roundTrip.tripLinkText({ trip: roundTrip.normalizeTrip(backendTrip()) }), "Return leg of ride #31");
});

test("normalizeRide carries the trip, labels an open return leg and maps 'ready to return'", () => {
  const open = fleet.normalizeRide(backendRide());
  assert.equal(open.tripType, "Round-Trip");
  assert.equal(open.trip.leg, "return");
  assert.equal(open.scheduledDate, "Ride home");
  assert.equal(open.scheduledTime, "when you're ready");
  assert.equal(open.status, "accepted");

  const ready = fleet.normalizeRide(backendRide({
    status: "ready to return", start_time: "2026-09-28T15:10:00",
    trip: backendTrip({ can_ready_to_return: false, needs_return_plan: true, ready_to_return_at: "2026-09-28T15:10:00Z" }),
  }));
  assert.equal(ready.status, "accepted");
  assert.equal(ready.awaitingAcceptance, false);
  assert.notEqual(ready.scheduledTime, "when you're ready");
  assert.equal(fleet.normalizeRideStatus("ready to return"), "accepted");

  const oneWay = fleet.normalizeRide({ ride_id: 5, status: "pending", start_time: "2026-09-28T15:10:00", trip: null });
  assert.equal(oneWay.trip ?? null, null);
  assert.equal(oneWay.tripType, "One-Way");
});

test("fresh ride list trip block and start time win over a cached ride detail", () => {
  const merged = rides.mergeRideSummaryAndDetail(
    { ride_id: 32, status: "ready to return", start_time: "2026-09-28T15:10:00", trip: backendTrip({ needs_return_plan: true }) },
    { ride_id: 32, status: "driver accepted", start_time: null, trip: backendTrip(), pickup_address: "Yale" },
  );
  assert.equal(merged.start_time, "2026-09-28T15:10:00");
  assert.equal(merged.trip.needs_return_plan, true);
  assert.equal(merged.pickup_address, "Yale");
});

test("Ready to Return card state follows the trip", () => {
  const ride = (status, trip) => ({ id: "32", status, trip: roundTrip.normalizeTrip(backendTrip(trip)) });
  assert.equal(roundTrip.readyToReturnState(ride("accepted", {})), "offer");
  assert.equal(roundTrip.readyToReturnState(ride("accepted", {}), true), "waiting"); // tapped, list not refreshed yet
  assert.equal(roundTrip.readyToReturnState(ride("accepted", { can_ready_to_return: false, needs_return_plan: true })), "waiting");
  assert.equal(
    roundTrip.readyToReturnState(ride("accepted", { can_ready_to_return: false, needs_return_plan: true, transport_method: "Uber (agency code)" })),
    "arranged",
  );
  // Passenger not dropped off yet, or the ride home already started: nothing to show.
  assert.equal(roundTrip.readyToReturnState(ride("accepted", { can_ready_to_return: false })), null);
  assert.equal(roundTrip.readyToReturnState(ride("picked_up", { can_ready_to_return: false, needs_return_plan: true })), null);
  assert.equal(roundTrip.readyToReturnState({ id: "5", status: "accepted", trip: null }), null);

  const list = [
    { id: "40", status: "accepted", trip: null },
    ride("accepted", {}),
  ];
  assert.equal(roundTrip.findReadyToReturnRide(list).id, "32");
  assert.equal(roundTrip.findReadyToReturnRide([list[0]]), null);
  assert.equal(roundTrip.readyToReturnTargetId(list[1]), "31");
  assert.equal(roundTrip.readyToReturnTargetId({ id: "9", trip: null }), "9");
});

test("Ready to Return note joins the picked suggestion and details", () => {
  assert.equal(roundTrip.buildReadyToReturnNote(null, "  "), "");
  assert.equal(roundTrip.buildReadyToReturnNote("Appointment ran long", ""), "Appointment ran long");
  assert.equal(roundTrip.buildReadyToReturnNote("Appointment ran long", " 20 more min "), "Appointment ran long: 20 more min");
  assert.equal(roundTrip.buildReadyToReturnNote(null, "x".repeat(400)).length, 300);
  const a = { trip: roundTrip.normalizeTrip(backendTrip()) };
  const b = { trip: roundTrip.normalizeTrip(backendTrip({ leg: "outbound" })) };
  assert.equal(roundTrip.isSameTrip(a, b), true);
  assert.equal(roundTrip.isSameTrip(a, { trip: null }), false);
});

// One trip, one card: lists group the legs by trip and show the trip's current leg.
function leg(id, legName, status, extra = {}) {
  const outbound = legName === "outbound";
  return {
    id: String(id),
    status,
    trip: roundTrip.normalizeTrip(backendTrip({
      id: 40, leg: legName, outbound_ride_id: 40, return_ride_id: 41, other_ride_id: outbound ? 41 : 40, ...extra,
    })),
  };
}

const stepsOf = (entry) => entry.legSteps.map((step) => `${step.leg}:${step.state}`).join(" ");

test("groupRidesByTrip shows a round trip once, on its first unfinished leg", () => {
  const oneWay = { id: "7", status: "accepted", trip: null };
  const entries = roundTrip.groupRidesByTrip([leg(40, "outbound", "pending"), oneWay, leg(41, "return", "pending")]);
  assert.deepEqual(plain(entries.map((entry) => entry.key)), ["trip-40", "7"]);
  assert.equal(entries[0].ride.id, "40");
  assert.equal(entries[0].legs.outbound.id, "40");
  assert.equal(entries[0].legs.return.id, "41");
  assert.equal(stepsOf(entries[0]), "outbound:current return:upcoming");
  assert.equal(entries[1].ride, oneWay);
  assert.deepEqual(plain(entries[1].legs), {});
  assert.deepEqual(plain(entries[1].legSteps), []);

  // Return listed before outbound: still one entry, current leg is the outbound.
  const reversed = roundTrip.groupRidesByTrip([leg(41, "return", "accepted"), leg(40, "outbound", "en_route")]);
  assert.equal(reversed.length, 1);
  assert.equal(reversed[0].ride.id, "40");

  // Outbound finished but still in the list (auto-complete before the next refresh): the ride home is current.
  const done = roundTrip.groupRidesByTrip([leg(40, "outbound", "completed"), leg(41, "return", "accepted")]);
  assert.equal(done[0].ride.id, "41");
  assert.equal(stepsOf(done[0]), "outbound:done return:current");

  // Only the return leg listed (the completed outbound is hidden): it's the current leg.
  const onlyReturn = roundTrip.groupRidesByTrip([leg(41, "return", "accepted")]);
  assert.equal(onlyReturn[0].key, "trip-40");
  assert.equal(onlyReturn[0].ride.id, "41");
  assert.equal(onlyReturn[0].legs.outbound, undefined);
  assert.equal(stepsOf(onlyReturn[0]), "outbound:done return:current");

  // Both legs finished: the later leg stands in, and nothing is current.
  const finished = roundTrip.groupRidesByTrip([leg(40, "outbound", "completed"), leg(41, "return", "cancelled")]);
  assert.equal(finished[0].ride.id, "41");
  assert.equal(stepsOf(finished[0]), "outbound:done return:done");
});

test("trip entries count trips and drop the return leg while the outbound is under way", () => {
  const rides = [leg(40, "outbound", "in_transit"), leg(41, "return", "accepted"), { id: "7", status: "pending", trip: null }];
  const upcoming = roundTrip.groupRidesByTrip(rides).filter((entry) => entry.ride.status === "pending" || entry.ride.status === "accepted");
  assert.deepEqual(plain(upcoming.map((entry) => entry.key)), ["7"]);
  assert.equal(roundTrip.groupRidesByTrip(rides).length, 2);

  const entry = roundTrip.findTripEntry(rides, rides[1]);
  assert.equal(entry.ride.id, "40");
  assert.equal(roundTrip.findTripEntry(rides, rides[2]), null);
});

test("Ready to Return ride and the trip's upcoming entry are the same trip", () => {
  const ret = leg(41, "return", "accepted");
  const rides = [ret, { id: "7", status: "accepted", trip: null }];
  const ready = roundTrip.findReadyToReturnRide(rides);
  assert.equal(ready.id, "41");
  const rest = roundTrip.groupRidesByTrip(rides).filter((entry) => !roundTrip.isSameTrip(entry.ride, ready));
  assert.deepEqual(plain(rest.map((entry) => entry.key)), ["7"]);
});

test("a round trip goes by its outbound ride number", () => {
  assert.equal(roundTrip.tripDisplayNumber(leg(41, "return", "accepted")), "40");
  assert.equal(roundTrip.tripTitle(leg(41, "return", "accepted")), "Ride #40 · Round trip");
  assert.equal(roundTrip.tripTitle({ id: "12", trip: null }), "Ride #12");
  assert.deepEqual(plain(roundTrip.tripLegSteps({ id: "12", status: "accepted", trip: null })), []);
  assert.equal(roundTrip.TRIP_LEG_LABELS.outbound, "Outbound");
  assert.equal(roundTrip.TRIP_LEG_LABELS.return, "Ride home");
});
