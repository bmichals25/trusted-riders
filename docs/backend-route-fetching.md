# Backend Route + Coordinate Handoff

This document explains how the current TrustedRiders mobile app receives,
normalizes, caches, and draws route coordinates from the backend. It is written
for a dispatch app developer who needs to match the mobile app's current route
contract.

Review date: 2026-05-20

---

## Short answer

The mobile app does not call a separate `/routes` endpoint. It pulls route
geometry from ride detail:

```http
GET /api/rides/<ride_id>
Authorization: Bearer <JWT>
```

The preferred backend field is:

```json
{
  "route": [
    { "lat": 40.7229, "lon": -73.9887 },
    { "lat": 40.7391, "lon": -73.9914 },
    { "lat": 40.7736, "lon": -73.9821 }
  ]
}
```

The app normalizes that into:

```ts
type RideCoordinate = {
  latitude: number;
  longitude: number;
};

routeCoords: RideCoordinate[];
```

Two valid points are enough to draw a polyline. Three or more points are better
because they show an actual road-following route instead of a straight segment.

---

## Current repository state

The current app layout uses Expo Router tabs:

- `app/(tabs)/index.tsx` draws the active ride card and mini-map.
- `app/ride-details.tsx` draws the pending/request detail map.
- `lib/dispatch-context.tsx` owns ride refresh state and merges sparse updates.
- `lib/fleet-api.ts` fetches rides and ride details from the backend.
- `lib/rides.ts` normalizes route geometry.
- `components/Map.tsx` re-exports `react-native-maps` for native.
- `components/Map.web.tsx` adapts the same `MapView`, `Marker`, and `Polyline`
  API onto Leaflet for web.

Important current-state note: the old standalone `dispatch/` web app directory
is not present in this working tree at review time. The route behavior below is
based on the current mobile app files listed above.

---

## Backend base URL

The app reads the backend URL from `EXPO_PUBLIC_FLEET_API_URL`.

Default:

```text
https://trdev.tailff74b1.ts.net
```

The value is trimmed so trailing slashes do not matter.

Source: `lib/config.ts`

```ts
export const FLEET_API_URL = (
  process.env.EXPO_PUBLIC_FLEET_API_URL ?? "https://trdev.tailff74b1.ts.net"
).replace(/\/+$/, "");
```

---

## Fetch pipeline

### 1. Login stores JWT

The app gets a JWT from:

```http
POST /api/login
```

The JWT is stored under `trustedriders-auth-token` and later used in:

```http
Authorization: Bearer <JWT>
```

### 2. DispatchProvider refreshes rides

`DispatchProvider` calls `refreshRides()`:

- once on mount
- every 30 seconds
- when screens call `refreshRides()` manually

Source: `lib/dispatch-context.tsx`

```ts
useEffect(() => {
  void refreshRides();
  const interval = setInterval(() => {
    void refreshRides();
  }, 30000);

  return () => clearInterval(interval);
}, [refreshRides]);
```

### 3. fetchRides calls the ride list endpoint

`fetchRides()` calls:

```http
GET /api/rides
Authorization: Bearer <JWT>
```

Accepted list response shapes:

```json
[
  { "ride_id": 47, "status": "in_progress" }
]
```

or:

```json
{
  "rides": [
    { "ride_id": 47, "status": "in_progress" }
  ]
}
```

or:

```json
{
  "data": [
    { "ride_id": 47, "status": "in_progress" }
  ]
}
```

Each summary ride should include one of:

- `id`
- `ride_id`
- `rideId`
- `uuid`

### 4. fetchRides hydrates each ride with detail

For every summary ride with an id, the app calls:

```http
GET /api/rides/<ride_id>
Authorization: Bearer <JWT>
```

The app converts local ids such as `ride-47` or `#47` to backend id `47` before
building the URL.

Accepted detail response wrappers:

```json
{ "ride": { "ride_id": 47, "route": [] } }
```

```json
{ "data": { "ride_id": 47, "route": [] } }
```

```json
{ "result": { "ride_id": 47, "route": [] } }
```

or a bare ride object:

```json
{ "ride_id": 47, "route": [] }
```

### 5. Summary and detail are merged

The app merges summary and detail with detail taking most fields:

```ts
const merged = { ...summary, ...(detail ?? {}) };
```

