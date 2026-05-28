import { useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";

import { getLastNonChatHref } from "@/lib/navigation-memory";

export default function MessagesTabScreen() {
  const router = useRouter();

  useFocusEffect(useCallback(() => {
    const returnTo = getLastNonChatHref();
    const frame = requestAnimationFrame(() => {
      router.push({ pathname: "/chat", params: { returnTo } });
    });

    return () => cancelAnimationFrame(frame);
  }, [router]));

  return null;
}
