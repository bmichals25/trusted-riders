import { useEffect, useMemo, useRef, useState } from "react";
import { SymbolIcon } from "@/components/ui/SymbolIcon";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { MenuView, type MenuAction } from "@react-native-menu/menu";

import { StatusBadge } from "@/components/ui/StatusBadge";
import { type DispatchedRide } from "@/lib/rides";
import { colors, radii, shadows, spacing } from "@/lib/theme";
import {
  buildTimelineHours,
  CALENDAR_MODES,
  type CalendarMode,
  chunk,
  currentTimeTop,
  formatAgendaDate,
  formatHeaderDate,
  formatHour,
  formatTime,
  groupAgendaItems,
  groupByDay,
  HOUR_HEIGHT,
  indexCollisionOffset,
  isActiveScheduleRide,
  isPendingRide,
  itemTop,
  rideCountLabel,
  rideShortLabel,
  scheduleStatusKey,
  type ScheduledItem,
  TIME_RAIL_WIDTH,
  WEEK_HOUR_HEIGHT,
  weekdayShort,
} from "@/features/schedule/schedule-model";

export function ScheduleToolbar({
  mode,
  selectedDate,
  onPrevious,
  onNext,
  onModeChange,
}: {
  mode: CalendarMode;
  selectedDate: Date;
  onPrevious: () => void;
  onNext: () => void;
  onModeChange: (mode: CalendarMode) => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      {mode === "list" ? (
        <View style={[dateStripStyle, { flex: 1 }]}>
          <View style={{ flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 3 }}>
            <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "900", lineHeight: 22 }} numberOfLines={1}>
              All scheduled rides
            </Text>
          </View>
        </View>
      ) : (
        <View style={[dateStripStyle, { flex: 1 }]}>
          <DateArrow label="Previous date" iconName="chevron.left" onPress={onPrevious} />
          <View style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
            <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "900", lineHeight: 22 }} numberOfLines={1}>
              {formatHeaderDate(selectedDate, mode)}
            </Text>
          </View>
          <DateArrow label="Next date" iconName="chevron.right" onPress={onNext} />
        </View>
      )}
      <ViewSelector mode={mode} onChange={onModeChange} />
    </View>
  );
}

const MODE_LABELS: Record<CalendarMode, string> = {
  list: "List",
  day: "Day",
  week: "Week",
  month: "Month",
};

function ViewSelector({ mode, onChange }: { mode: CalendarMode; onChange: (mode: CalendarMode) => void }) {
  const actions: MenuAction[] = CALENDAR_MODES.map((item) => ({
    id: item,
    title: MODE_LABELS[item],
    state: item === mode ? "on" : "off",
  }));

  return (
    <MenuView
      title="Schedule view"
      shouldOpenOnLongPress={false}
      onPressAction={({ nativeEvent }) => {
        const next = nativeEvent.event as CalendarMode;
        if (next && next !== mode) onChange(next);
      }}
      actions={actions}
    >
      <View
        accessibilityRole="button"
        accessibilityLabel={`Schedule view: ${MODE_LABELS[mode]}`}
        accessibilityHint="Choose list, day, week, or month view"
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingLeft: spacing.md,
          paddingRight: spacing.sm,
          borderRadius: radii.pill,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.slate200,
          ...shadows.soft,
        }}
      >
        <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "900" }} numberOfLines={1}>
          {MODE_LABELS[mode]}
        </Text>
        <SymbolIcon
          name="chevron.down"
          size={12}
          type="hierarchical"
          tintColor={colors.blue}
          weight="bold"
        />
      </View>
    </MenuView>
  );
}