One exception: if the summary has `status` or `ride_status`, summary status
wins. This keeps the list status fresh even if cached detail is stale.

---

## Detail caching and stale-route behavior

Ride detail is cached in memory for 60 seconds.

Successful detail responses are also persisted locally for 24 hours.

If `GET /api/rides/<ride_id>` fails, the app may still use:

1. the existing in-memory detail for that ride
2. the persisted 24-hour detail
3. a temporary hard-coded fallback for ride `174`

This matters for dispatch: if a ride's route changes after it was first loaded,
the mobile app may continue drawing the previous route until the memory cache
expires or a successful refresh replaces persisted detail.

Source: `lib/fleet-api.ts`

```ts
const RIDE_DETAIL_CACHE_MS = 60 * 1000;
const PERSISTED_RIDE_DETAIL_CACHE_MS = 24 * 60 * 60 * 1000;
```

---

## Recommended backend ride detail schema

Use this shape for best compatibility:

```json
{
  "ride_id": 47,
  "status": "in_progress",
  "pickup_address": "205 E Houston St, New York, NY 10002",
  "dropoff_address": "1998 Broadway, New York, NY 10023",
  "start": {
    "lat": 40.7229,
    "lon": -73.9887
  },
  "end": {
    "lat": 40.7736,
    "lon": -73.9821
  },
  "route": [
    { "lat": 40.7229, "lon": -73.9887 },
    { "lat": 40.7391, "lon": -73.9914 },
    { "lat": 40.7736, "lon": -73.9821 }
  ],
  "driver": {
    "id": 1,
    "name": "Driver Name",
    "location_lat": 40.7229,
    "location_lon": -73.9887
  }
}
```

`timestamp` may be included per route point, but the current map drawing code
does not use it:

```json
{ "lat": 40.7229, "lon": -73.9887, "timestamp": "2026-05-20T14:00:00Z" }
```

---

## Accepted pickup and dropoff coordinate fields

Pickup coordinates are read from:

- `pickupCoords`
- `pickup_coords`
- `start`
- `pickup_latitude` + `pickup_longitude`
- `pickup_lat` + `pickup_lon`
- `pickup_lat` + `pickup_lng`

Dropoff coordinates are read from:

- `dropoffCoords`
- `dropoff_coords`
- `end`
- `dropoff_latitude` + `dropoff_longitude`
- `dropoff_lat` + `dropoff_lon`
- `dropoff_lat` + `dropoff_lng`

Preferred:

```json
{
  "start": { "lat": 40.7229, "lon": -73.9887 },
  "end": { "lat": 40.7736, "lon": -73.9821 }
}
```

---

## Accepted route fields

The app checks route candidates in this order and uses the first candidate that
normalizes to more than one valid coordinate:

1. `routeCoords`
2. `route_coords`
3. `plannedRoute`
4. `planned_route`
5. `plannedPolyline`
6. `planned_polyline`
7. `planned_route_geometry`
8. `plannedRouteGeometry`
9. `routePoints`
10. `route_points`
11. `routeHistory`
12. `route_history`
13. `driverRoute`
14. `driver_route`
15. `routeGeometry`
16. `route_geometry`
17. `routePolyline`
18. `route_polyline`
19. `route`

Although many fields are accepted, the dispatch/backend contract should
standardize on `route`.

Important priority detail: if both `planned_route` and `route` are present, the
app currently prefers `planned_route` because it appears earlier in the
candidate list.

---

## Accepted route value formats

### Array of coordinate objects

Preferred:

```json
{
  "route": [
    { "lat": 40.7229, "lon": -73.9887 },
    { "lat": 40.7391, "lon": -73.9914 },
    { "lat": 40.7736, "lon": -73.9821 }
  ]
}
```

Also accepted:

```json
{
  "route": [
    { "latitude": 40.7229, "longitude": -73.9887 },
    { "latitude": 40.7391, "longitude": -73.9914 }
  ]
}
```

and:

```json
{
  "route": [
    { "lat": 40.7229, "lng": -73.9887 },
    { "lat": 40.7391, "lng": -73.9914 }
  ]
}
```

### Array coordinate pairs

The app accepts coordinate pairs:

```json
{
  "route": [
    [-73.9887, 40.7229],
    [-73.9914, 40.7391]
  ]
}
```

