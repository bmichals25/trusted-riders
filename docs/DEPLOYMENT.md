# Deployment

How the **canonical two-surface product** is built and published. This doc
does **not** claim HQ PASS, G-live approval, or production health-check PASS.

---

## Surface summary

| Surface | Deploy target | Tooling |
| ------- | ------------- | ------- |
| TrustedRide Certified iOS | TestFlight / App Store Connect | EAS Build + EAS Submit |
| TrustedRiders Dispatch web | https://trustedriders-dispatch.netlify.app | Netlify static deploy from `dispatch/` build |

**Not deployed from this repo:** Suresh Fleet Tracking API (external Flask/ngrok).

---

## iOS — EAS / TestFlight

### Prerequisites

- Apple Developer Program membership (team id in `app.json`: `F2UK2BP6A8`)
- EAS CLI (`npm install -g eas-cli`, version `>= 16.0.0`)
- Expo account in the `trustedriders` org

### Build

```bash
eas login
eas build --profile production --platform ios
```

Profiles in [`eas.json`](../eas.json):

- **`preview`** — internal distribution, auto-increment build number
- **`production`** — production track, auto-increment

Set production env vars at build time when needed:

```bash
EXPO_PUBLIC_DISPATCH_PHONE=+1XXXXXXXXXX \
EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY=your-key \
  eas build --profile production --platform ios
```

### Submit to TestFlight

```bash
eas submit --platform ios --latest
```

ASC app id `6762565267` is preconfigured under `submit.production.ios` in
`eas.json`. First-time setup may prompt for App Store Connect record creation
for bundle id `com.trustedriders.prototype`.

### What "live" means for iOS

- TestFlight builds have existed historically under the prototype bundle id.
- Public marketing: https://www.trustedriders.org
- Fleet API availability depends on Suresh's ngrok host — not guaranteed by
  this deploy path alone.

---

## Dispatch web — Netlify static

### Production (current live)

| Property | Value |
| -------- | ------- |
| URL | https://trustedriders-dispatch.netlify.app |
| Site id (historical) | `trustedriders-dispatch` |
| Artifact | `dispatch/dist` after `npm run build` in `dispatch/` |
| Role | Static dispatch UI only |

The Netlify host serves the **dispatch UI**. It is **not** the Fleet API and
**not** a ride backend.

### Build locally (verify before deploy)

```bash
cd dispatch
npm ci
npm run build
# output in dispatch/dist
```

### Preview vs production on Netlify

| Deploy type | When | Notes |
| ----------- | ---- | ----- |
| **Production (`--prod`)** | Deliberate G-live promotion only | Current live site; **do not** run `--prod` from draft doc/health PRs |
| **Draft / preview alias** | Open PR1 health work (`cursor/dispatch-health-json-endpoints-f5f6`) | `deploy-preview-<PR>` aliases; JSON `/api/health` stub on **preview only** |

**Health endpoint status (honest):**

- **Live production** `GET https://trustedriders-dispatch.netlify.app/api/health`
  → HTML 404 today (no JSON health on prod).
- **Draft PR1** adds Netlify Function redirects for `/api/health`, `/api`, `/mcp`
  on **preview deploys only** — evidence for a future G-live decision, **not**
  a current PASS.
- Finding TR-005 / section 1.2: **no PASS claimed** until merge + explicit
  G-live.

Do **not** use `netlify deploy --prod` from documentation-only branches.

---

## What this repo does **not** deploy

| Item | Status |
| ---- | ------ |
| Fleet Tracking API | External (Suresh); ngrok URL in `lib/config.ts` |
| Legacy `dispatch/` WebSocket relay | Local dev only (`npm run relay`) |
| Supabase / MCP prototype backends | Legacy gaps — see [`LEGACY.md`](./LEGACY.md) |
| Marketing site `trustedriders.org` | Separate hosting (not this repo) |

---

## CI / draft workflows (reference only)

An open draft PR (`cursor/dispatch-health-json-endpoints-f5f6`) adds:

- `.github/workflows/netlify-preview.yml` — PR preview publishes
- `dispatch/scripts/deploy-draft-preview.sh` — **no `--prod`**
- `netlify.toml` redirects for health/MCP stubs

**This TR-005 docs PR does not modify that work.** It only documents the
current honest state: preview JSON health is not live on production.

---

## Checklist before claiming "deployed"

- [ ] iOS: EAS build succeeded and appears in TestFlight / ASC
- [ ] Dispatch: Netlify production URL loads TrustedRiders Dispatch UI
- [ ] Fleet API: Suresh's host reachable (separate concern)
- [ ] Health JSON: only if G-live promoted — **not** true on prod today
- [ ] HQ / audit: finding stays **OPEN** until explicit review after merge

---

## Related docs

- [`ENVIRONMENT.md`](./ENVIRONMENT.md) — build-time variables
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system boundaries
- [`DEMO.md`](./DEMO.md) — what to show publicly
