import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { LocationRow } from "@/components/ui/LocationRow";
import { PageTransition } from "@/components/ui/PageTransition";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useDispatch } from "@/lib/dispatch-context";
import { fetchRides } from "@/lib/fleet-api";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { type DispatchedRide } from "@/lib/rides";
import { colors, radii, shadows, spacing } from "@/lib/theme";

type CalendarMode = "list" | "day" | "week" | "month";

type ScheduledItem = {
  ride: DispatchedRide;
  startsAt: Date;
  dayKey: string;
  timeLabel: string;
};

const MODES: CalendarMode[] = ["list", "day", "week", "month"];
const HOUR_HEIGHT = 64;
const WEEK_HOUR_HEIGHT = 52;
const TIME_RAIL_WIDTH = 52;


export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { rides, refreshRides, backendError } = useDispatch();
  const { impact } = useHaptics();
  const [fetchedRides, setFetchedRides] = useState<DispatchedRide[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<CalendarMode>("day");
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = dayKey(today);
  const selectedKey = dayKey(selectedDate);

  const scheduleSourceRides = useMemo(() => mergeRideLists(rides, fetchedRides), [fetchedRides, rides]);
  const calendarRides = useMemo(
    () => scheduleSourceRides.filter((ride) => ride.status === "accepted" || ride.status === "pending"),
    [scheduleSourceRides],
  );
  const scheduledItems = useMemo(
    () => calendarRides.map(toScheduledItem).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    [calendarRides],
  );
  const selectedDayItems = scheduledItems.filter((item) => item.dayKey === selectedKey);
  const weekDays = useMemo(() => buildWeek(selectedDate), [selectedDate]);
  const weekItems = scheduledItems.filter((item) => weekDays.some((day) => day.key === item.dayKey));
  const monthDays = useMemo(() => buildMonth(selectedDate), [selectedDate]);
  const monthItems = scheduledItems.filter((item) => {
    const start = startOfDay(item.startsAt);
    return start.getFullYear() === selectedDate.getFullYear() && start.getMonth() === selectedDate.getMonth();
  });

  const stepDate = useCallback((direction: -1 | 1) => {
    impact(ImpactFeedbackStyle.Light);
    const amount = mode === "week" ? 7 : 1;
    setSelectedDate((date) => mode === "month" ? addMonths(date, direction) : addDays(date, direction * amount));
  }, [impact, mode]);

  const selectDate = useCallback((date: Date) => {
    impact(ImpactFeedbackStyle.Light);
    setSelectedDate(startOfDay(date));
  }, [impact]);

  const selectMode = useCallback((nextMode: CalendarMode) => {
    impact(ImpactFeedbackStyle.Light);
    setMode(nextMode);
  }, [impact]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refreshRides(),
      fetchRides().then(setFetchedRides).catch((error) => {
        console.log("[mission] direct ride fetch skipped", error instanceof Error ? error.message : error);
      }),
    ]);
    setRefreshing(false);
  }, [refreshRides]);

  useEffect(() => {
    if (!isFocused) return;
    void refreshRides();
    void fetchRides().then(setFetchedRides).catch((error) => {
      console.log("[mission] direct ride fetch skipped", error instanceof Error ? error.message : error);
    });
  }, [isFocused, refreshRides]);

  const openCalendarRide = useCallback((ride: DispatchedRide) => {
    impact(ImpactFeedbackStyle.Light);
    router.push(`/ride-details?rideId=${encodeURIComponent(ride.id)}`);
  }, [impact, router]);

  return (
    <PageTransition>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.surfaceLow,
          paddingTop: insets.top + spacing.xs,
        }}
      >
        <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.sm, gap: spacing.sm }}>
          <FadeInBlock delay={40}>
            <ScheduleToolbar
              mode={mode}
              selectedDate={selectedDate}
              onPrevious={() => stepDate(-1)}
              onNext={() => stepDate(1)}
              onModeChange={selectMode}
            />
          </FadeInBlock>

          {backendError ? (
            <FadeInBlock delay={120}>
              <Notice title="Backend rides unavailable" body={backendError} />
            </FadeInBlock>
          ) : null}

          <FadeInBlock delay={90} style={{ flex: 1, minHeight: 0 }}>
            <CalendarSurface
              mode={mode}
              selectedDate={selectedDate}
              selectedKey={selectedKey}
              todayKey={todayKey}
              listItems={scheduledItems}
              dayItems={selectedDayItems}
              weekDays={weekDays}
              weekItems={weekItems}
              monthDays={monthDays}
              monthItems={monthItems}
              onSelectDate={selectDate}
              onOpenRide={openCalendarRide}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          </FadeInBlock>
        </View>
      </View>
    </PageTransition>
  );
}

