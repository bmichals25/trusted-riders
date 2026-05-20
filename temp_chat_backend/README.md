# TrustedRiders temporary ride chat API

Small Flask chat backend for the dispatch app and mobile app to use while
Suresh's canonical Flask API adds permanent chat support.

The reusable code lives in `trustedriders_chat/` as a Flask blueprint, so it can
be imported into the production backend with:

```python
from trustedriders_chat import chat_bp

app.register_blueprint(chat_bp)
```

The temporary standalone server is `server.py`.

## Run locally

```bash
cd temp_chat_backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

Default URL:

```text
http://localhost:5055
```

Use a different port:

```bash
PORT=5056 python server.py
```

## Endpoints

### Health

```http
GET /health
```

### List rooms

```http
GET /api/chat/rooms
```

### List ride messages

```http
GET /api/chat/rides/<ride_id>/messages
GET /api/chat/rides/<ride_id>/messages?after_id=<message_id>
```

### Send ride message

```http
POST /api/chat/rides/<ride_id>/messages
Content-Type: application/json

{
  "text": "Running five minutes late.",
  "sender": "driver",
  "sender_name": "Alex",
  "client_message_id": "optional-client-id"
}
```

Allowed `sender` values are `driver`, `dispatch`, `admin`, and `system`.

### Live stream

```http
GET /api/chat/rides/<ride_id>/stream
```

This is a Server-Sent Events stream. Browser dispatch clients can consume it
with `new EventSource(url)`. Native/mobile clients can either use an SSE client
library or poll `GET /messages?after_id=...`.

## Quick curl test

```bash
curl -sS -X POST http://localhost:5055/api/chat/rides/ride-123/messages \
  -H "Content-Type: application/json" \
  --data '{"text":"Hello from dispatch","sender":"dispatch","sender_name":"Dispatcher"}'

curl -sS http://localhost:5055/api/chat/rides/ride-123/messages
```

## Notes for Suresh

- Storage is intentionally in-memory for the temporary server. Swap
  `InMemoryChatStore` for a database-backed implementation in production.
- The HTTP contract is intentionally stable: the mobile/dispatch clients should
  only depend on the `/api/chat/...` routes and message JSON shape.
- Add real auth/driver scoping before production use. This temp server is for
  dev testing only.
