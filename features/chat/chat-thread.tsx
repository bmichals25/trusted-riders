import { type RefObject, useCallback } from "react";
import {
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
      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700", flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
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
}: {
  listRef: RefObject<FlatList<Message> | null>;
  messages: Message[];
  isOtherTyping: boolean;
  isInitialLoading: boolean;
  loadError: string | null;
  lastOperatorMessageId?: string;
  readMessageIds: Set<string>;
  onCheckpointPress: (checkpoint: CheckpointCardData) => void;
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
      onContentSizeChange={() =>
        listRef.current?.scrollToEnd({ animated: true })
      }
    />
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
        <Text style={{ color: colors.surface, fontSize: 16, fontWeight: "900" }}>↑</Text>
      </Pressable>
    </View>
  );
}
