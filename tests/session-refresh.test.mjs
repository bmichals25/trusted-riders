// Expired TR sessions are renewed with the refresh token and the request retried once (2026-09-26: the app
// signed Marcus out 12 hours after sign-in because it never used its 7-day refresh token).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");

function loadTransport(fetchImpl) {
  const filename = path.join(root, "lib/fleet-api-transport.ts");
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  class ApiRequestThrottle {
    begin() { return true; }
    finish() {}
  }
  const context = {
    module,
    exports: module.exports,
    console: { log() {} },
    fetch: fetchImpl,
    Headers,
    Response,
    require(specifier) {
      if (specifier === "./api-request-throttle") return { ApiRequestThrottle };
      if (specifier === "./agreement-events") return { detectAgreementRequired: async () => {} };
      if (specifier === "./config") return { FLEET_API_URL: "https://api.test" };
      throw new Error(`unexpected import ${specifier}`);
    },
  };
  vm.runInNewContext(compiled, context, { filename });
  return module.exports;
}

const expired = () => new Response(JSON.stringify({ msg: "Token has expired" }), { status: 401, headers: { "content-type": "application/json" } });
const ok = () => new Response(JSON.stringify({ rides: [] }), { status: 200, headers: { "content-type": "application/json" } });
const auth = (init) => new Headers(init.headers).get("Authorization");

test("an expired session is renewed and the request retried once with the new token", async () => {
  const seen = [];
  const t = loadTransport(async (_url, init) => {
    seen.push(auth(init));
    return auth(init) === "Bearer new" ? ok() : expired();
  });
  const stale = [];
  t.setSessionRefresher(async (token) => { stale.push(token); return { kind: "refreshed", token: "new" }; });
  const { result, res } = await t.fleetFetch("GET", "/api/rides", { headers: { Authorization: "Bearer old" } });
  assert.equal(res.status, 200);
  assert.equal(result, "sent");
  assert.deepEqual(seen, ["Bearer old", "Bearer new"]);
  assert.deepEqual(stale, ["old"]);
});

test("a refused refresh leaves the 401 for the caller (sign in again)", async () => {
  let calls = 0;
  const t = loadTransport(async () => { calls += 1; return expired(); });
  t.setSessionRefresher(async () => ({ kind: "expired" }));
  const { res } = await t.fleetFetch("GET", "/api/rides", { headers: { Authorization: "Bearer old" } });
  assert.equal(res.status, 401);
  assert.equal(calls, 1);
});

test("offline during the refresh counts as a network failure and keeps the session", async () => {
  const t = loadTransport(async () => expired());
  t.setSessionRefresher(async () => ({ kind: "unavailable" }));
  const { result, res } = await t.fleetFetch("GET", "/api/rides", { headers: { Authorization: "Bearer old" } });
  assert.equal(res, null);
  assert.equal(result, "failed");
});

test("login, logout, unauthenticated calls and validation 422s never trigger a refresh", async () => {
  let refreshes = 0;
  const t = loadTransport(async (url) =>
    url.endsWith("/api/notes")
      ? new Response(JSON.stringify({ msg: "text is required" }), { status: 422, headers: { "content-type": "application/json" } })
      : expired(),
  );
  t.setSessionRefresher(async () => { refreshes += 1; return { kind: "refreshed", token: "new" }; });
  await t.fleetFetch("POST", "/api/login", { headers: {} });
  await t.fleetFetch("POST", "/api/logout", { headers: { Authorization: "Bearer old" } });
  await t.fleetFetch("GET", "/api/rides", { headers: {} });
  await t.fleetFetch("POST", "/api/notes", { headers: { Authorization: "Bearer old" } });
  assert.equal(refreshes, 0);
});

test("a 422 for an unverifiable token is a session failure", async () => {
  const t = loadTransport(async () => ok());
  const res = new Response(JSON.stringify({ msg: "Signature verification failed" }), { status: 422, headers: { "content-type": "application/json" } });
  assert.equal(await t.isSessionFailure(res), true);
});