For arrays, the parser tries GeoJSON order first: `[longitude, latitude]`.

Use object points if possible. They are less ambiguous than coordinate arrays.

### Nested route objects

The app accepts route objects where coordinates are nested under one of:

- `coordinates`
- `coords`
- `points`
- `path`
- `route`
- `geometry`

Example:

```json
{
  "route_geometry": {
    "coordinates": [
      { "lat": 40.7229, "lon": -73.9887 },
      { "lat": 40.7391, "lon": -73.9914 }
    ]
  }
}
```

### Encoded polyline strings

The app accepts encoded polyline strings directly:

```json
{
  "route_polyline": "g_nwFxmubMeAcAKMIPq@fB_AxBgBlEWn@"
}
```

It also accepts polyline strings nested under:

- `polyline`
- `encoded_polyline`
- `encodedPolyline`
- `overview_polyline`
- `overviewPolyline`

and Google-style:

```json
{
  "route": {
    "overview_polyline": {
      "points": "g_nwFxmubMeAcAKMIPq@fB_AxBgBlEWn@"
    }
  }
}
```

JSON coordinate arrays are still preferred for dispatch/backend debugging.

---

## Coordinate validation

The app drops invalid route points.

A coordinate is valid only if:

```ts
latitude >= -90 &&
latitude <= 90 &&
longitude >= -180 &&
longitude <= 180
```

If fewer than two valid points remain after normalization, the app treats the
route as not drawable.

---

## Drawing behavior in the app

The current map components draw the route the same basic way in the home card
and ride details screen.

### Route selection for drawing

The app chooses:

1. `ride.routeCoords` if it has at least two valid points.
2. Otherwise `[ride.pickupCoords, ride.dropoffCoords]` if both exist.
3. Otherwise it shows a placeholder message instead of a map.

Current code shape:

```ts
const coords = hasDrawableRoute(ride.routeCoords)
  ? ride.routeCoords
  : [ride.pickupCoords, ride.dropoffCoords].filter((coord): coord is RideCoordinate => !!coord);

if (!hasDrawableRoute(coords)) {
  return <Placeholder />;
}
```

### Polyline drawing

Native app:

```tsx
<Polyline coordinates={coords} strokeWidth={4} strokeColor={colors.blue} />
```

Web adapter:

```tsx
<LeafletPolyline
  positions={coordinates.map((coord) => [coord.latitude, coord.longitude])}
  pathOptions={{ color: strokeColor ?? "#2563eb", weight: strokeWidth ?? 3 }}
/>
```

Pickup and dropoff pins are drawn only from `pickupCoords` and `dropoffCoords`.
The first and last route points are not used as marker positions unless they are
also supplied as pickup/dropoff coordinates.

### Region fitting

The current home mini-map and ride detail map calculate an initial bounding
region from the chosen coordinates:

```ts
latitude: (minLat + maxLat) / 2,
longitude: (minLng + maxLng) / 2,
latitudeDelta: Math.max((maxLat - minLat) * 1.8, 0.025),
longitudeDelta: Math.max((maxLng - minLng) * 1.8, 0.025),
```

The mini-maps are non-interactive:

```tsx
scrollEnabled={false}
zoomEnabled={false}
rotateEnabled={false}
pitchEnabled={false}
```

---

## Current fallback behavior

There is no active client-side directions service in this working tree. The old
`lib/directions-service.ts` and `lib/use-directions.ts` files are deleted in the
current status.

That means current route drawing is backend-first:

1. If backend detail provides route geometry, draw that route.
2. If route geometry is missing but pickup and dropoff coordinates exist, draw a
   straight line between pickup and dropoff.
3. If pickup/dropoff coordinates are also missing, show the placeholder.

For dispatch, this means backend-provided route geometry is the only way to get
a true road-following path in the current app.

---

## Sparse updates are intentionally protected

`DispatchProvider` protects previously loaded coordinates and route geometry
from being erased by later sparse backend responses.

When a refreshed ride is missing route data but the previous in-memory ride had
a drawable route, the app keeps the previous route:

```ts
routeCoords: nextHasRoute || !previousHasRoute ? next.routeCoords : previous.routeCoords
```

It also keeps previous pickup/dropoff coordinates if the new response omits
them.

