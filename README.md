# TrustedRiders

Slim V1 chaperone app for TrustedRiders non-emergency medical transport work.
Expo / React Native; iOS-first with a web preview for day-to-day development.

Production backend data comes from Suresh's Fleet Tracking API at:

```text
https://trdev.tailff74b1.ts.net
```

## Current V1 Scope

- Email/password login, token restore, and sign-out
- Location permission gate before the app shell opens
- Home screen with current ride, ride requests, scheduled rides, ride status toast, and pull-to-refresh
- Ride request accept, decline, and admin chat entry
- Active mission screen with background location tracking and map-app navigation
- Admin chat with message polling every 2.5 seconds and dispatch call button
- Settings with profile readout, location tracking toggle, haptics toggle, and sign-out
- Fleet API client for login, rides, ride details, status updates for accept/decline, and chat GPS command replies

Deferred items such as past rides, ride detail pages, push registration, QR verification, emergency actions, mission stage advancement, dispatch web experiments, temporary chat backend, and demo artifacts are intentionally absent from this branch.

## Prerequisites

- Node.js 20+
- npm 10+
- iOS: Xcode 15+ and a simulator, or a real device with Expo Go
- Android optional: Android Studio with an emulator or a real device
- Web optional: any modern browser

## Setup

```bash
npm install
```

## Run

```bash
npm run web
npm run ios
npm run android
npm start
```

Expo serves the bundle at `http://localhost:8081` by default, unless a different port is chosen.

## Backend URL

The default Fleet API URL is defined in [lib/config.ts](/Users/benmichals/ClaudeCodeTest/COMPANIES/TRUSTEDRIDERS_April_2026/lib/config.ts):

```ts
export const FLEET_API_URL =
  process.env.EXPO_PUBLIC_FLEET_API_URL ??
  "https://trdev.tailff74b1.ts.net";
```

Override it when needed:

```bash
EXPO_PUBLIC_FLEET_API_URL=https://new-backend-url.example npm run ios
```

## Dispatch Phone

Admin chat includes a dispatch call button. Set the phone number via `EXPO_PUBLIC_DISPATCH_PHONE` in E.164 format:

```bash
EXPO_PUBLIC_DISPATCH_PHONE=+15551234567 npm run ios
```

## Typecheck

```bash
npm run typecheck
```

## Notable Paths

| Path | Purpose |
| --- | --- |
| `app/` | Expo Router screens for home, mission, settings, and chat |
| `components/ui/` | Shared presentation components |
| `lib/dispatch-context.tsx` | Ride polling, status toast state, accept/decline, and chat command handling |
| `lib/fleet-api.ts` | Authenticated Fleet API client |
| `lib/location-context.tsx` | Foreground and background location tracking |
| `lib/chat-api.ts` | Backend admin chat list/send helpers |
| `lib/theme.ts` | Design-system tokens |
| `assets/` | TrustedRiders brand assets |

## Production Builds

EAS is configured in [eas.json](/Users/benmichals/ClaudeCodeTest/COMPANIES/TRUSTEDRIDERS_April_2026/eas.json) and [app.json](/Users/benmichals/ClaudeCodeTest/COMPANIES/TRUSTEDRIDERS_April_2026/app.json).

```bash
npm install -g eas-cli
eas login
eas build --profile production --platform ios
eas submit --platform ios --latest
```

## Permissions

The app uses foreground location for local ride context. GPS coordinates are not sent in chat responses; dispatch must send chat metadata `{ "command": "gps_ask" }`, and the TrustedRider must tap Turn On before the app replies with `{ "command": "gps_yes" }` and starts sending coordinates through `POST /api/update_location`.
