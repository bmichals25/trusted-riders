import { View } from "react-native";

import { colors } from "@/lib/theme";

/**
 * Composed phone handset glyph — matches the app's View-built icon language
 * (see GearGlyph in LocationIndicator). Used in the chat header's call button.
 */
export function CallGlyph() {
  const color = colors.greenLight;
  return (
    <View
      style={{
        width: 16,
        height: 16,
        transform: [{ rotate: "-18deg" }],
      }}
    >
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

export function TypingBubble() {
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