export function CalendarSurface({
  mode,
  selectedKey,
  todayKey,
  listItems,
  dayItems,
  weekDays,
  weekItems,
  monthDays,
  monthItems,
  onSelectDate,
  onOpenRide,
  refreshing,
  onRefresh,
}: {
  mode: CalendarMode;
  selectedKey: string;
  todayKey: string;
  listItems: ScheduledItem[];
  dayItems: ScheduledItem[];
  weekDays: Array<{ date: Date; key: string }>;
  weekItems: ScheduledItem[];
  monthDays: Array<{ date: Date; key: string; inMonth: boolean }>;
  monthItems: ScheduledItem[];
  onSelectDate: (date: Date) => void;
  onOpenRide: (ride: DispatchedRide) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const visibleRideCount = mode === "list" ? listItems.length : mode === "day" ? dayItems.length : mode === "week" ? weekItems.length : monthItems.length;
  const calendarScrollRef = useRef<ScrollView>(null);
  const centeredDayKeyRef = useRef<string | null>(null);
  const [calendarViewportHeight, setCalendarViewportHeight] = useState(0);
  const isTodayInDayMode = mode === "day" && selectedKey === todayKey;
  const dayTimelineHours = useMemo(() => buildTimelineHours(dayItems, isTodayInDayMode), [dayItems, isTodayInDayMode]);
  const dayFirstHour = dayTimelineHours[0] ?? 7;
  const dayCanvasHeight = dayTimelineHours.length * HOUR_HEIGHT;
  const dayCenterKey = `${selectedKey}:${dayItems.map((item) => item.ride.id).join(",")}`;

  useEffect(() => {
    if (!isTodayInDayMode) {
      centeredDayKeyRef.current = null;
      return;
    }
    if (!calendarViewportHeight || centeredDayKeyRef.current === dayCenterKey) return;

    centeredDayKeyRef.current = dayCenterKey;
    const currentTop = currentTimeTop(new Date(), dayFirstHour);
    const maxScrollY = Math.max(0, dayCanvasHeight - calendarViewportHeight);
    const centeredY = currentTop - (calendarViewportHeight / 2) + 10;
    const scrollY = Math.min(maxScrollY, Math.max(0, centeredY));
    const timer = setTimeout(() => {
      calendarScrollRef.current?.scrollTo({ y: scrollY, animated: false });
    }, 80);

    return () => clearTimeout(timer);
  }, [calendarViewportHeight, dayCanvasHeight, dayCenterKey, dayFirstHour, isTodayInDayMode]);

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
      {/* The ScrollView is the card's first descendant (subviews[0]) so react-native-screens
          scrolls it to top when the active bottom tab is re-tapped. */}
      <ScrollView
        ref={calendarScrollRef}
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{ paddingBottom: spacing.xs }}
        showsVerticalScrollIndicator={false}
        onLayout={(event) => setCalendarViewportHeight(event.nativeEvent.layout.height)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
      >
        {mode === "list" ? (
          visibleRideCount === 0 ? (
            <ScheduleEmptyState mode={mode} minHeight={Math.max(260, calendarViewportHeight - spacing.md)} />
          ) : (
            <AgendaList items={listItems} onOpenRide={onOpenRide} />
          )
        ) : mode === "day" ? (
          <DayCalendar items={dayItems} selectedKey={selectedKey} todayKey={todayKey} hours={dayTimelineHours} onOpenRide={onOpenRide} />
        ) : mode === "week" ? (
          <WeekCalendar days={weekDays} items={weekItems} selectedKey={selectedKey} onSelectDate={onSelectDate} onOpenRide={onOpenRide} />
        ) : (
          <MonthCalendar days={monthDays} items={monthItems} todayKey={todayKey} selectedKey={selectedKey} onSelectDate={onSelectDate} onOpenRide={onOpenRide} />
        )}
      </ScrollView>
    </View>
  );
}

