import { useCallback } from "react";
import { Linking, Modal, Pressable, Text, View } from "react-native";

import { ImpactFeedbackStyle, NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { colors, radii, spacing } from "@/lib/theme";

export type EmergencyOption = {
  /** Headline shown in 900 weight on the button. */
  title: string;
  /** Uppercase kicker above the title. */
  kicker: string;
  /** Phone number to dial when tapped (raw digits/+ only). */
  number: string;
  /** Optional small hint below the title — e.g. the raw number. */
  hint?: string;
  /** "danger" highlights in red (911); "primary" uses the brand dark. */
  variant?: "danger" | "primary";
};

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /** Required — keep copy intentional at each call site instead of inheriting a default. */
  description: string;
  options: EmergencyOption[];
};

/**
 * Centered modal with a short list of call-to-action buttons, each wired to
 * `tel:` links. Used from the operator sheet (Emergency button) and from
 * ride-details (ride-specific emergency contact + dispatch + 911).
 *
 * Structure avoids nested `<button>` DOM by using a `View` container and an
 * absolutely-positioned backdrop Pressable behind the card.
 */
export function EmergencyModal({
  visible,
  onClose,
  title = "Who do you need?",
  description,
  options,
}: Props) {
  const { impact, notification } = useHaptics();

  const dial = useCallback(
    async (number: string) => {
      impact(ImpactFeedbackStyle.Heavy);
      const url = `tel:${number.replace(/[^0-9+]/g, "")}`;
      try {
        await Linking.openURL(url);
      } catch {
        notification(NotificationFeedbackType.Error);
      }
      onClose();
    },
    [impact, notification, onClose],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.lg,
        }}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close emergency options"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.72)",
          }}
        />
        <View
          style={{
            width: "100%",
            maxWidth: 380,
            backgroundColor: colors.surface,
            borderRadius: radii.md,
            borderCurve: "continuous",
            padding: spacing.lg,
            gap: spacing.md,
          }}
        >
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.error, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2.6 }}>
              Emergency
            </Text>
            <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "900", letterSpacing: -0.4 }}>
              {title}
            </Text>
            <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "600", lineHeight: 18 }}>
              {description}
            </Text>
          </View>

          {options.map((opt) => {
            const danger = opt.variant === "danger";
            return (
              <Pressable
                key={opt.title + opt.number}
                onPress={() => dial(opt.number)}
                accessibilityRole="button"
                accessibilityLabel={`Call ${opt.title}`}
                style={({ pressed }) => ({
                  backgroundColor: danger
                    ? pressed
                      ? "#B91C1C"
                      : colors.error
                    : pressed
                      ? "#1E293B"
                      : colors.primary,
                  borderRadius: radii.sm,
                  paddingVertical: 18,
                  paddingHorizontal: spacing.lg,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                })}
              >
                <View style={{ gap: 2, flex: 1 }}>
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 11,
                      fontWeight: "900",
                      textTransform: "uppercase",
                      letterSpacing: 2.4,
                      opacity: danger ? 0.85 : 1,
                    }}
                  >
                    {opt.kicker}
                  </Text>
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 22,
                      fontWeight: "900",
                      letterSpacing: -0.3,
                    }}
                    numberOfLines={1}
                  >
                    {opt.title}
                  </Text>
                  {opt.hint ? (
                    <Text
                      style={{
                        color: danger ? "rgba(255,255,255,0.85)" : colors.slate400,
                        fontSize: 12,
                        fontWeight: "700",
                        letterSpacing: 0.4,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {opt.hint}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "900" }}>→</Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={({ pressed }) => ({
              paddingVertical: 14,
              alignItems: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                color: colors.slate500,
                fontSize: 13,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 1.6,
              }}
            >
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
