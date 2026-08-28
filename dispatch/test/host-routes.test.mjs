import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { handler as apiHandler } from "../netlify/functions/api.mjs";
import { handler as healthHandler } from "../netlify/functions/health.mjs";
import { handler as mcpHandler } from "../netlify/functions/mcp.mjs";
import { NOT_BACKEND_MESSAGE, SERVICE } from "../netlify/functions/_lib.mjs";

afterEach(() => {
  delete process.env.COMMIT_REF;
  delete process.env.CACHED_COMMIT_REF;
});

function parse(result) {
  return {
    status: result.statusCode,
    type: result.headers["Content-Type"],
    body: JSON.parse(result.body),
  };
}

test("GET /api/health returns JSON 200 with ok/service and sha when available", async () => {
  process.env.COMMIT_REF = "abc123def456";
  const { status, type, body } = parse(await healthHandler());

  assert.equal(status, 200);
  assert.match(type, /application\/json/);
  assert.equal(body.ok, true);
  assert.equal(body.service, SERVICE);
  assert.equal(body.sha, "abc123def456");
  assert.equal(body.message, undefined);
});

test("GET /api/health omits sha when no deploy ref is available", async () => {
  const { status, body } = parse(await healthHandler());

  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, SERVICE);
  assert.equal("sha" in body, false);
});

test("GET /api returns honest JSON 404 that this host is dispatch UI only", async () => {
  const { status, type, body } = parse(await apiHandler());

  assert.equal(status, 404);
  assert.match(type, /application\/json/);
  assert.equal(body.ok, false);
  assert.equal(body.error, "not_found");
  assert.equal(body.status, 404);
  assert.equal(body.service, SERVICE);
  assert.equal(body.message, NOT_BACKEND_MESSAGE);
});

test("GET /mcp returns honest JSON 501 that this host is not the fleet/MCP backend", async () => {
  const { status, type, body } = parse(await mcpHandler());

  assert.equal(status, 501);
  assert.match(type, /application\/json/);
  assert.equal(body.ok, false);
  assert.equal(body.error, "not_implemented");
  assert.equal(body.status, 501);
  assert.equal(body.service, SERVICE);
  assert.equal(body.message, NOT_BACKEND_MESSAGE);
});
