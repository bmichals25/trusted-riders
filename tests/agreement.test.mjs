// Trusted Rider agreement (BEN-20): markdown subset, API contract and the agreement_required signal.
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
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  const context = {
    Response,
    console,
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

test("agreement markdown renders headings, paragraphs, bullets, numbers, callouts and bold", () => {
  const md = loadTsModule("lib/agreement-markdown.ts");
  const blocks = plain(md.parseAgreementMarkdown([
    "> **DRAFT: placeholder text.** Do not rely on it.",
    "",
    "# Trusted Rider Agreement",
    "",
    "As a Trusted Rider you accompany",
    "passengers to appointments.",
    "",
    "## 1. Your role",
    "",
    "- Stay with your passenger.",
    "* Never leave them **alone**.",
    "2. Numbered item",
    "### Small heading",
    "Plain **unclosed bold",
  ].join("\r\n")));

  assert.deepEqual(blocks, [
    { type: "callout", spans: [{ text: "DRAFT: placeholder text.", bold: true }, { text: " Do not rely on it.", bold: false }] },
    { type: "heading", level: 1, spans: [{ text: "Trusted Rider Agreement", bold: false }] },
    { type: "paragraph", spans: [{ text: "As a Trusted Rider you accompany passengers to appointments.", bold: false }] },
    { type: "heading", level: 2, spans: [{ text: "1. Your role", bold: false }] },
    { type: "bullet", spans: [{ text: "Stay with your passenger.", bold: false }] },
    { type: "bullet", spans: [{ text: "Never leave them ", bold: false }, { text: "alone", bold: true }, { text: ".", bold: false }] },
    { type: "numbered", number: "2", spans: [{ text: "Numbered item", bold: false }] },
    { type: "heading", level: 3, spans: [{ text: "Small heading", bold: false }] },
    { type: "paragraph", spans: [{ text: "Plain **unclosed bold", bold: false }] },
  ]);
  assert.deepEqual(plain(md.parseAgreementMarkdown("")), []);
});

test("agreement_required 403 bodies notify listeners; other responses don't", async () => {
  const events = loadTsModule("lib/agreement-events.ts");
  let calls = 0;
  const unsubscribe = events.onAgreementRequired(() => {
    calls += 1;
  });

  const required = new Response(
    JSON.stringify({ error: "Please review and accept the Trusted Rider agreement in the app first.", code: "agreement_required" }),
    { status: 403, headers: { "Content-Type": "application/json" } },
  );
  assert.equal(await events.detectAgreementRequired(required), true);
  assert.equal(calls, 1);
  // The original response body is still readable by the caller.
  assert.equal((await required.json()).code, "agreement_required");

  assert.equal(await events.detectAgreementRequired(new Response(JSON.stringify({ error: "Not a driver account" }), { status: 403 })), false);
  assert.equal(await events.detectAgreementRequired(new Response("<html>nope</html>", { status: 403 })), false);
  assert.equal(await events.detectAgreementRequired(new Response(JSON.stringify({ code: "agreement_required" }), { status: 400 })), false);
  assert.equal(calls, 1);

  unsubscribe();
  events.notifyAgreementRequired();
  assert.equal(calls, 1);
  assert.equal(events.isAgreementRequiredBody({ code: "agreement_required" }), true);
  assert.equal(events.isAgreementRequiredBody(null), false);
});

function loadAgreementApi(fetchImpl, { token = "token" } = {}) {
  const cleared = [];
  const api = loadTsModule("lib/agreement-api.ts", {
    "./demo-mode": { DEMO_MODE: false },
    "./fleet-api": { getToken: () => token, clearToken: async () => cleared.push(true) },
    "./fleet-api-transport": {
      fleetFetch: async (method, requestPath, init) => {
        const res = await fetchImpl(method, requestPath, init);
        return { result: res ? (res.ok ? "sent" : "failed") : "failed", res };
      },
      readApiErrorMessage: async (res) => {
        try {
          return (await res.clone().json()).error ?? null;
        } catch {
          return null;
        }
      },
    },
  });
  return { api, cleared };
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const AGREEMENT_BODY = {
  version: "2026-09-draft-1",
  title: "Trusted Rider Chaperone & Privacy Agreement",
  body_markdown: "# Title\n",
  accepted: false,
  accepted_at: null,
};

test("fetchAgreement reads GET /api/me/agreement and maps its fields", async () => {
  const requests = [];
  const { api } = loadAgreementApi(async (method, requestPath, init) => {
    requests.push({ method, requestPath, auth: init.headers.Authorization });
    return json(200, AGREEMENT_BODY);
  });
  const result = plain(await api.fetchAgreement());
  assert.deepEqual(requests, [{ method: "GET", requestPath: "/api/me/agreement", auth: "Bearer token" }]);
  assert.deepEqual(result, {
    kind: "ok",
    agreement: {
      version: "2026-09-draft-1",
      title: "Trusted Rider Chaperone & Privacy Agreement",
      bodyMarkdown: "# Title\n",
      accepted: false,
      acceptedAt: null,
    },
  });
});

test("fetchAgreement signs out on 401 and fails open (unavailable) on other errors", async () => {
  const expired = loadAgreementApi(async () => json(401, { msg: "Token has expired" }));
  assert.equal((await expired.api.fetchAgreement()).kind, "signed_out");
  assert.equal(expired.cleared.length, 1);

  for (const res of [null, json(404, { error: "Not found" }), json(500, {}), json(200, { title: "no version" })]) {
    const { api } = loadAgreementApi(async () => res);
    assert.equal((await api.fetchAgreement()).kind, "unavailable");
  }

  const noToken = loadAgreementApi(async () => assert.fail("no request without a token"), { token: null });
  assert.equal((await noToken.api.fetchAgreement()).kind, "signed_out");
});

test("acceptAgreement posts the version and handles outdated text", async () => {
  let sent = null;
  const ok = loadAgreementApi(async (method, requestPath, init) => {
    sent = { method, requestPath, body: JSON.parse(init.body) };
    return json(200, { ...AGREEMENT_BODY, accepted: true, accepted_at: "2026-09-24T19:00:00Z" });
  });
  const accepted = plain(await ok.api.acceptAgreement("2026-09-draft-1"));
  assert.deepEqual(sent, { method: "POST", requestPath: "/api/me/agreement/accept", body: { version: "2026-09-draft-1" } });
  assert.equal(accepted.kind, "ok");
  assert.equal(accepted.agreement.acceptedAt, "2026-09-24T19:00:00Z");

  const outdated = loadAgreementApi(async () => json(400, { code: "agreement_version_mismatch", current_version: "v2" }));
  assert.equal((await outdated.api.acceptAgreement("2026-09-draft-1")).kind, "outdated");

  const failed = loadAgreementApi(async () => json(500, { error: "Boom" }));
  assert.deepEqual(plain(await failed.api.acceptAgreement("v")), { kind: "error", message: "Boom" });

  const offline = loadAgreementApi(async () => null);
  assert.equal((await offline.api.acceptAgreement("v")).kind, "error");
});
