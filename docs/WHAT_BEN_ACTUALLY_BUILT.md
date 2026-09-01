# What Ben Actually Built (Portfolio Narrative)

A concise, honest account of the **canonical TrustedRiders two-surface system**
for MuseLabs portfolio and release documentation — plus explicit disposition of
legacy prototype work.

---

## Elevator pitch

TrustedRiders is a non-emergency medical transport (NEMT) operator platform with
two deliberate product surfaces:

1. **TrustedRide Certified iOS** — a driver/operator mobile app for sign-in,
   ride visibility, mission navigation, location reporting, and in-field comms.
2. **TrustedRiders Dispatch web** — a static dispatch UI hosted on Netlify for
   operations-facing visibility.

Both surfaces are designed around **Suresh's Fleet Tracking API** (Flask) as the
data plane — not around a local WebSocket relay or invented backend.

Marketing presence: https://www.trustedriders.org

---

## Surface 1: TrustedRide Certified iOS

**What it is:** Expo / React Native app at the repo root, iOS-first, with a web
preview for development.

**What Ben built:**

- Full operator UX: sign-in, ride list, mission map, ride details, chat UI,
  settings, emergency dial, location permission gates, haptics, and design-system
  components ("Vigilant Command Center" — see [`DESIGN.md`](../DESIGN.md)).
- Real Fleet API integration (`lib/fleet-api.ts`): JWT auth, ride polling, ride
  detail enrichment, location updates (foreground + background).
- EAS pipeline configuration for TestFlight (`eas.json`, bundle id
  `com.trustedriders.prototype`).
- API traffic logging and throttling guardrails for backend correlation.
- Documented backend contract inventory and push-notification contract spec.

**What it depends on (not built in this repo):**

- Suresh's Flask API at the ngrok host in `lib/config.ts`
- Remaining backend endpoints (driver profile, push token registration, chat,
  accept/decline) tracked in ClickUp / `docs/suresh-fleet-api-inventory.md`

**Proof that mattered:** mobile location updates reaching the Fleet API and
dispatch visibility through the real backend path (documented in
[`manager-handoff-2026-05-06.md`](./manager-handoff-2026-05-06.md)) — not
through the legacy local relay.

---

## Surface 2: TrustedRiders Dispatch web

**What it is:** Static Vite + React dispatch UI at
https://trustedriders-dispatch.netlify.app (site id historically
`trustedriders-dispatch`).

**What Ben built:**

- Dispatch-facing UI deployed as a static Netlify site (build from `dispatch/`
  sources).
- Clear product boundary: this URL is **UI hosting**, not fleet persistence or
  MCP backend.
- Live branding aligned to **TrustedRiders Dispatch** (starter web-chat naming
  cleared on production).

**What it is not:**

- The Fleet API
- A substitute for Suresh's backend
- Proof of JSON `/api/health` on production (live returns 404; draft preview
  work is separate open PR)

---

## Legacy prototype (retained as evidence — not production)

Early iteration included a **local `dispatch/` Vite console** with a Node
WebSocket relay (`npm run relay`, ports 3001/3002). That path was useful for
experiments and historical integration demos.

**Current disposition (TR-005 HQ recommended_fix):**

- **Retain** the legacy documentation gap as evidence of prototype evolution.
- **Do not** pretend the local relay or React/MCP experiments are production.
- **Document** the canonical two-surface product separately (this docs package).

Known legacy gap classes (TR-001/002/003):

- React/MCP prototype wiring
- Bad or missing Supabase host references from early spikes
- Missing API origin issues in prototype configs

These are **not** resolved by inventing backends in docs. See
[`LEGACY.md`](./LEGACY.md).

The mobile app **no longer depends** on the WebSocket relay. Fleet API is the
single canonical data path.

---

## System diagram (what to put in a portfolio deck)

```text
  [Driver iOS app]  ────── Fleet REST API ──────  [Suresh Flask backend]
        │                      ▲
        │                      │ (data plane)
        │               [Dispatch web UI on Netlify — UI only]

  [Legacy local dispatch/ relay]  ── dashed ──  "evidence only, not prod"
```

---

## Documentation delivered (TR-005)

| Doc | Purpose |
| --- | ------- |
| Root [`README.md`](../README.md) | Product-first entry + dev quick start |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Boundaries and Fleet API |
| [`ENVIRONMENT.md`](./ENVIRONMENT.md) | Public vs server-only config |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | EAS + Netlify honest state |
| [`DEMO.md`](./DEMO.md) | Public walk without fake demos |
| [`LEGACY.md`](./LEGACY.md) | Prototype disposition |
| [`suresh-fleet-api-inventory.md`](./suresh-fleet-api-inventory.md) | API contract (pre-existing) |

---

## Honest status line (for reviewers)

> Ben built a production-intent **two-surface** NEMT operator product (iOS +
> Netlify dispatch UI) integrated with a real Fleet API backend, with legacy
> local prototype code retained transparently. Audit finding TR-005 is addressed
> by **documenting canonical surfaces separately** while **keeping legacy gaps
> visible** — not by claiming full production PASS or G-live before review.

Finding TR-005 stays **OPEN** until this package is merged and reviewed. No
section 1.2 PASS claimed in this draft.
