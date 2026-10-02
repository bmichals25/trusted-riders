// TrustedRider availability: pure helpers for the "My availability" screen (app/settings/availability.tsx).
// Wire format (backend services/availability.py):
//   {date: "2026-10-05", status: "available" | "unavailable" | null, windows: [{start: "08:00", end: "14:00"}]}
// status null = "not set" (dispatch sees that differently from "off"). Times are local; "24:00" = midnight.

export type AvailabilityStatus = "available" | "unavailable" | null;
export type AvailabilityWindow = { start: string; end: string };
export type AvailabilityDay = { date: string; status: AvailabilityStatus; windows: AvailabilityWindow[] };
export type DayMode = "unset" | "off" | "allDay" | "hours";

export const STEP_MINUTES = 30;
export const MAX_WINDOWS = 3;
export const DEFAULT_WINDOW: AvailabilityWindow = { start: "08:00", end: "17:00" };
export const ALL_DAY: AvailabilityWindow = { start: "00:00", end: "24:00" };
export const PRESETS: { label: string; window: AvailabilityWindow }[] = [
  { label: "Morning", window: { start: "07:00", end: "12:00" } },
  { label: "Afternoon", window: { start: "12:00", end: "17:00" } },
  { label: "9 to 5", window: { start: "09:00", end: "17:00" } },
  { label: "Evening", window: { start: "17:00", end: "21:00" } },
];

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, minutes));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/** "08:00" → "8:00 AM", "24:00" → "Midnight" */
export function clockLabel(hhmm: string): string {
  const total = toMinutes(hhmm);
  if (total >= 24 * 60) return "Midnight";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function isAllDay(day: AvailabilityDay): boolean {
  return day.status === "available" && day.windows.length === 1 && day.windows[0].start === "00:00" && day.windows[0].end === "24:00";
}

export function dayMode(day: AvailabilityDay): DayMode {
  if (day.status === "unavailable") return "off";
  if (day.status !== "available") return "unset";
  return isAllDay(day) ? "allDay" : "hours";
}

export function withMode(day: AvailabilityDay, mode: DayMode): AvailabilityDay {
  switch (mode) {
    case "off":
      return { ...day, status: "unavailable", windows: [] };
    case "allDay":
      return { ...day, status: "available", windows: [ALL_DAY] };
    case "hours":
      return {
        ...day,
        status: "available",
        windows: day.status === "available" && !isAllDay(day) && day.windows.length ? day.windows : [DEFAULT_WINDOW],
      };
    default:
      return { ...day, status: null, windows: [] };
  }
}

/** Move one edge of a window by `delta` minutes, keeping start < end (at least one step apart). */
export function nudgeWindow(window: AvailabilityWindow, edge: "start" | "end", delta: number): AvailabilityWindow {
  const start = toMinutes(window.start);
  const end = toMinutes(window.end);
  if (edge === "start") {
    const next = Math.max(0, Math.min(end - STEP_MINUTES, start + delta));
    return { ...window, start: fromMinutes(next) };
  }
  const next = Math.min(24 * 60, Math.max(start + STEP_MINUTES, end + delta));
  return { ...window, end: fromMinutes(next) };
}

/** A new window after the day's last one (or null when there's no room left in the day). */
export function nextWindow(windows: AvailabilityWindow[]): AvailabilityWindow | null {
  if (windows.length >= MAX_WINDOWS) return null;
  const lastEnd = windows.length ? Math.max(...windows.map((w) => toMinutes(w.end))) : toMinutes(DEFAULT_WINDOW.start);
  const start = windows.length ? lastEnd + 60 : lastEnd;
  if (start + 60 > 24 * 60) return null;
  return { start: fromMinutes(start), end: fromMinutes(Math.min(24 * 60, start + 4 * 60)) };
}

/** Short summary for a day row: "Not set", "Off", "All day", "8:00 AM – 5:00 PM", "2 time ranges". */
export function daySummary(day: AvailabilityDay): string {
  const mode = dayMode(day);
  if (mode === "unset") return "Not set";
  if (mode === "off") return "Off";
  if (mode === "allDay") return "All day";
  if (day.windows.length === 1) return `${clockLabel(day.windows[0].start)} – ${clockLabel(day.windows[0].end)}`;
  return `${day.windows.length} time ranges`;
}

/** Overlapping ranges on one day (the backend would merge them; the screen asks to fix them instead). */
export function windowsOverlap(windows: AvailabilityWindow[]): boolean {
  const sorted = [...windows].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  return sorted.some((w, i) => i > 0 && toMinutes(w.start) < toMinutes(sorted[i - 1].end));
}

function sameDay(a: AvailabilityDay, b: AvailabilityDay): boolean {
  return a.status === b.status && JSON.stringify(a.windows) === JSON.stringify(b.windows);
}

/** Days that differ from what was loaded: the PUT body. */
export function changedDays(saved: AvailabilityDay[], edited: AvailabilityDay[]): AvailabilityDay[] {
  const byDate = new Map(saved.map((d) => [d.date, d]));
  return edited.filter((d) => {
    const before = byDate.get(d.date);
    return !before || !sameDay(before, d);
  });
}

export function normalizeDay(raw: unknown): AvailabilityDay | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  if (typeof body.date !== "string") return null;
  const status = body.status === "available" || body.status === "unavailable" ? body.status : null;
  const windows = Array.isArray(body.windows)
    ? body.windows
        .filter((w): w is { start: string; end: string } =>
          !!w && typeof (w as any).start === "string" && typeof (w as any).end === "string")
        .map((w) => ({ start: w.start, end: w.end }))
    : [];
  return { date: body.date, status, windows: status === "available" ? windows : [] };
}

/** "2026-10-05" → { weekday: "Mon", date: "Oct 5" } without time-zone surprises. */
export function dayLabel(iso: string): { weekday: string; date: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const local = new Date(y, m - 1, d);
  return {
    weekday: local.toLocaleDateString("en-US", { weekday: "short" }),
    date: local.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}
