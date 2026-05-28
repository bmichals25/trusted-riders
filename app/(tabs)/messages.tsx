import { useLayoutEffect } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";

import { getLastNonChatHref } from "@/lib/navigation-memory";
import { colors, spacing } from "@/lib/theme";

export default function MessagesTabScreen() {
  const router = useRouter();

  useLayoutEffect(() => {
    const returnTo = getLastNonChatHref();
    router.push({ pathname: "/chat", params: { returnTo } });
  }, [router]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        justifyContent: "center",
        gap: 14,
      }}
    >
      <View
        style={{
          height: 4,
          width: 42,
          borderRadius: 2,
          backgroundColor: colors.blue,
          alignSelf: "center",
        }}
      />
      <Text
        style={{
          color: colors.primary,
          fontSize: 13,
          fontWeight: "900",
          letterSpacing: 2,
          textAlign: "center",
          textTransform: "uppercase",
        }}
      >
        Opening Dispatch
      </Text>
    </View>
  );
}
