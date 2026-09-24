// BEN-13: passenger + ride notes on driver rides.
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
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    Headers,
    Response,
    console,
    module,
    exports: module.exports,
    require(specifier) {
      if (specifier in mocks) return mocks[specifier];
      if (specifier.startsWith(".")) return {};
      throw new Error(`Unexpected import ${specifier}`);
    },
  }, { filename });
  return module.exports;
}

function loadNormalization() {
  return loadTsModule("lib/fleet-normalization.ts", {
    "./round-trip": loadTsModule("lib/round-trip.ts"),
    "./rides": { normalizeRouteGeometry: () => [] },
  });
}

const DETAIL = {
  ride_id: 42,
  status: "scheduled-driver assigned",
  pickup_address: "1 Main St",
  dropoff_address: "2 Oak Ave",
  start_time: "2026-09-24T15:00:00",
  driver: { id: 3, name: "Jordan Mitchell", location_lat: null, location_lon: null },
  site_name: "Brooklyn",
  passenger_id: 7,
  passenger_name: "Ava Passenger",
  passenger: {
    id: 7,
    name: "Ava Passenger",
    phone: "555-0100",
    mobility_needs: "Walker; needs help with the step",
    emergency_contact_name: "Ben Passenger",
    emergency_contact_phone: null,
    notes: "Prefers the front seat",
  },
  ride_notes: [
    { id: 12, ride_id: 42, author_user_id: 9, author_role: "tr", author_name: "Jordan Mitchell", text: "Running 5 min late", created_at: "2026-09-24T14:40:00Z" },
    { id: 11, ride_id: 42, author_user_id: 1, author_role: "dispatch", author_name: "Dana Dispatch", text: "Gate code 1234", created_at: "2026-09-24T14:00:00Z" },
  ],
};

test("ride detail maps passenger name, passenger record and ride notes", () => {
  const { normalizeRide } = loadNormalization();
  const ride = normalizeRide(DETAIL);

  assert.equal(ride.passengerName, "Ava Passenger");
  assert.equal(ride.passengerId, "7");
  assert.deepEqual(plain(ride.passenger), {
    id: "7",
    name: "Ava Passenger",
    phone: "555-0100",
    mobilityNeeds: "Walker; needs help with the step",
    emergencyContactName: "Ben Passenger",
    emergencyContactPhone: "",
    notes: "Prefers the front seat",
  });
  // Oldest first, roles mapped.
  assert.deepEqual(plain(ride.rideNotes), [
    { id: "11", authorRole: "dispatch", authorName: "Dana Dispatch", text: "Gate code 1234", createdAt: "2026-09-24T14:00:00Z" },
    { id: "12", authorRole: "tr", authorName: "Jordan Mitchell", text: "Running 5 min late", createdAt: "2026-09-24T14:40:00Z" },
  ]);
  // Person notes live in the Passenger section, not the ride's dispatch context.
  assert.equal(ride.notes, "");
});

test("rides without a passenger keep the Ride #N title and never pick the driver's name", () => {
  const { normalizeRide } = loadNormalization();
  const ride = normalizeRide({ ...DETAIL, passenger_id: null, passenger_name: null, passenger: null, ride_notes: [] });

  assert.equal(ride.passengerName, "Ride #42");
  assert.equal(ride.passengerId, null);
  assert.equal(ride.passenger, null);
  assert.deepEqual(plain(ride.rideNotes), []);
});

test("list rows and older backends leave passenger fields undefined", () => {
  const { normalizeRide } = loadNormalization();

  const listRow = normalizeRide({ ride_id: 5, status: "pending", start_time: "2026-09-24T15:00:00", passenger_id: 3, passenger_name: "Lee Rider" });
  assert.equal(listRow.passengerName, "Lee Rider");
  assert.equal(listRow.passengerId, "3");
  assert.equal("passenger" in listRow, false);
  assert.equal("rideNotes" in listRow, false);

  const legacy = normalizeRide({ ride_id: 6, status: "pending", start_time: "2026-09-24T15:00:00" });
  assert.equal(legacy.passengerName, "Ride #6");
  for (const key of ["passengerId", "passenger", "rideNotes"]) {
    assert.equal(key in legacy, false, `${key} should be absent`);
  }

  // Ad-hoc nested passenger objects (no record id) keep feeding name + notes like before.
  const nested = normalizeRide({ ride_id: 8, passenger: { full_name: "Ava", accessibility_notes: "Curbside" } });
  assert.equal(nested.passengerName, "Ava");
  assert.equal(nested.notes, "Curbside");
  assert.equal("passenger" in nested, false);
});

