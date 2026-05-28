import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { BackChevron } from "@/components/ui/BackChevron";
import { PageTransition } from "@/components/ui/PageTransition";
import {
  getRideChatStatus,
  formatChatTimestamp,
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
import { colors, radii, spacing } from "@/lib/theme";

type Message = {
  id: string;
  text: string;
  sender: "operator" | "admin";
  timestamp: string;
  metadata?: Record<string, unknown>;
  checkpoint?: CheckpointCardData;
  pending?: boolean;
};

type CheckpointCardData = {
  title: string;
  commandLabel: string;
  statusLabel: string;
  timeLabel: string;
  address?: string;
  stepLabel?: string;
  currentStageTitle?: string;
  currentStageAddress?: string;
  nextStageTitle?: string;
  nextStageAddress?: string;
  targetAddress?: string;
  driverLocationLabel?: string;
  completedMission: boolean;
};

function mapApiMessage(message: RideChatMessage): Message {
  const timestamp = formatChatTimestamp(message.created_at);
  return {
    id: message.id,
    text: message.text,
    sender: message.sender === "driver" ? "operator" : "admin",
    timestamp,
    metadata: message.metadata,
    checkpoint: getCheckpointCardData(message.text, message.metadata, timestamp),
  };
}

function humanizeToken(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  if (!value.trimStart().startsWith("{")) return null;

  try {
    return readRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

function getCheckpointCardData(
  text: string,
  metadata: Record<string, unknown> | undefined,
  fallbackTimeLabel: string,
): CheckpointCardData | undefined {
  const payload = readRecord(metadata)?.type === "mission_command_status"
    ? readRecord(metadata)
    : parseJsonObject(text);

  if (!payload || payload.type !== "mission_command_status") return undefined;

  const mission = readRecord(payload.mission);
  const ride = readRecord(payload.ride);
  const currentStage = readRecord(mission?.current_stage);
  const nextStage = readRecord(mission?.next_stage);
  const target = readRecord(mission?.target);
  const driverLocation = readRecord(payload.driver_location);
  const timestamp = readString(payload.timestamp);
  const timeLabel = timestamp ? formatChatTimestamp(timestamp) : fallbackTimeLabel;
  const commandLabel =
    readString(mission?.current_action) ||
    humanizeToken(payload.command) ||
    "Checkpoint";
  const statusLabel =
    humanizeToken(ride?.status_check) ||
    humanizeToken(ride?.status) ||
    "Status update";
  const stageTitle = readString(currentStage?.title);
  const address = readString(currentStage?.address);
  const step = readNumber(mission?.step);
  const totalSteps = readNumber(mission?.total_steps);
  const latitude = readNumber(driverLocation?.latitude);
  const longitude = readNumber(driverLocation?.longitude);
  const driverLocationLabel =
    latitude !== undefined && longitude !== undefined
      ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      : undefined;

  return {
    title: stageTitle ? `${stageTitle} checkpoint` : "Checkpoint update",
    commandLabel,
    statusLabel,
    timeLabel,
    address,
    stepLabel: step && totalSteps ? `${step} of ${totalSteps}` : undefined,
    currentStageTitle: stageTitle,
    currentStageAddress: address,
    nextStageTitle: readString(nextStage?.title),
    nextStageAddress: readString(nextStage?.address),
    targetAddress: readString(target?.address),
    driverLocationLabel,
    completedMission: payload.completed_mission === true,
  };
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { rideId, riderName, returnTo } = useLocalSearchParams<{
    rideId: string;
    riderName: string;
    returnTo?: string;
  }>();
  const roomId = "dispatch";
  const chatTitle = "Dispatch Messages";
  const contextLabel = rideId
    ? `Dispatch + TrustedRider · Ride ${rideId}${riderName ? ` · ${riderName}` : ""}`
    : "Dispatch + TrustedRider";
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [composerResetKey, setComposerResetKey] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [readReceipts, setReadReceipts] = useState<Partial<Record<"driver" | "dispatch" | "admin" | "system", ChatReadReceipt>>>({});
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<CheckpointCardData | null>(null);
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
      return Array.from(byId.values());
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
    }
  }, [markLatestIncomingRead, mergeMessages, refreshChatStatus, roomId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    lastMessageIdRef.current = undefined;
    setMessages([]);

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

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isOperator = item.sender === "operator";
    const isLastOperatorMessage = item.id === lastOperatorMessageId;
    const isRead = readMessageIds.has(item.id);
    const checkpoint = item.checkpoint;
    return (
      <View
        style={{
          alignSelf: isOperator ? "flex-end" : "flex-start",
          maxWidth: checkpoint ? "86%" : "78%",
          marginBottom: 8,
        }}
      >
        {checkpoint ? (
          <CheckpointUpdateCard
            data={checkpoint}
            isOperator={isOperator}
            onPress={() => {
              impact(ImpactFeedbackStyle.Light);
              setSelectedCheckpoint(checkpoint);
            }}
          />
        ) : (
          <View
            style={{
              backgroundColor: isOperator ? colors.primary : colors.surfaceLow,
              borderRadius: 16,
              borderBottomRightRadius: isOperator ? 4 : 16,
              borderBottomLeftRadius: isOperator ? 16 : 4,
              paddingHorizontal: 14,
              paddingVertical: 10,
            }}
          >
            <Text
              style={{
                color: isOperator ? colors.surface : colors.primary,
                opacity: item.pending ? 0.72 : 1,
                fontSize: 15,
                fontWeight: "500",
                lineHeight: 21,
              }}
            >
              {item.text}
            </Text>
          </View>
        )}
        <Text
          style={{
            color: colors.slate400,
            fontSize: 10,
            fontWeight: "600",
            marginTop: 4,
            alignSelf: isOperator ? "flex-end" : "flex-start",
            paddingHorizontal: 4,
          }}
        >
          {item.timestamp === "Not sent"
            ? "Not sent"
            : isLastOperatorMessage && !item.pending
              ? (isRead ? "Read" : "Sent")
              : item.timestamp}
        </Text>
      </View>
    );
  }, [impact, lastOperatorMessageId, readMessageIds]);

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
        <View style={{
          paddingHorizontal: spacing.md,
          paddingVertical: 12,
          backgroundColor: colors.surfaceLow,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}>
          <View style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.green,
          }} />
          <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
            {contextLabel}
          </Text>
        </View>
      </ChatOpeningBlock>

      <ChatOpeningBlock delay={70} distance={12} style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          ListFooterComponent={isOtherTyping ? <TypingBubble /> : null}
          ListEmptyComponent={
            <View
              style={{
                backgroundColor: colors.surfaceLow,
                borderRadius: radii.md,
                borderCurve: "continuous",
                padding: spacing.lg,
                gap: 6,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "900", textAlign: "center" }}>
                {loadError ? "Chat backend unavailable" : "No messages yet"}
              </Text>
              <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 18 }}>
                {loadError ?? "Send a message to start the dispatch chat."}
              </Text>
            </View>
          }
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: spacing.md,
          }}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />
      </ChatOpeningBlock>

      <ChatOpeningBlock delay={120} distance={10}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            paddingHorizontal: spacing.md,
            paddingTop: 10,
            paddingBottom: insets.bottom + 10,
            backgroundColor: colors.surfaceLow,
            gap: 10,
          }}
        >
          <TextInput
            key={`chat-input-${composerResetKey}`}
            ref={inputRef}
            value={inputText}
            onChangeText={handleInputChange}
            placeholder="Type a message..."
            placeholderTextColor={colors.slate400}
            multiline
            // @ts-expect-error — web-only react-native-web props to remove
            // the browser's default focus outline and suppress the Grammarly
            // overlay that injects a green "G" badge into the input.
            dataSet={{ gramm: "false", gramm_editor: "false" }}
            style={[
              {
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingTop: 10,
                paddingBottom: 10,
                fontSize: 15,
                color: colors.primary,
                maxHeight: 100,
              },
              // react-native-web only — hides the browser's default focus ring.
              Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as any) : null,
            ]}
            onSubmitEditing={sendMessage}
            // Multiline inputs don't normally fire `onSubmitEditing`, so handle
            // Enter explicitly. Shift+Enter inserts a newline; plain Enter sends.
            onKeyPress={(e: any) => {
              if (e.nativeEvent?.key === "Enter" && !e.nativeEvent?.shiftKey) {
                if (Platform.OS === "web" && e.preventDefault) {
                  e.preventDefault();
                }
                sendMessage();
              }
            }}
          />
          <Pressable
            onPress={() => { impact(ImpactFeedbackStyle.Light); sendMessage(); }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: inputText.trim() && !isSending ? colors.primary : colors.slate200,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.surface, fontSize: 16, fontWeight: "900" }}>↑</Text>
          </Pressable>
        </View>
      </ChatOpeningBlock>
      <CheckpointDetailModal
        checkpoint={selectedCheckpoint}
        onClose={() => setSelectedCheckpoint(null)}
      />
    </KeyboardAvoidingView>
    </PageTransition>
  );
}

