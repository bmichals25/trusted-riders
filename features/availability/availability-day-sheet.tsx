import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DayCard } from "@/features/availability/availability-editor";
import { changedDays, dayLabel, windowsOverlap, withMode, type AvailabilityDay } from "@/lib/availability";
import { saveMyAvailability } from "@/lib/availability-api";
import { NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { colors, spacing } from "@/lib/theme";

/**
 * One day's availability as a sheet, opened by tapping a day in the availability calendar
 * (Day / Week / Month). Saves just that day.
 */
export function AvailabilityDaySheet({
  day,
  isToday,
  onClose,
  onSaved,
}: {
  day: AvailabilityDay | null;
  isToday: boolean;
  onClose: () => void;
  onSaved: (day: AvailabilityDay) => void;
}) {
  const insets = useSafeAreaInsets();
  const { selection, notification } = useHaptics();
  const [draft, setDraft] = useState<AvailabilityDay | null>(day);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(day);
    setError("");
  }, [day]);

  const changed = day && draft ? changedDays([day], [draft]).length > 0 : false;
  const overlapping = draft?.status === "available" && windowsOverlap(draft.windows);
  const label = day ? dayLabel(day.date) : null;

  const save = async () => {
    if (!draft || !changed || overlapping) return;
    setSaving(true);
    setError("");
    const result = await saveMyAvailability([draft]);
    setSaving(false);
    if (result.kind === "ok") {
      notification(NotificationFeedbackType.Success);
      onSaved(result.days.find((d) => d.date === draft.date) ?? draft);
    } else if (result.kind === "error") {
      setError(result.message);
      notification(NotificationFeedbackType.Error);
    }
  };

  return (
    <Modal visible={day != null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.surfaceLow }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={10}>
            <Text style={{ color: colors.blueStrong, fontSize: 17, fontWeight: "700" }}>Cancel</Text>
          </Pressable>
          <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "900" }}>
            {label ? `${isToday ? "Today" : label.weekday}, ${label.date}` : ""}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !changed || saving || overlapping }}
            disabled={!changed || saving || overlapping}
            onPress={save}
            hitSlop={10}
          >
            {saving ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={{ color: changed && !overlapping ? colors.blueStrong : colors.slate300, fontSize: 17, fontWeight: "900" }}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.lg, gap: spacing.md }}>
          {draft ? (
            <DayCard
              day={draft}
              isToday={isToday}
              onMode={(mode) => {
                selection();
                setDraft((d) => (d ? withMode(d, mode) : d));
              }}
              onWindows={(windows) => setDraft((d) => (d ? { ...d, windows } : d))}
              onTick={selection}
            />
          ) : null}
          {overlapping ? (
            <Text style={{ color: colors.error, fontSize: 13, fontWeight: "700" }}>
              Two time ranges overlap. Adjust them before saving.
            </Text>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 13, fontWeight: "700" }}>
              {error}
            </Text>
          ) : null}
          <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "600", lineHeight: 18, paddingHorizontal: 4 }}>
            Your coordinator sees this when assigning rides. Tap a mode again to clear the day back to "not set".
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}
