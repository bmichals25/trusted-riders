// Recently completed rides on Home (lib/recent-rides.ts), completing a leg on this phone, the Ready to Return
// status line, and the schedule's day rollover.
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
const recent = loadTsModule("lib/recent-rides.ts", { "./rides": rides, "./round-trip": roundTrip });
const fleet = loadTsModule("lib/fleet-normalization.ts", { "./rides": rides, "./round-trip": roundTrip });
const schedule = loadTsModule("features/schedule/schedule-model.ts", {
  "@/lib/rides": {},
  "@/lib/round-trip": roundTrip,
  "@/lib/theme": {},
});

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-09-25T04:14:00Z");

function trip(leg, overrides = {}) {
  return {
    tripId: "31", leg, legNumber: leg === "outbound" ? 1 : 2, label: "",
    outboundRideId: "31", returnRideId: "32", otherRideId: leg === "outbound" ? "32" : "31", otherRideStatus: null,
    returnTimeOpen: true, readyToReturnAt: null, readyToReturnNote: "", transportMethod: "", transportNote: "",
    canReadyToReturn: false, needsReturnPlan: false, ...overrides,
  };
}

function ride(id, status, overrides = {}) {
  return { id, status, passengerName: `Passenger ${id}`, trip: null, ...overrides };
}

const ids = (entries) => plain(entries.map((entry) => `${entry.key}:${entry.ride.id}`));

test("a finished round trip shows once, opens the ride home and has both legs done", () => {
  const list = [
    ride("31", "completed", { trip: trip("outbound"), endedAt: NOW - 3 * HOUR }),
    ride("32", "completed", { trip: trip("return"), endedAt: NOW - 1 * HOUR }),
  ];
  const [entry, ...rest] = recent.recentCompletedTrips(list, NOW);
  assert.equal(rest.length, 0);
  assert.equal(entry.key, "trip-31");
  assert.equal(entry.ride.id, "32");
  assert.equal(entry.completedAt, NOW - 1 * HOUR);
  assert.deepEqual(plain(entry.legSteps), [{ leg: "outbound", state: "done" }, { leg: "return", state: "done" }]);
});

test("a round trip with the ride home still to come isn't recently completed", () => {
  const list = [
    ride("31", "completed", { trip: trip("outbound"), endedAt: NOW - HOUR }),
    ride("32", "accepted", { trip: trip("return", { canReadyToReturn: true }) }),
  ];
  assert.deepEqual(plain(recent.recentCompletedTrips(list, NOW)), []);
});

test("only rides completed in the last 24 hours, newest first, at most 5", () => {
  const list = [
    ride("1", "completed", { endedAt: NOW - 2 * HOUR }),
    ride("2", "completed", { endedAt: NOW - 25 * HOUR }), // too old
    ride("3", "completed"), // no end time
    ride("4", "cancelled", { endedAt: NOW - HOUR }), // nothing was completed
    ride("5", "in_transit"),
    ride("6", "completed", { endedAt: NOW - 30 * 60 * 1000 }),
    ride("7", "completed", { endedAt: NOW + 5 * 24 * HOUR }), // bad data
  ];
  assert.deepEqual(ids(recent.recentCompletedTrips(list, NOW)), ["6:6", "1:1"]);

  const many = Array.from({ length: 7 }, (_, index) => ride(`r${index}`, "completed", { endedAt: NOW - (index + 1) * HOUR }));
  assert.deepEqual(ids(recent.recentCompletedTrips(many, NOW)), ["r0:r0", "r1:r1", "r2:r2", "r3:r3", "r4:r4"]);
  assert.equal(recent.recentCompletedTrips(many, NOW, { limit: 2 }).length, 2);
  // The window counts from the trip's last completed leg.
  assert.deepEqual(plain(recent.recentCompletedTrips([ride("1", "completed", { endedAt: NOW - 2 * HOUR })], NOW, { windowMs: HOUR })), []);
});

test("a round trip whose ride home was cancelled or went to another TR still reads as finished", () => {
  const cancelledHome = recent.recentCompletedTrips([
    ride("31", "completed", { trip: trip("outbound"), endedAt: NOW - HOUR }),
    ride("32", "cancelled", { trip: trip("return"), endedAt: NOW - 30 * 60 * 1000 }),
  ], NOW);
  assert.deepEqual(ids(cancelledHome), ["trip-31:31"]); // notes go on the leg that was actually driven
  assert.equal(cancelledHome[0].completedAt, NOW - HOUR);

  const otherTr = recent.recentCompletedTrips([
    ride("31", "completed", { trip: trip("outbound", { otherRideStatus: "driver/passenger at dropoff" }), endedAt: NOW - HOUR }),
  ], NOW);
  assert.deepEqual(ids(otherTr), ["trip-31:31"]);
  assert.deepEqual(plain(otherTr[0].legSteps), [{ leg: "outbound", state: "done" }, { leg: "return", state: "done" }]);

  const homeNotDoneYet = recent.recentCompletedTrips([
    ride("31", "completed", { trip: trip("outbound", { otherRideStatus: "driver in transit" }), endedAt: NOW - HOUR }),
  ], NOW);
  assert.deepEqual(plain(homeNotDoneYet[0].legSteps), [{ leg: "outbound", state: "done" }, { leg: "return", state: "upcoming" }]);
});

