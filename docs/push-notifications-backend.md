# Push Notifications — Backend Integration Guide

This doc is for the Flask / backend developer. The iOS and Android apps are
already wired to request notification permission, fetch an Expo push token, and
POST it to the backend after a successful login. Your side is: persist the
token, and send pushes through Expo's push service when ride events fire.

**Audience:** the person maintaining the TrustedRiders Fleet Tracking Flask
API.

---

## How the pipeline works

```
iOS app                        Flask API                    Expo Push Service                    Driver's phone
───────                        ─────────                    ─────────────────                    ──────────────
1. Login                   ─▶  /api/login  ─▶  returns JWT
2. Register for pushes     ─▶  /api/register-push-token
                               (stores push_token on driver)
                                     │
   …time passes, new ride dispatched │
                                     ▼
                               POST https://exp.host/--/api/v2/push/send
                                     │
                                     ▼
                                                    ─▶   APNs (iOS) / FCM (Android)  ─▶   📱
```

Expo acts as your proxy to APNs and FCM. You never talk to Apple or Google
directly — you hand Expo a `push_token` plus `title` / `body` and Expo delivers
it.

---

## What the app already does

These parts are done on the client. You don't have to change anything in the
mobile repo for the feature to work:

1. After login, the app calls `Notifications.requestPermissionsAsync()` — the
   OS prompts the driver for notification permission.
2. The app then calls `Notifications.getExpoPushTokenAsync({ projectId })` and
   receives a string like:
   ```
   ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
   ```
3. The app POSTs that token to `/api/register-push-token` with the current
   bearer token from login.
4. On every cold boot with a cached session, the app re-registers. So you can
   assume the `push_token` column is kept reasonably fresh.

---

## 1. Schema change

Add two columns to whatever table holds drivers:

```sql
ALTER TABLE drivers ADD COLUMN push_token TEXT;
ALTER TABLE drivers ADD COLUMN push_platform TEXT;  -- 'ios' | 'android' | 'web'
ALTER TABLE drivers ADD COLUMN push_token_updated_at TIMESTAMPTZ;
```

Index isn't strictly needed — you'll be looking up by `driver_id`, which is
already primary.

---

## 2. Endpoint contract — `POST /api/register-push-token`

### Request

```http
POST /api/register-push-token HTTP/1.1
Host: api.trustedriders.example
Authorization: Bearer <JWT from /api/login>
Content-Type: application/json

{
  "push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ios"
}
```

**Auth:** same JWT the rest of the API accepts. Reject with 401 if missing or
invalid.

### Behavior

- Resolve the driver id from the JWT `sub` claim.
- Upsert: write `push_token`, `push_platform`, and `push_token_updated_at =
  now()` for that driver. If the same token already exists on a *different*
  driver row (e.g. reinstall, device handed off), clear the old row's token to
  avoid duplicate deliveries.
- Validate the token prefix is `ExponentPushToken[...]`. Expo rejects anything
  else. Log and return 400 on malformed input.

### Response

```json
{ "ok": true }
```

Status 200 on success. 400 for malformed body. 401 for missing/bad JWT. The
client swallows errors and moves on — failures don't block login — so your
response format is lightweight.

### Flask sketch

```python
from flask import Blueprint, request, jsonify, g

bp = Blueprint("push", __name__)

@bp.post("/api/register-push-token")
@auth_required  # your existing JWT decorator
def register_push_token():
    body = request.get_json(silent=True) or {}
    token = body.get("push_token")
    platform = body.get("platform")

    if not token or not token.startswith("ExponentPushToken["):
        return jsonify(error="invalid_token"), 400
    if platform not in ("ios", "android", "web"):
        return jsonify(error="invalid_platform"), 400

    # Clear the token from any other driver first (reinstall / device swap).
    db.session.query(Driver).filter(
        Driver.push_token == token,
        Driver.id != g.driver.id,
    ).update({"push_token": None, "push_platform": None})

    g.driver.push_token = token
    g.driver.push_platform = platform
    g.driver.push_token_updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify(ok=True)
```

---

## 3. Sending a push

Expo's push service accepts a POST at:

