# Suresh Fleet API Inventory

Date checked: 2026-05-06

Base URL:

```text
https://trdev.tailff74b1.ts.net
```

This is the canonical backend for TrustedRiders mobile app data.

## Confirmed Live Endpoints

### `POST /api/login`

Status: deployed.

Allowed methods from `OPTIONS`: `OPTIONS, POST`.

Request the mobile app sends:

```json
{
  "email": "driver@example.com",
  "password": "password"
}
```

Expected success response shape from the mobile client:

```json
{
  "token": "jwt",
  "user": {
    "id": 1,
    "name": "Driver Name",
    "email": "driver@example.com"
  }
}
```

Observed behavior:

- `GET /api/login` returns `405 Method Not Allowed`.
- `POST /api/login` with invalid credentials returns `401` and `{"error":"Invalid credentials"}`.
- `POST /api/login` with `{}` returns `500`, so backend validation should be hardened.

### `POST /api/update_location`

Status: deployed.

Allowed methods from `OPTIONS`: `OPTIONS, POST`.

Auth: requires `Authorization: Bearer <JWT>`.

Request the mobile app sends:

```json
{
  "lat": 37.788,
  "lon": -122.408,
  "timestamp": "2026-05-06T19:33:50.000Z"
}
```

Notes:

- The backend should infer the driver/account from the JWT returned by
  `/api/login`.
- The app no longer sends `user_id`, `driver_id`, or `ride_id` in location
  updates.
- Foreground and background GPS both use this endpoint.
- Without auth, backend returns `401` and `{"msg":"Missing Authorization Header"}`.

### `GET /api/rides`

Status: canonical mobile ride list endpoint as of 2026-05-11 backend contract update.

Auth: requires `Authorization: Bearer <JWT>`.

Expected response shape: one summary row per ride. Each row must include
`ride_id`; the mobile app hydrates each row with `GET /api/rides/<ride_id>`.

```json
{
  "rides": [
    {
      "ride_id": 47,
      "status": "in_progress"
    }
  ]
}
```

Notes:

- The backend should infer the logged-in driver/account from the JWT returned
  by `/api/login`.
- The summary response can include extra fields; the mobile app merges them
  with the detail payload.
- If the summary response does not include pickup/dropoff addresses, the app
  expects `GET /api/rides/<ride_id>` to provide them.

### `GET /api/rides/<ride_id>`

Status: deployed and documented in `/Users/benmichals/Downloads/openapi (1).yaml`.

Observed response fields:

- `ride_id`
- `status`
- `start_time`
- `end_time`
- `distance_km`
- `duration_minutes`
- `pickup_address`
- `dropoff_address`
- `start.lat`
- `start.lon`
- `end.lat`
- `end.lon`
- `route[]` with `lat`, `lon`, `timestamp`
- `driver.id`
- `driver.name`
- `driver.location_lat`
- `driver.location_lon`

### `GET /api/rides/summary`

Status: deployed and documented in `/Users/benmichals/Downloads/openapi (1).yaml`.

Observed response fields:

- `active_rides`
- `avg_duration_minutes`
- `rides_today`
- `total_distance_km`
- `total_rides`

## Expected But Not Currently Deployed

### `GET /api/me`

Status: requested in ClickUp task `86b9tv6fa`, but not currently deployed.

Auth: should require `Authorization: Bearer <JWT>` and return only the logged-in driver.

Mobile needs this to replace remaining operator drawer/settings placeholders:

- operator credential ID
- driver status
- certified-since date
- certification names/statuses/issue dates/expiry dates
- registered vehicle summary
- profile photo URL
- QR verification URL or signed QR payload

Recommended response shape:

```json
{
  "id": 1,
  "name": "Driver Name",
  "email": "driver@example.com",
  "operator_id": "099-242",
  "status": "active",
  "certified_since": "2024-03-01",
  "certifications": [],
  "vehicle": null,
  "profile_photo_url": null,
  "qr_verification_url": null,
  "qr_verification_token": null
}
```

### `POST /api/register-push-token`

Status: mobile app has a client and backend contract doc, but live backend currently returns `404`.

