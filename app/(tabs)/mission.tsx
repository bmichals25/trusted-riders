import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { AvailabilityCalendar } from "@/features/availability/availability-calendar";
import { AvailabilityDaySheet } from "@/features/availability/availability-day-sheet";
import { AvailabilityEditor } from "@/features/availability/availability-editor";
import { type AvailabilityDay } from "@/lib/availability";
import { fetchMyAvailability } from "@/lib/availability-api";
import { PageTransition } from "@/components/ui/PageTransition";
import { CalendarSurface, ScheduleNotice, ScheduleToolbar } from "@/features/schedule/schedule-calendar";
import {
  addDays,
  addMonths,
  buildMonth,
  buildWeek,
  type CalendarMode,
  dayKey,
  isCalendarRideStatus,
  mergeRideLists,
  selectedDayAfterDateChange,
  startOfDay,
  toScheduledItem,
} from "@/features/schedule/schedule-model";
import { useToday } from "@/features/schedule/use-today";
import { useDispatch } from "@/lib/dispatch-context";
import { fetchRides } from "@/lib/fleet-api";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { type DispatchedRide } from "@/lib/rides";
import { groupRidesByTrip } from "@/lib/round-trip";
import { colors, radii, shadows, spacing } from "@/lib/theme";

type ScheduleSection = "rides" | "availability";

const SECTIONS: { key: ScheduleSection; label: string }[] = [
  { key: "rides", label: "Rides" },
  { key: "availability", label: "My availability" },
];


export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { rides, refreshRides, backendError } = useDispatch();
  const { impact } = useHaptics();
  const [fetchedRides, setFetchedRides] = useState<DispatchedRide[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<CalendarMode>("day");
  // ?section=availability opens My availability (e.g. from onboarding).
  const { section: sectionParam } = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<ScheduleSection>(sectionParam === "availability" ? "availability" : "rides");
  useEffect(() => {
    if (sectionParam === "availability") setSection("availability");
  }, [sectionParam]);
  // "Today" follows the clock (it used to be fixed when the tab first mounted, so after midnight the
  // schedule still opened on yesterday).
  const today = useToday(isFocused);
  const [selectedDate, setSelectedDate] = useState(() => today);
  const todayKey = dayKey(today);
  const selectedKey = dayKey(selectedDate);
  const previousTodayRef = useRef(today);

  useEffect(() => {
    const previousToday = previousTodayRef.current;
    if (previousToday.getTime() === today.getTime()) return;
    previousTodayRef.current = today;
    setSelectedDate((selected) => selectedDayAfterDateChange(selected, previousToday, today));
  }, [today]);

  const scheduleSourceRides = useMemo(() => mergeRideLists(rides, fetchedRides), [fetchedRides, rides]);
  const calendarRides = useMemo(
    () => scheduleSourceRides.filter((ride) => isCalendarRideStatus(ride.status)),
    [scheduleSourceRides],
  );
  // One item per round trip (its current leg), so day counts and the agenda count trips, not legs.
  const scheduledItems = useMemo(
    () =>
      groupRidesByTrip(calendarRides)
        .map((entry) => toScheduledItem(entry.ride))
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
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

  // My availability as a calendar (Day / Week / Month): the visible range's days, keyed by date.
  const [availability, setAvailability] = useState<Map<string, AvailabilityDay>>(new Map());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const availabilityRange = useMemo(() => {
    const visible = mode === "month" ? monthDays : weekDays;
    return { from: visible[0]?.key ?? todayKey, days: visible.length || 7 };
  }, [mode, monthDays, weekDays, todayKey]);
  const loadAvailability = useCallback(async () => {
    const result = await fetchMyAvailability(availabilityRange);
    if (result.kind === "ok") {
      setAvailability((prev) => {
        const next = new Map(prev);
        for (const day of result.days) next.set(day.date, day);
        return next;
      });
    }
  }, [availabilityRange]);
  useEffect(() => {
    if (!isFocused || section !== "availability" || mode === "list") return;
    void loadAvailability();
  }, [isFocused, loadAvailability, mode, section]);
  const editingDay = editingKey
    ? availability.get(editingKey) ?? { date: editingKey, status: null, windows: [] }
    : null;

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
    try {
      await Promise.all([
        refreshRides(),
        fetchRides().then(setFetchedRides).catch((error) => {
          console.log("[mission] direct ride fetch skipped", error instanceof Error ? error.message : error);
        }),
      ]);
    } finally {
      setRefreshing(false);
    }
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
        {/* column-reverse: the CalendarSurface (which owns the scrollable region) is declared
            first so it becomes the native first-descendant (subviews[0]) that
            react-native-screens scrolls to top when the active bottom tab is re-tapped. The
            toolbar and notice are declared after it but still render above it. */}
        <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.sm, gap: spacing.sm, flexDirection: "column-reverse" }}>
          {section === "availability" ? (
            <FadeInBlock delay={40} style={{ flex: 1, minHeight: 0 }}>
              {mode === "list" ? (
                <AvailabilityEditor />
              ) : (
                <AvailabilityCalendar
                  mode={mode}
                  selectedKey={selectedKey}
                  todayKey={todayKey}
                  days={availability}
                  weekDays={weekDays}
                  monthDays={monthDays}
                  rides={mode === "month" ? monthItems : weekItems}
                  onSelectDate={selectDate}
                  onEditDay={(key) => {
                    impact(ImpactFeedbackStyle.Light);
                    setEditingKey(key);
                  }}
                />
              )}
            </FadeInBlock>
          ) : (
          <FadeInBlock delay={90} style={{ flex: 1, minHeight: 0 }}>
            <CalendarSurface
              mode={mode}
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
          )}

          {section === "rides" && backendError ? (
            <FadeInBlock delay={120}>
              <ScheduleNotice title="Backend rides unavailable" body={backendError} />
            </FadeInBlock>
          ) : null}

          <FadeInBlock delay={40}>
            <ScheduleToolbar
              mode={mode}
              selectedDate={selectedDate}
              onPrevious={() => stepDate(-1)}
              onNext={() => stepDate(1)}
              onModeChange={selectMode}
              listTitle={section === "availability" ? "Next two weeks" : undefined}
            />
          </FadeInBlock>

          <SectionSwitch
            value={section}
            onChange={(next) => {
              impact(ImpactFeedbackStyle.Light);
              setSection(next);
            }}
          />
        </View>
        <AvailabilityDaySheet
          day={editingDay}
          isToday={editingKey === todayKey}
          onClose={() => setEditingKey(null)}
          onSaved={(day) => {
            setAvailability((prev) => new Map(prev).set(day.date, day));
            setEditingKey(null);
          }}
        />
      </View>
    </PageTransition>
  );
}

/** Rides | My availability, at the top of the Schedule tab. */
function SectionSwitch({ value, onChange }: { value: ScheduleSection; onChange: (next: ScheduleSection) => void }) {
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        padding: 3,
        gap: 3,
        borderRadius: radii.md,
        borderCurve: "continuous",
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.slate200,
        ...shadows.soft,
      }}
    >
      {SECTIONS.map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => !active && onChange(item.key)}
            style={{
              flex: 1,
              minHeight: 38,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.sm,
              borderCurve: "continuous",
              backgroundColor: active ? colors.primary : "transparent",
            }}
          >
            <Text style={{ color: active ? colors.surface : colors.primarySoft, fontSize: 15, fontWeight: "800" }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
