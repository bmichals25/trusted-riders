import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { listRideChatMessages, type RideChatMessage } from "@/lib/chat-api";
import { useDispatchActions } from "@/lib/dispatch-context";
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
  const { clearDispatchUnreadMessages, noteIncomingDispatchMessages } = useDispatchActions();
  const [notice, setNotice] = useState<DispatchMessageNotice | null>(null);
  const lastMessageIdRef = useRef<string | undefined>(undefined);
  const observedIncomingMessageIdsRef = useRef(new Set<string>());
  const hasInitializedRef = useRef(false);
  const pollingRef = useRef(false);
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);

  const dismiss = useCallback(() => {
    translateY.value = withTiming(-120, { duration: 180 });
    opacity.value = withTiming(0, { duration: 160 }, (finished) => {
      if (finished) runOnJS(setNotice)(null);
    });
  }, [opacity, translateY]);

  useEffect(() => {
    if (!notice) return;

    notification(NotificationFeedbackType.Success);
    translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
    opacity.value = withTiming(1, { duration: 180 });

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

        const incoming = messages.filter(isIncomingMessage);
        const newIncoming = incoming.filter((message) => {
          if (observedIncomingMessageIdsRef.current.has(message.id)) return false;
          observedIncomingMessageIdsRef.current.add(message.id);
          return true;
        });

        if (pathname === "/chat") {
          clearDispatchUnreadMessages();
          return;
        }

        if (!hasInitializedRef.current) {
          hasInitializedRef.current = true;
          return;
        }

        const latestIncoming = newIncoming[newIncoming.length - 1];
        if (!latestIncoming) return;

        noteIncomingDispatchMessages(newIncoming.length);
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
  }, [clearDispatchUnreadMessages, noteIncomingDispatchMessages, pathname]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!notice) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        {
          position: "absolute",
          top: insets.top + 10,
          left: 16,
          right: 16,
          zIndex: 110,
        },
        animatedStyle,
      ]}
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
          boxShadow: "0px 10px 24px rgba(15, 23, 42, 0.16)",
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