This is helpful when backend list responses are sparse, but it means dispatch
developers should not assume clearing `route` to `[]` will immediately erase an
already loaded route in the UI.

---

## Recommended dispatch/backend contract

For every ride that has been submitted and processed, return:

```json
{
  "ride_id": 47,
  "status": "in_progress",
  "pickup_address": "205 E Houston St, New York, NY 10002",
  "dropoff_address": "1998 Broadway, New York, NY 10023",
  "start": { "lat": 40.7229, "lon": -73.9887 },
  "end": { "lat": 40.7736, "lon": -73.9821 },
  "route": [
    { "lat": 40.7229, "lon": -73.9887 },
    { "lat": 40.7288, "lon": -73.9901 },
    { "lat": 40.7391, "lon": -73.9914 },
    { "lat": 40.7554, "lon": -73.9870 },
    { "lat": 40.7736, "lon": -73.9821 }
  ]
}
```

Rules of thumb:

- Use `route` as the canonical route field.
- Use `{ "lat": number, "lon": number }` point objects.
- Include `start` and `end` even when `route` exists, because markers use
  pickup/dropoff coordinates.
- Return at least two valid route points.
- Return three or more route points for a real path.
- Do not send `[lat, lon]` arrays unless necessary; if arrays are used, prefer
  GeoJSON `[lon, lat]`.
- Keep route detail scoped to the authenticated driver.

---

## Processing lifecycle after ride submission

If route computation is asynchronous, the backend can return an empty route
while processing:

```json
{
  "ride_id": 47,
  "status": "submitted",
  "start": { "lat": 40.7229, "lon": -73.9887 },
  "end": { "lat": 40.7736, "lon": -73.9821 },
  "route": []
}
```

After processing completes, the same endpoint should return route geometry:

```json
{
  "ride_id": 47,
  "status": "in_progress",
  "start": { "lat": 40.7229, "lon": -73.9887 },
  "end": { "lat": 40.7736, "lon": -73.9821 },
  "route": [
    { "lat": 40.7229, "lon": -73.9887 },
    { "lat": 40.7391, "lon": -73.9914 },
    { "lat": 40.7736, "lon": -73.9821 }
  ]
}
```

Because the app refreshes rides every 30 seconds and caches detail for 60
seconds, route updates may take up to roughly a minute to appear unless the user
manually refreshes and the detail cache has expired.

---

## Implementation checklist for the dispatch app developer

To match the mobile app:

- Call `GET /api/rides` with the driver's bearer token.
- For each visible ride, call `GET /api/rides/<ride_id>`.
- Accept detail wrapped in `ride`, `data`, `result`, or as a bare object.
- Normalize `route` into `{ latitude, longitude }[]`.
- Use route geometry only when at least two valid points exist.
- Fall back to `[start, end]` or `[pickupCoords, dropoffCoords]` for a straight
  line if route geometry is missing.
- Draw pickup and dropoff markers from `start`/`end`, not from route endpoints.
- Preserve the last known route if a later sparse refresh omits route geometry.
- Prefer `route` over compatibility field names for any new backend work.

---

## Debugging tips

The mobile app logs route candidate counts while fetching:

```text
[api] /api/rides/47 route detail route:12
```

or:

```text
[api] /api/rides/47 route detail no-route-fields keys=ride_id|status|start|end
```

Useful files to compare against:

- `lib/fleet-api.ts`
- `lib/rides.ts`
- `lib/dispatch-context.tsx`
- `app/(tabs)/index.tsx`
- `app/ride-details.tsx`
- `components/Map.web.tsx`

---

## Review findings

1. There is no separate route endpoint in the current mobile app; route data is
   hydrated from `GET /api/rides/<ride_id>`.
2. There is no current client-side road-route fallback. Without backend route
   geometry, the app draws a straight pickup-to-dropoff line.
3. The route candidate priority means `planned_route` or `planned_polyline` can
   override `route` if both are present. Dispatch/backend should avoid sending
   competing route fields with different geometry.
4. Pickup/dropoff markers require explicit pickup/dropoff coordinates. Route
   endpoints alone draw the line but do not create pickup/dropoff marker data.
5. Sparse refresh protection and persisted detail caching can keep an older
   route visible after a later sparse or failed detail response.
