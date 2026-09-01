# TrustedRiders

**Canonical two-surface product** for MuseLabs TrustedRiders — a non-emergency
medical transport (NEMT) operator platform.

| Surface | What it is | Where it lives |
| ------- | ---------- | -------------- |
| **TrustedRide Certified iOS** | Operator/driver mobile app (Expo / React Native) | Repo root (`app/`, `lib/`, `eas.json`) |
| **TrustedRiders Dispatch web** | Static dispatch UI (Vite) | https://trustedriders-dispatch.netlify.app |

**Marketing:** https://www.trustedriders.org

**Fleet data backend:** Suresh Fleet Tracking API (Flask) — see
[`lib/config.ts`](lib/config.ts) for the current ngrok host and
[`docs/suresh-fleet-api-inventory.md`](docs/suresh-fleet-api-inventory.md) for
the discovered contract.

---

## Legacy vs canonical (read this first)

This monorepo also contains a **local React/MCP prototype** under `dispatch/`
(Vite console + WebSocket relay). That code is **retained as legacy evidence**
of early experiments — it is **not** production proof and is **not** the
canonical dispatch host.

| | Canonical | Legacy (evidence only) |
| - | --------- | ---------------------- |
| Dispatch UI | Netlify static site at `trustedriders-dispatch.netlify.app` | Local `dispatch/` Vite console on `:3001` |
| Mobile data path | Suresh Fleet API (`lib/fleet-api.ts`) | Old WebSocket relay (`npm run relay` / `:3002`) — **no longer used by mobile** |
| MCP / bad Supabase hosts | N/A — not part of canonical product | Documented gaps (TR-001/002/003 class); see [`docs/LEGACY.md`](docs/LEGACY.md) |

Do not treat incomplete prototype documentation as a production gap to "fix" by
inventing backends. TR-005's recommended disposition is to **document the
canonical two-surface product separately** and **retain the legacy gap as
evidence**.

---

## Documentation index

| Doc | Purpose |
| --- | ------- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System boundaries: iOS, Dispatch web, Fleet API, what Netlify is / is not |
| [`docs/ENVIRONMENT.md`](docs/ENVIRONMENT.md) | `EXPO_PUBLIC_*`, EAS, Fleet API URL, dispatch phone — no secrets |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | EAS/TestFlight for iOS; Netlify static for Dispatch; preview vs prod |
| [`docs/DEMO.md`](docs/DEMO.md) | Honest public walk-through of what you can actually see today |
| [`docs/WHAT_BEN_ACTUALLY_BUILT.md`](docs/WHAT_BEN_ACTUALLY_BUILT.md) | Portfolio narrative for the two-surface system |
| [`docs/LEGACY.md`](docs/LEGACY.md) | Local prototype disposition and known legacy gaps |
| [`docs/suresh-fleet-api-inventory.md`](docs/suresh-fleet-api-inventory.md) | Discovered Fleet API endpoints and gaps |
| [`DESIGN.md`](DESIGN.md) | "Vigilant Command Center" design language |

---

## Quick start (developer setup)

### Prerequisites

- **Node.js 20+** (the `dispatch/` sub-project declares `engines.node ≥ 18`)
- **npm 10+**
- **iOS**: Xcode 15+ and a simulator, or a real device with
  [Expo Go](https://apps.apple.com/us/app/expo-go/id982107779). For production
  builds, an active Apple Developer Program membership and the EAS CLI.
- **Android** (optional): Android Studio with an emulator or a real device.
- **Web** (optional): any modern browser for Expo web preview.

### Install

```bash
npm install

# Legacy dispatch console only — local experiments, not canonical production
cd dispatch && npm install && cd ..
```

### Run the iOS / mobile app

```bash
npm run web      # Web preview (fastest)
npm run ios      # iOS simulator
npm run android  # Android emulator
npm start        # Metro menu
```

Expo serves at **http://localhost:8081** by default. Sign-in authenticates
against the Fleet API URL in [`lib/config.ts`](lib/config.ts). The JWT is
persisted in `AsyncStorage` / `localStorage`.

### Type-check

```bash
npm run typecheck
```

### Production iOS build (EAS / TestFlight)

```bash
npm install -g eas-cli
eas login
eas build --profile production --platform ios
eas submit --platform ios --latest
```

Bundle id: `com.trustedriders.prototype`. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
for profiles, env vars, and TestFlight notes.

### Legacy dispatch console (local only)

```bash
cd dispatch
npm run dev          # Vite :3001 + relay :3002
npm run relay        # relay only
npx vite --port 3001 # console only
```

See [`docs/LEGACY.md`](docs/LEGACY.md) — the mobile app no longer depends on
this relay.

---

## Repo map

| Path | Role |
| ---- | ---- |
| `app/` | Expo Router routes (`index`, `mission`, `chat`, …) |
| `lib/` | Auth, Fleet API client, dispatch context, location, theme |
| `components/` | Shared UI (map, badges, modals, …) |
| `eas.json` / `app.json` | EAS build profiles; bundle id `com.trustedriders.prototype` |
| `dispatch/` | **Legacy** local Vite console + WebSocket relay |
| `docs/` | Architecture, deployment, demo, and API inventory docs |

---

## Permissions

The mobile app requests location (when-in-use, always, and background on iOS)
for map display, pickup navigation, and Fleet API location updates during
active missions. See [`components/ui/LocationSetupGate.tsx`](components/ui/LocationSetupGate.tsx).