function ScheduleToolbar({
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
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
        <Text style={{ color: colors.primary, fontSize: 30, fontWeight: "900", lineHeight: 35 }}>
          Schedule
        </Text>
        <ModeControl mode={mode} onChange={onModeChange} />
      </View>

      {mode === "list" ? (
        <View style={dateStripStyle}>
          <View style={{ flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 3 }}>
            <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "900", lineHeight: 22 }} numberOfLines={1}>
              All scheduled rides
            </Text>
            <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "800", lineHeight: 16 }} numberOfLines={1}>
              Agenda view
            </Text>
          </View>
        </View>
      ) : (
        <View style={dateStripStyle}>
          <DateArrow label="Previous date" glyph="‹" onPress={onPrevious} />
          <View style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
            <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "900", lineHeight: 22 }} numberOfLines={1}>
              {formatHeaderDate(selectedDate, mode)}
            </Text>
            <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "800", lineHeight: 16 }} numberOfLines={1}>
              {dateSubtitle(selectedDate, mode)}
            </Text>
          </View>
          <DateArrow label="Next date" glyph="›" onPress={onNext} />
        </View>
      )}
    </View>
  );
}

function DateArrow({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: radii.pill,
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.62 : 1,
      })}
    >
      <Text style={{ color: colors.blue, fontSize: 28, fontWeight: "700", lineHeight: 29 }}>
        {glyph}
      </Text>
    </Pressable>
  );
}

