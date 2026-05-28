import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { listRideChatMessages, type RideChatMessage } from "@/lib/chat-api";
import { NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { colors, radii } from "@/lib/theme";

type DispatchMessageNotice = {
  id: string;
  senderName: string;
  preview: string;
};

const POLL_INTERVAL_MS = 5000;
const DISPATCH_CHAT_ROOM_ID = "dispatch";

function isIncomingMessage(message: RideChatMessage) {
  return message.sender === "dispatch" || message.sender === "admin" || message.sender === "system";
}

function latestMessageId(messages: RideChatMessage[]) {
  return messages[messages.length - 1]?.id;
}

export function DispatchMessageToast() {
  const { notification } = useHaptics();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<DispatchMessageNotice | null>(null);
  const lastMessageIdRef = useRef<string | undefined>(undefined);
  const hasInitializedRef = useRef(false);
  const pollingRef = useRef(false);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setNotice(null);
    });
  }, [opacity, translateY]);

  useEffect(() => {
    if (!notice) return;

    notification(NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 220,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(dismiss, 8000);
    return () => clearTimeout(timer);
  }, [dismiss, notification, notice, opacity, translateY]);

  useEffect(() => {
    let active = true;

    const pollMessages = async () => {
      if (pollingRef.current) return;
      pollingRef.current = true;

      try {
        if (!active) return;

        const messages = await listRideChatMessages(DISPATCH_CHAT_ROOM_ID, lastMessageIdRef.current);
        const newestId = latestMessageId(messages);
        if (newestId) lastMessageIdRef.current = newestId;

        if (!hasInitializedRef.current) {
          hasInitializedRef.current = true;
          return;
        }

        if (pathname === "/chat") return;

        const incoming = messages.filter(isIncomingMessage);
        const latestIncoming = incoming[incoming.length - 1];
        if (!latestIncoming) return;

        setNotice({
          id: `dispatch-${latestIncoming.id}`,
          senderName: latestIncoming.sender_name || "Dispatch",
          preview: latestIncoming.text,
        });
      } catch {
        // Chat endpoints may be absent in some backend environments. Keep the
        // foreground ride UI quiet and let the chat screen show details.
      } finally {
        pollingRef.current = false;
      }
    };

    void pollMessages();
    const interval = setInterval(() => {
      void pollMessages();
    }, POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [pathname]);

  if (!notice) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + 10,
        left: 16,
        right: 16,
        zIndex: 110,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`New message from ${notice.senderName}. Open dispatch chat.`}
        onPress={() => {
          dismiss();
          router.push({
            pathname: "/chat",
          });
        }}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.slate200,
          borderRadius: radii.sm,
          borderWidth: 1,
          paddingHorizontal: 16,
          paddingVertical: 13,
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.16,
          shadowRadius: 24,
          elevation: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: radii.sm,
              backgroundColor: colors.blueSoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.blue, fontSize: 17, fontWeight: "900" }}>i</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "900" }}>
              New dispatch message
            </Text>
            <Text numberOfLines={2} style={{ color: colors.primarySoft, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
              {notice.senderName}: {notice.preview}
            </Text>
          </View>
          <Text style={{ color: colors.blue, fontSize: 12, fontWeight: "900" }}>
            Open
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
