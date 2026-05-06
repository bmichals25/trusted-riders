import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import { DISPATCH_PHONE } from "@/lib/config";
import { useHaptics } from "@/lib/haptics-context";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { colors, radii, spacing } from "@/lib/theme";

type Message = {
  id: string;
  text: string;
  sender: "operator" | "admin";
  timestamp: string;
};

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { rideId, riderName } = useLocalSearchParams<{ rideId: string; riderName: string }>();
  const chatTitle = rideId ? `Ride ${rideId} Dispatch` : "Dispatch Messages";
  const contextLabel = riderName ? `${riderName} · ${rideId ? `Ride ${rideId}` : "Mission"}` : "Mission dispatch";
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const { impact } = useHaptics();
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

  const callAdmin = useCallback(() => {
    impact(ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${DISPATCH_PHONE}`).catch(() => {});
  }, [impact]);

  return (
    <PageTransition>
    <Stack.Screen
      options={{
        title: chatTitle,
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
      <FadeInBlock delay={40}>
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
      </FadeInBlock>

      <FadeInBlock delay={120} style={{ flex: 1 }}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
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
              No backend chat history loaded
            </Text>
            <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 18 }}>
              Messages will appear here when they are provided by the backend.
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
      </FadeInBlock>

      <FadeInBlock delay={200}>
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
            backgroundColor: inputText.trim() ? colors.primary : colors.slate200,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.surface, fontSize: 16, fontWeight: "900" }}>↑</Text>
        </Pressable>
      </View>
      </FadeInBlock>
    </KeyboardAvoidingView>
    </PageTransition>
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
