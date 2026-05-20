# TrustedRiders Backend Handoff: Ride Admin Chat

**Status:** Ready for backend implementation  
**Updated:** 2026-05-15  
**Target backend:** Suresh's Flask fleet API, `https://trdev.tailff74b1.ts.net`

This document is for the backend developer implementing real ride chat in the
TrustedRiders Flask API. The driver mobile app is already wired and tested
against this contract using a temporary LAN Flask server. If the production API
keeps the routes and JSON shapes below, the mobile app should work without
frontend changes other than pointing the chat base URL at the real backend.

## Goal

Add backend-owned ride admin chat so drivers and dispatch/admin users can chat
on a specific ride.

The chat must:

- Be keyed by canonical `ride_id`.
- Work for pending/unaccepted rides, accepted rides, active rides, cancelled
  rides, and completed/past rides.
- Persist messages in the real backend database for retrieval later.
- Support normal text messages.
- Support structured mission/checkpoint updates sent by the driver app.
- Support typing indicators and read receipts.
- Return response JSON compatible with the temporary backend contract.

## Existing Temporary Backend

The temporary implementation in this repo is intentionally packaged as a Flask
blueprint and can be copied as a reference:

```text
temp_chat_backend/
temp_chat_backend/trustedriders_chat/blueprint.py
temp_chat_backend/trustedriders_chat/store.py
```

Blueprint registration pattern:

```python
from trustedriders_chat import chat_bp

app.register_blueprint(chat_bp)
```

For production, replace the temporary store with database models and real
authentication/authorization. Do not use process memory as the source of truth.

## Base Path

All routes should live under:

```text
/api/chat
```

## Message Object Contract

Every message returned by the API must use this shape:

```json
{
  "id": "server-generated-message-id",
  "ride_id": "102",
  "text": "Hello",
  "sender": "driver",
  "sender_name": "Driver",
  "client_message_id": "driver-1778870000000",
  "metadata": {},
  "created_at": "2026-05-15T19:01:51.595224Z"
}
```

Required fields:

- `id`: server-generated stable id, string preferred.
- `ride_id`: string in JSON, even if database id is numeric.
- `text`: message body.
- `sender`: one of `driver`, `dispatch`, `admin`, `system`.
- `sender_name`: nullable display name.
- `client_message_id`: nullable id supplied by client for idempotency.
- `metadata`: JSON object. Return `{}` when empty.
- `created_at`: UTC ISO timestamp ending in `Z`.

Allowed sender values:

```text
driver
dispatch
admin
system
```

Production security note: the backend should derive or validate `sender` from
the authenticated user's role. A driver must not be allowed to spoof
`sender: "admin"` or `sender: "dispatch"`.

## Required Routes

### List Messages

```http
GET /api/chat/rides/<ride_id>/messages
GET /api/chat/rides/<ride_id>/messages?after_id=<last_seen_message_id>
GET /api/chat/rides/<ride_id>/messages?after_id=<last_seen_message_id>&limit=100
Authorization: Bearer <jwt>
```

Response:

```json
{
  "ride_id": "102",
  "messages": [
    {
      "id": "6bcd4a5d26f342fb89d7a0bd2e26109a",
      "ride_id": "102",
      "text": "Running five minutes late.",
      "sender": "driver",
      "sender_name": "Driver",
      "client_message_id": "driver-1778870000000",
      "metadata": {},
      "created_at": "2026-05-15T19:01:51.595224Z"
    }
  ]
}
```

Behavior:

- Sort oldest to newest.
- Return `{"ride_id":"102","messages":[]}` when no messages exist.
- `after_id` returns only messages created after that message.
- If `after_id` is unknown, returning `[]` is acceptable.
- Recommended default `limit`: `100`.
- Recommended max `limit`: `500`.
- This endpoint must work after ride completion. Do not hide completed ride
  chat history.

### Create Message

```http
POST /api/chat/rides/<ride_id>/messages
Content-Type: application/json
Authorization: Bearer <jwt>
```

Request:

