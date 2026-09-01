# Environment Configuration

Public and build-time configuration for the **canonical two-surface product**.
No secrets belong in this repo or in these docs.

---

## Overview

| Concern | Where configured | Public at runtime? |
| ------- | ---------------- | ------------------ |
| Fleet API base URL | [`lib/config.ts`](../lib/config.ts) `FLEET_API_URL` | Yes (compiled into app) |
| Google Directions | `EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY` | Yes (client-side; restrict key in Google Cloud) |
| Emergency dispatch phone | `EXPO_PUBLIC_DISPATCH_PHONE` | Yes |
| EAS build profiles | [`eas.json`](../eas.json) | N/A (CI/local build) |
| Apple bundle / team | [`app.json`](../app.json) | Public metadata |
| Netlify dispatch site | Netlify dashboard / `NETLIFY_SITE_ID` at deploy time | N/A |

---

## `EXPO_PUBLIC_*` variables (mobile / Expo)

Expo inlines `EXPO_PUBLIC_*` at build time. Treat every value as **visible in
the client bundle**.

### `EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY`

- **Purpose:** Google Directions API for route geometry on the mission map.
- **Default:** empty string if unset (`lib/config.ts`).
- **Set for local dev:** `.env` file at repo root (gitignored) or shell export:

```bash
export EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY="your-restricted-key"
npm run ios
```

- **Production:** pass at EAS build time via EAS secrets or build env.
- **Security:** use a key restricted by iOS bundle id and/or HTTP referrer;
  never commit the key.

### `EXPO_PUBLIC_DISPATCH_PHONE`

- **Purpose:** E.164 number dialed by in-app Emergency modals.
- **Default:** `+15550000911` (555 placeholder — does not route to a real line).
- **Production example:**

```bash
EXPO_PUBLIC_DISPATCH_PHONE=+15551234567 eas build --profile production --platform ios
```

- **Formatting:** displayed via `formatPhone()` in `lib/config.ts`.

---

## Fleet API URL (not an env var today)

The canonical backend URL is **hardcoded** in [`lib/config.ts`](../lib/config.ts):

```ts
export const FLEET_API_URL =
  "https://pretyphoid-electrovalently-zena.ngrok-free.dev";
```

This is Suresh's Flask Fleet Tracking API (ngrok tunnel). It is **public** in
the sense that the mobile client must know where to connect; it is **not**
MuseLabs-controlled production infrastructure.

To point a local build at a different host, change `FLEET_API_URL` in
`lib/config.ts` for dev only — do not commit alternate URLs without team
agreement.

---

## EAS / iOS identifiers

From [`app.json`](../app.json) and [`eas.json`](../eas.json):

| Setting | Value |
| ------- | ----- |
| App name (display) | TrustedRiders Prototype |
| Slug | `trustedriders-prototype` |
| iOS bundle identifier | `com.trustedriders.prototype` |
| EAS owner | `trustedriders` |
| ASC app id (submit) | `6762565267` (in `eas.json` submit.production.ios) |

Build profiles:

| Profile | Use |
| ------- | --- |
| `development` | Dev client, internal distribution |
| `preview` | Internal TestFlight-style builds (`autoIncrement`) |
| `production` | App Store / TestFlight production track (`autoIncrement`) |

CLI requirement: `eas-cli` version `>= 16.0.0` per `eas.json`.

---

## Server-only / CI secrets (never commit)

These are **not** documented with values. Store in EAS secrets, Netlify env,
or local shell only.

| Secret | Used for |
| ------ | -------- |
| Apple ID / app-specific password / ASC API key | `eas build` / `eas submit` |
| `EXPO_TOKEN` | CI EAS builds |
| `NETLIFY_AUTH_TOKEN` | Draft Netlify preview deploys (PR1 workflow) |
| Google Directions API key (if not using `EXPO_PUBLIC_`) | Alternative to public embed — prefer restricted public key pattern above |
| Fleet API credentials | Driver accounts are created on Suresh's backend; JWT returned from `POST /api/login` — not stored in repo |

---

## Dispatch web (Netlify)

The canonical dispatch UI at `trustedriders-dispatch.netlify.app` is a **static
Vite build**. It does not read `EXPO_PUBLIC_*` vars from the mobile app.

Draft preview deploys (separate open PR) may use:

- `NETLIFY_AUTH_TOKEN` — deploy authentication
- `NETLIFY_SITE_ID` — defaults to `trustedriders-dispatch`

Preview deploys use **aliases** (`deploy-preview-<PR>`), not `--prod`.

---

## Local legacy `dispatch/` (optional)

Only needed if intentionally running the legacy local console:

```bash
cd dispatch && npm install && npm run dev
```

No `EXPO_PUBLIC_*` integration. The relay binds to local ports (3001/3002).
See [`LEGACY.md`](./LEGACY.md).

---

## Related docs

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — what connects to what
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — EAS and Netlify deploy paths