function ChatOpeningBlock({
  children,
  delay,
  distance,
  style,
}: {
  children: ReactNode;
  delay: number;
  distance: number;
  style?: any;
}) {
  const isFocused = useIsFocused();
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    cancelAnimation(progress);

    if (reduced) {
      progress.value = 1;
      return;
    }

    if (isFocused) {
      progress.value = 0;
      progress.value = withDelay(
        delay,
        withTiming(1, {
          duration: 340,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
        }),
      );
    }
  }, [delay, isFocused, progress, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  if (reduced) return <View style={style}>{children}</View>;

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

function CheckpointUpdateCard({
  data,
  isOperator,
  onPress,
}: {
  data: CheckpointCardData;
  isOperator: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="View checkpoint update details"
      style={({ pressed }) => [
        {
          width: 286,
          borderRadius: radii.md,
          borderBottomRightRadius: isOperator ? 5 : radii.md,
          borderBottomLeftRadius: isOperator ? radii.md : 5,
          borderCurve: "continuous",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.slate200,
          padding: 14,
          gap: 10,
          opacity: pressed ? 0.76 : 1,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: colors.greenSoftDark,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.greenLight, fontSize: 18, fontWeight: "900" }}>✓</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              color: colors.green,
              fontSize: 11,
              fontWeight: "900",
              textTransform: "uppercase",
              letterSpacing: 1.2,
            }}
            numberOfLines={1}
          >
            Driver checkpoint
          </Text>
          <Text
            style={{
              color: colors.primary,
              fontSize: 16,
              fontWeight: "900",
              lineHeight: 20,
            }}
            numberOfLines={1}
          >
            {data.commandLabel}
          </Text>
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>
          {data.statusLabel} · {data.timeLabel}
        </Text>
        {data.address ? (
          <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "700", lineHeight: 16 }} numberOfLines={2}>
            {data.address}
          </Text>
        ) : null}
      </View>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.slate100,
          paddingTop: 9,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: colors.slate400, fontSize: 11, fontWeight: "800" }}>
          View checkpoint details
        </Text>
        <Text style={{ color: colors.blue, fontSize: 15, fontWeight: "900" }}>›</Text>
      </View>
    </Pressable>
  );
}

