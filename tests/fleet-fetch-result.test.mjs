import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldSuppressRideErrorPanel,
  shouldSuppressRideFetchError,
} from "../lib/fleet-fetch-result.ts";

test("suppresses ride fetch errors for internally skipped requests", () => {
  assert.equal(shouldSuppressRideFetchError("skipped"), true);
  assert.equal(shouldSuppressRideFetchError("paused"), true);
});

test("keeps ride fetch errors visible for real network failures", () => {
  assert.equal(shouldSuppressRideFetchError("failed"), false);
});

test("suppresses the ride error panel for status zero fetch failures", () => {
  assert.equal(shouldSuppressRideErrorPanel(0), true);
});

test("keeps the ride error panel visible for actionable backend statuses", () => {
  assert.equal(shouldSuppressRideErrorPanel(401), false);
  assert.equal(shouldSuppressRideErrorPanel(403), false);
  assert.equal(shouldSuppressRideErrorPanel(500), false);
});
