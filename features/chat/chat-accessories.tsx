import { View } from "react-native";

import { colors } from "@/lib/theme";

export function TypingBubble() {
  return (
    <View style={{ alignSelf: "flex-start", marginBottom: 8 }}>
      <View
        style={{
          backgroundColor: colors.surfaceLow,
          borderRadius: 10,
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
