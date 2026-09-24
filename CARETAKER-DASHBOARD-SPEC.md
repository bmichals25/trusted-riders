# TrustedGuide — Caretaker Dashboard Spec

Spec status: **Draft v1** (2026-07-06)

The Caretaker Dashboard is a web-first surface (mobile-responsive) used by family members and professional caretakers to monitor a patient under Guide's care. It is read-focused: caretakers review what Guide learned, flag attention items, and book or inspect upcoming check-ins. They do not configure Guide's behavior here.

The product is a health-monitoring companion to TrustedRiders' non-emergency medical transport work. Both products serve the same patient population and share the TrustedRide Certified design language: calm, authoritative, operational — not consumer wellness app aesthetics.

---

## Section 1 — Person's Profile

**Purpose:** Persistent record of the patient's administrative and safety facts. The anchor for every other section.

### Content

| Field group | Fields |
|---|---|
| Identity | Full name, preferred name, date of birth, photo (optional) |
| Insurance | Primary carrier, plan ID, group number, secondary carrier (optional), pre-auth contact phone |
| Care team | Primary care physician (name, practice, phone, fax), specialist(s) with same fields |
| Emergency contacts | Up to 4 contacts — name, relationship, phone (primary + optional secondary), whether Guide may call them directly |
| Pharmacy | Name, phone, address |
| Living situation | Home address, whether patient lives alone, mobility aid in use (none / cane / walker / wheelchair) |
| Notes | Free-text field for context Guide cannot infer (e.g. "hard of hearing on left side," "prefers morning calls") |

### Behavior rules

- Insurance info and emergency contacts are editable by any caretaker with write access.
- Care team fields are editable; changes create an audit entry (who changed what, when).
- Photo is optional; show initials avatar if absent — consistent with TRC driver card pattern.
- Profile completeness indicator (not a gamification element — a practical "Guide will ask about X; you haven't provided Y yet" warning).

---

## Section 2 — Health Snapshot

**Purpose:** Four key health signals shown at-a-glance so a caretaker can detect drift without reading transcripts.

### Design constraint

Four signal tiles, horizontally arranged on desktop, stacked on mobile. Each tile shows today's value, the baseline (set by caretaker or auto-calculated from the first N readings), and a trend direction indicator (up / stable / down / not yet reported).

### Default signals

The four signals are configurable per patient, but the defaults are:

| Signal | What it tracks | Source |
|---|---|---|
| **Mood** | Reported mood from Guide's call — 1–5 scale derived from patient's own language | Guide call analysis |
| **Sleep** | Hours of sleep last night, patient-reported | Guide call |
| **Pain level** | 0–10 self-reported pain score | Guide call |
| **Medication adherence** | Did the patient confirm they took their medications? (Yes / No / Skipped call) | Guide call |

### Tile anatomy

- **Signal name** (kicker, uppercase)
- **Today's value** (large, dominant — the glance target)
- **Baseline** (smaller, beneath — "your baseline: 7 hrs")
- **Trend indicator** (arrow or flat line — derived from the last 7 readings)
- **Last updated** (timestamp of the call that produced this reading)

### Drift detection

- If today's value deviates from the baseline by more than a configurable threshold (defaults: mood ≥2 drop, sleep ≥2hr drop, pain ≥3 point rise, adherence = No), the tile shifts to an amber warning state.
- Tiles do not auto-escalate to red here — that escalation lives in Section 5 (Flagged Events), which uses additional context beyond single-session drift.
- If no call data exists for today, the tile shows the last available value and a "No call today" label — never a blank or a zero.

---

## Section 3 — Call History & Transcripts

**Purpose:** Full record of every Guide conversation — what was said, what was learned, and how the call went.

### List view

Each row shows:
- Date and time of call
- Duration
- Call outcome: Completed / Partial (patient ended call early) / No answer / Voicemail
- Mood score for the call (icon + number)
- Whether any flags were raised during the call (flag icon if yes)

Sorted newest-first by default. Filterable by outcome and date range.

### Transcript detail

Clicking a row opens the call detail panel (drawer or full page):

- **Audio playback** (if available and patient consented) — player with scrubbing
- **Full transcript** — speaker-attributed, time-coded. Guide's lines vs. patient's lines visually distinguished (Guide left/light, patient right/tonal, consistent with TRC chat pattern)
- **Guide's summary** — structured extraction of what Guide noted: mood language, health reports, new complaints, medication mentions, notable statements
- **Extracted signals** — the specific values that fed into the Health Snapshot this session
- **Caretaker notes** — free-text annotation field per call; visible to all caretakers on this patient

### Rules

- Transcripts are read-only for caretakers. No editing.
- Guide's summary is shown first; the raw transcript is collapsed by default (expand on tap/click) to reduce overwhelm.
- If transcript is unavailable (no-answer, voicemail), show the outcome label and any voicemail audio if recorded.
- Never show a blank transcript panel — always state what happened (e.g. "Patient did not answer. Guide left a voicemail at 10:04 AM.").