function ModeControl({ mode, onChange }: { mode: CalendarMode; onChange: (mode: CalendarMode) => void }) {
  return (
    <View style={{ width: 224, backgroundColor: colors.surfaceHigh, borderRadius: radii.pill, padding: 2, flexDirection: "row", gap: 2 }}>
      {MODES.map((item) => {
        const selected = item === mode;
        return (
          <Pressable
            key={item}
            onPress={() => onChange(item)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 30,
              borderRadius: radii.pill,
              backgroundColor: selected ? colors.surface : "transparent",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.72 : 1,
              ...selected ? shadows.soft : null,
            })}
          >
            <Text style={{ color: selected ? colors.primary : colors.slate500, fontSize: 12, fontWeight: "800", textTransform: "capitalize" }}>
              {item}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CalendarSurface({
  mode,
  selectedDate,
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
  selectedDate: Date;
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
        gap: spacing.xs,
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        ...shadows.soft,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
        <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 }} numberOfLines={1}>
          {mode === "list" ? "Agenda" : mode === "day" ? "Daily schedule" : mode === "week" ? "Week view" : "Month view"}
        </Text>
        <View style={{ borderRadius: radii.pill, backgroundColor: colors.surfaceLow, paddingHorizontal: spacing.sm, paddingVertical: 6 }}>
          <Text style={{ color: visibleRideCount ? colors.blue : colors.slate500, fontSize: 12, fontWeight: "900" }}>
            {rideCountLabel(visibleRideCount)}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, minHeight: 0, gap: spacing.xs }}>
        <ScrollView
          ref={calendarScrollRef}
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ paddingBottom: spacing.xs }}
          showsVerticalScrollIndicator={false}
          onLayout={(event) => setCalendarViewportHeight(event.nativeEvent.layout.height)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
        >
          {mode === "list" ? (
            <AgendaList items={listItems} onOpenRide={onOpenRide} />
          ) : mode === "day" ? (
            <DayCalendar
              items={dayItems}
              selectedKey={selectedKey}
              todayKey={todayKey}
              hours={dayTimelineHours}
              onOpenRide={onOpenRide}
            />
          ) : mode === "week" ? (
            <WeekCalendar days={weekDays} items={weekItems} selectedKey={selectedKey} onSelectDate={onSelectDate} onOpenRide={onOpenRide} />
          ) : (
            <MonthCalendar days={monthDays} items={monthItems} todayKey={todayKey} selectedKey={selectedKey} onSelectDate={onSelectDate} onOpenRide={onOpenRide} />
          )}
        </ScrollView>

      </View>
    </View>
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
            <Text style={timelineTimeStyle}>{formatHour(hour)}</Text>
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
        <Text style={{ color: colors.error, fontSize: 10, fontWeight: "900" }}>
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${ride.passengerName} ride`}
      style={({ pressed }) => ({
        borderRadius: radii.sm,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: pending ? colors.amber : colors.slate100,
        padding: spacing.sm,
        flexDirection: "row",
        gap: spacing.sm,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <View style={{ width: 58, alignItems: "center", gap: 4 }}>
        <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "900" }} numberOfLines={1}>
          {item.timeLabel}
        </Text>
        <View style={{ width: 2, flex: 1, minHeight: 54, borderRadius: radii.pill, backgroundColor: pending ? colors.amberSoft : colors.blueSoft }} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "900", lineHeight: 20 }} numberOfLines={1}>
              {ride.passengerName}
            </Text>
            <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "800", lineHeight: 16 }} numberOfLines={1}>
              {rideShortLabel(ride)} · {ride.transitType}
            </Text>
          </View>
          <StatusBadge status={pending ? "pending" : "scheduled"} />
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
      <Text style={{ flex: 1, color: colors.slate500, fontSize: 12, fontWeight: "700", lineHeight: 16 }} numberOfLines={1}>
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
                  accessibilityLabel={primaryPendingItem ? `Open pending ride ${rideShortLabel(primaryPendingItem.ride)}` : `Select ${formatAgendaDate(day.date)}`}
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
                  accessibilityLabel={primaryPendingItem ? `Open pending ride ${rideShortLabel(primaryPendingItem.ride)}` : `Select ${formatAgendaDate(day.date)}`}
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
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.ride.passengerName} ride`}
      style={({ pressed }) => ({
        backgroundColor: pending ? colors.surface : mode === "day" ? colors.blueSoft : colors.surface,
        borderRadius: radii.xs,
        paddingHorizontal: compact ? 5 : spacing.sm,
        paddingVertical: compact ? 5 : spacing.sm,
        gap: compact ? 1 : 3,
        opacity: pressed ? 0.72 : 1,
        borderWidth: 1,
        borderColor: pending ? colors.amber : mode === "day" ? "rgba(37, 99, 235, 0.18)" : colors.slate100,
        borderLeftWidth: pending ? 1 : 3,
        borderLeftColor: pending ? colors.amber : colors.blue,
        ...style,
      })}
    >
      <Text style={{ color: colors.primary, fontSize: compact ? 10 : 14, fontWeight: "900" }} numberOfLines={compact ? 1 : 2}>
        {compact ? rideShortLabel(item.ride) : item.ride.passengerName}
      </Text>
      <Text style={{ color: pending ? colors.amber : colors.blue, fontSize: compact ? 9 : 12, fontWeight: "900" }} numberOfLines={1}>
        {item.timeLabel}{mode === "day" ? ` · ${pending ? "Pending" : item.ride.transitType}` : ""}
      </Text>
      {mode === "day" ? (
        <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
          {item.ride.pickupAddress}
        </Text>
      ) : null}
    </Pressable>
  );
}

