import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SymbolIcon } from "@/components/ui/SymbolIcon";
import { type DispatchedRide } from "@/lib/rides";
import { colors, radii, spacing } from "@/lib/theme";

const REASONS = ["Vehicle problem", "Sick or emergency", "Schedule conflict", "Other"] as const;
type Reason = (typeof REASONS)[number];

/**
 * Driver backs out of an upcoming ride. The passenger's trip is not cancelled: the ride goes back to
 * dispatch, who is told in chat (with the reason) and reassigns it.
 */
export function CancelRideSheet({
  ride,
  visible,
  onClose,
  onConfirm,
}: {
  ride: DispatchedRide;
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<{ ok: boolean; message?: string }>;
}) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setReason(null);
    setDetails("");
    setError(null);
    setSubmitting(false);
  }, [visible]);

  const needsDetails = reason === "Other";
  const canSubmit = !!reason && (!needsDetails || details.trim().length > 0) && !submitting;

  const submit = async () => {
    if (!canSubmit || !reason) return;
    setSubmitting(true);
    setError(null);
    const text = details.trim() ? (reason === "Other" ? details.trim() : `${reason}: ${details.trim()}`) : reason;
    const result = await onConfirm(text);
    setSubmitting(false);
    if (!result.ok) setError(result.message ?? "Couldn't reach dispatch. Try again.");
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable
          accessibilityLabel="Close"
          onPress={submitting ? undefined : onClose}
          style={{ flex: 1, backgroundColor: colors.overlay }}
        />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            maxHeight: "85%",
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md }}>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.primary, fontSize: 21, fontWeight: "900" }}>Cancel ride #{ride.id}?</Text>
              <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "600", lineHeight: 20 }}>
                The ride goes back to dispatch to reassign to another Trusted Rider. The passenger's trip isn't cancelled.
                {"\n"}Pickup: {ride.scheduledDate} · {ride.scheduledTime}
              </Text>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
                Reason
              </Text>
              <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {REASONS.map((option) => {
                  const selected = reason === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setReason(option)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => ({
                        paddingHorizontal: 14,
                        minHeight: 40,
                        justifyContent: "center",
                        borderRadius: 999,
                        borderWidth: 1.5,
                        borderColor: selected ? colors.primary : colors.surfaceHigh,
                        backgroundColor: selected ? colors.primary : pressed ? colors.surfaceHigh : colors.surface,
                      })}
                    >
                      <Text style={{ color: selected ? colors.surface : colors.primary, fontSize: 14, fontWeight: "700" }}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder={needsDetails ? "Tell dispatch what happened" : "Anything dispatch should know? (optional)"}
                placeholderTextColor={colors.slate500}
                multiline
                maxLength={280}
                accessibilityLabel="Details for dispatch"
                style={{
                  minHeight: 72,
                  borderRadius: radii.sm,
                  borderWidth: 1,
                  borderColor: colors.surfaceHigh,
                  padding: 12,
                  fontSize: 15,
                  color: colors.primary,
                  textAlignVertical: "top",
                }}
              />
            </View>

            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
              <SymbolIcon name="exclamationmark.triangle.fill" size={15} type="hierarchical" tintColor={colors.amber} weight="semibold" />
              <Text style={{ flex: 1, color: colors.slate500, fontSize: 13, fontWeight: "600", lineHeight: 18 }}>
                If pickup is soon, also message dispatch so they can find someone quickly.
              </Text>
            </View>

            {error ? (
              <Text accessibilityLiveRegion="polite" style={{ color: colors.error, fontSize: 14, fontWeight: "700" }}>
                {error}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={onClose}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Keep ride"
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 52,
                  borderRadius: radii.sm,
                  backgroundColor: pressed ? colors.slate200 : colors.surfaceHigh,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "800" }}>Keep ride</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={!canSubmit}
                accessibilityRole="button"
                accessibilityLabel="Cancel ride"
                accessibilityState={{ disabled: !canSubmit, busy: submitting }}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 52,
                  borderRadius: radii.sm,
                  backgroundColor: colors.error,
                  opacity: !canSubmit ? 0.45 : pressed ? 0.85 : 1,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <Text style={{ color: colors.surface, fontSize: 16, fontWeight: "800" }}>
                  {submitting ? "Cancelling…" : "Cancel ride"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