---

## Section 4 — Calendar / Check-in Log

**Purpose:** Scheduled check-ins and their outcomes at a glance; caretakers can review the cadence and add one-off calls.

### Calendar view

- Default: **week view** with call slots shown as time blocks
- Toggle to **list view** (upcoming-first) for a planner-style overview
- Past calls show their outcome color: green (completed), amber (partial), red (no answer × 2 consecutive), gray (voicemail)

### Scheduled call types

| Type | Source |
|---|---|
| **Regular cadence** | Set by caretaker — e.g. every weekday at 10 AM. Guide auto-dials at the scheduled time |
| **Metric-triggered** | Auto-scheduled by Guide when a signal drifts — e.g. pain rose 4 points, so Guide schedules a follow-up call tomorrow |
| **One-off** | Caretaker manually adds a call for a specific date/time — e.g. before a medical appointment |

### Adding a call

- Caretakers can tap any open slot or use a "Schedule check-in" button
- Form: date, time, brief note to Guide (e.g. "Ask about the new medication")
- Note becomes a Guide prompt context item — not read aloud verbatim, but used to shape that call's focus

### Rules

- Caretakers cannot cancel a metric-triggered call without confirming the reason (one-sentence modal, not a lengthy gate)
- Past calls in the calendar link directly to their transcript in Section 3
- If there are no upcoming calls scheduled, show a clear "No upcoming check-ins" state with a prompt to add one — not a silent empty calendar

---

## Section 5 — Flagged Events

**Purpose:** Alert layer for things Guide detected that need human attention. This is the highest-urgency section. Caretakers who only have 60 seconds come here first.

### What gets flagged

Guide raises a flag when it detects one or more of:

| Flag type | Example trigger |
|---|---|
| **Fall risk spike** | Patient mentions dizziness or a near-fall; Guide's model scores risk above threshold |
| **New or worsening symptom** | Patient describes a new complaint not in their baseline (e.g. chest tightness, new joint pain) |
| **Medication concern** | Patient is confused about dosage, says they ran out, or missed multiple days |
| **Mood crisis signal** | Language indicating hopelessness, social isolation beyond baseline, or refusal to talk |
| **Care team mention** | Patient mentions a recent ER visit, hospital discharge, or urgent care visit that wasn't in the profile |
| **Consecutive no-answers** | 2+ scheduled calls unanswered in a row — Guide flags for human follow-up |

### Flag card anatomy

Each flag is a card in a prioritized list (critical first):

- **Severity pill** — Critical / Elevated / Watch (color: red / amber / slate)
- **Flag type label** (kicker, e.g. "Fall Risk")
- **What Guide observed** — one- or two-sentence plain-language summary of what triggered the flag, grounded in the transcript (not inferred filler)
- **Linked call** — timestamp + link to the transcript where the flag originated
- **Caretaker action** — one of: Acknowledge (mark seen, no further action), Resolved (explain in one line), Escalate (triggers a notification to the emergency contact or sets a reminder to call the care team)
- **Age of flag** — how long since it was raised (flags older than 72 hours without action pulse softly in amber to prompt resolution)

### Rules

- **Never show a blank Flagged Events section with misleading calm.** If there are no flags, show "No active flags" with the date of the last Guide call — so caretakers know Guide has been running, not that Guide hasn't checked.
- Flags are never auto-dismissed. A caretaker must explicitly acknowledge or resolve each one.
- Critical-severity flags trigger an out-of-app notification (push or email, per caretaker preference) — the dashboard alone is not sufficient for critical events.
- The "Escalate" action opens a pre-filled contact panel for the emergency contact or care team — it does not auto-dial or auto-send without the caretaker reviewing and confirming.
- Flag history (acknowledged and resolved flags) is accessible via a "View resolved" toggle — hidden by default to keep the active list scannable.

---

## Cross-section design rules

These apply to all five sections and must be enforced when building:

1. **Operational voice, not wellness marketing.** Labels are direct: "No call today," "Flag raised," "Baseline: 7 hrs." Never: "Everything looks great!" or "Keep it up!"
2. **Data currency is always visible.** Every section shows when its data was last updated. A section whose data is stale (>24 hrs old for health signals, >72 hrs for profiles not yet completed) shows an explicit label, not a silent empty state.
3. **No canned output when Guide hasn't run.** If Guide has not yet called a patient, sections show honest "No data yet" states, not placeholder values or example readings.
4. **Mobile-responsive.** Priority order for mobile: Flagged Events → Health Snapshot → Call History. Profile and Calendar are secondary on small screens.
5. **Access tiers.** Two roles: Read-only (family observer) and Read/write (primary caretaker). Editing profile, scheduling calls, and resolving flags require the write role. Audit trail for all write actions.
