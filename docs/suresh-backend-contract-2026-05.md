# Suresh Backend Contract Notes

Review date: 2026-05-28

## Chat

The updated backend owns one dispatch chat room per authenticated
TrustedRider/chaperone. In the OpenAPI file this account type is named
`driver`.

Mobile should use:

```http
GET /api/chat/messages
POST /api/chat/messages
```

Mobile should not route chat by ride id. Ride context may be included as
message metadata for local/operator context, but it does not select a backend
room.

The driver/chaperone POST body is:

```json
{
  "text": "Message text",
  "client_message_id": "client-generated-id",
  "message_metadata": {}
}
```

## Accept / Decline Gap

The app still uses the legacy endpoint below for TrustedRider accept/decline:

```http
PATCH /api/rides/<ride_id>/status
```

Suresh's latest OpenAPI does not document this route or a replacement
driver-owned accept/decline endpoint. Confirm the supported endpoint before
removing the current fallback.