Auth: should require `Authorization: Bearer <JWT>`.

Request the mobile app sends:

```json
{
  "push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ios"
}
```

Expected response:

```json
{ "ok": true }
```

Recommended backend fields:

- `drivers.push_token`
- `drivers.push_platform`
- `drivers.push_token_updated_at`

## Mobile Ride Normalization

Ride fields the app can currently consume:

- `id`, `ride_id`, `rideId`, or `uuid`
- `passenger_name`, `rider_name`, `passengerName`, `client_name`, `customer_name`, or `name`
- `pickup_address`, `pickupAddress`, or `pickup`
- `dropoff_address`, `dropoffAddress`, `destination_address`, or `dropoff`
- `pickupCoords` or `pickup_coords` with `latitude`/`longitude` or `lat`/`lon`/`lng`
- `dropoffCoords` or `dropoff_coords` with `latitude`/`longitude` or `lat`/`lon`/`lng`
- `pickup_latitude` or `pickup_lat`
- `pickup_longitude`, `pickup_lon`, or `pickup_lng`
- `dropoff_latitude` or `dropoff_lat`
- `dropoff_longitude`, `dropoff_lon`, or `dropoff_lng`
- `pickup_date`, `scheduled_date`, `scheduledDate`, `ride_date`, or `date`
- `pickup_time`, `scheduled_time`, `scheduledTime`, `ride_time`, or `time`
- `transit_type`, `transitType`, `vehicle_type`, or `vehicle`
- `trip_type`, `tripType`, or `ride_type`
- `notes`, `care_notes`, or `special_instructions`
- `emergency_contact`, `emergencyContact`, or `contact_phone`
- `status` or `ride_status`
- `created_at` or `createdAt`

Supported ride statuses in the app:

- `pending`
- `accepted`
- `en_route`
- `picked_up`
- `in_transit`
- `completed`
- `cancelled`

The app also normalizes common backend status names:

- `requested`, `request`, `pending`, `new` -> `pending`
- `scheduled`, `booked`, `assigned`, `accepted` -> `accepted`
- `active`, `in_progress`, `en_route`, `enroute`, `on_way`, `released` -> `en_route`
- `picked_up`, `pickedup` -> `picked_up`
- `in_transit`, `intransit` -> `in_transit`
- `completed`, `complete`, `done` -> `completed`
- `cancelled`, `canceled`, `declined` -> `cancelled`

## Admin-Only Ride Mutation Routes

Documented in `/Users/benmichals/Downloads/openapi_admin.yaml`.

- `PATCH /api/admin/rides/<ride_id>`
- `POST /api/admin/rides/<ride_id>/complete`
- `POST /api/admin/rides/<ride_id>/cancel`
- `POST /api/admin/rides/<ride_id>/assign-driver`

Admin ride update body can include:

- `driver_id`
- `status`
- `start_lat`
- `start_lon`
- `end_lat`
- `end_lon`
- `end_time`

There is no documented driver-facing ride status mutation endpoint yet.

## Previously Guessed But Not In The Spec

### `GET /api/rides`

Status: not documented and live backend returns `404`.

### `PATCH /api/rides/<id>/status`

Status: not documented and live backend returns `404`.

The app should not rely on this unless Suresh adds a driver-facing status endpoint.

## Docs Discovery

These doc/schema routes were checked and currently return `404`:

- `/openapi.json`
- `/swagger.json`
- `/api/docs`
- `/docs`
- `/apidocs`
- `/swagger`
- `/redoc`

## Questions For Suresh

- Can ride detail include passenger/rider name, transit type, trip type, care notes, and emergency contact?
- What statuses does the backend use for requested, scheduled, released, active, completed, and cancelled rides?
- What driver-facing endpoint should the app call to accept, decline, start, complete, or cancel rides?
- Should location updates include only `lat`, `lon`, `timestamp`, and `ride_id`, or can we also send heading, speed, battery, and accuracy?
- Should the push token endpoint be added at `/api/register-push-token`, or does another route already exist?
- Can Suresh expose an OpenAPI/Swagger JSON route so we can keep the mobile API client aligned automatically?
