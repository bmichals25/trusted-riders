# TRC Application Design System

TrustedRide Certified uses the **Vigilant Command Center** design language: a calm, authoritative mobile interface for TrustedRiders (drivers) and operators doing active ride work.

This document is the design source of truth for the current application experience. The code-level token source remains `lib/theme.ts`.

## Product Context

TRC is not a playful consumer ride app. It is a field operations tool for people who need to understand ride obligations, location status, dispatch messages, and next actions quickly while mobile.

Primary users:

- TrustedRiders (drivers) and operators working non-emergency medical transport assignments.
- People using the app under time pressure, motion, glare, and occasional connectivity issues.
- Dispatch-connected staff who need reliable status, route, chat, and location context.

The interface should feel trusted, vigilant, and operational. Every screen should answer: "What is happening now, what is next, and what action matters?"

## Design Thesis

TRC should feel like a compact field command surface:

- Dense enough for real logistics work.
- Quiet enough to scan in under half a second.
- Premium enough to represent a certified service brand.
- Native enough that iOS behaviors, touch targets, and navigation feel familiar.

Use high-end editorial hierarchy, tight radii, tonal layering, and restrained color. Avoid soft generic app patterns, marketing-card layouts, and decorative color.

## Brand Principles

### 1. Current Obligation First

The active or next ride is the primary information object. It should dominate the home experience through hierarchy, not decoration.

Design cues:

- Strong section title: `Current Ride` or `Upcoming Rides`.
- Passenger or ride ID as the most prominent item.
- Route preview and pickup/dropoff rows grouped directly under the ride identity.
- Primary action placed after context so the user knows what they are acting on.

### 2. Glance Recognition

The app must be readable in motion and in bright conditions.

Rules:

- Keep essential status labels short.
- Use consistent status badge colors.
- Use left/right alignment for logistics data.
- Avoid centered layouts except for empty/loading states.
- Keep metadata close to the object it describes.

### 3. Tonal Hierarchy

Separate surfaces by background tone, spacing, and elevation, not heavy lines.

Rules:

- Base screens use `surfaceLow`.
- Primary cards use `surface`.
- Inner fields and active panels use `surfaceLowest` or `surfaceHigh`.
- Borders are rare and functional.
- Avoid nested card stacks.

### 4. Semantic Color

Color must carry operational meaning.

Rules:

- Navy is brand authority and primary action.
- Blue is trusted operational highlight, route, schedule, chat, and navigation.
- Green is live/available/success/pickup.
- Amber is upcoming, pending, caution, or no-show.
- Red is urgent, disabled, destructive, or error.
- Yellow and red are never decorative.

### 5. Native Field Ergonomics

Controls should feel like iOS tools built for repeated use.

Rules:

- Minimum touch target: 44 pt.
- Persistent action bars are allowed for ride detail and chat.
- Pull-to-refresh is appropriate for ride, schedule, and chat lists.
- Haptic feedback supports major taps without becoming noisy.
- Map previews should not fight the main workflow.

## Source Files

Use these files when making design decisions:

| File | Role |
| --- | --- |
| `.impeccable.md` | Product/user context and standing design principles |
| `DESIGN.md` | Narrative design system and implementation guidance |
| `lib/theme.ts` | Code-level color, spacing, radius, shadow, typography, and status tokens |
| `components/ui/StatusBadge.tsx` | Canonical operational badge treatment |
| `features/home/home-screen-sections.tsx` | Ride card, map preview, route row, action button patterns |
| `features/auth/driver-login-screen.tsx` | Brand/login composition and form treatment |
| `features/rides/ride-details-screen.tsx` | Ride detail hierarchy and persistent action bar |
| `features/chat/chat-thread.tsx` | Dispatch message patterns |
| `features/settings/settings-screen-sections.tsx` | Settings rows, live status, and utility surfaces |

## Brand Assets

Use the app's existing assets directly.

| Asset | Use |
| --- | --- |
| `assets/trustedride_certified_main_logo_transparent.png` | Primary brand mark in login and app header |
| `assets/TRC_APP_ICON_2.png` | App icon and small product icon contexts |
| `assets/TR_logo.png` | Secondary TrustedRiders mark, only when the broader company brand is needed |

Logo rules:

- Place the main TRC logo on clean white or very light surfaces.
- Do not use the logo as a watermark or background texture.
- Do not crop the shield or squeeze the logo.
- Keep clear space around the logo, especially in the centered header.

## Color System

### Core Tokens

