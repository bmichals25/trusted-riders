# TrustedRiders Mobile Frontend Architecture

This app uses Expo Router for navigation and keeps route files focused on screen
composition, navigation, and data wiring. Feature-specific UI belongs under
`features/<feature>/`, while broadly reusable primitives live in `components/ui/`.

## Current Structure

- `app/`: Expo Router routes and layouts. Route files should stay thin.
- `features/home/`: Home-screen-specific presentation and layout.
- `features/chat/`: Dispatch chat presentation, animation, and composer pieces.
- `features/schedule/`: Schedule calendar rendering, date math, grouping, and
  schedule-specific view models.
- `features/settings/`: Settings screen sections and rows.
- `components/ui/`: Shared UI building blocks used across features.
- `lib/`: API façades, transport helpers, domain helpers, providers, storage,
  and design tokens.

## Frontend Standards

- Keep touch targets at least 44x44 points for primary interactive controls.
- Use `accessibilityRole`, `accessibilityLabel`, `accessibilityHint`, and
  `accessibilityState` on custom controls.
- Use `lib/theme.ts` tokens for color, spacing, radii, shadows, and typography.
- Prefer native iOS behaviors: safe areas, stack headers, scroll views, switches,
  haptics, and system keyboard semantics.
- Use transform and opacity for animation, and respect reduced-motion settings.
- Keep route files small enough to scan. Extract repeated sections, rows,
  cards, and motion helpers into feature modules before they grow into screens.

## Refactor Direction

Completed cleanup:

- `app/(tabs)/mission.tsx` is now a thin route that delegates calendar UI and
  schedule modeling to `features/schedule/`.
- `app/chat.tsx` delegates checkpoint parsing, checkpoint card/modal UI, chat
  thread rendering, composer UI, and small chat accessories to `features/chat/`.
- `lib/fleet-api.ts` delegates throttled Fleet transport to
  `lib/fleet-api-transport.ts` and ride-detail cache/fallback policy to
  `lib/fleet-ride-detail-cache.ts`.
- `lib/fleet-api.ts` delegates backend ride/user normalization to
  `lib/fleet-normalization.ts`, with focused contract coverage for backend
  ride shapes.
- `app/(tabs)/index.tsx` is now a thin Home route. Brand chrome remains in
  `features/home/home-brand-header.tsx`, and current-ride cards, ride-request
  banners, notices, empty/loading states, route previews, and navigation URL
  helpers live in `features/home/home-screen-sections.tsx`.
- `app/ride-details.tsx` delegates ride-detail rendering, action bars, map
  previews, route panels, and fallback state to `features/rides/`.
- `app/ride-requests.tsx` delegates request-list orchestration, empty/error
  states, and request header rendering to `features/rides/`.

The next cleanup targets are:

- Add focused component tests around status mapping, ride rendering, and chat
  message formatting as the frontend stabilizes.
