import { useCallback } from "react";
import { View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { getLastNonChatHref } from "@/lib/navigation-memory";
import { colors } from "@/lib/theme";

export default function MessagesTabScreen() {
  const router = useRouter();

  useFocusEffect(useCallback(() => {
    const returnTo = getLastNonChatHref();
    router.replace({ pathname: "/chat", params: { returnTo } });
  }, [router]));

  return <View style={{ flex: 1, backgroundColor: colors.surfaceLow }} />;
}