| Token | Value | Role |
| --- | --- | --- |
| `surface` | `#FFFFFF` | Primary cards, headers, inputs, action bars |
| `surfaceLow` | `#F4F7FA` | Screen background and quiet section layer |
| `surfaceHigh` | `#E2E8F0` | Secondary button fills and pressed utility states |
| `surfaceLowest` | `#FCFDFE` | Form panels and active inner content |
| `surfaceFrosted` | `rgba(255,255,255,0.88)` | Floating overlays when translucency is useful |
| `mapPlaceholder` | `#E5EBF2` | Empty or loading map state |
| `primary` | `#0F172A` | Primary brand surface, hero, primary button, operator bubble |
| `primarySoft` | `#334155` | Secondary brand text and icons |
| `primaryPressed` | `#1E293B` | Pressed primary state |
| `blue` | `#2563EB` | Route, navigation, chat, schedule emphasis |
| `blueStrong` | `#1D4ED8` | Strong operational blue text/icons |
| `blueSoft` | `#DBEAFE` | Blue icon tile and badge background |
| `green` | `#16A34A` | Pickup, live tracking, success |
| `greenStrong` | `#15803D` | Strong success/live text |
| `greenSoft` | `#DCFCE7` | Green badge and icon background |
| `amber` | `#D97706` | Caution and warning accents |
| `amberStrong` | `#92400E` | Strong caution text |
| `amberSoft` | `#FEF3C7` | Upcoming, pending, warning background |
| `error` | `#DC2626` | Error, destructive, disabled-location urgency |
| `slate500` | `#64748B` | Secondary copy |
| `slate400` | `#94A3B8` | Placeholder and low-emphasis icon |
| `slate300` | `#CBD5E1` | Text on dark primary surfaces |
| `slate200` | `#E2E8F0` | Functional separators and outlines |
| `slate100` | `#F1F5F9` | Muted icon tile or value pill |

### Status Colors

Status labels must use `statusLabels` and `statusColors` from `lib/theme.ts`.

| Status key | Label | Background | Text | Use |
| --- | --- | --- | --- | --- |
| `pending` | Upcoming | `#FEF3C7` | `#92400E` | Assigned future ride, not an accept-first request |
| `scheduled` | Scheduled | `#DBEAFE` | `#1E40AF` | Confirmed future ride |
| `enRoute` | En Route | `#FEF3C7` | `#92400E` | Traveling toward pickup/dropoff |
| `inTransit` | In Transit | `#EDE9FE` | `#5B21B6` | Passenger/ride in progress |
| `arrived` | Arrived | `#DCFCE7` | `#15803D` | Arrival checkpoint |
| `completed` | Completed | `#DCFCE7` | `#15803D` | Finished ride |
| `cancelled` | Cancelled | `#FEE2E2` | `#B91C1C` | Cancelled ride or unavailable work |
| `noShow` | No Show | `#FEF3C7` | `#92400E` | Exception state |
| `available` | Available | `#DCFCE7` | `#15803D` | Operator availability |
| `onRide` | On Ride | `#DBEAFE` | `#1E40AF` | Active ride state |
| `offDuty` | Off Duty | `#F1F5F9` | `#475569` | Inactive operator state |

## Typography

The app currently relies on the native React Native system font stack. On iOS this should read as SF Pro; on web it should fall back to a system sans stack such as `-apple-system`, `BlinkMacSystemFont`, `Helvetica Neue`, and `Arial`.

Do not introduce a novelty brand font unless the app is migrated consistently.

### Type Scale

| Role | Size | Weight | Line height | Use |
| --- | ---: | --- | ---: | --- |
| Ride detail hero | 33 | 900 | 38 | Passenger name or ride ID on primary navy surface |
| Screen title | 22 | 900 | 27 | Header title and settings subheader |
| Section title | 22 | 800 | Default | `Current Ride`, `Upcoming Rides` |
| Card title | 17-18 | 800-900 | 22-24 | Passenger, route address, panel title |
| Body | 15 | 500-700 | 21 | Message text, inputs, normal content |
| Supporting text | 13-14 | 600-700 | 18-20 | Metadata, descriptions, empty state body |
| Kicker | 10-12 | 800-900 | Default | Uppercase section labels and field labels |
| Badge | 11 | 900 | Default | Status badges and compact pills |

### Typography Rules

- Use uppercase only for kickers, field labels, badges, and small command labels.
- Letter spacing is allowed only for uppercase micro-labels. Keep it between `0.9` and `2.6`.
- Do not use negative letter spacing.
- Do not scale font size with viewport width.
- Keep long values to one line only when the layout has a clear truncation strategy.
- Avoid centered body text except in empty/loading states.

## Spacing, Radius, And Elevation

### Spacing Tokens