test("pickRecentFinishedRows keeps recent completed/cancelled rows, newest first and capped", () => {
  const rows = [
    { id: "a", status: "completed", endedAt: NOW - 3 * HOUR },
    { id: "b", status: "cancelled", endedAt: NOW - HOUR },
    { id: "c", status: "completed", endedAt: NOW - 30 * HOUR },
    { id: "d", status: "accepted", endedAt: null },
    { id: "e", status: "completed", endedAt: null },
    { id: "f", status: "completed", endedAt: NOW - 2 * HOUR },
  ];
  assert.deepEqual(plain(recent.pickRecentFinishedRows(rows, NOW).map((row) => row.id)), ["b", "f", "a"]);
  assert.deepEqual(plain(recent.pickRecentFinishedRows(rows, NOW, { limit: 1 }).map((row) => row.id)), ["b"]);
});

test("normalizeRide reads end_time for finished rides; the fresh list row wins over a cached detail", () => {
  const done = fleet.normalizeRide({ ride_id: 40, status: "driver/passenger at dropoff", end_time: "2026-09-25T04:13:00" });
  assert.equal(done.status, "completed");
  assert.equal(done.endedAt, Date.parse("2026-09-25T04:13:00Z")); // naive backend timestamps are UTC
  assert.equal("endedAt" in fleet.normalizeRide({ ride_id: 41, status: "driver accepted", end_time: "2026-09-25T04:13:00" }), false);

  // A detail cached while the ride was active still has the passenger block; a finished ride drops it.
  const cachedDetail = { ride_id: 40, status: "driver/passenger in transit", end_time: null, passenger: { id: 7, name: "Ann", phone: "555" } };
  const merged = rides.mergeRideSummaryAndDetail(
    { ride_id: 40, status: "driver/passenger at dropoff", end_time: "2026-09-25T04:13:00" },
    cachedDetail,
  );
  assert.equal(merged.status, "driver/passenger at dropoff");
  assert.equal(merged.end_time, "2026-09-25T04:13:00");
  assert.equal(merged.passenger, null);
  const active = rides.mergeRideSummaryAndDetail({ ride_id: 40, status: "driver/passenger in transit" }, cachedDetail);
  assert.equal(active.passenger.phone, "555");
});

test("completing the outbound leg on this phone offers Ready to Return before the next refresh", () => {
  const list = [
    ride("31", "in_transit", { trip: trip("outbound") }),
    ride("32", "accepted", { trip: trip("return") }),
    ride("50", "accepted"),
  ];
  const next = roundTrip.applyLegCompleted(list, "31", NOW);
  assert.equal(next[0].status, "completed");
  assert.equal(next[0].endedAt, NOW);
  assert.equal(next[1].trip.canReadyToReturn, true);
  assert.equal(roundTrip.readyToReturnState(next[1]), "offer");
  assert.equal(roundTrip.findReadyToReturnRide(next.filter((r) => r.status === "accepted")).id, "32");
  assert.equal(next[2], list[2]);
  assert.equal(list[0].status, "in_transit"); // not mutated

  // Already marked ready (dispatch arranging it): leave the trip block alone.
  const marked = roundTrip.applyLegCompleted(
    [list[0], ride("32", "accepted", { trip: trip("return", { readyToReturnAt: "2026-09-25T04:09:00Z", needsReturnPlan: true }) })],
    "31",
    NOW,
  );
  assert.equal(marked[1].trip.canReadyToReturn, false);

  // Completing the ride home (or a one-way ride) makes it recently completed right away.
  const home = roundTrip.applyLegCompleted(
    [ride("31", "completed", { trip: trip("outbound"), endedAt: NOW - HOUR }), ride("32", "in_transit", { trip: trip("return") })],
    "32",
    NOW,
  );
  assert.deepEqual(ids(recent.recentCompletedTrips(home, NOW)), ["trip-31:32"]);
  assert.deepEqual(plain(roundTrip.applyLegCompleted([ride("9", "in_transit")], "missing", NOW).map((r) => r.status)), ["in_transit"]);
});

test("the Ready to Return status line punctuates the TR's note", () => {
  assert.equal(roundTrip.asSentence("Appointment ran long"), "Appointment ran long.");
  assert.equal(roundTrip.asSentence("Finished early!"), "Finished early!");
  assert.equal(roundTrip.asSentence("Is the van free?"), "Is the van free?");
  assert.equal(roundTrip.asSentence("She said \"thanks.\""), "She said \"thanks.\"");
  assert.equal(roundTrip.asSentence("  "), "");
  assert.equal(
    roundTrip.readyToReturnStatusText("waiting", "12:09 AM", "Appointment ran long"),
    "You told dispatch at 12:09 AM. Note: Appointment ran long. Stay with the passenger; check chat for updates.",
  );
  assert.equal(
    roundTrip.readyToReturnStatusText("arranged", "", "Waiting on paperwork: pharmacy is slow."),
    "Dispatch has your message. Note: Waiting on paperwork: pharmacy is slow. Dispatch will start the ride home in the app when it's time.",
  );
  assert.equal(
    roundTrip.readyToReturnStatusText("waiting", "12:09 AM", ""),
    "You told dispatch at 12:09 AM. Stay with the passenger; check chat for updates.",
  );
});

test("the schedule's today rolls over at midnight without moving a day the TR picked", () => {
  const lateNight = new Date(2026, 8, 24, 23, 59, 30);
  assert.equal(schedule.msUntilNextDay(lateNight), 30 * 1000);
  assert.equal(schedule.msUntilNextDay(new Date(2026, 8, 25, 0, 0, 0)), 24 * HOUR);

  const sep24 = new Date(2026, 8, 24);
  const sep25 = new Date(2026, 8, 25);
  const oct1 = new Date(2026, 9, 1);
  assert.equal(schedule.selectedDayAfterDateChange(new Date(2026, 8, 24, 0, 0), sep24, sep25), sep25);
  assert.equal(schedule.selectedDayAfterDateChange(oct1, sep24, sep25), oct1);
});
