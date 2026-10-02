// TrustedRider availability: day modes, time steppers, what gets saved, and the PUT request.
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
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  const context = {
    Response,
    console,
    Date,
    Map,
    JSON,
    Math,
    module,
    exports: module.exports,
    require(specifier) {
      if (specifier in mocks) return mocks[specifier];
      return {};
    },
  };
  vm.runInNewContext(compiled, context, { filename });
  return module.exports;
}

const av = loadTsModule("lib/availability.ts");
const day = (overrides = {}) => ({ date: "2026-10-05", status: null, windows: [], ...overrides });

test("day modes round-trip: off, all day, set hours, not set", () => {
  assert.equal(av.dayMode(day()), "unset");
  const off = av.withMode(day(), "off");
  assert.deepEqual(plain(off), { date: "2026-10-05", status: "unavailable", windows: [] });
  assert.equal(av.dayMode(off), "off");
  const allDay = av.withMode(off, "allDay");
  assert.deepEqual(plain(allDay.windows), [{ start: "00:00", end: "24:00" }]);
  assert.equal(av.daySummary(allDay), "All day");
  const hours = av.withMode(allDay, "hours");
  assert.deepEqual(plain(hours.windows), [{ start: "08:00", end: "17:00" }]);
  assert.equal(av.daySummary(hours), "8:00 AM – 5:00 PM");
  // Switching back to hours keeps custom hours.
  const custom = { ...hours, windows: [{ start: "10:00", end: "14:00" }] };
  assert.deepEqual(plain(av.withMode(custom, "hours").windows), [{ start: "10:00", end: "14:00" }]);
  assert.equal(av.daySummary(av.withMode(custom, "unset")), "Not set");
});

test("steppers move by 30 minutes and never cross", () => {
  const w = { start: "08:00", end: "08:30" };
  assert.deepEqual(plain(av.nudgeWindow(w, "start", 30)), w); // can't pass the end
  assert.deepEqual(plain(av.nudgeWindow(w, "end", -30)), w);
  assert.deepEqual(plain(av.nudgeWindow(w, "start", -30)), { start: "07:30", end: "08:30" });
  assert.deepEqual(plain(av.nudgeWindow({ start: "00:00", end: "23:30" }, "end", 60)), { start: "00:00", end: "24:00" });
  assert.deepEqual(plain(av.nudgeWindow({ start: "00:00", end: "05:00" }, "start", -30)), { start: "00:00", end: "05:00" });
  assert.equal(av.clockLabel("24:00"), "Midnight");
  assert.equal(av.clockLabel("12:30"), "12:30 PM");
});

test("extra time ranges follow the last one; overlaps are caught", () => {
  assert.deepEqual(plain(av.nextWindow([{ start: "08:00", end: "12:00" }])), { start: "13:00", end: "17:00" });
  assert.equal(av.nextWindow([{ start: "08:00", end: "23:30" }]), null);
  assert.equal(av.windowsOverlap([{ start: "08:00", end: "12:00" }, { start: "11:00", end: "14:00" }]), true);
  assert.equal(av.windowsOverlap([{ start: "13:00", end: "14:00" }, { start: "08:00", end: "12:00" }]), false);
});

test("only changed days are saved", () => {
  const saved = [day({ date: "2026-10-05" }), day({ date: "2026-10-06", status: "unavailable" })];
  const edited = [av.withMode(saved[0], "allDay"), saved[1]];
  assert.deepEqual(plain(av.changedDays(saved, edited)).map((d) => d.date), ["2026-10-05"]);
  assert.deepEqual(plain(av.changedDays(saved, saved)), []);
});

test("normalizeDay drops windows unless available", () => {
  assert.deepEqual(plain(av.normalizeDay({ date: "2026-10-05", status: "unavailable", windows: [{ start: "08:00", end: "09:00" }] })),
    { date: "2026-10-05", status: "unavailable", windows: [] });
  assert.equal(av.normalizeDay({ status: "available" }), null);
  assert.deepEqual(plain(av.normalizeDay({ date: "2026-10-05", status: "maybe" })), { date: "2026-10-05", status: null, windows: [] });
});

test("save request is a PUT of the changed days with the token", () => {
  const api = loadTsModule("lib/availability-api.ts", {
    "./availability": av,
    "./demo-mode": { DEMO_MODE: false },
    "./fleet-api": { getToken: () => "tok", expireSession: async () => {} },
    "./fleet-api-transport": {},
  });
  const { path: p, init } = api.buildSaveAvailabilityRequest([
    { date: "2026-10-05", status: "unavailable", windows: [{ start: "08:00", end: "09:00" }] },
    { date: "2026-10-06", status: "available", windows: [{ start: "08:00", end: "12:00" }] },
  ]);
  assert.equal(p, "/api/me/availability");
  assert.equal(init.method, "PUT");
  assert.equal(init.headers.Authorization, "Bearer tok");
  assert.deepEqual(JSON.parse(init.body), {
    days: [
      { date: "2026-10-05", status: "unavailable", windows: [] },
      { date: "2026-10-06", status: "available", windows: [{ start: "08:00", end: "12:00" }] },
    ],
  });
});