| Token | Value | Use |
| --- | ---: | --- |
| `spacing.xs` | 6 | Micro gaps, skeleton rows, small padding |
| `spacing.sm` | 10 | Button/icon gap, tight row spacing |
| `spacing.md` | 16 | Standard screen/card padding |
| `spacing.lg` | 24 | Major group gap |
| `spacing.xl` | 32 | Login form and large vertical breathing room |

### Radius Tokens

| Token | Value | Use |
| --- | ---: | --- |
| `radii.xs` | 4 | Status badges, small buttons, tight controls |
| `radii.sm` | 8 | Default card, input, button, icon tile |
| `radii.md` | 12 | Larger cards and panels |
| `radii.lg` | 16 | Reserved for rare large containers |
| `radii.xl` | 24 | Avoid unless the design specifically needs a large soft surface |
| `radii.pill` | 999 | Tiny pills, circular header actions, status dots |

Rules:

- Default cards should be 8 px radius.
- Avoid large rounded rectangles for operational surfaces.
- Do not put cards inside other cards.
- Use `borderCurve: "continuous"` where native rounding polish matters.
- Use `shadows.soft` for cards and `shadows.floating` for persistent bars or lifted primary context.
- Avoid big decorative shadows.

## Screen Patterns

### Login

The login screen is the clearest brand gateway.

Rules:

- Center the credential panel with a maximum width around 440.
- Use a white logo plate and quiet form panel.
- Field labels are uppercase, small, and widely tracked.
- Inputs use white fill, tight 8 px radius, and a subtle focused blue outline.
- Primary sign-in button is dark navy, uppercase, and full width.
- Errors are compact, uppercase, red, and placed close to the affected form.

### Home

Home is the command surface.

Rules:

- Header uses centered TRC logo with small live-location and dispatch message affordances on the right.
- The content stack starts with location/backend notices only when they are actionable.
- `Current Ride` appears when an active ride exists.
- If there is no active ride, scheduled or pending rides appear as `Upcoming Rides`.
- The first upcoming ride may use the stronger map-preview card.
- Empty states should say what is happening and offer refresh, not explain the whole product.

### Ride Cards

Ride cards are the main repeated object.

Required structure:

- Avatar or initials.
- Passenger name or ride ID.
- Status badge.
- Date, time, and transit type.
- Map preview when coordinates are available.
- Pickup and dropoff rows with green and blue markers.
- Primary or secondary actions after the route context.

Rules:

- Use `surface` on `surfaceLow`.
- Use `spacing.md` internal padding and gaps.
- Use route color consistently: pickup green, dropoff blue.
- Use primary action only for the most important next step.
- Keep secondary actions in a 2-column row when space allows.

### Ride Details

Ride details should feel like a focused operations brief.

Rules:

- Header: back chevron, uppercase ride state eyebrow, one-line ride number.
- Hero: dark navy surface with the passenger or ride ID as the dominant title.
- Readiness strip: status, time, vehicle in compact metrics.
- Map: muted standard style, non-interactive preview, route polyline in blue.
- Route panel: pickup and dropoff as the largest practical text objects.
- Dispatch context: plain operational notes, no marketing language.
- Bottom action bar: persistent, white, floating, with `Navigate` as the primary action and `Chat` as secondary.

### Schedule

Schedule is a planning surface, not a decorative calendar.

Rules:

- Toolbar controls are compact and functional.
- List/day/week/month modes are selected through a native menu affordance.
- Calendar surfaces use white cards on `surfaceLow`.
- Ride blocks and agenda rows must prioritize time, passenger/ride identity, and status.
- Empty states stay useful and compact.

### Dispatch Chat

Chat is a dispatch command channel.

Rules:

- The context strip should make the active ride or dispatch connection clear.
- Operator messages use primary navy bubbles aligned right.
- Dispatch messages use light tonal bubbles aligned left.
- Date separators are compact pills.
- Delivery labels are small and unobtrusive.
- Composer is persistent, light, and compact, with a 44 pt send button.
- Message text should be plain, operational, and short.

### Settings

Settings is an operations utility area.

Rules:

- Operator summary appears first with initials, TrustedRider label, and live/off pill.
- Rows use icon tiles, bold labels, short descriptions, and native chevrons or switches.
- Group settings in white surfaces with 12 px radius.
- Use dividers only inside list groups where they clarify row boundaries.
- Destructive actions use red text/icon treatment and red-tinted separators.

### Location And GPS Approval

Location state is mission-critical and should always be understandable.

Rules:

