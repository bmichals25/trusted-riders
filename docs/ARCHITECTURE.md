# TrustedRiders Architecture

This document describes the **canonical two-surface product** and how it
relates to the Fleet API, the Netlify dispatch host, and retained legacy code.

---

## Canonical product surfaces

### 1. TrustedRide Certified iOS (operator / driver mobile)

| Property | Value |
| -------- | ----- |
| Stack | Expo 55 / React Native / Expo Router |
| Repo paths | `app/`, `lib/`, `components/`, `eas.json`, `app.json` |
| Bundle id | `com.trustedriders.prototype` |
| EAS project | `trustedriders` org; project id in `app.json` → `expo.extra.eas.projectId` |
| Role | Driver sign-in, ride list, mission map, location reporting, in-app chat UI, emergency dial |
| Data source | **Suresh Fleet Tracking API** only (`lib/fleet-api.ts` → `lib/config.ts`) |

The mobile app does **not** talk to the Netlify dispatch host for fleet data.
It does **not** use the legacy `dispatch/` WebSocket relay.

Historical note: TestFlight builds have existed under the prototype bundle id.
Live marketing is at https://www.trustedriders.org.

### 2. TrustedRiders Dispatch web (static dispatch UI)

| Property | Value |
| -------- | ----- |
| Stack | Vite + React (built artifact deployed to Netlify) |
| Live URL | https://trustedriders-dispatch.netlify.app |
| Netlify site id (historical) | `trustedriders-dispatch` |
| Role | Dispatch-facing static UI for ride visibility and operations experiments |
| What it is **not** | A ride backend, a fleet database, or the MCP/fleet API |

The live site title is **TrustedRiders Dispatch**. Starter web-chat branding
has been cleared on the live host.

Build source in this repo: the `dispatch/` folder produces the static bundle,
but **production** is the Netlify-hosted artifact — not `localhost:3001`.

---

## Fleet API (backend data plane)

All canonical mobile fleet data flows through **Suresh's Flask Fleet Tracking
API**:

```text
https://pretyphoid-electrovalently-zena.ngrok-free.dev
```

Configured in [`lib/config.ts`](../lib/config.ts) as `FLEET_API_URL`.

Typical mobile paths:

```text
Driver app  ──POST /api/login──►  Fleet API  ◄──GET /api/drivers/:id/rides──  Driver app
Driver app  ──POST /api/update_location──►  Fleet API
Driver app  ──GET /api/rides/:id──►  Fleet API
```

Endpoint inventory, observed shapes, and known gaps:
[`suresh-fleet-api-inventory.md`](./suresh-fleet-api-inventory.md).

The ngrok host is a **development/staging tunnel**, not a permanent production
URL. Do not document it as guaranteed uptime or as MuseLabs-owned
infrastructure.

---

## Boundary diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                     CANONICAL TWO-SURFACE PRODUCT                  │
├──────────────────────────────┬──────────────────────────────────┤
│  TrustedRide Certified iOS   │  TrustedRiders Dispatch (web)    │
│  Expo / React Native         │  Static Vite UI on Netlify      │
│  app/ lib/ components/       │  trustedriders-dispatch.         │
│                              │  netlify.app                     │
└──────────────┬───────────────┴──────────────────────────────────┘
               │                           │
               │  Fleet REST (JWT)         │  (UI only — not fleet API)
               ▼                           ▼
        ┌──────────────────────────────────────────┐
        │     Suresh Fleet Tracking API (Flask)     │
        │     ngrok host in lib/config.ts           │
        └──────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              LEGACY (retained evidence — not production)         │
│  dispatch/ local Vite :3001 + WebSocket relay :3002             │
│  React/MCP prototype gaps (TR-001/002/003 class)                │
│  See docs/LEGACY.md                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## What the Netlify dispatch host is / is not

| | |
| - | - |
| **Is** | Static hosting for the dispatch Vite UI; optional Netlify Functions for draft health/MCP stubs (see open PR1 draft work) |
| **Is not** | The Fleet API, a ride persistence layer, Supabase, or a substitute for Suresh's backend |
| **Live `/api/health`** | Returns HTML 404 on production today — JSON health is **preview-only** until a deliberate G-live promotion (draft PR1); do not claim PASS |

---

## Legacy `dispatch/` folder (retained, not canonical)

The repo-root `dispatch/` directory is a **local development artifact**:

- Vite dev server (historically port **3001**)
- Node WebSocket relay (`server.js`, `npm run relay`, port **3002**)
- Local-only channel code in `dispatch/src/channel.ts` (marked legacy in source)

Early integration proved mobile → Fleet API → dispatch visibility loops using
real backend paths (see [`manager-handoff-2026-05-06.md`](./manager-handoff-2026-05-06.md)),
but the **mobile app no longer depends on the WebSocket relay**.

Retain this folder as **legacy evidence** of prototype iteration. Do not
conflate it with the canonical Netlify dispatch surface or with production
readiness.

---

## Related docs

- [`ENVIRONMENT.md`](./ENVIRONMENT.md) — env vars and EAS
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — EAS, Netlify, preview vs prod
- [`LEGACY.md`](./LEGACY.md) — prototype gaps and disposition
- [`suresh-fleet-api-inventory.md`](./suresh-fleet-api-inventory.md) — API contract