```json
{
  "text": "Running five minutes late.",
  "sender": "driver",
  "sender_name": "Driver",
  "client_message_id": "driver-1778870000000",
  "metadata": {}
}
```

Response status: `201 Created`

Response:

```json
{
  "message": {
    "id": "server-generated-message-id",
    "ride_id": "102",
    "text": "Running five minutes late.",
    "sender": "driver",
    "sender_name": "Driver",
    "client_message_id": "driver-1778870000000",
    "metadata": {},
    "created_at": "2026-05-15T19:01:51.595224Z"
  }
}
```

Validation:

- `text` is required.
- Trim whitespace.
- Reject empty messages.
- Recommended max text length: `2000` for normal messages.
- For structured checkpoint JSON, allow a larger safe limit such as `12000`.
- `metadata` must be a JSON object when provided.
- `sender_name` and `client_message_id` are optional.
- Return `400` for validation errors.

Recommended error shape:

```json
{
  "error": "text is required"
}
```

Idempotency:

- If `client_message_id` is present, enforce uniqueness on
  `(ride_id, client_message_id)`.
- On duplicate retry, return the previously-created message instead of creating
  a second row.

## Chat Status: Typing + Read Receipts

The mobile app calls `/status` every few seconds while chat is open. This route
is required for iMessage-style typing dots and read receipts.

### Get Chat Status

```http
GET /api/chat/rides/<ride_id>/status
Authorization: Bearer <jwt>
```

Response:

```json
{
  "ride_id": "102",
  "typing": [
    {
      "sender": "dispatch",
      "sender_name": "Dispatch",
      "is_typing": true,
      "updated_at": "2026-05-15T19:01:51.581916Z",
      "expires_at_ms": 1778871716581
    }
  ],
  "read_receipts": {
    "driver": {
      "sender": "driver",
      "sender_name": "Driver",
      "last_read_message_id": "server-message-id",
      "read_at": "2026-05-15T19:01:51.595224Z"
    }
  }
}
```

Behavior:

- `typing` is an array of active typing states.
- Expire typing states automatically after about 5 seconds.
- `read_receipts` is an object keyed by sender.
- Return empty structures if no status exists:

```json
{
  "ride_id": "102",
  "typing": [],
  "read_receipts": {}
}
```

### Set Typing State

```http
POST /api/chat/rides/<ride_id>/typing
Content-Type: application/json
Authorization: Bearer <jwt>
```

Request:

```json
{
  "sender": "dispatch",
  "sender_name": "Dispatch",
  "is_typing": true
}
```

Response: same shape as `GET /status`.

Behavior:

- `is_typing: true` creates/refreshes the sender's typing state.
- `is_typing: false` clears the sender's typing state.
- Typing state is ephemeral and can be stored in Redis or memory, but `/status`
  must return it consistently while active.

### Mark Read

```http
POST /api/chat/rides/<ride_id>/read
Content-Type: application/json
Authorization: Bearer <jwt>
```

Request:

```json
{
  "sender": "dispatch",
  "sender_name": "Dispatch",
  "last_read_message_id": "server-message-id"
}
```

Response: same shape as `GET /status`.

Behavior:

- Store the latest read message id per sender for the ride.
- If `last_read_message_id` is omitted, the backend may use the latest message
  in that ride chat.
- Read receipts should be durable enough to survive app reloads.

## Structured Mission Checkpoint Updates

The driver app sends checkpoint/status updates into chat whenever the driver
taps mission command buttons such as:

- `Start Navigation`
- `Pickup Passenger`
- `Arrive Drop-off`
- `Arrive Home`
- cancel/report/emergency actions

These are sent as normal chat messages with:

```json
{
  "sender": "system",
  "sender_name": "Mission Status",
  "text": "{\n  \"type\": \"mission_command_status\",\n  ...\n}",
  "metadata": {
    "type": "mission_command_status"
  }
}
```

Important compatibility requirement:

- Preserve `metadata` exactly as a JSON object.
- Preserve `text` exactly as a string.
- The mobile app renders a compact checkpoint card when either:
  - `metadata.type === "mission_command_status"`, or
  - `text` parses as JSON with `type === "mission_command_status"`.