function CheckpointDetailModal({
  checkpoint,
  onClose,
}: {
  checkpoint: CheckpointCardData | null;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={!!checkpoint}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(15, 23, 42, 0.28)",
        }}
      >
        <View
          style={{
            maxHeight: "78%",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingTop: 14,
            paddingBottom: 18,
            gap: 12,
          }}
        >
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                width: 46,
                height: 5,
                borderRadius: radii.pill,
                backgroundColor: colors.slate200,
              }}
            />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.green, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2 }}>
                Checkpoint details
              </Text>
              <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "900" }} numberOfLines={1}>
                {checkpoint?.commandLabel ?? "Checkpoint"}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close checkpoint details"
              hitSlop={10}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.surfaceLow,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.68 : 1,
              })}
            >
              <Text style={{ color: colors.primary, fontSize: 20, fontWeight: "900" }}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            style={{
              borderRadius: radii.md,
            }}
            contentContainerStyle={{
              gap: 10,
              paddingBottom: 4,
            }}
            showsVerticalScrollIndicator
          >
            {checkpoint ? (
              <>
                <View
                  style={{
                    borderRadius: radii.lg,
                    borderCurve: "continuous",
                    backgroundColor: colors.greenSoft,
                    padding: 14,
                    gap: 6,
                  }}
                >
                  <Text style={{ color: colors.green, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.1 }}>
                    {checkpoint.completedMission ? "Mission completed" : "Driver update"}
                  </Text>
                  <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "900", lineHeight: 23 }}>
                    {checkpoint.commandLabel}
                  </Text>
                  <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "800" }}>
                    {checkpoint.statusLabel} · {checkpoint.timeLabel}
                  </Text>
                </View>

                <CheckpointDetailRow
                  label="Step"
                  value={checkpoint.stepLabel ?? "Current mission step"}
                />
                <CheckpointDetailRow
                  label="Current stop"
                  value={[checkpoint.currentStageTitle, checkpoint.currentStageAddress].filter(Boolean).join("\n")}
                />
                {checkpoint.nextStageTitle || checkpoint.nextStageAddress ? (
                  <CheckpointDetailRow
                    label="Next stop"
                    value={[checkpoint.nextStageTitle, checkpoint.nextStageAddress].filter(Boolean).join("\n")}
                  />
                ) : null}
                {checkpoint.targetAddress && checkpoint.targetAddress !== checkpoint.currentStageAddress ? (
                  <CheckpointDetailRow
                    label="Target"
                    value={checkpoint.targetAddress}
                  />
                ) : null}
                {checkpoint.driverLocationLabel ? (
                  <CheckpointDetailRow
                    label="Driver location"
                    value={checkpoint.driverLocationLabel}
                  />
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CheckpointDetailRow({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  if (!value) return null;

  return (
    <View
      style={{
        borderRadius: radii.md,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceLow,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 5,
      }}
    >
      <Text style={{ color: colors.slate400, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.1 }}>
        {label}
      </Text>
      <Text selectable style={{ color: colors.primary, fontSize: 15, fontWeight: "800", lineHeight: 21 }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Composed phone handset glyph — matches the app's View-built icon language
 * (see GearGlyph in LocationIndicator). Used in the chat header's call button.
 */
function CallGlyph() {
  const color = colors.greenLight;
  return (
    <View
      style={{
        width: 16,
        height: 16,
        transform: [{ rotate: "-18deg" }],
      }}
    >
      {/* Top ear piece */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 7,
          height: 7,
          borderRadius: 2,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
        }}
      />
      {/* Bottom mouthpiece */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 7,
          height: 7,
          borderRadius: 2,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
        }}
      />
      {/* Handle */}
      <View
        style={{
          position: "absolute",
          top: 3,
          left: 3,
          width: 10,
          height: 2.5,
          backgroundColor: color,
          borderRadius: 1,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}

function TypingBubble() {
  return (
    <View style={{ alignSelf: "flex-start", marginBottom: 8 }}>
      <View
        style={{
          backgroundColor: colors.surfaceLow,
          borderRadius: 16,
          borderBottomLeftRadius: 4,
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: "row",
          gap: 5,
          alignItems: "center",
        }}
      >
        {[0, 1, 2].map((dot) => (
          <View
            key={dot}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: colors.slate400,
              opacity: dot === 1 ? 0.78 : 0.48,
            }}
          />
        ))}
      </View>
    </View>
  );
}
