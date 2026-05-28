import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  TextInput,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackChevron } from "@/components/ui/BackChevron";
import { PageTransition } from "@/components/ui/PageTransition";
import { CallGlyph } from "@/features/chat/chat-accessories";
import { CheckpointDetailModal } from "@/features/chat/chat-checkpoint";
import { mapApiMessage, type CheckpointCardData, type Message } from "@/features/chat/chat-model";
import { ChatOpeningBlock } from "@/features/chat/chat-opening-block";
import { ChatComposer, ChatContextStrip, ChatMessageList } from "@/features/chat/chat-thread";
import {
  getRideChatStatus,
  listRideChatMessages,
  markRideChatRead,
  sendRideChatMessage,
  setRideChatTyping,
  type ChatReadReceipt,
  type RideChatMessage,
} from "@/lib/chat-api";
import { DISPATCH_PHONE, formatPhone } from "@/lib/config";
import { useHaptics } from "@/lib/haptics-context";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { colors } from "@/lib/theme";

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const isFocused = useIsFocused();
  const { rideId, riderName, returnTo } = useLocalSearchParams<{
    rideId: string;
    riderName: string;
    returnTo?: string;
  }>();
  const roomId = "dispatch";
  const chatTitle = "Dispatch Messages";
  const riderLabel = typeof riderName === "string" && !/^ride\b/i.test(riderName) ? riderName : undefined;
  const contextLabel = rideId
    ? `Dispatch + TrustedRider · Ride ${rideId}${riderLabel ? ` · ${riderLabel}` : ""}`
    : "Dispatch + TrustedRider";
  const [messages, setMessages] = useState<Message[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [composerResetKey, setComposerResetKey] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [readReceipts, setReadReceipts] = useState<Partial<Record<"driver" | "dispatch" | "admin" | "system", ChatReadReceipt>>>({});
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<CheckpointCardData | null>(null);
  const canSendMessage = inputText.trim().length > 0 && !isSending;
  const { impact } = useHaptics();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const draftRef = useRef("");
  const lastClearedTextRef = useRef("");
  const ignoreClearedTextUntilRef = useRef(0);
  const lastMessageIdRef = useRef<string | undefined>(undefined);
  const refreshInFlightRef = useRef(false);
  const lastTypingSentAtRef = useRef(0);
  const lastReadMarkedIdRef = useRef<string | undefined>(undefined);
  const latestScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastOperatorMessageId = useMemo(
    () => [...messages].reverse().find((message) => message.sender === "operator")?.id,
    [messages],
  );
  const readMessageIds = useMemo(
    () =>
      new Set(
        [readReceipts.dispatch, readReceipts.admin]
          .map((receipt) => receipt?.last_read_message_id)
          .filter((id): id is string => !!id),
      ),
    [readReceipts],
  );

  const refreshChatStatus = useCallback(async () => {
    try {
      const status = await getRideChatStatus(roomId);
      setIsOtherTyping(status.typing.some((state) => state.sender !== "driver"));
      setReadReceipts(status.read_receipts);
    } catch {
      // Message loading surfaces backend availability. Status is best effort.
    }
  }, [roomId]);

  const mergeMessages = useCallback((incoming: RideChatMessage[]) => {
    if (!incoming.length) return;

    setMessages((prev) => {
      const byId = new Map(prev.map((message) => [message.id, message]));
      for (const message of incoming) {
        byId.set(message.id, mapApiMessage(message));
      }
      return Array.from(byId.values()).sort(compareMessagesByCreatedAt);
    });

    lastMessageIdRef.current = incoming[incoming.length - 1]?.id ?? lastMessageIdRef.current;
  }, []);

  const markLatestIncomingRead = useCallback((incoming: RideChatMessage[]) => {
    const latestIncoming = [...incoming].reverse().find((message) => message.sender !== "driver");
    if (!latestIncoming || latestIncoming.id === lastReadMarkedIdRef.current) return;

    lastReadMarkedIdRef.current = latestIncoming.id;
    void markRideChatRead({
      rideId: roomId,
      sender: "driver",
      senderName: "Driver",
      lastReadMessageId: latestIncoming.id,
    }).then((status) => {
      setReadReceipts(status.read_receipts);
    }).catch(() => {});
  }, [roomId]);

  const refreshMessages = useCallback(async (afterId?: string) => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    try {
      const incoming = await listRideChatMessages(roomId, afterId);
      mergeMessages(incoming);
      markLatestIncomingRead(incoming);
      await refreshChatStatus();
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reach chat backend.";
      setLoadError(message);
      console.log(`[chat] load failed: ${message}`);
    } finally {
      refreshInFlightRef.current = false;
      setIsInitialLoading(false);
    }
  }, [markLatestIncomingRead, mergeMessages, refreshChatStatus, roomId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!lastMessageIdRef.current) {
      setIsInitialLoading(true);
    }

    void refreshMessages();

    const timer = setInterval(() => {
      if (active) {
        void refreshMessages(lastMessageIdRef.current);
      }
    }, 2500);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refreshMessages]));

  useEffect(() => {
    return () => {
      void setRideChatTyping({
        rideId: roomId,
        sender: "driver",
        senderName: "Driver",
        isTyping: false,
      }).catch(() => {});
    };
  }, [roomId]);

  const handleInputChange = useCallback((text: string) => {
    if (text === lastClearedTextRef.current && Date.now() < ignoreClearedTextUntilRef.current) {
      return;
    }

    draftRef.current = text;
    setInputText(text);

    const now = Date.now();
    const isTyping = text.trim().length > 0;
    if (!isTyping || now - lastTypingSentAtRef.current > 1800) {
      lastTypingSentAtRef.current = now;
      void setRideChatTyping({
        rideId: roomId,
        sender: "driver",
        senderName: "Driver",
        isTyping,
      }).catch(() => {});
    }
  }, [roomId]);

  const clearComposer = useCallback((sentText: string) => {
    draftRef.current = "";
    lastClearedTextRef.current = sentText;
    ignoreClearedTextUntilRef.current = Date.now() + 1000;
    setInputText("");
    inputRef.current?.clear();
    inputRef.current?.setNativeProps({ text: "" });
    setComposerResetKey((key) => key + 1);
  }, []);

  const sendMessage = useCallback(async () => {
    const text = draftRef.current.trim() || inputText.trim();
    if (!text) return;
    if (isSending) return;

    const clientMessageId = `driver-${Date.now()}`;
    const newMessage: Message = {
      id: clientMessageId,
      text,
      sender: "operator",
      timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => [...prev, newMessage]);
    clearComposer(text);
    void setRideChatTyping({
      rideId: roomId,
      sender: "driver",
      senderName: "Driver",
      isTyping: false,
    }).catch(() => {});
    setIsSending(true);

    try {
      const saved = await sendRideChatMessage({
        rideId: roomId,
        text,
        sender: "driver",
        senderName: "Driver",
        clientMessageId,
        metadata: {
          ...(rideId ? { ride_id: rideId } : {}),
          ...(riderName ? { rider_name: riderName } : {}),
        },
      });
      setMessages((prev) => [
        ...prev.filter((message) => message.id !== clientMessageId),
        mapApiMessage(saved),
      ]);
      lastMessageIdRef.current = saved.id;
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send chat message.";
      setLoadError(message);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === clientMessageId ? { ...item, pending: false, timestamp: "Not sent" } : item,
        ),
      );
      Alert.alert("Message not sent", message);
    } finally {
      setIsSending(false);
    }
  }, [clearComposer, inputText, isSending, roomId]);

  const scrollToLatest = useCallback((animated: boolean) => {
    if (latestScrollTimerRef.current) {
      clearTimeout(latestScrollTimerRef.current);
    }

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated });
      latestScrollTimerRef.current = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated });
        latestScrollTimerRef.current = null;
      }, 80);
    });
  }, []);

  useEffect(() => {
    if (!isFocused || isInitialLoading || messages.length === 0) return;
    scrollToLatest(false);
  }, [isFocused, isInitialLoading, messages.length, scrollToLatest]);

  useEffect(() => {
    return () => {
      if (latestScrollTimerRef.current) {
        clearTimeout(latestScrollTimerRef.current);
      }
    };
  }, []);

  const openCheckpoint = useCallback((checkpoint: CheckpointCardData) => {
    impact(ImpactFeedbackStyle.Light);
    setSelectedCheckpoint(checkpoint);
  }, [impact]);

  const submitComposer = useCallback(() => {
    if (!canSendMessage) return;
    impact(ImpactFeedbackStyle.Light);
    void sendMessage();
  }, [canSendMessage, impact, sendMessage]);

  const callAdmin = useCallback(async () => {
    impact(ImpactFeedbackStyle.Medium);
    const phoneNumber = DISPATCH_PHONE.replace(/[^0-9+]/g, "");
    const url = `tel:${phoneNumber}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert(
          "Calling unavailable",
          `This device cannot open phone calls. Dispatch: ${formatPhone(DISPATCH_PHONE)}`,
        );
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Calling unavailable",
        `Could not open the phone app. Dispatch: ${formatPhone(DISPATCH_PHONE)}`,
      );
    }
  }, [impact]);

  return (
    <PageTransition>
    <Stack.Screen
      options={{
        headerShown: true,
        headerBackVisible: false,
        headerLeft: () => (
          <BackChevron
            fallbackHref={typeof returnTo === "string" ? (returnTo as any) : undefined}
            preferFallback={typeof returnTo === "string"}
          />
        ),
        title: chatTitle,
        headerTitleAlign: "center",
        headerRight: () => (
          <Pressable
            onPress={callAdmin}
            accessibilityRole="button"
            accessibilityLabel="Call dispatch admin"
            hitSlop={8}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.greenSoftDark,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 4,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <CallGlyph />
          </Pressable>
        ),
      }}
    />
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
    >
      <ChatOpeningBlock delay={20} distance={8}>
        <ChatContextStrip label={contextLabel} />
      </ChatOpeningBlock>

      <ChatOpeningBlock delay={70} distance={12} style={{ flex: 1 }}>
        <ChatMessageList
          listRef={flatListRef}
          messages={messages}
          isOtherTyping={isOtherTyping}
          isInitialLoading={isInitialLoading}
          loadError={loadError}
          lastOperatorMessageId={lastOperatorMessageId}
          readMessageIds={readMessageIds}
          onCheckpointPress={openCheckpoint}
        />
      </ChatOpeningBlock>

      <ChatOpeningBlock delay={120} distance={10}>
        <ChatComposer
          inputRef={inputRef}
          resetKey={composerResetKey}
          value={inputText}
          isSending={isSending}
          canSendMessage={canSendMessage}
          bottomInset={insets.bottom}
          onChangeText={handleInputChange}
          onSubmit={submitComposer}
        />
      </ChatOpeningBlock>
      <CheckpointDetailModal
        checkpoint={selectedCheckpoint}
        onClose={() => setSelectedCheckpoint(null)}
      />
    </KeyboardAvoidingView>
    </PageTransition>
  );
}

function compareMessagesByCreatedAt(a: Message, b: Message) {
  const aTime = Date.parse(a.createdAt);
  const bTime = Date.parse(b.createdAt);

  if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
    return a.id.localeCompare(b.id);
  }

  return aTime - bTime;
}