- The detail sheet shows the full JSON from the payload.

Example checkpoint request:

```json
{
  "text": "{\n  \"type\": \"mission_command_status\",\n  \"command\": \"advance_mission\",\n  \"timestamp\": \"2026-05-15T19:14:44.171Z\",\n  \"ride\": {\n    \"id\": \"102\",\n    \"passenger_name\": \"Ride #102\",\n    \"status\": \"en_route\",\n    \"status_check\": \"enRoute\",\n    \"transit_type\": \"Sedan\",\n    \"trip_type\": \"One-Way\"\n  },\n  \"mission\": {\n    \"step\": 1,\n    \"total_steps\": 4,\n    \"current_action\": \"Pickup Passenger\",\n    \"current_stage\": {\n      \"title\": \"Pickup @ Home\",\n      \"address\": \"205 E Houston St, New York, NY 10002\"\n    },\n    \"next_stage\": {\n      \"title\": \"Drop-off @ Facility\",\n      \"address\": \"1998 Broadway, New York, NY 10023\"\n    },\n    \"target\": {\n      \"address\": \"205 E Houston St, New York, NY 10002\",\n      \"coordinates\": {\n        \"latitude\": 40.7229,\n        \"longitude\": -73.9887\n      }\n    }\n  },\n  \"driver_location\": {\n    \"latitude\": 40.7229,\n    \"longitude\": -73.9887,\n    \"heading\": 180,\n    \"speed\": 0\n  }\n}",
  "sender": "system",
  "sender_name": "Mission Status",
  "client_message_id": "mission-102-advance_mission-1778872484171",
  "metadata": {
    "type": "mission_command_status",
    "command": "advance_mission",
    "timestamp": "2026-05-15T19:14:44.171Z",
    "ride": {
      "id": "102",
      "passenger_name": "Ride #102",
      "status": "en_route",
      "status_check": "enRoute",
      "transit_type": "Sedan",
      "trip_type": "One-Way"
    },
    "mission": {
      "step": 1,
      "total_steps": 4,
      "current_action": "Pickup Passenger",
      "current_stage": {
        "title": "Pickup @ Home",
        "address": "205 E Houston St, New York, NY 10002"
      },
      "next_stage": {
        "title": "Drop-off @ Facility",
        "address": "1998 Broadway, New York, NY 10023"
      },
      "target": {
        "address": "205 E Houston St, New York, NY 10002",
        "coordinates": {
          "latitude": 40.7229,
          "longitude": -73.9887
        }
      }
    },
    "driver_location": {
      "latitude": 40.7229,
      "longitude": -73.9887,
      "heading": 180,
      "speed": 0
    }
  }
}
```

The production backend does not need to interpret every checkpoint field for
v1. It does need to validate that `metadata` is an object, store it as JSON,
and return it unchanged.

## Optional SSE Live Stream

The mobile app currently uses polling and does not require SSE. Dispatch can
also use polling. SSE is optional for v1.

If implemented:

```http
GET /api/chat/rides/<ride_id>/stream
Authorization: Bearer <jwt>
```

Emit messages as:

```text
event: message
data: {"id":"...","ride_id":"102","text":"...","sender":"driver",...}
```

## Optional Admin Debug Route

```http
GET /api/chat/rooms
Authorization: Bearer <admin-jwt>
```

Response:

```json
{
  "rooms": [
    {
      "ride_id": "102",
      "created_at": "2026-05-15T19:01:51.595224Z",
      "updated_at": "2026-05-15T19:14:44.171Z",
      "message_count": 7,
      "last_message": {
        "id": "message-id",
        "ride_id": "102",
        "text": "Example",
        "sender": "driver",
        "sender_name": "Driver",
        "client_message_id": "driver-1778870000000",
        "metadata": {},
        "created_at": "2026-05-15T19:01:51.595224Z"
      }
    }
  ]
}
```

This can be admin-only or omitted from production.

