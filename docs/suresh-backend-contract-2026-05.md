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

Machine-to-machine chat updates should be sent through `message_metadata` and
may use an empty `text` field. The mobile app treats these as hidden command
messages unless a command explicitly has a user-facing card.

GPS request flow:

- Dispatch sends `{ "command": "gps_ask" }`.
- Mobile prompts the TrustedRider to approve or deny turning on local tracking.
- Mobile starts local tracking and replies with `{ "command": "gps_yes" }` when
  approved.
- Mobile replies with `{ "command": "gps_off" }` when denied.

Mobile does not send coordinate payloads in the chat response. After an
approved `gps_yes`, location coordinates are sent through the normal
`POST /api/update_location` endpoint while tracking remains on. Tracking and
coordinate posting remain off until dispatch requests access through `gps_ask`
and the TrustedRider approves the popup.

## Accept / Decline Gap

The app still uses the legacy endpoint below for TrustedRider accept/decline:

```http
PATCH /api/rides/<ride_id>/status
```

Suresh's latest OpenAPI does not document this route or a replacement
driver-owned accept/decline endpoint. Confirm the supported endpoint before
removing the current fallback.