test("ride note normalization maps roles, drops unusable notes and sorts oldest first", () => {
  const { normalizeRideNote, normalizeRideNotes, normalizeRideNoteAuthorRole } = loadNormalization();

  assert.equal(normalizeRideNoteAuthorRole("dispatch"), "dispatch");
  assert.equal(normalizeRideNoteAuthorRole("TR"), "tr");
  assert.equal(normalizeRideNoteAuthorRole("driver"), "tr");
  assert.equal(normalizeRideNoteAuthorRole(null), "dispatch");

  assert.equal(normalizeRideNote({ id: 1, text: "   " }), null);
  assert.equal(normalizeRideNote({ text: "no id" }), null);
  assert.equal(normalizeRideNote(null), null);
  assert.deepEqual(plain(normalizeRideNote({ id: 2, author_role: "tr", author_name: null, text: " hi ", created_at: null })), {
    id: "2", authorRole: "tr", authorName: "TR", text: "hi", createdAt: "",
  });

  const sorted = normalizeRideNotes([
    { id: "c", author_role: "dispatch", text: "third", created_at: "2026-09-24T12:00:00Z" },
    { id: "a", author_role: "dispatch", text: "first", created_at: "2026-09-24T10:00:00" },
    { id: "b", author_role: "dispatch", text: "second", created_at: "2026-09-24T11:00:00Z" },
    "junk",
  ]);
  assert.deepEqual(sorted.map((note) => note.id), ["a", "b", "c"]);
  assert.deepEqual(plain(normalizeRideNotes(null)), []);
});

test("fresh list passenger fields win over a cached ride detail", () => {
  const rides = loadTsModule("lib/rides.ts", {});
  const merged = rides.mergeRideSummaryAndDetail(
    { ride_id: 42, status: "pending", passenger_id: 8, passenger_name: "New Rider" },
    { ride_id: 42, status: "pending", passenger_id: 7, passenger_name: "Old Rider", ride_notes: [] },
  );
  assert.equal(merged.passenger_id, 8);
  assert.equal(merged.passenger_name, "New Rider");
  assert.deepEqual(merged.ride_notes, []);
});

function loadNotesApi({ demo = false, respond } = {}) {
  const calls = [];
  const api = loadTsModule("lib/ride-notes-api.ts", {
    "./demo-data": {
      demoRides: [{ id: "1027", rideNotes: [{ id: "d1", authorRole: "dispatch", authorName: "Dispatch", text: "Seed", createdAt: "2026-09-24T10:00:00Z" }] }],
    },
    "./demo-mode": { DEMO_MODE: demo },
    "./fleet-api": { getToken: () => "token" },
    "./fleet-api-transport": {
      fleetFetch: async (method, requestPath, init) => {
        calls.push({ method, path: requestPath, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
        const res = respond ? respond(method, requestPath) : null;
        return res ? { result: res.ok ? "sent" : "failed", res } : { result: "failed", res: null };
      },
      readApiErrorMessage: async (res) => (await res.clone().json()).error ?? null,
    },
    "./fleet-normalization": loadNormalization(),
    "./rides": { getRideBackendId: (id) => (/^\d+$/.test(id) ? Number(id) : null) },
  });
  return { api, calls };
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("ride notes API lists and adds notes on the driver endpoint", async () => {
  let postStatus = 201;
  const { api, calls } = loadNotesApi({
    respond: (method) => method === "GET"
      ? json(200, { notes: [{ id: 1, author_role: "dispatch", author_name: "Dana", text: "Gate 1234", created_at: "2026-09-24T14:00:00Z" }] })
      : postStatus === 201
        ? json(201, { note: { id: 2, author_role: "tr", author_name: "Jordan", text: "On my way", created_at: "2026-09-24T14:05:00Z" } })
        : json(postStatus, { error: "Note text is required" }),
  });

  assert.equal(api.buildRideNotesPath("42"), "/api/rides/42/notes");

  const notes = await api.fetchRideNotes("42");
  assert.deepEqual(plain(notes.map((note) => [note.id, note.authorRole, note.text])), [["1", "dispatch", "Gate 1234"]]);
  assert.equal(calls[0].method, "GET");
  assert.equal(calls[0].path, "/api/rides/42/notes");
  assert.equal(calls[0].headers.Authorization, "Bearer token");

  const note = await api.addRideNote("42", "  On my way  ");
  assert.equal(note.id, "2");
  assert.equal(note.authorRole, "tr");
  assert.deepEqual(plain(calls[1]).body, { text: "On my way" });

  await assert.rejects(api.addRideNote("42", "   "), /Write a note first/);
  await assert.rejects(api.addRideNote("42", "x".repeat(2001)), /up to 2000 characters/);
  assert.equal(calls.length, 2);

  postStatus = 400;
  await assert.rejects(api.addRideNote("42", "hello"), /Note text is required/);
  postStatus = 404;
  await assert.rejects(api.addRideNote("42", "hello"), (error) => error.status === 404 && /no longer assigned/.test(error.message));
});

test("ride notes API surfaces network failures", async () => {
  const { api } = loadNotesApi({ respond: () => null });
  await assert.rejects(api.fetchRideNotes("42"), (error) => error.status === 0);
  await assert.rejects(api.addRideNote("42", "hello"), /Couldn't reach dispatch/);
});

test("demo mode serves seeded notes and appends added notes locally", async () => {
  const { api, calls } = loadNotesApi({ demo: true });
  assert.deepEqual((await api.fetchRideNotes("1027")).map((note) => note.id), ["d1"]);
  const added = await api.addRideNote("1027", "Arrived at entrance B", "Jordan Mitchell");
  assert.equal(added.authorRole, "tr");
  assert.equal(added.authorName, "Jordan Mitchell");
  assert.deepEqual((await api.fetchRideNotes("1027")).map((note) => note.text), ["Seed", "Arrived at entrance B"]);
  assert.deepEqual(plain(await api.fetchRideNotes("9999")), []);
  assert.equal(calls.length, 0);
});
