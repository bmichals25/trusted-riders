import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";

import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { colors } from "@/lib/theme";

/**
 * Shared back-nav chevron used in the header of every pushed screen.
 * Deliberately minimal: a single `‹` glyph in the operational blue, 44×44
 * tap target with a subtle press fade — matches the "Vigilant Command Center"
 * aesthetic of tight, editorial controls.
 */
export function BackChevron() {
  const router = useRouter();
  const { impact } = useHaptics();

  return (
    <Pressable
      onPress={() => {
        impact(ImpactFeedbackStyle.Light);
        if (router.canGoBack()) router.back();
        else router.replace("/");
      }}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      style={({ pressed }) => ({
        opacity: pressed ? 0.5 : 1,
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        marginLeft: -8,
      })}
    >
      <Text style={{ color: colors.blue, fontSize: 28, fontWeight: "600", lineHeight: 28 }}>
        ‹
      </Text>
    </Pressable>
  );
}
