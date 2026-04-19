# TrustedRiders

Operator-facing mobile app for the TrustedRiders non-emergency medical transport
dispatch platform. Expo / React Native; iOS-first with a working web preview for
development.

A sibling Vite app under `dispatch/` provides a minimal dispatch console + a
WebSocket relay so you can drive end-to-end flows locally.

---

## Prerequisites

- **Node.js 20+** (the dispatch sub-project declares `engines.node ≥ 18`)
- **npm 10+**
- **iOS**: Xcode 15+ and a simulator, or a real device with
  [Expo Go](https://apps.apple.com/us/app/expo-go/id982107779). For production
  builds, an active Apple Developer Program membership and the EAS CLI.
- **Android** (optional): Android Studio with an emulator or a real device.
- **Web** (optional): any modern browser.

---

## First-time setup

```bash
# From the repo root
npm install

# Dispatch console + WebSocket relay (optional but recommended)
cd dispatch
npm install
cd ..
```

---

## Running the driver app

From the repo root:

```bash
# Web preview (fastest; most UI renders identically to iOS)
npm run web

# iOS simulator — opens Metro, then launches the simulator
npm run ios

# Android emulator
npm run android

# Or start Metro on its own and pick a target from the menu
npm start
```

Expo serves the bundle at **http://localhost:8081** by default (or 8083 if a
`--port` flag is set). The web preview renders at that URL.

### Sign in

The sign-in form authenticates against the Fleet Tracking Flask backend. By
default the app points at the ngrok URL defined in
[`lib/config.ts`](lib/config.ts):

```ts
export const FLEET_API_URL =
  process.env.EXPO_PUBLIC_FLEET_API_URL ?? "https://…ngrok-free.dev";
```

To point at a different backend, set `EXPO_PUBLIC_FLEET_API_URL` before
starting Metro:

```bash
EXPO_PUBLIC_FLEET_API_URL=https://api.example.com npm run web
```

The token is persisted in `AsyncStorage` / `localStorage` so reloads stay
authenticated for the JWT lifetime (~24h). Signing out from Settings clears
it.

---

## Running the dispatch console

From the repo root:

```bash
cd dispatch

# Both the Vite console and the WebSocket relay
npm run dev

# Or run them separately
npm run relay         # node server.js — relay on port 3002
npx vite --port 3001  # console on http://localhost:3001
```

---

## Type-checking

```bash
npm run typecheck
```

---

## Production builds (iOS / TestFlight)

EAS is already configured — see [`eas.json`](eas.json) and the `expo.extra.eas`
entry in [`app.json`](app.json).

```bash
# One-time: install EAS CLI and sign in
npm install -g eas-cli
eas login

# Production build for TestFlight
eas build --profile production --platform ios

# Submit the latest build to App Store Connect
eas submit --platform ios --latest
```

EAS will prompt for your Apple ID, password, and 2FA code on the first build;
credentials are cached after that. The first TestFlight submission walks you
through creating the App Store Connect record (bundle id
`com.trustedriders.prototype`).

---

## Notable scripts & paths

| Script / path                              | What it does                                             |
| ------------------------------------------ | -------------------------------------------------------- |
| `npm run web` / `ios` / `android`          | Start Metro for the named platform                       |
| `npm run typecheck`                        | `tsc --noEmit`                                           |
| `app/`                                     | Expo Router routes (`index`, `mission`, `chat`, …)       |
| `components/ui/`                           | Shared presentation components                           |
| `lib/`                                     | Contexts (auth, dispatch, haptics, location), API client |
| `lib/theme.ts`                             | Design-system tokens — source of truth for DESIGN.md     |
| `assets/`                                  | Brand logo + icon                                        |
| `dispatch/`                                | Vite console + WebSocket relay                           |
| `DESIGN.md`                                | "Vigilant Command Center" design language                |

---

## Design language

See [`DESIGN.md`](DESIGN.md) — the *Vigilant Command Center* rule set. Tight
radii (4/8 px), tonal layering instead of dividers, dark gradient reserved for
hero elements and primary actions, editorial hierarchy over consumer-app
softness.

---

## Permissions

The app requests:

- **Location when-in-use + always** — shown to the user via
  [`LocationSetupGate`](components/ui/LocationSetupGate.tsx) after sign-in;
  required for the map, pickup navigation, and live dispatch updates.
- **Background location** (iOS `UIBackgroundModes: location`, Android
  `FOREGROUND_SERVICE_LOCATION`) — used during an active mission to keep
  dispatch informed while the app is in the background.