function ScheduleEmptyState({ mode, minHeight }: { mode: CalendarMode; minHeight: number }) {
  const title = mode === "list"
    ? "No scheduled rides"
    : mode === "day"
      ? "No rides this day"
      : mode === "week"
        ? "No rides this week"
        : "No rides this month";
  const body = mode === "list"
    ? "Pull to refresh when dispatch assigns new work."
    : "Pull to refresh, or switch views.";

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${title}. ${body}`}
      style={{
        minHeight,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xl,
        gap: spacing.sm,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 54,
          height: 54,
          borderRadius: radii.lg,
          backgroundColor: colors.surfaceLow,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.slate100,
        }}
      >
        <SymbolIcon
          name="calendar.badge.clock"
          size={25}
          type="hierarchical"
          tintColor={colors.slate500}
          weight="semibold"
        />
      </View>
      <View style={{ gap: 5, alignItems: "center" }}>
        <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "900", lineHeight: 23, textAlign: "center" }}>
          {title}
        </Text>
        <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "700", lineHeight: 19, textAlign: "center", maxWidth: 260 }}>
          {body}
        </Text>
      </View>
    </View>
  );
}

export function ScheduleNotice({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderLeftWidth: 4, borderLeftColor: colors.error, borderRadius: radii.sm, padding: spacing.md, gap: 4, ...shadows.soft }}>
      <Text style={{ color: colors.error, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4 }}>
        {title}
      </Text>
      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>{body}</Text>
    </View>
  );
}

function DateArrow({ label, iconName, onPress }: { label: string; iconName: "chevron.left" | "chevron.right"; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Changes the schedule date range"
      hitSlop={10}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: radii.pill,
        backgroundColor: pressed ? colors.surfaceHigh : colors.surfaceLow,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.62 : 1,
      })}
    >
      <SymbolIcon
        name={iconName}
        size={18}
        type="hierarchical"
        tintColor={colors.blue}
        weight="bold"
      />
    </Pressable>
  );
}

function DayCalendar({
  items,
  selectedKey,
  todayKey,
  hours,
  onOpenRide,
}: {
  items: ScheduledItem[];
  selectedKey: string;
  todayKey: string;
  hours: number[];
  onOpenRide: (ride: DispatchedRide) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  const firstHour = hours[0] ?? 7;
  const canvasHeight = hours.length * HOUR_HEIGHT;
  const showCurrentTime = selectedKey === todayKey;
  const currentTop = currentTimeTop(now, firstHour);
  const currentHour = showCurrentTime ? now.getHours() : null;

  useEffect(() => {
    if (!showCurrentTime) return;
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, [showCurrentTime]);

  return (
    <View style={timelineStyle}>
      <View style={{ height: canvasHeight, position: "relative" }}>
        {hours.map((hour, index) => (
          <View key={hour} style={[timelineRowStyle, { top: index * HOUR_HEIGHT }]}>
            <Text style={[timelineTimeStyle, hour === currentHour ? { opacity: 0 } : null]}>{formatHour(hour)}</Text>
            <View style={timelineSlotStyle} />
          </View>
        ))}
        {items.map((item, index) => (
          <CalendarEventBlock
            key={item.ride.id}
            item={item}
            mode="day"
            onPress={() => onOpenRide(item.ride)}
            style={{
              position: "absolute",
              left: TIME_RAIL_WIDTH + spacing.sm,
              right: spacing.sm,
              top: itemTop(item, firstHour) + 5 + indexCollisionOffset(items, item, index),
              minHeight: 54,
            }}
          />
        ))}
        {showCurrentTime ? <CurrentTimeIndicator now={now} top={currentTop} /> : null}
      </View>
    </View>
  );
}

function CurrentTimeIndicator({ now, top }: { now: Date; top: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        right: spacing.sm,
        top,
        height: 20,
        flexDirection: "row",
        alignItems: "center",
        zIndex: 10,
      }}
    >
      <View style={{ width: TIME_RAIL_WIDTH, alignItems: "center" }}>
        <Text
          numberOfLines={1}
          style={{
            color: colors.error,
            fontSize: 10,
            fontWeight: "900",
            backgroundColor: colors.surface,
            borderRadius: radii.xs,
            paddingHorizontal: 3,
            overflow: "hidden",
          }}
        >
          {formatTime(now, "")}
        </Text>
      </View>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.error }} />
      <View style={{ flex: 1, height: 2, backgroundColor: colors.error }} />
    </View>
  );
}

function AgendaList({ items, onOpenRide }: { items: ScheduledItem[]; onOpenRide: (ride: DispatchedRide) => void }) {
  const grouped = groupAgendaItems(items);
  return (
    <View style={{ gap: spacing.md }}>
      {grouped.map((group) => (
        <View key={group.key} style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "900", lineHeight: 23 }}>
              {formatAgendaDate(group.date)}
            </Text>
            <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "900" }}>
              {rideCountLabel(group.items.length)}
            </Text>
          </View>
          <View style={{ gap: spacing.xs }}>
            {group.items.map((item) => (
              <AgendaRideRow key={item.ride.id} item={item} onPress={() => onOpenRide(item.ride)} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function AgendaRideRow({ item, onPress }: { item: ScheduledItem; onPress: () => void }) {
  const ride = item.ride;
  const pending = isPendingRide(ride);
  const active = isActiveScheduleRide(ride);
  // toLocaleTimeString separates the AM/PM with a narrow no-break space (U+202F),
  // so split on any whitespace — a plain " " split silently keeps them joined.
  const timeParts = item.timeLabel.split(/\s+/);
  const timeClock = timeParts[0];
  const timePeriod = timeParts.length > 1 ? timeParts[timeParts.length - 1] : "";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${ride.passengerName} ride. ${item.timeLabel}. ${pending ? "Upcoming ride" : active ? "Active ride" : "Scheduled ride"}. Pickup ${ride.pickupAddress}. Dropoff ${ride.dropoffAddress}.`}
      style={({ pressed }) => ({
        borderRadius: radii.sm,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: pending ? colors.amber : active ? colors.green : colors.slate100,
        padding: spacing.sm,
        flexDirection: "row",
        gap: spacing.sm,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <View style={{ width: 50, alignItems: "center", gap: 4 }}>
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "900", lineHeight: 18 }} numberOfLines={1}>
            {timeClock}
          </Text>
          {timePeriod ? (
            <Text style={{ color: colors.slate500, fontSize: 11, fontWeight: "800", lineHeight: 13 }} numberOfLines={1}>
              {timePeriod}
            </Text>
          ) : null}
        </View>
        <View style={{ width: 2, flex: 1, minHeight: 54, borderRadius: radii.pill, backgroundColor: pending ? colors.amberSoft : active ? colors.greenSoft : colors.blueSoft }} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "900", lineHeight: 20 }}>
              {ride.passengerName}
            </Text>
            <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "800", lineHeight: 16 }}>
              {rideShortLabel(ride)} · {ride.transitType}
            </Text>
          </View>
          <StatusBadge status={scheduleStatusKey(ride)} />
        </View>
        <View style={{ gap: 5 }}>
          <CompactRouteLine color={colors.green} address={ride.pickupAddress} />
          <CompactRouteLine color={colors.blue} address={ride.dropoffAddress} />
        </View>
      </View>
    </Pressable>
  );
}

