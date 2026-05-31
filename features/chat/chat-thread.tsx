import { type RefObject, memo, useCallback, useEffect, useMemo } from "react";
import { SymbolIcon } from "@/components/ui/SymbolIcon";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { TypingBubble } from "@/features/chat/chat-accessories";
import { CheckpointUpdateCard } from "@/features/chat/chat-checkpoint";
import { type CheckpointCardData, type Message } from "@/features/chat/chat-model";
import { colors, radii, spacing } from "@/lib/theme";

export function ChatContextStrip({ label }: { label: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}. Dispatch link active.`}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        backgroundColor: colors.surfaceLow,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 30,
          height: 30,
          borderRadius: radii.sm,
          backgroundColor: colors.greenSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SymbolIcon
          name="checkmark.message.fill"
          size={15}
          type="hierarchical"
          tintColor={colors.greenStrong}
          weight="semibold"
        />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "900" }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

export type ChatRow =
  | { type: "date"; id: string; date?: string }
  | {
      type: "message";
      id: string;
      text: string;
      isOperator: boolean;
      pending: boolean;
      deliveryLabel: string;
      a11yLabel: string;
      checkpoint?: CheckpointCardData;
    };

export function ChatMessageList({
  listRef,
  messages,
  isOtherTyping,
  isInitialLoading,
  loadError,
  lastOperatorMessageId,
  readMessageIds,
  onCheckpointPress,
  onScrollToLatest,
  onRetry,
}: {
  listRef: RefObject<FlashListRef<ChatRow> | null>;
  messages: Message[];
  isOtherTyping: boolean;
  isInitialLoading: boolean;
  loadError: string | null;
  lastOperatorMessageId?: string;
  readMessageIds: Set<string>;
  onCheckpointPress: (checkpoint: CheckpointCardData) => void;
  onScrollToLatest: () => void;
  onRetry: () => void;
}) {
  const rows = useMemo<ChatRow[]>(() => {
    const out: ChatRow[] = [];
    for (let index = 0; index < messages.length; index += 1) {
      const item = messages[index];
      const previous = index > 0 ? messages[index - 1] : undefined;
      if (shouldShowDateSeparator(previous, item)) {
        out.push({ type: "date", id: `date:${item.id}`, date: item.createdAt });
      }
      const isOperator = item.sender === "operator";
      const isLastOperatorMessage = item.id === lastOperatorMessageId;
      const isRead = readMessageIds.has(item.id);
      const deliveryLabel =
        item.timestamp === "Not sent"
          ? "Not sent"
          : isLastOperatorMessage && !item.pending
            ? isRead
              ? "Read"
              : "Sent"
            : item.timestamp;
      out.push({
        type: "message",
        id: item.id,
        text: item.text,
        isOperator,
        pending: !!item.pending,
        deliveryLabel,
        a11yLabel: messageAccessibilityLabel(item, isOperator, isLastOperatorMessage, isRead),
        checkpoint: item.checkpoint,
      });
    }
    return out;
  }, [messages, lastOperatorMessageId, readMessageIds]);

  const renderRow = useCallback(
    ({ item }: { item: ChatRow }) => {
      if (item.type === "date") {
        return <MessageDateSeparator date={item.date} />;
      }
      return (
        <MessageRow
          text={item.text}
          isOperator={item.isOperator}
          pending={item.pending}
          deliveryLabel={item.deliveryLabel}
          a11yLabel={item.a11yLabel}
          checkpoint={item.checkpoint}
          onCheckpointPress={onCheckpointPress}
        />
      );
    },
    [onCheckpointPress],
  );

  if (rows.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: spacing.md }}>
        {isInitialLoading && !loadError ? (
          <ChatLoadingState />
        ) : (
          <ChatUnavailableState loadError={loadError} onRetry={onRetry} />
        )}
      </View>
    );
  }

  return (
    <FlashList
      ref={listRef}
      data={rows}
      renderItem={renderRow}
      keyExtractor={chatRowKey}
      getItemType={chatRowType}
      ListFooterComponent={isOtherTyping ? <TypingBubble /> : null}
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      onContentSizeChange={onScrollToLatest}
      onLayout={onScrollToLatest}
    />
  );
}

function chatRowKey(item: ChatRow) {
  return item.id;
}

function chatRowType(item: ChatRow) {
  return item.type === "date" ? "date" : item.checkpoint ? "checkpoint" : "message";
}

const MessageRow = memo(function MessageRow({
  text,
  isOperator,
  pending,
  deliveryLabel,
  a11yLabel,
  checkpoint,
  onCheckpointPress,
}: {
  text: string;
  isOperator: boolean;
  pending: boolean;
  deliveryLabel: string;
  a11yLabel: string;
  checkpoint?: CheckpointCardData;
  onCheckpointPress: (checkpoint: CheckpointCardData) => void;
}) {
  return (
    <View
      accessible={!checkpoint}
      accessibilityLabel={checkpoint ? undefined : a11yLabel}
      style={[
        styles.rowContainer,
        {
          alignSelf: isOperator ? "flex-end" : "flex-start",
          maxWidth: checkpoint ? "86%" : "78%",
        },
      ]}
    >
      {checkpoint ? (
        <CheckpointUpdateCard data={checkpoint} isOperator={isOperator} onPress={() => onCheckpointPress(checkpoint)} />
      ) : (
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isOperator ? colors.primary : colors.surfaceLow,
              borderBottomRightRadius: isOperator ? 4 : 10,
              borderBottomLeftRadius: isOperator ? 10 : 4,
            },
          ]}
        >
          <Text style={[styles.bubbleText, { color: isOperator ? colors.surface : colors.primary, opacity: pending ? 0.72 : 1 }]}>
            {text}
          </Text>
        </View>
      )}
      <Text style={[styles.deliveryLabel, { alignSelf: isOperator ? "flex-end" : "flex-start" }]}>
        {deliveryLabel}
      </Text>
    </View>
  );
});

function MessageDateSeparator({ date }: { date?: string }) {
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={messageDateLabel(date)}
      style={{
        alignSelf: "center",
        minHeight: 26,
        borderRadius: radii.pill,
        backgroundColor: colors.surfaceLow,
        paddingHorizontal: 10,
        justifyContent: "center",
        marginTop: spacing.xs,
        marginBottom: spacing.sm,
      }}
    >
      <Text style={{ color: colors.slate500, fontSize: 11, fontWeight: "900" }}>
        {messageDateLabel(date)}
      </Text>
    </View>
  );
}

function ChatUnavailableState({
  loadError,
  onRetry,
}: {
  loadError: string | null;
  onRetry: () => void;
}) {
  const title = loadError ? "Chat unavailable" : "No messages yet";
  const body = loadError ?? "Dispatch messages and ride updates will appear here.";

  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${body}`}
      style={{
        backgroundColor: colors.surfaceLow,
        borderRadius: radii.sm,
        borderCurve: "continuous",
        padding: spacing.lg,
        gap: spacing.md,
        alignItems: "flex-start",
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 52,
          height: 52,
          borderRadius: radii.sm,
          backgroundColor: loadError ? colors.errorSoftDark : colors.blueSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SymbolIcon
          name={loadError ? "exclamationmark.bubble.fill" : "message.badge.fill"}
          size={24}
          type="hierarchical"
          tintColor={loadError ? colors.error : colors.blueStrong}
          weight="semibold"
        />
      </View>
      <View style={{ gap: 6, alignItems: "flex-start" }}>
        <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "900" }}>
          {title}
        </Text>
        <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "700", lineHeight: 19, maxWidth: 260 }}>
          {body}
        </Text>
      </View>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={loadError ? "Retry loading chat" : "Refresh chat"}
        style={({ pressed }) => ({
          minHeight: 42,
          minWidth: 120,
          borderRadius: radii.sm,
          backgroundColor: colors.surfaceHigh,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing.md,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
          {loadError ? "Try Again" : "Refresh"}
        </Text>
      </Pressable>
    </View>
  );
}

function ChatLoadingState() {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0.62);

  useEffect(() => {
    if (reduced) {
      pulse.value = 0.82;
      return;
    }

    pulse.value = withRepeat(
      withTiming(1, {
        duration: 920,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [pulse, reduced]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading dispatch chat"
      style={{
        width: "100%",
        gap: 12,
        paddingTop: spacing.xl,
      }}
    >
      <LoadingBubble pulseStyle={pulseStyle} side="dispatch" style={{ width: "72%", height: 58 }} />
      <LoadingBubble pulseStyle={pulseStyle} side="operator" style={{ width: "58%", height: 50 }} />
      <LoadingBubble pulseStyle={pulseStyle} side="dispatch" style={{ width: "64%", height: 46 }} />
    </View>
  );
}

function LoadingBubble({
  pulseStyle,
  side,
  style,
}: {
  pulseStyle: StyleProp<ViewStyle>;
  side: "dispatch" | "operator";
  style: StyleProp<ViewStyle>;
}) {
  const operator = side === "operator";

  return (
    <Animated.View
      style={[
        styles.loadingBubble,
        {
          alignSelf: operator ? "flex-end" : "flex-start",
          borderBottomRightRadius: operator ? 4 : 10,
          borderBottomLeftRadius: operator ? 10 : 4,
          backgroundColor: operator ? colors.slate100 : colors.surfaceLow,
        },
        style,
        pulseStyle,
      ]}
    />
  );
}

export function ChatComposer({
  inputRef,
  resetKey,
  value,
  isSending,
  canSendMessage,
  bottomInset,
  onChangeText,
  onSubmit,
}: {
  inputRef: RefObject<TextInput | null>;
  resetKey: number;
  value: string;
  isSending: boolean;
  canSendMessage: boolean;
  bottomInset: number;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: spacing.md,
        paddingTop: 10,
        paddingBottom: bottomInset + 10,
        backgroundColor: colors.surfaceLow,
        gap: 10,
      }}
    >
      <TextInput
        key={`chat-input-${resetKey}`}
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder="Type a message..."
        placeholderTextColor={colors.slate400}
        accessibilityLabel="Message dispatch"
        accessibilityHint="Enter a message to send to dispatch."
        accessibilityValue={{ text: value ? `${value.length} characters entered` : "No message entered" }}
        autoCapitalize="sentences"
        autoCorrect
        blurOnSubmit={false}
        enablesReturnKeyAutomatically
        returnKeyType="send"
        multiline
        // @ts-expect-error — web-only react-native-web props to remove
        // the browser's default focus outline and suppress the Grammarly
        // overlay that injects a green "G" badge into the input.
        dataSet={{ gramm: "false", gramm_editor: "false" }}
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: 10,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 10,
          fontSize: 15,
          color: colors.primary,
          maxHeight: 100,
          minHeight: 44,
          lineHeight: 21,
        }}
        onSubmitEditing={onSubmit}
        // Multiline inputs don't normally fire `onSubmitEditing`, so handle
        // Enter explicitly. Shift+Enter inserts a newline; plain Enter sends.
        onKeyPress={(event: any) => {
          if (event.nativeEvent?.key === "Enter" && !event.nativeEvent?.shiftKey) {
            if (Platform.OS === "web" && event.preventDefault) {
              event.preventDefault();
            }
            onSubmit();
          }
        }}
      />
      <Pressable
        disabled={!canSendMessage}
        onPress={onSubmit}
        accessibilityRole="button"
        accessibilityLabel={isSending ? "Sending message" : "Send message"}
        accessibilityState={{ disabled: !canSendMessage, busy: isSending }}
        style={{
          width: 44,
          height: 44,
          borderRadius: radii.sm,
          backgroundColor: canSendMessage ? colors.primary : colors.slate200,
          alignItems: "center",
          justifyContent: "center",
          opacity: canSendMessage ? 1 : 0.72,
        }}
      >
        {isSending ? (
          <ActivityIndicator color={colors.surface} size="small" />
        ) : (
          <SymbolIcon
            name="arrow.up"
            size={18}
            type="hierarchical"
            tintColor={colors.surface}
            weight="bold"
          />
        )}
      </Pressable>
    </View>
  );
}

