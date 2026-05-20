# TrustedRiders temporary ride chat API handoff

Use this document as instructions for Suresh's coding AI agent.

## Goal

Wire TrustedRiders ride chat to the temporary Flask chat API now, while keeping
the implementation compatible with Suresh's canonical Flask backend later.

The temporary API is running from Ben's machine for dev testing.

## Temporary dev base URL

When on the same Wi-Fi/LAN as Ben's machine:

```text
http://192.168.68.59:5055
```

From Ben's machine only:

```text
http://127.0.0.1:5055
```

If testing remotely, this LAN URL will not work unless the machine is exposed
through VPN/Tailscale/ngrok or another tunnel.

## API contract

### Health

```http
GET /health
```

Expected response:

```json
{
  "status": "ok",
  "service": "trustedriders-temp-chat",
  "rooms": 0,
  "messages": 0
}
```

### List chat rooms

```http
GET /api/chat/rooms
```

### List messages for a ride

```http
GET /api/chat/rides/<ride_id>/messages
```

Optional incremental fetch:

```http
GET /api/chat/rides/<ride_id>/messages?after_id=<last_seen_message_id>
```

Expected response:

```json
{
  "ride_id": "ride-123",
  "messages": [
    {
      "id": "message-id",
      "ride_id": "ride-123",
      "text": "Hello from dispatch",
      "sender": "dispatch",
      "sender_name": "Dispatcher",
      "client_message_id": null,
      "metadata": {},
      "created_at": "2026-05-12T02:24:45.373228Z"
    }
  ]
}
```

### Send a message

```http
POST /api/chat/rides/<ride_id>/messages
Content-Type: application/json
```

Request body:

```json
{
  "text": "Running five minutes late.",
  "sender": "driver",
  "sender_name": "Alex",
  "client_message_id": "optional-client-generated-id",
  "metadata": {}
}
```

Allowed `sender` values:

```text
driver
dispatch
admin
system
```

Expected response:

```json
{
  "message": {
    "id": "server-generated-message-id",
    "ride_id": "ride-123",
    "text": "Running five minutes late.",
    "sender": "driver",
    "sender_name": "Alex",
    "client_message_id": "optional-client-generated-id",
    "metadata": {},
    "created_at": "2026-05-12T02:24:45.373228Z"
  }
}
```

### Live message stream

```http
GET /api/chat/rides/<ride_id>/stream
```

This endpoint uses Server-Sent Events.

Browser/dispatch clients can use:

```js
const events = new EventSource(
  "http://192.168.68.59:5055/api/chat/rides/ride-123/stream"
);

events.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  console.log(message);
});
```

Native/mobile clients can either use an SSE library or poll:

```http
GET /api/chat/rides/<ride_id>/messages?after_id=<last_seen_message_id>
```

## Client integration expectations

Use the ride id already present in the dispatch/mobile flow as `<ride_id>`.

For the mobile driver app:

- Load existing messages with `GET /api/chat/rides/<ride_id>/messages`.
- Send driver messages with `sender: "driver"`.
- Use `sender_name` for the displayed driver/operator name when available.
- Prefer polling with `after_id` if SSE support is awkward in React Native.

For the dispatch app:

- Load existing messages with `GET /api/chat/rides/<ride_id>/messages`.
- Send dispatch/admin messages with `sender: "dispatch"` or `sender: "admin"`.
- Use SSE via `/stream` for live updates if running in a browser.

## Quick curl smoke test

```bash
BASE_URL="http://192.168.68.59:5055"
RIDE_ID="ride-123"

curl -sS "$BASE_URL/health"

curl -sS -X POST "$BASE_URL/api/chat/rides/$RIDE_ID/messages" \
  -H "Content-Type: application/json" \
  --data '{
    "text": "Hello from dispatch",
    "sender": "dispatch",
    "sender_name": "Dispatcher"
  }'

curl -sS "$BASE_URL/api/chat/rides/$RIDE_ID/messages"
```

## Import path for Suresh's Flask backend

The temporary server code is intentionally packaged as a reusable Flask
blueprint in:

```text
temp_chat_backend/trustedriders_chat/
```

Current standalone runner:

```text
temp_chat_backend/server.py
```

In Suresh's Flask app, the agent can copy/import the package and register:

```python
from trustedriders_chat import chat_bp

app.register_blueprint(chat_bp)
```

The routes will be available under:

```text
/api/chat/...
```

## Production notes before permanent deployment

The temporary API is dev-only.

Before production, replace the in-memory `InMemoryChatStore` with persistent
database storage and add:

- real auth
- driver scoping by authenticated driver
- dispatch/admin authorization
- message retention policy
- input length limits aligned with product needs
- push notification trigger for new chat messages

The frontend should depend on the HTTP contract above, not on the temporary
storage implementation.