function CompactRouteLine({ color, address }: { color: string; address: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ flex: 1, color: colors.slate500, fontSize: 12, fontWeight: "700", lineHeight: 16 }}>
        {address}
      </Text>
    </View>
  );
}

function WeekCalendar({
  days,
  items,
  selectedKey,
  onSelectDate,
  onOpenRide,
}: {
  days: Array<{ date: Date; key: string }>;
  items: ScheduledItem[];
  selectedKey: string;
  onSelectDate: (date: Date) => void;
  onOpenRide: (ride: DispatchedRide) => void;
}) {
  const byDay = groupByDay(items);
  const hours = buildTimelineHours(items);
  const firstHour = hours[0] ?? 7;
  const canvasHeight = hours.length * WEEK_HOUR_HEIGHT;
  return (
    <View style={weekShellStyle}>
      <View style={{ flexDirection: "row", paddingLeft: TIME_RAIL_WIDTH }}>
        {days.map((day) => {
          const selected = day.key === selectedKey;
          return (
            <Pressable
              key={day.key}
              onPress={() => onSelectDate(day.date)}
              accessibilityRole="button"
              accessibilityLabel={`Select ${formatAgendaDate(day.date)}`}
              accessibilityState={{ selected }}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 46,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radii.xs,
                backgroundColor: selected ? colors.primary : "transparent",
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Text style={{ color: selected ? colors.surface : colors.slate400, fontSize: 10, fontWeight: "900", textTransform: "uppercase" }}>
                {weekdayShort(day.date)}
              </Text>
              <Text style={{ color: selected ? colors.surface : colors.primary, fontSize: 15, fontWeight: "900" }}>
                {day.date.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ height: canvasHeight, position: "relative" }}>
        {hours.map((hour, index) => (
          <View key={hour} style={[weekHourLineStyle, { top: index * WEEK_HOUR_HEIGHT }]}>
            <Text style={timelineTimeStyle}>{formatHour(hour)}</Text>
          </View>
        ))}
        <View style={{ position: "absolute", left: TIME_RAIL_WIDTH, right: 0, top: 0, bottom: 0, flexDirection: "row" }}>
          {days.map((day) => {
            const dayItems = byDay.get(day.key) ?? [];
            const primaryPendingItem = dayItems.find((item) => isPendingRide(item.ride));
            return (
              <View key={day.key} style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: colors.slate100, position: "relative" }}>
                <Pressable
                  onPress={() => primaryPendingItem ? onOpenRide(primaryPendingItem.ride) : onSelectDate(day.date)}
                  accessibilityRole="button"
                  accessibilityLabel={primaryPendingItem ? `Open upcoming ride ${rideShortLabel(primaryPendingItem.ride)}` : `Select ${formatAgendaDate(day.date)}`}
                  style={({ pressed }) => ({
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    opacity: pressed ? 0.72 : 1,
                  })}
                />
                {dayItems.map((item, index) => (
                  <CalendarEventBlock
                    key={item.ride.id}
                    item={item}
                    mode="week"
                    onPress={() => onOpenRide(item.ride)}
                    style={{
                      position: "absolute",
                      left: 3,
                      right: 3,
                      top: itemTop(item, firstHour, WEEK_HOUR_HEIGHT) + 4 + indexCollisionOffset(dayItems, item, index, 3),
                      minHeight: 38,
                      zIndex: 2,
                    }}
                  />
                ))}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function MonthCalendar({
  days,
  items,
  todayKey,
  selectedKey,
  onSelectDate,
  onOpenRide,
}: {
  days: Array<{ date: Date; key: string; inMonth: boolean }>;
  items: ScheduledItem[];
  todayKey: string;
  selectedKey: string;
  onSelectDate: (date: Date) => void;
  onOpenRide: (ride: DispatchedRide) => void;
}) {
  const byDay = groupByDay(items);
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
            const dayItems = byDay.get(day.key) ?? [];
            const primaryPendingItem = dayItems.find((item) => isPendingRide(item.ride));
            const isToday = day.key === todayKey;
            const selected = day.key === selectedKey;
            return (
              <View
                key={day.key}
                style={{
                  flex: 1,
                  minHeight: 70,
                  borderRadius: radii.xs,
                  backgroundColor: selected ? colors.primary : isToday ? colors.surfaceLow : colors.surface,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.slate100,
                  padding: 6,
                  gap: 5,
                  opacity: day.inMonth ? 1 : 0.32,
                  position: "relative",
                }}
              >
                <Pressable
                  onPress={() => primaryPendingItem ? onOpenRide(primaryPendingItem.ride) : onSelectDate(day.date)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={primaryPendingItem ? `Open upcoming ride ${rideShortLabel(primaryPendingItem.ride)}` : `Select ${formatAgendaDate(day.date)}`}
                  style={({ pressed }) => ({
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0,
                    borderRadius: radii.xs,
                    opacity: pressed ? 0.72 : 1,
                  })}
                />
                <View pointerEvents="box-none" style={{ gap: 5 }}>
                  <Text style={{ color: selected ? colors.surface : colors.primary, fontSize: 12, fontWeight: "900", textAlign: "right" }}>
                    {day.date.getDate()}
                  </Text>
                  {dayItems.slice(0, 2).map((item) => (
                    <MonthEventBar key={item.ride.id} item={item} selected={selected} onPress={() => onOpenRide(item.ride)} />
                  ))}
                  {dayItems.length > 2 ? (
                    <Text style={{ color: selected ? colors.greenLight : colors.slate500, fontSize: 9, fontWeight: "900" }}>+{dayItems.length - 2} more</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function CalendarEventBlock({
  item,
  mode,
  style,
  onPress,
}: {
  item: ScheduledItem;
  mode: "day" | "week";
  style?: object;
  onPress: () => void;
}) {
  const compact = mode === "week";
  const pending = isPendingRide(item.ride);
  const active = isActiveScheduleRide(item.ride);
  const eventColor = pending ? colors.amber : active ? colors.green : colors.blue;
  const eventSoftColor = pending ? colors.surface : active ? colors.greenSoft : colors.blueSoft;
  const eventBorderColor = pending ? colors.amber : active ? "rgba(22, 163, 74, 0.24)" : "rgba(37, 99, 235, 0.18)";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.ride.passengerName} ride. ${item.timeLabel}. ${pending ? "Upcoming ride" : active ? "Active ride" : "Scheduled ride"}.`}
      style={({ pressed }) => ({
        // Week columns are only ~36px wide, so the chip is a filled colour block
        // positioned on the time rail (no text — any label just truncates to "…").
        // Day mode keeps the full detail card.
        backgroundColor: compact ? (pending ? colors.surface : eventColor) : eventSoftColor,
        borderRadius: radii.xs,
        paddingHorizontal: compact ? 0 : spacing.sm,
        paddingVertical: compact ? 0 : spacing.sm,
        gap: compact ? 0 : 3,
        opacity: pressed ? 0.72 : 1,
        borderWidth: compact ? (pending ? 1 : 0) : 1,
        borderColor: compact ? eventColor : mode === "day" ? eventBorderColor : pending ? colors.amber : active ? colors.greenSoft : colors.slate100,
        borderLeftWidth: compact ? (pending ? 1 : 0) : pending ? 1 : 3,
        borderLeftColor: eventColor,
        ...style,
      })}
    >
      {compact ? null : (
        <>
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "900" }}>
            {item.ride.passengerName}
          </Text>
          <Text style={{ color: pending ? colors.amber : active ? colors.greenStrong : colors.blue, fontSize: 12, fontWeight: "900" }} numberOfLines={1}>
            {item.timeLabel} · {pending ? "Upcoming" : active ? "Active" : item.ride.transitType}
          </Text>
          <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "700" }}>
            {item.ride.pickupAddress}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function MonthEventBar({ item, selected, onPress }: { item: ScheduledItem; selected: boolean; onPress: () => void }) {
  const pending = isPendingRide(item.ride);
  const active = isActiveScheduleRide(item.ride);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.ride.passengerName} ride. ${item.timeLabel}. ${pending ? "Upcoming ride" : active ? "Active ride" : "Scheduled ride"}.`}
      style={({ pressed }) => ({
        minHeight: pending ? 7 : 5,
        borderRadius: radii.pill,
        backgroundColor: pending ? "transparent" : selected ? colors.surfaceScrim80 : active ? colors.green : colors.blue,
        borderWidth: pending ? 1 : 0,
        borderColor: pending ? colors.amber : "transparent",
        opacity: pressed ? 0.72 : 1,
      })}
    />
  );
}

const dateStripStyle = {
  minHeight: 50,
  borderRadius: radii.pill,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.slate200,
  padding: spacing.xs,
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
} as const;

const timelineStyle = {
  borderRadius: radii.sm,
  borderWidth: 1,
  borderColor: colors.slate100,
  overflow: "hidden",
  backgroundColor: colors.surface,
} as const;

const timelineRowStyle = {
  position: "absolute",
  left: 0,
  right: 0,
  height: HOUR_HEIGHT,
  flexDirection: "row",
  borderBottomWidth: 1,
  borderBottomColor: colors.slate100,
} as const;

const timelineTimeStyle = {
  width: TIME_RAIL_WIDTH,
  paddingTop: 10,
  color: colors.slate400,
  fontSize: 11,
  fontWeight: "900",
  textAlign: "center",
} as const;

const timelineSlotStyle = {
  flex: 1,
  borderLeftWidth: 1,
  borderLeftColor: colors.slate100,
} as const;

const weekShellStyle = {
  borderRadius: radii.sm,
  borderWidth: 1,
  borderColor: colors.slate100,
  overflow: "hidden",
  backgroundColor: colors.surface,
} as const;

const weekHourLineStyle = {
  position: "absolute",
  left: 0,
  right: 0,
  height: WEEK_HOUR_HEIGHT,
  borderTopWidth: 1,
  borderTopColor: colors.slate100,
} as const;
