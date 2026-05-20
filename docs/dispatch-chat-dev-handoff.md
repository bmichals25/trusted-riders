# TrustedRiders dispatch chat handoff

This document is for the dispatch app developer wiring admin/dispatch chat to
the temporary TrustedRiders chat backend.

## Base URL

For same-Wi-Fi/LAN testing:

```text
http://192.168.1.181:5055
```

Health check:

```http
GET http://192.168.1.181:5055/health
```

Expected:

```json
{
  "status": "ok",
  "service": "trustedriders-temp-chat",
  "rooms": 0,
  "messages": 0
}
```

## Ride-scoped chat

Every chat room is keyed by ride id:

```text
/api/chat/rides/<ride_id>/...
```

Important: chat is available for pending/unaccepted rides too. Dispatch should
allow messaging on a ride as soon as the ride exists, not only after a driver
accepts it.

## Load messages

```http
GET /api/chat/rides/<ride_id>/messages
GET /api/chat/rides/<ride_id>/messages?after_id=<last_seen_message_id>
```

Example:

```bash
curl -sS http://192.168.1.181:5055/api/chat/rides/102/messages
```

Response:

```json
{
  "ride_id": "102",
  "messages": [
    {
      "id": "server-message-id",
      "ride_id": "102",
      "text": "Hello",
      "sender": "driver",
      "sender_name": "Driver",
      "client_message_id": "driver-1778870000000",
      "metadata": {},
      "created_at": "2026-05-15T19:01:51.595224Z"
    }
  ]
}
```

Use `after_id` for polling. Messages are sorted oldest to newest.

## Send dispatch message

```http
POST /api/chat/rides/<ride_id>/messages
Content-Type: application/json
```

Example:

```bash
curl -sS -X POST http://192.168.1.181:5055/api/chat/rides/102/messages \
  -H "Content-Type: application/json" \
  --data '{
    "text": "Message from dispatch",
    "sender": "dispatch",
    "sender_name": "Dispatch",
    "client_message_id": "dispatch-optional-unique-id"
  }'
```

Allowed sender values:

```text
driver
dispatch
admin
system
```

Dispatch should use `sender: "dispatch"` or `sender: "admin"`.

## Chat status

Use status for typing indicators and read receipts.

```http
GET /api/chat/rides/<ride_id>/status
```

Example:

```bash
curl -sS http://192.168.1.181:5055/api/chat/rides/102/status
```

Response:

```json
{
  "ride_id": "102",
  "typing": [
    {
      "sender": "driver",
      "sender_name": "Driver",
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

Typing states expire automatically after about 5 seconds unless refreshed.

## Send typing state

When the dispatch user is typing:

```http
POST /api/chat/rides/<ride_id>/typing
Content-Type: application/json
```

Example:

```bash
curl -sS -X POST http://192.168.1.181:5055/api/chat/rides/102/typing \
  -H "Content-Type: application/json" \
  --data '{
    "sender": "dispatch",
    "sender_name": "Dispatch",
    "is_typing": true
  }'
```

When the dispatch user clears the composer, sends the message, or leaves chat:

```bash
curl -sS -X POST http://192.168.1.181:5055/api/chat/rides/102/typing \
  -H "Content-Type: application/json" \
  --data '{
    "sender": "dispatch",
    "sender_name": "Dispatch",
    "is_typing": false
  }'
```

Recommended dispatch behavior:

- Send `is_typing: true` when the composer has text.
- Refresh while typing every 1.5-2 seconds.
- Send `is_typing: false` on send, clear, blur, or unmount.
- Show driver typing when `/status.typing` includes `sender: "driver"`.

## Send read receipt

When dispatch displays/reads the latest driver message:

```http
POST /api/chat/rides/<ride_id>/read
Content-Type: application/json
```

Example:

```bash
curl -sS -X POST http://192.168.1.181:5055/api/chat/rides/102/read \
  -H "Content-Type: application/json" \
  --data '{
    "sender": "dispatch",
    "sender_name": "Dispatch",
    "last_read_message_id": "server-message-id"
  }'
```

Recommended dispatch behavior:

- When messages load, find the latest message where `sender === "driver"`.
- If it is visible to the dispatch user, POST `/read` with that message id.
- Use `read_receipts.driver.last_read_message_id` to show whether the driver has
  read the latest dispatch/admin message.

## Live update strategy

The temporary backend is polling-friendly. Suggested loop:

1. Initial load: `GET /messages`.
2. Every 2-3 seconds while chat is open:
   - `GET /messages?after_id=<last_seen_message_id>`
   - `GET /status`
3. On dispatch composer changes:
   - POST `/typing`.
4. On viewing driver messages:
   - POST `/read`.

There is also an optional Server-Sent Events message stream:

```http
GET /api/chat/rides/<ride_id>/stream
```

The mobile app currently uses polling, so dispatch can use polling too.

## UI expectations

Dispatch should support:

- Chat entry for pending/unaccepted rides.
- Chat entry for accepted/active rides.
- Chat entry/history for completed rides when the real backend persists chat.
- Driver typing indicator using iMessage-style loading dots.
- Read receipts on latest dispatch/admin message.
- Message bubbles grouped by `sender`.

## Mobile behavior already implemented

The driver app now:

- Can open Admin Chat for pending ride requests.
- Sends messages to `/api/chat/rides/<ride_id>/messages`.
- Sends `driver` typing state to `/typing`.
- Polls `/status`.
- Shows dispatch/admin typing dots.
- Marks dispatch/admin messages read through `/read`.
- Shows `Sent` / `Read` under the latest driver message.

## Important production note

This temporary server is in-memory. The real backend must persist chat rows by
canonical `ride_id` so chat history is retrievable later, including after ride
completion.