## Auth And Ride Scoping

Production must enforce:

- Drivers can only read/send chat for rides assigned to them.
- Dispatch/admin users can read/send chat for rides they are allowed to manage.
- Pending/unaccepted ride chats must be available to dispatch/admin as soon as
  the ride exists.
- Driver access for pending rides should follow existing app rules. If the
  driver can see the pending ride request in the app, they should be able to
  open/send chat for that ride.
- Completed/cancelled ride chat remains readable for authorized users.
- Return `401` for missing/invalid auth.
- Return `403` for authenticated users not allowed to access that ride.
- Return `404` when the ride does not exist or should not be revealed.

Sender enforcement recommendation:

- `driver` token -> allow `sender: "driver"` and backend-generated
  `sender: "system"` checkpoint messages if the request originates from the
  driver app for that assigned/visible ride.
- `dispatch/admin` token -> allow `sender: "dispatch"` or `sender: "admin"`.
- Never trust unauthenticated `sender`.

## Database Recommendation

Create `ride_chat_messages`:

```text
id                  uuid/string primary key
ride_id             foreign key to rides
sender              enum/string: driver | dispatch | admin | system
sender_user_id      nullable foreign key to users/drivers/admins
sender_name         nullable string
text                text
client_message_id   nullable string
metadata            json/jsonb default {}
created_at          timestamp with timezone
updated_at          timestamp with timezone, optional
deleted_at          timestamp with timezone, optional
```

Create `ride_chat_read_receipts`:

```text
id                     uuid/string primary key
ride_id                foreign key to rides
sender                 enum/string: driver | dispatch | admin | system
sender_user_id         nullable foreign key
sender_name            nullable string
last_read_message_id   nullable foreign key to ride_chat_messages
read_at                timestamp with timezone
created_at             timestamp with timezone
updated_at             timestamp with timezone
```

Typing can be Redis/in-memory because it is ephemeral:

```text
key: ride_chat_typing:<ride_id>:<sender-or-user-id>
ttl: 5 seconds
value: sender, sender_name, is_typing, updated_at, expires_at_ms
```

Recommended indexes:

```text
ride_chat_messages (ride_id, created_at)
ride_chat_messages (ride_id, id)
ride_chat_messages (ride_id, client_message_id) unique where client_message_id is not null
ride_chat_read_receipts (ride_id, sender)
```

Retention:

- Do not delete chat when ride status changes to completed/cancelled.
- Completed ride detail/history must retrieve the same chat by `ride_id`.
- If business retention rules are added later, implement them separately.
- Prefer soft-delete over hard-delete for auditability.

## Mobile App Behavior Already Implemented

The driver app currently:

- Opens chat for pending ride requests.
- Opens chat for active missions.
- Loads messages with `GET /messages`.
- Polls `GET /messages?after_id=<last_id>` every few seconds while focused.
- Polls `GET /status`.
- Sends driver text messages with `sender: "driver"`.
- Sends mission/checkpoint messages with `sender: "system"` and structured
  `metadata.type = "mission_command_status"`.
- Sends typing state to `POST /typing`.
- Marks dispatch/admin messages read with `POST /read`.
- Shows dispatch/admin typing dots.
- Shows `Sent` / `Read` under the latest driver message.
- Renders checkpoint JSON as a compact card and opens full JSON on tap.

## Dispatch App Expectations

The dispatch/admin app should use the same API:

- Load chat by `ride_id`.
- Allow chat on pending/unaccepted rides.
- Allow chat on active rides.
- Allow chat/history on completed rides.
- Send dispatch/admin messages through `POST /messages`.
- Send typing state through `POST /typing`.
- Mark driver messages read through `POST /read`.
- Display checkpoint messages as status cards by detecting
  `metadata.type === "mission_command_status"`.

## Push Notification Follow-Up

After persistence works, create push notifications when messages are created:

- Dispatch/admin message to driver -> notify assigned driver.
- Driver/system message to dispatch/admin -> notify dispatch/admin dashboard or
  channel.