function MonthEventBar({ item, selected, onPress }: { item: ScheduledItem; selected: boolean; onPress: () => void }) {
  const pending = isPendingRide(item.ride);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.ride.passengerName} ride`}
      style={({ pressed }) => ({
        minHeight: pending ? 7 : 5,
        borderRadius: radii.pill,
        backgroundColor: pending ? "transparent" : selected ? colors.surfaceScrim80 : colors.blue,
        borderWidth: pending ? 1 : 0,
        borderColor: pending ? colors.amber : "transparent",
        opacity: pressed ? 0.72 : 1,
      })}
    />
  );
}

function ScheduledRideCard({ item, onChat }: { item: ScheduledItem; onChat: () => void }) {
  const ride = item.ride;
  return (
    <View style={cardStyle}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <TimeBlock item={item} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, alignItems: "center" }}>
            <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "900", flex: 1 }} numberOfLines={1}>
              {ride.passengerName}
            </Text>
            <StatusBadge status="scheduled" />
          </View>
          <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "700" }}>
            {formatShortDate(item.startsAt)} · {ride.transitType}
          </Text>
        </View>
      </View>
      <View style={{ gap: spacing.md }}>
        <LocationRow color={colors.green} label="Pickup" address={ride.pickupAddress} />
        <LocationRow color={colors.blue} label="Dropoff" address={ride.dropoffAddress} />
      </View>
      <ActionButton label="Chat" onPress={onChat} />
    </View>
  );
}

function TimeBlock({ item }: { item: ScheduledItem }) {
  return (
    <View style={{ width: 58, minHeight: 58, borderRadius: radii.sm, backgroundColor: colors.surfaceLow, alignItems: "center", justifyContent: "center", gap: 2 }}>
      <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "900" }}>{item.timeLabel}</Text>
      <Text style={{ color: colors.slate400, fontSize: 10, fontWeight: "900", textTransform: "uppercase" }}>
        {weekdayShort(item.startsAt)}
      </Text>
    </View>
  );
}

function SectionHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.md }}>
      <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "900" }}>{title}</Text>
      <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "900" }}>{detail}</Text>
    </View>
  );
}

function EmptySchedule({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, gap: 4 }}>
      <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "900", lineHeight: 22 }}>
        {title}
      </Text>
      <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
        {body}
      </Text>
    </View>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderLeftWidth: 4, borderLeftColor: colors.error, borderRadius: radii.sm, padding: spacing.md, gap: 4, ...shadows.soft }}>
      <Text style={{ color: colors.error, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4 }}>
        {title}
      </Text>
      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>{body}</Text>
    </View>
  );
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        minHeight: 48,
        borderRadius: radii.sm,
        backgroundColor: colors.surfaceLow,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

function toScheduledItem(ride: DispatchedRide): ScheduledItem {
  const startsAt = parseRideStart(ride);
  return {
    ride,
    startsAt,
    dayKey: dayKey(startsAt),
    timeLabel: formatTime(startsAt, ride.scheduledTime),
  };
}

function parseRideStart(ride: DispatchedRide): Date {
  const rawDate = ride.scheduledDate?.trim();
  const rawTime = ride.scheduledTime?.trim();
  const today = new Date();
  const base =
    /^today$/i.test(rawDate) ? today :
    /^tomorrow$/i.test(rawDate) ? addDays(today, 1) :
    new Date(`${rawDate} ${rawTime}`);

  const parsed = Number.isNaN(base.getTime()) ? new Date(ride.createdAt || Date.now()) : base;
  if (!rawTime || !Number.isNaN(base.getTime())) return parsed;

  const timeParsed = new Date(`${parsed.toDateString()} ${rawTime}`);
  return Number.isNaN(timeParsed.getTime()) ? parsed : timeParsed;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months, 1);
  return startOfDay(copy);
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildWeek(today: Date) {
  const start = addDays(today, -today.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    return { date, key: dayKey(date) };
  });
}

function buildMonth(today: Date) {
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index);
    return { date, key: dayKey(date), inMonth: date.getMonth() === today.getMonth() };
  });
}

function groupByDay(items: ScheduledItem[]) {
  const grouped = new Map<string, ScheduledItem[]>();
  items.forEach((item) => {
    const next = grouped.get(item.dayKey) ?? [];
    next.push(item);
    grouped.set(item.dayKey, next);
  });
  return grouped;
}

function mergeRideLists(primary: DispatchedRide[], fallback: DispatchedRide[]) {
  const byId = new Map<string, DispatchedRide>();
  fallback.forEach((ride) => byId.set(ride.id, ride));
  primary.forEach((ride) => byId.set(ride.id, ride));
  return Array.from(byId.values());
}

function groupAgendaItems(items: ScheduledItem[]) {
  const grouped = groupByDay(items);
  return Array.from(grouped.entries())
    .map(([key, groupItems]) => ({
      key,
      date: groupItems[0]?.startsAt ?? new Date(key),
      items: groupItems,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function groupByHour(items: ScheduledItem[]) {
  const grouped = new Map<number, ScheduledItem[]>();
  items.forEach((item) => {
    const hour = Number.isNaN(item.startsAt.getTime()) ? 8 : item.startsAt.getHours();
    const next = grouped.get(hour) ?? [];
    next.push(item);
    grouped.set(hour, next);
  });
  return grouped;
}

function itemTop(item: ScheduledItem, firstHour: number, hourHeight = HOUR_HEIGHT) {
  const date = item.startsAt;
  const hour = Number.isNaN(date.getTime()) ? firstHour : date.getHours();
  const minutes = Number.isNaN(date.getTime()) ? 0 : date.getMinutes();
  return Math.max(0, (hour - firstHour) * hourHeight + (minutes / 60) * hourHeight);
}

function currentTimeTop(now: Date, firstHour: number) {
  const top = (now.getHours() - firstHour) * HOUR_HEIGHT + (now.getMinutes() / 60) * HOUR_HEIGHT;
  return Math.max(0, top - 10);
}

function indexCollisionOffset(items: ScheduledItem[], item: ScheduledItem, index: number, amount = 4) {
  const itemHour = Number.isNaN(item.startsAt.getTime()) ? 8 : item.startsAt.getHours();
  const previousInHour = items.slice(0, index).filter((candidate) => {
    const candidateHour = Number.isNaN(candidate.startsAt.getTime()) ? 8 : candidate.startsAt.getHours();
    return candidateHour === itemHour;
  }).length;
  return previousInHour * amount;
}

function buildTimelineHours(items: ScheduledItem[], includeCurrentHour = false) {
  const rideHours = items.map((item) => Number.isNaN(item.startsAt.getTime()) ? 8 : item.startsAt.getHours());
  if (includeCurrentHour) rideHours.push(new Date().getHours());
  const earliest = Math.min(7, ...rideHours);
  const latest = Math.max(20, ...rideHours);
  return Array.from({ length: latest - earliest + 1 }, (_, index) => earliest + index);
}

function chunk<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function periodLabel(mode: CalendarMode) {
  if (mode === "list") return "List";
  if (mode === "day") return "Day";
  if (mode === "week") return "Week";
  return "Month";
}

function dateSubtitle(date: Date, mode: CalendarMode) {
  if (mode === "list") return "Agenda view";
  if (mode === "day") return "Daily agenda";
  if (mode === "week") return "Select a day from this week";
  return "Select a date from this month";
}

function rideCountLabel(count: number) {
  if (count === 0) return "No rides";
  if (count === 1) return "1 ride";
  return `${count} rides`;
}

function formatHeaderDate(date: Date, mode: CalendarMode) {
  if (mode === "month") {
    return date.toLocaleDateString([], { month: "long", year: "numeric" });
  }
  if (mode === "week") {
    const week = buildWeek(date);
    const start = week[0].date;
    const end = week[6].date;
    return `${formatShortDate(start)} - ${formatShortDate(end)}`;
  }
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function formatDailyTitle(date: Date) {
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function formatAgendaDate(date: Date) {
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function weekdayShort(date: Date) {
  return date.toLocaleDateString([], { weekday: "short" }).slice(0, 3);
}

function rideShortLabel(ride: DispatchedRide) {
  return `#${ride.id.replace(/^ride-?/i, "")}`;
}

function isPendingRide(ride: DispatchedRide) {
  return ride.status === "pending";
}

function formatHour(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric" });
}

function formatTime(date: Date, fallback: string) {
  if (Number.isNaN(date.getTime())) return fallback || "TBD";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

const cardStyle = {
  backgroundColor: colors.surface,
  borderRadius: radii.sm,
  padding: spacing.md,
  gap: spacing.md,
  ...shadows.soft,
} as const;

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

const countPillStyle = {
  borderRadius: radii.pill,
  backgroundColor: colors.surfaceLow,
  paddingHorizontal: spacing.sm,
  paddingVertical: 6,
} as const;

const calendarSurfaceStyle = {
  backgroundColor: colors.surface,
  borderRadius: radii.sm,
  padding: spacing.sm,
  gap: spacing.sm,
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
  ...shadows.soft,
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
