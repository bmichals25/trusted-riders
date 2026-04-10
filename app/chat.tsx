import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radii, spacing } from "@/lib/theme";

type Message = {
  id: string;
  text: string;
  sender: "operator" | "admin";
  timestamp: string;
};

const initialMessages: Message[] = [
  { id: "1", text: "Hi, I'm reviewing the upcoming ride for Sarah Jenkins. Any special notes?", sender: "operator", timestamp: "2:32 PM" },
  { id: "2", text: "Yes — she has a new wheelchair model. Make sure to confirm the ramp fit before departure.", sender: "admin", timestamp: "2:33 PM" },
  { id: "3", text: "Got it. Is the facility entrance still on the north side?", sender: "operator", timestamp: "2:34 PM" },
  { id: "4", text: "Correct. Use the patient drop-off loop, not the ER entrance. Security will wave you through.", sender: "admin", timestamp: "2:35 PM" },
  { id: "5", text: "Perfect, thanks for the heads up.", sender: "operator", timestamp: "2:35 PM" },
];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { rideId, riderName } = useLocalSearchParams<{ rideId: string; riderName: string }>();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const sendMessage = useCallback(() => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: String(Date.now()),
      text: inputText.trim(),
      sender: "operator",
      timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");

    // Simulate admin reply
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          text: "Acknowledged. I'll update the ride notes.",
          sender: "admin",
          timestamp: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        },
      ]);
    }, 1500);
  }, [inputText]);

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isOperator = item.sender === "operator";
    return (
      <View
        style={{
          alignSelf: isOperator ? "flex-end" : "flex-start",
          maxWidth: "78%",
          marginBottom: 8,
        }}
      >
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
              fontSize: 15,
              fontWeight: "500",
              lineHeight: 21,
            }}
          >
            {item.text}
          </Text>
        </View>
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
          {item.timestamp}
        </Text>
      </View>
    );
  }, []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
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
          Dispatch Admin — Online
        </Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing.md,
        }}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

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
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor={colors.slate400}
          multiline
          style={{
            flex: 1,
            backgroundColor: colors.surfaceLow,
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 10,
            fontSize: 15,
            color: colors.primary,
            maxHeight: 100,
          }}
          onSubmitEditing={sendMessage}
        />
        <Pressable
          onPress={sendMessage}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: inputText.trim() ? colors.primary : colors.slate200,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.surface, fontSize: 16, fontWeight: "900" }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
