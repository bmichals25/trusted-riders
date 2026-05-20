import assert from "node:assert/strict";
import test from "node:test";

import { hasDetailedRoute, hasDrawableRoute, normalizeRouteGeometry } from "../lib/rides.ts";

test("does not treat endpoints as a detailed route", () => {
  assert.equal(
    hasDetailedRoute([
      { latitude: 40.1, longitude: -73.1 },
      { latitude: 40.2, longitude: -73.2 },
    ]),
    false,
  );
});

test("treats two coordinates as a drawable route", () => {
  assert.equal(
    hasDrawableRoute([
      { latitude: 40.1, longitude: -73.1 },
      { latitude: 40.2, longitude: -73.2 },
    ]),
    true,
  );
});

test("treats three or more coordinates as a detailed route", () => {
  assert.equal(
    hasDetailedRoute([
      { latitude: 40.1, longitude: -73.1 },
      { latitude: 40.15, longitude: -73.15 },
      { latitude: 40.2, longitude: -73.2 },
    ]),
    true,
  );
});

test("normalizes backend route arrays with lat/lon points", () => {
  assert.deepEqual(
    normalizeRouteGeometry([
      { lat: 40.1, lon: -73.1, timestamp: "2026-05-11T12:00:00Z" },
      { lat: 40.15, lon: -73.15, timestamp: "2026-05-11T12:03:00Z" },
      { lat: 40.2, lon: -73.2, timestamp: "2026-05-11T12:06:00Z" },
    ]),
    [
      { latitude: 40.1, longitude: -73.1 },
      { latitude: 40.15, longitude: -73.15 },
      { latitude: 40.2, longitude: -73.2 },
    ],
  );
});

test("normalizes nested geometry coordinates", () => {
  assert.deepEqual(
    normalizeRouteGeometry({
      geometry: {
        coordinates: [
          [-73.1, 40.1],
          [-73.15, 40.15],
        ],
      },
    }),
    [
      { latitude: 40.1, longitude: -73.1 },
      { latitude: 40.15, longitude: -73.15 },
    ],
  );
});

test("normalizes encoded polyline route geometry", () => {
  assert.deepEqual(
    normalizeRouteGeometry("_p~iF~ps|U_ulLnnqC_mqNvxq`@"),
    [
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ],
  );
});
