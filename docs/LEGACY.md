# Legacy Prototype Disposition

This document explains what the **legacy React/MCP / local `dispatch/` prototype**
is, why it remains in the repo, and how it differs from the **canonical
two-surface product**.

TR-005 HQ `recommended_fix`:

> Retain this documentation gap as legacy evidence; document the canonical
> two-surface product separately.

That is what this file supports.

---

## What is legacy

| Artifact | Location | Status |
| -------- | -------- | ------ |
| Local dispatch Vite console | `dispatch/` (dev port ~3001) | Retained; not canonical prod |
| WebSocket GPS relay | `dispatch/server.js` (`npm run relay`, port ~3002) | Retained; mobile **no longer uses** |
| Dispatch channel / local storage | `dispatch/src/channel.ts` | Marked legacy in source comments |
| React/MCP prototype experiments | Historical branches / Netlify MCP stubs | Evidence only; see open PR1 draft |
| Bad Supabase host references | Early prototype configs (TR-002 class) | Documented gap; not fixed by inventing infra |
| Missing API origin issues | TR-003 class prototype wiring | Documented gap |

---

## What is canonical (not legacy)

| Surface | Evidence of "real" |
| ------- | ------------------ |
| TrustedRide Certified iOS | `app/`, `lib/fleet-api.ts`, EAS, TestFlight history |
| TrustedRiders Dispatch web | https://trustedriders-dispatch.netlify.app |
| Fleet data plane | Suresh Flask API — [`suresh-fleet-api-inventory.md`](./suresh-fleet-api-inventory.md) |

---

## Running legacy locally (optional)

Only for historical reproduction or local experiments:

```bash
cd dispatch
npm install
npm run dev          # Vite :3001 + relay :3002 together
npm run relay        # relay only
npx vite --port 3001 # console only
```

**Do not** document this as the production dispatch path. Production dispatch
UI is the Netlify static site.

---

## Known legacy gaps (do not invent backends)

These are intentionally **retained as audit evidence**, not silently "fixed"
in documentation:

### TR-001 class — React/MCP prototype

Early experiments wired MCP-style endpoints and prototype handlers. The
canonical product does **not** route fleet data through MCP on the Netlify
host. Draft PR1 adds **preview-only** `/mcp` Netlify Function stubs for future
G-live consideration — not live production proof.

### TR-002 class — Supabase / wrong host

Prototype configs may reference Supabase or other hosts that are not part of
the canonical Fleet API architecture. The mobile app's canonical backend is
**only** `FLEET_API_URL` in `lib/config.ts`.

### TR-003 class — missing API origin

Local prototype flows assumed relays or origins that do not exist in production.
The honest fix is documentation boundary clarity (this package), not a fictional
origin URL in docs.

---

## Relationship to manager handoff notes

[`manager-handoff-2026-05-06.md`](./manager-handoff-2026-05-06.md) records
**real** integration proof:

- Mobile → Fleet API → dispatch visibility through backend paths
- Ride creation loop from dispatch side picked up by mobile

That proof used the **Fleet API**, not the legacy WebSocket relay as the
system of record. The relay folder remains as **how we got there**, not **where
we deploy today**.

---

## What reviewers should look for

- [ ] README and ARCHITECTURE clearly separate canonical vs legacy
- [ ] Live Netlify URL treated as UI-only
- [ ] No claim that legacy `dispatch/` relay is production
- [ ] No claim that live `/api/health` JSON passes on production Netlify
- [ ] TR-005 finding can close **after merge + review**, not on draft PR alone

---

## Related docs

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system boundaries
- [`WHAT_BEN_ACTUALLY_BUILT.md`](./WHAT_BEN_ACTUALLY_BUILT.md) — portfolio narrative
- [`DEMO.md`](./DEMO.md) — what to show publicly
