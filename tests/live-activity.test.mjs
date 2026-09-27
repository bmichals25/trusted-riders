// Ride Live Activity: which ride shows on the Lock Screen / Dynamic Island, and that it carries no PHI.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");

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
    require(specifier) {
      if (specifier in mocks) return mocks[specifier];
      throw new Error(`unexpected import ${specifier}`);
    },
  }, { filename });
  return module.exports;
}

const live = loadTsModule("lib/live-activity.ts", {
  "./round-trip": { tripDisplayNumber: (ride) => ride.trip?.outboundRideId ?? ride.id },
});

const NOW = Date.UTC(2026, 8, 27, 4, 0);
const MIN = 60 * 1000;
const ride = (over) => ({
  id: "42",
  status: "accepted",
  awaitingAcceptance: false,
  pickupAt: NOW + 30 * MIN,
  passengerName: "Jane Patient",
  pickupAddress: "1 Private Lane",
  dropoffAddress: "Dialysis Center",
  notes: "oxygen",
  emergencyContact: "555-0100",
  ...over,
});

test("the current ride always wins", () => {
  const active = ride({ id: "7", status: "en_route" });
  assert.equal(live.pickLiveActivityRide(active, [ride()], NOW).id, "7");
});

test("an accepted ride shows from two hours before pickup until an hour after", () => {
  assert.equal(live.pickLiveActivityRide(null, [ride({ pickupAt: NOW + 121 * MIN })], NOW), null);
  assert.equal(live.pickLiveActivityRide(null, [ride({ pickupAt: NOW + 119 * MIN })], NOW)?.id, "42");
  assert.equal(live.pickLiveActivityRide(null, [ride({ pickupAt: NOW - 59 * MIN })], NOW)?.id, "42");
  assert.equal(live.pickLiveActivityRide(null, [ride({ pickupAt: NOW - 61 * MIN })], NOW), null);
});

test("rides waiting for the TR's answer, or without a pickup time, never show; the soonest pickup wins", () => {
  assert.equal(live.pickLiveActivityRide(null, [ride({ awaitingAcceptance: true })], NOW), null);
  assert.equal(live.pickLiveActivityRide(null, [ride({ pickupAt: null })], NOW), null);
  const picked = live.pickLiveActivityRide(null, [ride({ id: "50", pickupAt: NOW + 90 * MIN }), ride({ id: "49", pickupAt: NOW + 20 * MIN })], NOW);
  assert.equal(picked.id, "49");
});

test("statuses map to the four steps plus the final ones", () => {
  const steps = ["pending", "accepted", "en_route", "picked_up", "in_transit", "completed", "cancelled"].map(live.rideActivityStep);
  assert.deepEqual(steps, ["upcoming", "upcoming", "en_route", "at_pickup", "on_board", "completed", "cancelled"]);
});

test("the payload is PHI-free: ride number, step, pickup time and leg only", () => {
  const payload = live.rideActivityPayload(ride({ trip: { outboundRideId: "40", leg: "return" } }));
  assert.deepEqual(Object.keys(payload).sort(), ["legLabel", "pickupAtMs", "rideNumber", "step"]);
  assert.deepEqual({ ...payload }, { rideNumber: "40", step: "upcoming", pickupAtMs: NOW + 30 * MIN, legLabel: "Ride home" });
  const text = JSON.stringify(payload);
  for (const phi of ["Jane", "Private Lane", "Dialysis", "oxygen", "555-0100"]) assert.ok(!text.includes(phi), phi);
});

test("a ride that just finished sends its final state; one that vanished ends the activity", () => {
  const shown = ride({ status: "in_transit" });
  assert.equal(live.finishedRidePayload(shown, [ride({ status: "completed" })]).step, "completed");
  assert.equal(live.finishedRidePayload(shown, [ride({ status: "cancelled" })]).step, "cancelled");
  assert.equal(live.finishedRidePayload(shown, []), null);
});
