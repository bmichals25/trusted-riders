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
