import { useCallback } from "react";
import { SymbolView } from "expo-symbols";
import { useFocusEffect, useRouter } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getLastNonChatHref } from "@/lib/navigation-memory";
import { colors, radii, shadows, spacing } from "@/lib/theme";

export default function MessagesTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useFocusEffect(useCallback(() => {
    const returnTo = getLastNonChatHref();
    const frame = requestAnimationFrame(() => {
      router.push({ pathname: "/chat", params: { returnTo } });
    });

    return () => cancelAnimationFrame(frame);
  }, [router]));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Opening dispatch chat"
      style={{
        flex: 1,
        backgroundColor: colors.surfaceLow,
        paddingTop: insets.top + spacing.xl,
        paddingHorizontal: spacing.lg,
        justifyContent: "center",
        paddingBottom: insets.bottom + 96,
      }}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radii.md,
          borderCurve: "continuous",
          padding: spacing.lg,
          gap: spacing.md,
          ...shadows.soft,
        }}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            width: 46,
            height: 46,
            borderRadius: radii.sm,
            backgroundColor: colors.blueSoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SymbolView
            name="bubble.left.and.bubble.right.fill"
            size={23}
            type="hierarchical"
            tintColor={colors.blueStrong}
            weight="semibold"
          />
        </View>
        <View style={{ gap: 5 }}>
          <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "900", lineHeight: 28 }}>
            Opening dispatch chat
          </Text>
          <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
            Keeping your place while the latest ride conversation opens.
          </Text>
        </View>
        <View
          style={{
            height: 4,
            borderRadius: radii.pill,
            backgroundColor: colors.blueSoft,
            overflow: "hidden",
          }}
        >
          <View style={{ width: "54%", height: "100%", backgroundColor: colors.blue, borderRadius: radii.pill }} />
        </View>
      </View>
    </View>
  );
}
