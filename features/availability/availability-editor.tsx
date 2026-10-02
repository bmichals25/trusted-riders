import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import { FadeInBlock } from "@/components/ui/FadeInBlock";
import {
  PRESETS,
  STEP_MINUTES,
  changedDays,
  clockLabel,
  dayLabel,
  dayMode,
  daySummary,
  nextWindow,
  nudgeWindow,
  windowsOverlap,
  withMode,
  type AvailabilityDay,
  type AvailabilityWindow,
  type DayMode,
} from "@/lib/availability";
import { fetchMyAvailability, saveMyAvailability } from "@/lib/availability-api";
import { NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme";

const MODES: { key: DayMode; label: string }[] = [
  { key: "off", label: "Off" },
  { key: "allDay", label: "All day" },
  { key: "hours", label: "Set hours" },
];

/**
 * My availability (Schedule tab → My availability): when the TrustedRider can drive over the next two
 * weeks, day by day. Dispatch sees it on its Schedule (Availability) and is warned when assigning a ride
 * outside it. Fills its parent: the day list scrolls, the save bar sits underneath.
 */
export function AvailabilityEditor() {
  const { selection, notification } = useHaptics();
  const [saved, setSaved] = useState<AvailabilityDay[]>([]);
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchMyAvailability();
    if (result.kind === "ok") {
      setSaved(result.days);
      setDays(result.days);
      setError("");
    } else if (result.kind === "error") {
      setError(result.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const changes = useMemo(() => changedDays(saved, days), [saved, days]);
  const overlapping = days.some((d) => d.status === "available" && windowsOverlap(d.windows));
  const unsetThisWeek = days.slice(0, 7).filter((d) => d.status == null).length;

  const updateDay = (date: string, next: (day: AvailabilityDay) => AvailabilityDay) => {
    setJustSaved(false);
    setDays((prev) => prev.map((d) => (d.date === date ? next(d) : d)));
  };

  const save = async () => {
    if (!changes.length || saving || overlapping) return;
    setSaving(true);
    setError("");
    const result = await saveMyAvailability(changes);
    setSaving(false);
    if (result.kind === "ok") {
      const byDate = new Map(result.days.map((d) => [d.date, d]));
      const merged = days.map((d) => byDate.get(d.date) ?? d);
      setSaved(merged);
      setDays(merged);
      setJustSaved(true);
      notification(NotificationFeedbackType.Success);
    } else if (result.kind === "error") {
      setError(result.message);
      notification(NotificationFeedbackType.Error);
    }
  };

  return (
    <View style={{ flex: 1, minHeight: 0, gap: spacing.sm }}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        style={{ flex: 1, marginHorizontal: -spacing.md }}
        contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <FadeInBlock delay={40}>
          <Text
            style={{
              color: colors.primarySoft,
              ...typography.footnote,
              fontWeight: "600",
              marginHorizontal: spacing.md + 4,
              marginBottom: spacing.md,
            }}
          >
            Tell your coordinator when you can drive. They see this when assigning rides, and you'll be asked to
            confirm any ride outside these hours.
          </Text>
        </FadeInBlock>

        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
        ) : (
          <>
            {unsetThisWeek > 0 ? (
              <FadeInBlock delay={60}>
                <View
                  style={{
                    marginHorizontal: spacing.md,
                    marginBottom: spacing.md,
                    padding: spacing.sm + 2,
                    borderRadius: radii.md,
                    borderCurve: "continuous",
                    backgroundColor: colors.amberSoft,
                  }}
                >
                  <Text style={{ color: colors.amberStrong, fontSize: 13, fontWeight: "800" }}>
                    {unsetThisWeek === 7 ? "This week isn't set yet" : `${unsetThisWeek} day${unsetThisWeek === 1 ? "" : "s"} this week not set`}
                  </Text>
                </View>
              </FadeInBlock>
            ) : null}

            {[
              { title: "Next 7 days", slice: days.slice(0, 7) },
              { title: "The week after", slice: days.slice(7) },
            ].map((group, gi) =>
              group.slice.length ? (
                <FadeInBlock key={group.title} delay={80 + gi * 60}>
                  <Text
                    style={{
                      color: colors.slate500,
                      ...typography.sectionKicker,
                      marginHorizontal: spacing.md + spacing.md,
                      marginBottom: spacing.sm,
                    }}
                  >
                    {group.title}
                  </Text>
                  <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.lg, gap: spacing.sm }}>
                    {group.slice.map((day, i) => (
                      <DayCard
                        key={day.date}
                        day={day}
                        isToday={gi === 0 && i === 0}
                        onMode={(mode) => {
                          selection();
                          updateDay(day.date, (d) => withMode(d, mode));
                        }}
                        onWindows={(windows) => updateDay(day.date, (d) => ({ ...d, windows }))}
                        onTick={selection}
                      />
                    ))}
                  </View>
                </FadeInBlock>
              ) : null,
            )}
          </>
        )}
      </ScrollView>

      <View style={{ gap: 6 }}>
        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 13, fontWeight: "700" }}>
            {error}
          </Text>
        ) : overlapping ? (
          <Text style={{ color: colors.error, fontSize: 13, fontWeight: "700" }}>
            Two time ranges on the same day overlap. Adjust them before saving.
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !changes.length || saving || overlapping }}
          disabled={!changes.length || saving || overlapping}
          onPress={save}
          style={({ pressed }) => ({
            minHeight: 50,
            borderRadius: radii.md,
            borderCurve: "continuous",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor:
              !changes.length && justSaved
                ? colors.greenSoft
                : !changes.length || overlapping
                  ? colors.slate300
                  : pressed
                    ? colors.primaryPressed
                    : colors.primary,
          })}
        >
          {saving ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text
              style={{
                color: !changes.length && justSaved ? colors.greenStrong : colors.surface,
                fontSize: 16,
                fontWeight: "900",
              }}
            >
              {changes.length
                ? `Save ${changes.length} day${changes.length === 1 ? "" : "s"}`
                : justSaved
                  ? "✓ Saved. Your coordinator can see it"
                  : "No changes"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function DayCard({
  day,
  isToday,
  onMode,
  onWindows,
  onTick,
}: {
  day: AvailabilityDay;
  isToday: boolean;
  onMode: (mode: DayMode) => void;
  onWindows: (windows: AvailabilityWindow[]) => void;
  onTick: () => void;
}) {
  const mode = dayMode(day);
  const label = dayLabel(day.date);
  const summaryColor =
    mode === "off" ? colors.error : mode === "unset" ? colors.slate400 : colors.greenStrong;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.md,
        borderCurve: "continuous",
        padding: spacing.sm + 2,
        gap: spacing.sm,
        ...shadows.soft,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
        <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "900" }}>
          {isToday ? "Today" : label.weekday}
        </Text>
        <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "700" }}>{label.date}</Text>
        <Text
          style={{ marginLeft: "auto", color: summaryColor, fontSize: 13, fontWeight: "800" }}
          numberOfLines={1}
        >
          {daySummary(day)}
        </Text>
      </View>

      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: "row", backgroundColor: colors.slate100, borderRadius: radii.sm, padding: 3, gap: 3 }}
      >
        {MODES.map((m) => {
          const active = mode === m.key;
          return (
            <Pressable
              key={m.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label.weekday} ${label.date}: ${m.label}`}
              onPress={() => onMode(active ? "unset" : m.key)}
              style={{
                flex: 1,
                minHeight: 36,
                borderRadius: radii.sm - 2,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? (m.key === "off" ? colors.error : colors.primary) : "transparent",
              }}
            >
              <Text style={{ color: active ? colors.surface : colors.primarySoft, fontSize: 14, fontWeight: "800" }}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {mode === "hours" ? (
        <View style={{ gap: spacing.sm }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.label}
                accessibilityRole="button"
                accessibilityLabel={`${p.label}, ${clockLabel(p.window.start)} to ${clockLabel(p.window.end)}`}
                onPress={() => {
                  onTick();
                  onWindows([p.window]);
                }}
                style={{
                  paddingHorizontal: 12,
                  minHeight: 32,
                  justifyContent: "center",
                  borderRadius: radii.pill,
                  borderWidth: 1,
                  borderColor: colors.slate300,
                }}
              >
                <Text style={{ color: colors.primarySoft, fontSize: 13, fontWeight: "700" }}>{p.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {day.windows.map((w, i) => (
            <WindowRow
              key={i}
              window={w}
              canRemove={day.windows.length > 1}
              onChange={(next) => {
                onTick();
                onWindows(day.windows.map((x, j) => (j === i ? next : x)));
              }}
              onRemove={() => {
                onTick();
                onWindows(day.windows.filter((_, j) => j !== i));
              }}
            />
          ))}

          {nextWindow(day.windows) ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const next = nextWindow(day.windows);
                if (!next) return;
                onTick();
                onWindows([...day.windows, next]);
              }}
              style={{ alignSelf: "flex-start", paddingVertical: 4 }}
            >
              <Text style={{ color: colors.blueStrong, fontSize: 14, fontWeight: "800" }}>+ Add another time</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function WindowRow({
  window,
  canRemove,
  onChange,
  onRemove,
}: {
  window: AvailabilityWindow;
  canRemove: boolean;
  onChange: (w: AvailabilityWindow) => void;
  onRemove: () => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <TimeStepper
        label="From"
        value={clockLabel(window.start)}
        onMinus={() => onChange(nudgeWindow(window, "start", -STEP_MINUTES))}
        onPlus={() => onChange(nudgeWindow(window, "start", STEP_MINUTES))}
      />
      <TimeStepper
        label="To"
        value={clockLabel(window.end)}
        onMinus={() => onChange(nudgeWindow(window, "end", -STEP_MINUTES))}
        onPlus={() => onChange(nudgeWindow(window, "end", STEP_MINUTES))}
      />
      {canRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove this time range"
          onPress={onRemove}
          hitSlop={8}
          style={{ width: 28, alignItems: "center" }}
        >
          <Text style={{ color: colors.slate500, fontSize: 20, fontWeight: "700" }}>×</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function TimeStepper({
  label,
  value,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  const button = (text: string, onPress: () => void, a11y: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: radii.sm,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? colors.slate200 : colors.slate100,
      })}
    >
      <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "800" }}>{text}</Text>
    </Pressable>
  );
  return (
    <View
      accessible={false}
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        borderWidth: 1,
        borderColor: colors.slate200,
        borderRadius: radii.sm,
        padding: 4,
      }}
    >
      {button("−", onMinus, `${label} earlier`)}
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={{ color: colors.slate500, fontSize: 10, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>
          {label}
        </Text>
        <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "800" }} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {button("+", onPlus, `${label} later`)}
    </View>
  );
}