function messageAccessibilityLabel(
  message: Message,
  isOperator: boolean,
  isLastOperatorMessage: boolean,
  isRead: boolean,
) {
  const sender = isOperator ? "You" : "Dispatch";
  const delivery = message.timestamp === "Not sent"
    ? "Not sent"
    : isLastOperatorMessage && !message.pending
      ? (isRead ? "Read" : "Sent")
      : message.pending
        ? "Sending"
        : message.timestamp;

  return `${sender}. ${message.text}. ${delivery}.`;
}

function shouldShowDateSeparator(previous: Message | undefined, current: Message) {
  if (!previous) return true;
  return messageDateKey(previous.createdAt) !== messageDateKey(current.createdAt);
}

function messageDateKey(value?: string) {
  const date = parseMessageDate(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function messageDateLabel(value?: string) {
  const date = parseMessageDate(value);
  const today = startOfLocalDay(new Date());
  const target = startOfLocalDay(date);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function parseMessageDate(value?: string) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function startOfLocalDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

const styles = StyleSheet.create({
  loadingBubble: {
    borderRadius: 10,
  },
  rowContainer: {
    marginBottom: 8,
  },
  bubble: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: {
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 21,
  },
  deliveryLabel: {
    color: colors.slate500,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
    paddingHorizontal: 4,
  },
});
