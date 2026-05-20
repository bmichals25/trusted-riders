import assert from "node:assert/strict";
import test from "node:test";

import { mergeRideSummaryAndDetail } from "../lib/rides.ts";

test("keeps the fresh ride list status when cached detail has an older status", () => {
  assert.deepEqual(
    mergeRideSummaryAndDetail(
      {
        ride_id: 168,
        status: "in_progress",
      },
      {
        ride_id: 168,
        status: "accepted",
        pickup_address: "100 Main St",
      },
    ),
    {
      ride_id: 168,
      status: "in_progress",
      pickup_address: "100 Main St",
    },
  );
});

test("uses ride_status from the fresh ride list over cached detail status", () => {
  assert.deepEqual(
    mergeRideSummaryAndDetail(
      {
        ride_id: 168,
        ride_status: "in_progress",
      },
      {
        ride_id: 168,
        status: "accepted",
        pickup_address: "100 Main St",
      },
    ),
    {
      ride_id: 168,
      ride_status: "in_progress",
      status: "in_progress",
      pickup_address: "100 Main St",
    },
  );
});