```
POST https://exp.host/--/api/v2/push/send
Host: exp.host
Accept: application/json
Accept-Encoding: gzip, deflate
Content-Type: application/json
```

### Minimal payload

```json
{
  "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "title": "New ride request",
  "body": "Sarah Jenkins — PT at 4:45 PM",
  "sound": "default"
}
```

You can also pass an **array** of payloads (up to 100) in one request — batch
sends are much cheaper if you're notifying multiple drivers at once.

### Recommended payload for TrustedRiders ride events

```json
{
  "to": "ExponentPushToken[xxx]",
  "title": "New ride request",
  "body": "Sarah Jenkins — Physical Therapy at 4:45 PM",
  "sound": "default",
  "priority": "high",
  "ttl": 600,
  "badge": 1,
  "data": {
    "type": "ride_request",
    "ride_id": 8829,
    "url": "trustedriders://ride-details?rideId=8829"
  }
}
```

Field notes:

| Field | Purpose |
|---|---|
| `priority: "high"` | Wakes the device immediately instead of being queued (iOS only honors this if content is user-visible) |
| `ttl: 600` | Discard after 10 min if not delivered. Stops stale "accept this ride" pushes from firing after the ride has already started |
| `badge: 1` | Red dot + number on the app icon. You control the absolute value — decrement via a follow-up push with `badge: 0` when the driver opens the app |
| `data.type` | Lets the app branch on incoming payloads without regexing the title |
| `data.url` | Deep-link — when the driver taps the push, `expo-router` auto-navigates to that path if you pass a matching scheme |

### Auth for the Expo push endpoint (optional but recommended)

Expo accepts unauthenticated POSTs (tokens are secret enough to authorize).
But for production you should use an **Expo access token** to raise rate
limits and get delivery receipts:

1. On Expo's dashboard → Account Settings → Access Tokens → create one
2. Store as `EXPO_ACCESS_TOKEN` in your env
3. Add to every push request:
   ```
   Authorization: Bearer ${EXPO_ACCESS_TOKEN}
   ```

### Python example (requests)

```python
import os
import requests

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

def send_push(driver, title, body, data=None, *, sound="default", priority="high", ttl=600):
    if not driver.push_token:
        return  # driver has no push token registered yet

    payload = {
        "to": driver.push_token,
        "title": title,
        "body": body,
        "sound": sound,
        "priority": priority,
        "ttl": ttl,
    }
    if data:
        payload["data"] = data

    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
    }
    access_token = os.getenv("EXPO_ACCESS_TOKEN")
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    resp = requests.post(EXPO_PUSH_URL, json=payload, headers=headers, timeout=10)
    resp.raise_for_status()
    return resp.json()  # contains a ticket id — see "Delivery receipts" below
```

Then in your ride-assignment handler:

```python
def assign_ride(ride, driver):
    # …existing assignment logic…
    send_push(
        driver,
        title="New ride request",
        body=f"{ride.passenger_name} — {ride.type} at {ride.scheduled_time.strftime('%-I:%M %p')}",
        data={
            "type": "ride_request",
            "ride_id": ride.id,
            "url": f"trustedriders://ride-details?rideId={ride.id}",
        },
    )
```

---

## 4. Ride events worth pushing

Start with these three — they cover the 90% case for operators:

| Event | Title | Body template | `data.type` | `data.url` |
|---|---|---|---|---|
| New ride request | `New ride request` | `{passenger} — {type} at {time}` | `ride_request` | `trustedriders://ride-details?rideId={id}` |
| Ride cancelled | `Ride cancelled` | `{passenger} — was {time}` | `ride_cancelled` | `trustedriders://` |
| Ride updated (time / address) | `Ride updated` | `{passenger} — {summary_of_change}` | `ride_updated` | `trustedriders://ride-details?rideId={id}` |

Optional follow-ups, worth adding when the core flow is stable:

- **Rider ready** — "Eleanor Rigby is ready for pickup" (fires when facility
  marks the rider as ready in your internal system)
- **Shift start reminder** — "You're on shift in 30 min"
- **Dispatch message** — hook to Admin Chat so a dispatch message pushes a
  preview
- **Emergency acknowledgement** — when a driver hits the Emergency button in
  the app, confirm receipt with a push: "Dispatch received your alert."

