import { type RefObject, useCallback } from "react";
import { SymbolView } from "expo-symbols";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

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
        borderBottomWidth: 1,
        borderBottomColor: colors.slate100,
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
        <SymbolView
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
        <Text style={{ color: colors.slate500, fontSize: 11, fontWeight: "800" }} numberOfLines={1}>
          Dispatch link active
        </Text>
      </View>
    </View>
  );
}

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
  listRef: RefObject<FlatList<Message> | null>;
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
            onPress={() => onCheckpointPress(checkpoint)}
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
  }, [lastOperatorMessageId, onCheckpointPress, readMessageIds]);

  return (
    <FlatList
      ref={listRef}
      data={messages}
      renderItem={renderMessage}
      keyExtractor={(item) => item.id}
      ListFooterComponent={isOtherTyping ? <TypingBubble /> : null}
      ListEmptyComponent={
        isInitialLoading && !loadError ? (
          <ChatLoadingState />
        ) : (
          <ChatUnavailableState loadError={loadError} onRetry={onRetry} />
        )
      }
      contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.md,
        flexGrow: messages.length === 0 ? 1 : undefined,
        justifyContent: messages.length === 0 ? "center" : undefined,
      }}
      initialNumToRender={16}
      maxToRenderPerBatch={10}
      windowSize={9}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={onScrollToLatest}
      onLayout={onScrollToLatest}
    />
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
        borderRadius: radii.md,
        borderCurve: "continuous",
        padding: spacing.lg,
        gap: spacing.md,
        alignItems: "center",
        borderWidth: 1,
        borderColor: colors.slate100,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 52,
          height: 52,
          borderRadius: radii.lg,
          backgroundColor: loadError ? colors.errorSoftDark : colors.blueSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SymbolView
          name={loadError ? "exclamationmark.bubble.fill" : "message.badge.fill"}
          size={24}
          type="hierarchical"
          tintColor={loadError ? colors.error : colors.blueStrong}
          weight="semibold"
        />
      </View>
      <View style={{ gap: 6, alignItems: "center" }}>
        <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "900", textAlign: "center" }}>
          {title}
        </Text>
        <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "700", textAlign: "center", lineHeight: 19, maxWidth: 260 }}>
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
          borderRadius: radii.pill,
          backgroundColor: pressed ? colors.surfaceHigh : colors.surface,
          borderWidth: 1,
          borderColor: colors.slate200,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: spacing.md,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "900" }}>
          {loadError ? "Try Again" : "Refresh"}
        </Text>
      </Pressable>
    </View>
  );
}

function ChatLoadingState() {
  return (
    <View
      accessibilityLabel="Loading dispatch chat"
      style={{
        width: "100%",
        gap: 12,
        paddingTop: spacing.xl,
      }}
    >
      <View
        style={{
          alignSelf: "flex-start",
          width: "72%",
          height: 58,
          borderRadius: 16,
          borderBottomLeftRadius: 4,
          backgroundColor: colors.surfaceLow,
        }}
      />
      <View
        style={{
          alignSelf: "flex-end",
          width: "58%",
          height: 50,
          borderRadius: 16,
          borderBottomRightRadius: 4,
          backgroundColor: colors.slate100,
        }}
      />
      <View
        style={{
          alignSelf: "flex-start",
          width: "64%",
          height: 46,
          borderRadius: 16,
          borderBottomLeftRadius: 4,
          backgroundColor: colors.surfaceLow,
        }}
      />
    </View>
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
        returnKeyType="send"
        multiline
        // @ts-expect-error — web-only react-native-web props to remove
        // the browser's default focus outline and suppress the Grammarly
        // overlay that injects a green "G" badge into the input.
        dataSet={{ gramm: "false", gramm_editor: "false" }}
        style={{
          flex: 1,
          backgroundColor: colors.surface,
          borderRadius: 20,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 10,
          fontSize: 15,
          color: colors.primary,
          maxHeight: 100,
          minHeight: 44,
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
          borderRadius: 22,
          backgroundColor: canSendMessage ? colors.primary : colors.slate200,
          alignItems: "center",
          justifyContent: "center",
          opacity: canSendMessage ? 1 : 0.72,
        }}
      >
        {isSending ? (
          <ActivityIndicator color={colors.surface} size="small" />
        ) : (
          <SymbolView
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
