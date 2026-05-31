import { type DispatchedRide } from "@/lib/rides";
import { type StatusKey } from "@/lib/theme";

export type CalendarMode = "list" | "day" | "week" | "month";

export type ScheduledItem = {
  ride: DispatchedRide;
  startsAt: Date;
  dayKey: string;
  timeLabel: string;
};

export const CALENDAR_MODES: CalendarMode[] = ["list", "day", "week", "month"];
export const HOUR_HEIGHT = 64;
export const WEEK_HOUR_HEIGHT = 52;
export const TIME_RAIL_WIDTH = 52;

export function toScheduledItem(ride: DispatchedRide): ScheduledItem {
  const startsAt = parseRideStart(ride);
  return {
    ride,
    startsAt,
    dayKey: dayKey(startsAt),
    timeLabel: formatTime(startsAt, ride.scheduledTime),
  };
}

export function parseRideStart(ride: DispatchedRide): Date {
  const rawDate = ride.scheduledDate?.trim() ?? "";
  const rawTime = ride.scheduledTime?.trim() ?? "";
  const today = new Date();
  const isToday = /^today$/i.test(rawDate);
  const isTomorrow = /^tomorrow$/i.test(rawDate);

  // "Today"/"Tomorrow" resolve to the start of that calendar day so the
  // scheduled clock time below is layered on — without this the ride would
  // inherit the current time of day instead of its scheduledTime.
  if (isToday || isTomorrow) {
    const day = startOfDay(isTomorrow ? addDays(today, 1) : today);
    return applyClockTime(day, rawTime) ?? day;
  }

  // Explicit "<date> <time>" string already carries the time.
  const explicit = new Date(`${rawDate} ${rawTime}`.trim());
  if (!Number.isNaN(explicit.getTime())) return explicit;

  // Last resort: layer the time onto a parsed date, else fall back to createdAt.
  const dateOnly = new Date(rawDate);
  if (!Number.isNaN(dateOnly.getTime())) return applyClockTime(dateOnly, rawTime) ?? dateOnly;
  return new Date(ride.createdAt || Date.now());
}

// Layers a "h:mm AM/PM" (or 24h "HH:mm") clock string onto the given day.
// Returns null when the string can't be parsed so callers can fall back.
function applyClockTime(day: Date, rawTime: string): Date | null {
  const match = rawTime.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  const result = new Date(day);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months, 1);
  return startOfDay(copy);
}

export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function buildWeek(today: Date) {
  const start = addDays(today, -today.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    return { date, key: dayKey(date) };
  });
}

export function buildMonth(today: Date) {
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    return { date, key: dayKey(date), inMonth: date.getMonth() === today.getMonth() };
  });
}

export function groupByDay(items: ScheduledItem[]) {
  const grouped = new Map<string, ScheduledItem[]>();
  items.forEach((item) => {
    const next = grouped.get(item.dayKey) ?? [];
    next.push(item);
    grouped.set(item.dayKey, next);
  });
  return grouped;
}

export function mergeRideLists(primary: DispatchedRide[], fallback: DispatchedRide[]) {
  const byId = new Map<string, DispatchedRide>();
  fallback.forEach((ride) => byId.set(ride.id, ride));
  primary.forEach((ride) => byId.set(ride.id, ride));
  return Array.from(byId.values());
}

export function groupAgendaItems(items: ScheduledItem[]) {
  const grouped = groupByDay(items);
  return Array.from(grouped.entries())
    .map(([key, groupItems]) => ({
      key,
      date: groupItems[0]?.startsAt ?? new Date(key),
      items: groupItems,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function itemTop(item: ScheduledItem, firstHour: number, hourHeight = HOUR_HEIGHT) {
  const date = item.startsAt;
  const hour = Number.isNaN(date.getTime()) ? firstHour : date.getHours();
  const minutes = Number.isNaN(date.getTime()) ? 0 : date.getMinutes();
  return Math.max(0, (hour - firstHour) * hourHeight + (minutes / 60) * hourHeight);
}

export function currentTimeTop(now: Date, firstHour: number) {
  const top = (now.getHours() - firstHour) * HOUR_HEIGHT + (now.getMinutes() / 60) * HOUR_HEIGHT;
  return Math.max(0, top - 10);
}

export function indexCollisionOffset(items: ScheduledItem[], item: ScheduledItem, index: number, amount = 4) {
  const itemHour = Number.isNaN(item.startsAt.getTime()) ? 8 : item.startsAt.getHours();
  const previousInHour = items.slice(0, index).filter((candidate) => {
    const candidateHour = Number.isNaN(candidate.startsAt.getTime()) ? 8 : candidate.startsAt.getHours();
    return candidateHour === itemHour;
  }).length;
  return previousInHour * amount;
}

export function buildTimelineHours(items: ScheduledItem[], includeCurrentHour = false) {
  const rideHours = items.map((item) => Number.isNaN(item.startsAt.getTime()) ? 8 : item.startsAt.getHours());
  if (includeCurrentHour) rideHours.push(new Date().getHours());
  const earliest = Math.min(7, ...rideHours);
  const latest = Math.max(20, ...rideHours);
  return Array.from({ length: latest - earliest + 1 }, (_, index) => earliest + index);
}

export function chunk<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

export function dateSubtitle(date: Date, mode: CalendarMode) {
  if (mode === "list") return "Agenda view";
  if (mode === "day") return "Daily agenda";
  if (mode === "week") return "Select a day from this week";
  return "Select a date from this month";
}

export function rideCountLabel(count: number) {
  if (count === 0) return "No rides";
  if (count === 1) return "1 ride";
  return `${count} rides`;
}

export function formatHeaderDate(date: Date, mode: CalendarMode) {
  if (mode === "month") {
    return date.toLocaleDateString([], { month: "long", year: "numeric" });
  }
  if (mode === "week") {
    const week = buildWeek(date);
    const start = week[0].date;
    const end = week[6].date;
    const sameMonth = start.getMonth() === end.getMonth();
    const endLabel = sameMonth ? `${end.getDate()}` : formatShortDate(end);
    return `${formatShortDate(start)} – ${endLabel}`;
  }
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function formatAgendaDate(date: Date) {
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export function formatShortDate(date: Date) {
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function weekdayShort(date: Date) {
  return date.toLocaleDateString([], { weekday: "short" }).slice(0, 3);
}

export function rideShortLabel(ride: DispatchedRide) {
  return `#${ride.id.replace(/^ride-?/i, "")}`;
}

export function isPendingRide(ride: DispatchedRide) {
  return ride.status === "pending";
}

export function isActiveScheduleRide(ride: Pick<DispatchedRide, "status">) {
  return ride.status === "en_route" || ride.status === "picked_up" || ride.status === "in_transit";
}

export function isCalendarRideStatus(status: DispatchedRide["status"]) {
  return (
    status === "pending" ||
    status === "accepted" ||
    status === "en_route" ||
    status === "picked_up" ||
    status === "in_transit"
  );
}

export function scheduleStatusKey(ride: Pick<DispatchedRide, "status">): StatusKey {
  if (ride.status === "pending" || ride.status === "accepted") return "scheduled";
  if (ride.status === "en_route") return "enRoute";
  if (ride.status === "picked_up") return "arrived";
  if (ride.status === "in_transit") return "inTransit";
  return "scheduled";
}

export function formatHour(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric" });
}

export function formatTime(date: Date, fallback: string) {
  if (Number.isNaN(date.getTime())) return fallback || "TBD";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