- Show location-disabled banner only when permission is actually denied.
- The banner uses red tint because the issue blocks route/navigation confidence.
- The action label is direct: `Enable`.
- If permission is blocked, route to settings or explain the exact local browser/iOS settings step.
- Do not create noisy repeated permission prompts.

## Component Rules

### Buttons

| Type | Treatment | Use |
| --- | --- | --- |
| Primary | `primary` fill, white text/icon, 8 px radius, 52-56 min height | Sign in, start/view active ride, navigate |
| Secondary | `surfaceHigh` fill, primary text/icon, 8 px radius, 44-48 min height | Chat, view ride, refresh |
| Destructive | Red-tinted fill or red text/icon | Sign out, destructive account actions |
| Icon utility | 44 square/circle, transparent or tonal pressed state | Header chat, live tracking, password visibility |

Rules:

- Pair icons with text for ride actions.
- Use symbol icons from `SymbolIcon` where available.
- Keep labels short and action-oriented.
- Do not use pill buttons for primary commands.

### Cards And Panels

Rules:

- Cards use `surface`, `radii.sm` or `radii.md`, `spacing.md`, and `shadows.soft`.
- Panels inside a screen may use `surfaceLow` when they are secondary context.
- Do not stack visual cards inside other cards.
- Prefer gap and background shift over borders.
- Use functional dividers only in settings/list rows.

### Badges And Pills

Rules:

- Status badges use `StatusBadge`.
- Badges are uppercase, 11 px, weight 900, letter spacing 1.
- Badge radius is 4.
- Pills are allowed only for compact state indicators such as `Live`, `Off`, dates, and unread counts.

### Map Previews

Rules:

- Use muted standard map style.
- Disable scroll, zoom, rotate, pitch, compass, scale, traffic, and toolbar for previews.
- Draw route as a blue stroke with a softer blue underlay.
- Pickup marker is green, dropoff marker is blue.
- If coordinates are missing, show a compact placeholder with a useful message.
- Floating map labels may use frosted white and soft shadow.

### Forms

Rules:

- Labels are uppercase, small, and direct.
- Inputs are white with subtle slate border.
- Focused inputs use blue border, not glow.
- Password visibility uses an icon utility button.
- Errors are close to the field group and written in operational language.

## Copy Voice

The app copy should be concise, direct, and operational.

Use:

- `Current Ride`
- `Upcoming Rides`
- `Navigate`
- `Chat`
- `View Ride`
- `Location Disabled`
- `Backend rides unavailable`
- `Standing by`

Avoid:

- Marketing copy inside the app.
- Long instructional paragraphs.
- Cute or playful phrasing.
- Ambiguous labels like `Manage`, `More`, or `Continue` when a concrete action exists.
- Showing internal implementation details to the team or field user.

## Accessibility And Field Conditions

Rules:

- Maintain 44 pt minimum tap targets.
- Provide explicit accessibility labels for ride cards, maps, status, chat, and buttons.
- Do not rely on color alone for status; pair it with a text label.
- Keep contrast strong on `surfaceLow` and `surface`.
- Use `numberOfLines` and `minWidth: 0` where row text can truncate.
- Test compact iPhone widths for overlapping header actions, long passenger names, long addresses, and long status labels.
- Preserve reduced-motion behavior for loading and transition animations.

## Animation And Motion

Motion should clarify state changes, not perform.

Rules:

- Use short fade/translate transitions for screen entrance and ride card appearance.
- Use pulsing skeletons for loading states, with reduced-motion support.
- Use haptics on important taps such as opening ride detail, chat, navigation, and settings actions.
- Avoid decorative looping animation in the main workflow.

## Anti-Patterns

Do not use:

- Decorative yellow, red, or purple.
- Large marketing hero sections inside the app.
- Centered consumer-app cards for logistics data.
- Nested cards.
- Oversized border radii.
- Heavy borders, thick dividers, or decorative outlines.
- One-note blue/purple gradients.
- Glass everywhere.
- Long onboarding-style explanations inside operational screens.
- Generic stock imagery.
- `Accept Request` as the default framing for pending rides when the product treats them as upcoming assigned work.
- Internal environment or generation notes in user/team-facing documents.

## Implementation Checklist

Before shipping a new TRC screen or component:

- Use tokens from `lib/theme.ts`.
- Confirm the screen works on compact iPhone widths.
- Confirm no text overlaps or clips with long names, ride IDs, addresses, and status labels.
- Confirm the primary action is visually obvious and semantically correct.
- Confirm color is semantic and not decorative.
- Confirm empty, loading, error, and permission-denied states are useful.
- Confirm accessibility labels describe operational state, not visual decoration.
- Confirm the screen still reads as TrustedRide Certified when viewed without surrounding context.