---

## 5. Don't push when the app is already showing the relevant screen

Tapping a push always wakes the app. But if the driver is already in Admin
Chat when a new chat message arrives, a big banner is annoying. The mobile
client handles this via a silent-data push pattern:

Instead of a user-visible push, send:

```json
{
  "to": "ExponentPushToken[xxx]",
  "data": { "type": "chat_message", "ride_id": 8829 },
  "contentAvailable": true,
  "_contentAvailable": true,
  "priority": "high"
}
```

This delivers *without* showing a banner — the app's notification handler
receives the payload and can refresh state silently. Use for:

- Live updates to a ride the driver is already viewing
- Background sync of the ride list
- Chat message count updates

For the ship-version, banners for everything is fine. Silent pushes are a
follow-up optimization.

---

## 6. Delivery receipts (handling bad tokens)

Expo's `/push/send` response gives you a list of **tickets** — each ticket has
an `id` and a `status: "ok" | "error"`.

```json
{
  "data": [
    { "status": "ok", "id": "XXXXX-XXXXX-XXXXX" }
  ]
}
```

If `status: "error"`, inspect `details.error`:

| Error code | What it means | Action |
|---|---|---|
| `DeviceNotRegistered` | Token is invalid (uninstall, new device, revoked) | Null out `driver.push_token` in your DB so you stop sending |
| `MessageTooBig` | Payload > 4KB | Trim `body` or `data` |
| `MessageRateExceeded` | Too many pushes to one device too fast | Back off with exponential retry |
| `InvalidCredentials` | Your APNs/FCM key on EAS is broken | The iOS team fixes on the Expo dashboard |

To get the final delivery status (vs the "we accepted it" ticket ack), store
the `id` and later call:

```
POST https://exp.host/--/api/v2/push/getReceipts
Body: { "ids": ["XXXXX-XXXXX-XXXXX", ...] }
```

Polling once ~15 minutes after send is typical. Only necessary if you need
confirmation for audit — for normal operation the immediate ticket ack is
enough.

---

## 7. Testing

### Quick manual test — curl

Once a driver has logged into the installed TestFlight build and the
`push_token` is in your DB:

```bash
curl -X POST https://exp.host/--/api/v2/push/send \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "ExponentPushToken[REPLACE_WITH_TOKEN_FROM_DB]",
    "title": "Test from backend",
    "body": "If you see this, the pipeline works 🎉",
    "sound": "default"
  }'
```

You should see a banner on the phone within a few seconds.

### Expo's web tool

Faster for eyeballing: https://expo.dev/notifications — paste a token, a
title, a body, click "Send Notification". Useful while iterating on payload
shape before wiring it into backend code.

### End-to-end test for each ride event

1. Sign a test driver into TestFlight on a real device.
2. Trigger the event in your dispatch system (create a new ride, cancel one,
   etc.).
3. Confirm:
   - Banner shows with correct title + body
   - Tapping opens the correct screen (if `data.url` set)
   - No crash; no duplicate deliveries

---

## 8. What NOT to send

- **PII over the body** — push payloads pass through APNs/FCM unencrypted at
  the transport layer. Don't include full SSNs, medical record numbers, etc.
  Names + first-line-of-address is standard.
- **High-frequency pings** — iOS throttles apps that push too often. Keep to
  meaningful events (ride lifecycle, chat) and avoid "you moved 10 meters"
  updates.
- **Silent pushes without visible content on iOS** — iOS only delivers a
  limited number per hour. See Apple's docs on `content-available` pushes.

---

## Reference

- Expo push service docs: https://docs.expo.dev/push-notifications/sending-notifications/
- Expo push tool UI: https://expo.dev/notifications
- APNs behavior guide: https://developer.apple.com/documentation/usernotifications
- The mobile client's push token flow: [lib/push.ts](../lib/push.ts)
- The mobile client's backend call: [lib/fleet-api.ts `registerPushToken`](../lib/fleet-api.ts)

---

## Contact

Frontend questions → Ben (benjaminmichals@gmail.com).
EAS project / Apple credentials → managed in Ben's Expo account
(`benmichals` on Expo, team ID `F2UK2BP6A8` on Apple).