- Do not notify the sender about their own message.

Push payload:

```json
{
  "type": "chat_message",
  "ride_id": "102",
  "message_id": "server-generated-message-id"
}
```

For checkpoint messages, optionally include:

```json
{
  "type": "mission_command_status",
  "ride_id": "102",
  "message_id": "server-generated-message-id",
  "command": "advance_mission"
}
```

## Smoke Tests

Replace values as needed:

```bash
BASE_URL="https://trdev.tailff74b1.ts.net"
RIDE_ID="102"
TOKEN="..."

curl -sS "$BASE_URL/api/chat/rides/$RIDE_ID/messages" \
  -H "Authorization: Bearer $TOKEN"

curl -sS -X POST "$BASE_URL/api/chat/rides/$RIDE_ID/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "text": "Hello from the real backend",
    "sender": "driver",
    "sender_name": "Driver",
    "client_message_id": "manual-smoke-test-1",
    "metadata": {}
  }'

curl -sS "$BASE_URL/api/chat/rides/$RIDE_ID/messages" \
  -H "Authorization: Bearer $TOKEN"

curl -sS -X POST "$BASE_URL/api/chat/rides/$RIDE_ID/typing" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "sender": "driver",
    "sender_name": "Driver",
    "is_typing": true
  }'

curl -sS "$BASE_URL/api/chat/rides/$RIDE_ID/status" \
  -H "Authorization: Bearer $TOKEN"

curl -sS -X POST "$BASE_URL/api/chat/rides/$RIDE_ID/read" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "sender": "driver",
    "sender_name": "Driver"
  }'
```

Expected:

- First `GET` returns prior messages or an empty array.
- `POST /messages` returns `201` and a `message`.
- Second `GET` includes the newly-created message.
- `POST /typing` returns status with active driver typing.
- `GET /status` returns `typing` and `read_receipts`.
- `POST /read` stores/returns a driver read receipt.

Checkpoint smoke test:

```bash
curl -sS -X POST "$BASE_URL/api/chat/rides/$RIDE_ID/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "text": "{\"type\":\"mission_command_status\",\"command\":\"advance_mission\",\"timestamp\":\"2026-05-15T19:14:44.171Z\",\"ride\":{\"id\":\"102\",\"status\":\"en_route\",\"status_check\":\"enRoute\"},\"mission\":{\"step\":1,\"total_steps\":4,\"current_action\":\"Pickup Passenger\",\"current_stage\":{\"title\":\"Pickup @ Home\",\"address\":\"205 E Houston St, New York, NY 10002\"}}}",
    "sender": "system",
    "sender_name": "Mission Status",
    "client_message_id": "manual-checkpoint-smoke-test-1",
    "metadata": {
      "type": "mission_command_status",
      "command": "advance_mission",
      "timestamp": "2026-05-15T19:14:44.171Z",
      "ride": {
        "id": "102",
        "status": "en_route",
        "status_check": "enRoute"
      },
      "mission": {
        "step": 1,
        "total_steps": 4,
        "current_action": "Pickup Passenger",
        "current_stage": {
          "title": "Pickup @ Home",
          "address": "205 E Houston St, New York, NY 10002"
        }
      }
    }
  }'
```

Expected in mobile app: this renders as a compact `Driver checkpoint` card.
Tapping the card shows the full JSON details.

## Acceptance Checklist

- `GET /api/chat/rides/<ride_id>/messages` works for authorized users.
- `POST /api/chat/rides/<ride_id>/messages` creates a persisted DB message.
- `after_id` incremental polling returns only newer messages.
- Pending/unaccepted ride chats are available to authorized users.
- Completed ride chats remain retrievable by `ride_id`.
- Unauthorized users cannot access another driver's ride chat.
- Dispatch/admin can send messages for managed rides.
- `GET /status`, `POST /typing`, and `POST /read` match the contract.
- `metadata` is stored and returned unchanged.
- Mission checkpoint messages render as cards in the mobile app.
- Response JSON matches this document exactly enough for the app to use without
  frontend changes.
