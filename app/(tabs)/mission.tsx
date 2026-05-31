import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FadeInBlock } from "@/components/ui/FadeInBlock";
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
  startOfDay,
  toScheduledItem,
} from "@/features/schedule/schedule-model";
import { useDispatch } from "@/lib/dispatch-context";
import { fetchRides } from "@/lib/fleet-api";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { type DispatchedRide } from "@/lib/rides";
import { colors, spacing } from "@/lib/theme";


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
    () => scheduleSourceRides.filter((ride) => isCalendarRideStatus(ride.status)),
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

          {backendError ? (
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
            />
          </FadeInBlock>
        </View>
      </View>
    </PageTransition>
  );
}
