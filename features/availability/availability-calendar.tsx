import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { dayMode, toMinutes, type AvailabilityDay } from "@/lib/availability";
import {
  TIME_RAIL_WIDTH,
  chunk,
  formatAgendaDate,
  formatHour,
  groupByDay,
  weekdayShort,
  type ScheduledItem,
} from "@/features/schedule/schedule-model";
import { colors, radii, shadows, spacing } from "@/lib/theme";

type Mode = "day" | "week" | "month";
type CalendarDay = { date: Date; key: string; inMonth?: boolean };

const HOUR_PX = 44;
const WEEK_HOUR_PX = 36;
const DEFAULT_FIRST_HOUR = 6;
const DEFAULT_LAST_HOUR = 22;

const GREEN_BG = "#DCFCE7";
const GREEN_EDGE = "#22A355";
const GREEN_TEXT = "#14532D";
const OFF_BG = "rgba(220, 38, 38, 0.08)";

function compactClock(hhmm: string) {
  const total = toMinutes(hhmm);
  if (total >= 24 * 60) return "12a";
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""}${h < 12 ? "a" : "p"}`;
}

/** "Off", "All day", "8a–5p", "2 times", or "Not set" for a month cell. */
export function shortDayLabel(day: AvailabilityDay | undefined) {
  if (!day) return "Not set";
  const mode = dayMode(day);
  if (mode === "unset") return "Not set";
  if (mode === "off") return "Off";
  if (mode === "allDay") return "All day";
  if (day.windows.length === 1) return `${compactClock(day.windows[0].start)}–${compactClock(day.windows[0].end)}`;
  return `${day.windows.length} times`;
}

function hoursFor(days: Array<AvailabilityDay | undefined>, rides: ScheduledItem[]) {
  let first = DEFAULT_FIRST_HOUR;
  let last = DEFAULT_LAST_HOUR;
  for (const day of days) {
    if (!day || dayMode(day) !== "hours") continue;
    for (const w of day.windows) {
      first = Math.min(first, Math.floor(toMinutes(w.start) / 60));
      last = Math.max(last, Math.ceil(toMinutes(w.end) / 60));
    }
  }
  for (const item of rides) {
    first = Math.min(first, item.startsAt.getHours());
    last = Math.max(last, item.startsAt.getHours() + 1);
  }
  return Array.from({ length: Math.max(1, last - first) }, (_, i) => first + i);
}

/**
 * My availability as a calendar (Schedule → My availability → Day / Week / Month), laid out like the
 * rides calendar: green blocks are the hours the TR said they can drive, days off are tinted red, days
 * not filled in are grey, and their rides sit on top so clashes are easy to spot. Tapping a day (or a
 * block) opens that day for editing; past days can't be changed.
 */
export function AvailabilityCalendar({
  mode,
  selectedKey,
  todayKey,
  days,
  weekDays,
  monthDays,
  rides,
  onEditDay,
  onSelectDate,
}: {
  mode: Mode;
  selectedKey: string;
  todayKey: string;
  days: Map<string, AvailabilityDay>;
  weekDays: CalendarDay[];
  monthDays: CalendarDay[];
  rides: ScheduledItem[];
  onEditDay: (key: string) => void;
  onSelectDate: (date: Date) => void;
}) {
  const ridesByDay = useMemo(() => groupByDay(rides), [rides]);
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.sm,
        padding: spacing.xs,
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        ...shadows.soft,
      }}
    >
      <ScrollView style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ paddingBottom: spacing.xs }} showsVerticalScrollIndicator={false}>
        {mode === "month" ? (
          <MonthGrid days={monthDays} availability={days} ridesByDay={ridesByDay} todayKey={todayKey} selectedKey={selectedKey} onEditDay={onEditDay} />
        ) : (
          <TimeGrid
            columns={mode === "day" ? weekDays.filter((d) => d.key === selectedKey).slice(0, 1) : weekDays}
            availability={days}
            ridesByDay={ridesByDay}
            todayKey={todayKey}
            selectedKey={selectedKey}
            hourPx={mode === "day" ? HOUR_PX : WEEK_HOUR_PX}
            single={mode === "day"}
            onEditDay={onEditDay}
            onSelectDate={onSelectDate}
          />
        )}
        <Legend />
      </ScrollView>
    </View>
  );
}

function TimeGrid({
  columns,
  availability,
  ridesByDay,
  todayKey,
  selectedKey,
  hourPx,
  single,
  onEditDay,
  onSelectDate,
}: {
  columns: CalendarDay[];
  availability: Map<string, AvailabilityDay>;
  ridesByDay: Map<string, ScheduledItem[]>;
  todayKey: string;
  selectedKey: string;
  hourPx: number;
  single: boolean;
  onEditDay: (key: string) => void;
  onSelectDate: (date: Date) => void;
}) {
  const hours = hoursFor(
    columns.map((c) => availability.get(c.key)),
    columns.flatMap((c) => ridesByDay.get(c.key) ?? []),
  );
  const firstHour = hours[0];
  const canvasHeight = hours.length * hourPx;
  const top = (minutes: number) => ((minutes - firstHour * 60) / 60) * hourPx;

  return (
    <View style={{ borderRadius: radii.sm, borderWidth: 1, borderColor: colors.slate100, overflow: "hidden" }}>
      {!single ? (
        <View style={{ flexDirection: "row", paddingLeft: TIME_RAIL_WIDTH }}>
          {columns.map((day) => {
            const selected = day.key === selectedKey;
            const past = day.key < todayKey;
            return (
              <Pressable
                key={day.key}
                onPress={() => onSelectDate(day.date)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${formatAgendaDate(day.date)}`}
                accessibilityState={{ selected }}
                style={{
                  flex: 1,
                  minHeight: 46,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radii.xs,
                  backgroundColor: selected ? colors.primary : "transparent",
                  opacity: past ? 0.45 : 1,
                }}
              >
                <Text style={{ color: selected ? colors.surface : colors.slate400, fontSize: 10, fontWeight: "900", textTransform: "uppercase" }}>
                  {weekdayShort(day.date)}
                </Text>
                <Text style={{ color: selected ? colors.surface : colors.primary, fontSize: 15, fontWeight: "900" }}>{day.date.getDate()}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={{ height: canvasHeight, position: "relative" }}>
        {hours.map((hour, index) => (
          <View
            key={hour}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: index * hourPx,
              height: hourPx,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: colors.slate100,
            }}
          >
            <Text style={{ width: TIME_RAIL_WIDTH, paddingTop: 4, color: colors.slate400, fontSize: 11, fontWeight: "900", textAlign: "center" }}>
              {formatHour(hour)}
            </Text>
          </View>
        ))}

        <View style={{ position: "absolute", left: TIME_RAIL_WIDTH, right: 0, top: 0, bottom: 0, flexDirection: "row" }}>
          {columns.map((day) => {
            const avail = availability.get(day.key);
            const mode = avail ? dayMode(avail) : "unset";
            const past = day.key < todayKey;
            const dayRides = ridesByDay.get(day.key) ?? [];
            return (
              <View
                key={day.key}
                style={{
                  flex: 1,
                  borderLeftWidth: 1,
                  borderLeftColor: colors.slate100,
                  position: "relative",
                  backgroundColor: mode === "off" ? OFF_BG : mode === "unset" ? colors.surfaceLow : "transparent",
                  opacity: past ? 0.5 : 1,
                }}
              >
                <Pressable
                  disabled={past}
                  onPress={() => onEditDay(day.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatAgendaDate(day.date)}: ${shortDayLabel(avail)}. ${past ? "" : "Tap to change."}`}
                  style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
                />
                {mode === "off" || mode === "unset" ? (
                  <Text
                    pointerEvents="none"
                    style={{
                      marginTop: 6,
                      textAlign: "center",
                      fontSize: single ? 13 : 9,
                      fontWeight: "900",
                      color: mode === "off" ? colors.error : colors.slate400,
                      textTransform: "uppercase",
                    }}
                  >
                    {mode === "off" ? "Off" : single ? "Not set · tap to add" : "Not set"}
                  </Text>
                ) : null}
                {avail && (mode === "hours" || mode === "allDay")
                  ? avail.windows.map((w) => {
                      const s = Math.max(toMinutes(w.start), firstHour * 60);
                      const e = Math.min(toMinutes(w.end), (firstHour + hours.length) * 60);
                      if (e <= s) return null;
                      return (
                        <View
                          key={`${w.start}-${w.end}`}
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            left: 2,
                            right: 2,
                            top: top(s),
                            height: Math.max(14, top(e) - top(s)),
                            borderRadius: radii.xs,
                            backgroundColor: GREEN_BG,
                            borderLeftWidth: 3,
                            borderLeftColor: GREEN_EDGE,
                            paddingHorizontal: 4,
                            paddingTop: 2,
                          }}
                        >
                          <Text style={{ color: GREEN_TEXT, fontSize: single ? 13 : 9, fontWeight: "900" }} numberOfLines={2}>
                            {mode === "allDay" ? "All day" : single ? `${compactClock(w.start)} – ${compactClock(w.end)}` : compactClock(w.start)}
                          </Text>
                        </View>
                      );
                    })
                  : null}
                {dayRides.map((item) => {
                  const minutes = item.startsAt.getHours() * 60 + item.startsAt.getMinutes();
                  return (
                    <View
                      key={item.ride.id}
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        left: single ? 40 : 6,
                        right: single ? 8 : 2,
                        top: top(minutes),
                        height: Math.max(16, hourPx * 0.7),
                        borderRadius: radii.xs,
                        backgroundColor: colors.blue,
                        paddingHorizontal: 4,
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: colors.surface, fontSize: single ? 12 : 8, fontWeight: "900" }} numberOfLines={1}>
                        {single ? `Ride · ${item.ride.passengerName ?? ""}`.trim() : "Ride"}
                      </Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function MonthGrid({
  days,
  availability,
  ridesByDay,
  todayKey,
  selectedKey,
  onEditDay,
}: {
  days: CalendarDay[];
  availability: Map<string, AvailabilityDay>;
  ridesByDay: Map<string, ScheduledItem[]>;
  todayKey: string;
  selectedKey: string;
  onEditDay: (key: string) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => (
          <Text key={`${label}-${index}`} style={{ flex: 1, color: colors.slate400, fontSize: 10, fontWeight: "900", textAlign: "center" }}>
            {label}
          </Text>
        ))}
      </View>
      {chunk(days, 7).map((week, weekIndex) => (
        <View key={weekIndex} style={{ flexDirection: "row", gap: 6 }}>
          {week.map((day) => {
            const avail = availability.get(day.key);
            const mode = avail ? dayMode(avail) : "unset";
            const past = day.key < todayKey;
            const isToday = day.key === todayKey;
            const rideCount = (ridesByDay.get(day.key) ?? []).length;
            const tone =
              mode === "off"
                ? { bg: OFF_BG, fg: colors.error }
                : mode === "unset"
                  ? { bg: colors.surfaceLow, fg: colors.slate400 }
                  : { bg: GREEN_BG, fg: GREEN_TEXT };
            return (
              <Pressable
                key={day.key}
                disabled={past || !day.inMonth}
                onPress={() => onEditDay(day.key)}
                accessibilityRole="button"
                accessibilityLabel={`${formatAgendaDate(day.date)}: ${shortDayLabel(avail)}${rideCount ? `, ${rideCount} ride${rideCount === 1 ? "" : "s"}` : ""}`}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 64,
                  borderRadius: radii.xs,
                  backgroundColor: tone.bg,
                  borderWidth: isToday || day.key === selectedKey ? 2 : 1,
                  borderColor: isToday ? colors.primary : colors.slate100,
                  padding: 5,
                  gap: 3,
                  opacity: !day.inMonth ? 0.25 : past ? 0.45 : pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "900", textAlign: "right" }}>{day.date.getDate()}</Text>
                <Text style={{ color: tone.fg, fontSize: 9, fontWeight: "900" }} numberOfLines={2}>
                  {mode === "unset" ? "—" : shortDayLabel(avail)}
                </Text>
                {rideCount ? (
                  <View style={{ alignSelf: "flex-start", paddingHorizontal: 4, borderRadius: radii.pill, backgroundColor: colors.blue }}>
                    <Text style={{ color: colors.surface, fontSize: 8, fontWeight: "900" }}>
                      {rideCount} ride{rideCount === 1 ? "" : "s"}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function Legend() {
  const item = (swatch: object, label: string) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <View style={[{ width: 12, height: 12, borderRadius: 3 }, swatch]} />
      <Text style={{ color: colors.slate500, fontSize: 11, fontWeight: "800" }}>{label}</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.xs, paddingTop: spacing.sm }}>
      {item({ backgroundColor: GREEN_BG, borderLeftWidth: 3, borderLeftColor: GREEN_EDGE }, "Available")}
      {item({ backgroundColor: OFF_BG, borderWidth: 1, borderColor: "rgba(220,38,38,0.3)" }, "Off")}
      {item({ backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.slate200 }, "Not set")}
      {item({ backgroundColor: colors.blue }, "Your rides")}
    </View>
  );
}
