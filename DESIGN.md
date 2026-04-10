# Design System: The Vigilant Command Center

This project follows the "Vigilant Command Center" design language as its standing frontend rule set.

## Core Rules

- Favor high-end editorial hierarchy over soft consumer-app patterns.
- Use tonal layering for separation.
- Do not use 1px section dividers or decorative borders.
- Keep logistical data left-aligned or right-aligned, never center it by default.
- Treat yellow and red as semantic state colors, not decoration.
- Use the signature dark gradient only for hero elements and primary actions.
- Use glass only for floating map overlays and persistent navigation context.
- Keep radii tight.
  - Default radius: `4px`
  - Primary/card radius: `8px`
  - Avoid oversized rounded corners and pill buttons unless the element is a small utility control or chip.
- Prefer ambient "cloud" shadows only for floating controls.
- Optimize for glare, motion, and 0.5-second glance recognition.

## Token Intent

- `surface`: base background
- `surfaceLow`: section container
- `surfaceHigh`: recessed or utility layer
- `surfaceLowest`: active card sitting above a toned section
- `primary` and `primarySoft`: authoritative branded gradient
- `blue`: trusted operational highlight
- `accent`: reserved for important emphasis
- `error`: urgent status only

## Component Direction

- Buttons:
  - Primary uses the signature gradient.
  - Secondary uses tonal fill, no border.
  - Tertiary stays transparent.
- Cards and lists:
  - Separate with spacing and tonal shifts, not lines.
  - Driver information should feel like a dispatch console, not a chat app.
- Map overlays:
  - Use translucent light surfaces with soft blur-like treatment and ambient shadow.

## Implementation Notes

- `lib/theme.ts` is the code-level source of truth for tokens used by the current prototype.
- Any future screen or component added to this workspace should follow this file and the token constraints above.
