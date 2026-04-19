import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { colors, radii, spacing } from "@/lib/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSave: (value: string) => void;
  label: string;
  placeholder?: string;
  initialValue?: string;
  hint?: string;
};

/**
 * Centered modal for editing a single text field in Settings. Matches the
 * "Vigilant Command Center" aesthetic: uppercase kickers, tight radii, dark
 * primary save action.
 *
 * Structured as `View` container + absolutely-positioned backdrop Pressable
 * so we don't nest `<button>` DOM on web.
 */
export function EditFieldModal({
  visible,
  onClose,
  onSave,
  label,
  placeholder,
  initialValue = "",
  hint,
}: Props) {
  const { impact } = useHaptics();
  const [value, setValue] = useState(initialValue);

  // Reset the input whenever the modal reopens with fresh props.
  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const trimmed = value.trim();
  const dirty = trimmed !== initialValue.trim();
  const canSave = dirty && trimmed.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    impact(ImpactFeedbackStyle.Light);
    onSave(trimmed);
    onClose();
  };

  const webInputStyle =
    Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as any) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
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
            accessibilityLabel="Close"
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
              maxWidth: 420,
              backgroundColor: colors.surface,
              borderRadius: radii.md,
              borderCurve: "continuous",
              padding: spacing.lg,
              gap: spacing.md,
            }}
          >
            <View style={{ gap: 4 }}>
              <Text
                style={{
                  color: colors.slate400,
                  fontSize: 11,
                  fontWeight: "900",
                  textTransform: "uppercase",
                  letterSpacing: 2.6,
                }}
              >
                Edit
              </Text>
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 22,
                  fontWeight: "900",
                  letterSpacing: -0.4,
                }}
              >
                {label}
              </Text>
              {hint ? (
                <Text
                  style={{
                    color: colors.slate500,
                    fontSize: 13,
                    fontWeight: "600",
                    lineHeight: 18,
                  }}
                >
                  {hint}
                </Text>
              ) : null}
            </View>

            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={placeholder}
              placeholderTextColor={colors.slate400}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSave}
              style={[
                {
                  backgroundColor: colors.surfaceLow,
                  borderRadius: radii.sm,
                  paddingHorizontal: 14,
                  paddingVertical: 14,
                  fontSize: 16,
                  fontWeight: "600",
                  color: colors.primary,
                },
                webInputStyle,
              ]}
            />

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: pressed ? colors.surfaceHigh : colors.surfaceLow,
                  borderRadius: radii.sm,
                  paddingVertical: 14,
                  alignItems: "center",
                })}
              >
                <Text
                  style={{
                    color: colors.slate500,
                    fontSize: 13,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                accessibilityRole="button"
                accessibilityLabel="Save"
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: !canSave ? colors.slate300 : pressed ? "#1E293B" : colors.primary,
                  borderRadius: radii.sm,
                  paddingVertical: 14,
                  alignItems: "center",
                })}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 13,
                    fontWeight: "900",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  Save
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
