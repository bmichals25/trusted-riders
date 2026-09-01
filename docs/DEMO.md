# Demo Guide (Honest Public Walk)

What you can **actually** show today without fake backends, paid services, or
unrecorded Loom videos. This is draft portfolio evidence — not an HQ PASS
claim.

---

## What exists publicly

### 1. Marketing site

**URL:** https://www.trustedriders.org

Public-facing brand and program positioning for TrustedRiders / TrustedRide
Certified. This is separate from the GitHub monorepo deploy paths.

**Show:** landing copy, program framing, contact paths if present.

**Do not claim:** that every CTA maps to a fully automated production backend
owned by this repo.

### 2. TrustedRiders Dispatch web UI

**URL:** https://trustedriders-dispatch.netlify.app

Static dispatch interface (Vite build on Netlify). Live title:
**TrustedRiders Dispatch**.

**Show:** the deployed UI shell, layout, and any client-side flows that work
without a live fleet session.

**Be honest:**

- This host is the **dispatch UI only** — not the Fleet API.
- `/api/health` on **production** returns HTML 404 today (no JSON PASS).
- JSON health stubs exist only on **draft Netlify preview** deploys (open PR1),
  not on the live URL.

### 3. TrustedRide Certified iOS (operator app)

**Source:** repo root Expo app (`app/`, `lib/`).

**Bundle id:** `com.trustedriders.prototype`

**Public constraints:**

| Constraint | Reality |
| ---------- | ------- |
| TestFlight | Builds have existed historically; access is invite-gated via Apple |
| Simulator / Expo Go | Works for local demo with valid Fleet API credentials |
| Fleet API | Requires Suresh's ngrok host to be up + driver account |
| Google Directions | Optional key for full route geometry |

**Show locally (recommended for portfolio reviewers with repo access):**

```bash
npm install
npm run ios   # or npm run web for faster UI pass
```

Sign in with credentials issued on the Fleet API backend. Without backend
access, show static UI via web preview and point to
[`suresh-fleet-api-inventory.md`](./suresh-fleet-api-inventory.md) for the
integration contract.

**Do not show as production proof:**

- Legacy `dispatch/` WebSocket relay on `localhost:3001`
- Any Supabase or MCP prototype host from early experiments
- Invented "all green" health checks on live Netlify prod

---

## Suggested walk order (5–10 minutes)

1. **Marketing** — open https://www.trustedriders.org; explain NEMT operator
   positioning.
2. **Architecture** — one sentence: mobile + dispatch UI share Fleet API data;
   Netlify is UI-only. Point to [`ARCHITECTURE.md`](./ARCHITECTURE.md).
3. **Dispatch UI** — open https://trustedriders-dispatch.netlify.app; show
   static dispatch surface; state health JSON is preview-only.
4. **Mobile** — simulator or web preview from repo; sign-in if backend is up;
   otherwise screenshot/TestFlight note from [`DEPLOYMENT.md`](./DEPLOYMENT.md).
5. **Legacy boundary** — briefly note `dispatch/` local prototype is retained
   evidence, not prod ([`LEGACY.md`](./LEGACY.md)).

---

## What not to demo (or label clearly as legacy)

| Item | Why |
| ---- | --- |
| `cd dispatch && npm run dev` relay loop | Legacy local experiment; mobile no longer uses relay |
| MCP / bad Supabase origins | TR-001/002/003 class gaps; do not invent fixes in demo |
| Live `/api/health` JSON on Netlify prod | Does not exist today — 404 |
| Paid Google Cloud / ngrok uptime guarantees | Third-party / Suresh-operated dependencies |

---

## Evidence artifacts (no video required)

Reviewers can use:

- This repo's `docs/` package (TR-005)
- Live URLs above
- [`WHAT_BEN_ACTUALLY_BUILT.md`](./WHAT_BEN_ACTUALLY_BUILT.md) portfolio narrative
- [`manager-handoff-2026-05-06.md`](./manager-handoff-2026-05-06.md) for dated
  integration proof notes (mobile → Fleet API → dispatch visibility)

---

## Finding status

TR-005 remains **OPEN** until this docs package is reviewed and merged. This
demo guide is **draft evidence** — not G-live approval and not section 1.2 PASS.
