import { SymbolView, type SFSymbol, type SymbolWeight } from "expo-symbols";
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

type SymbolIconProps = {
  name: SFSymbol;
  size: number;
  tintColor: string;
  type?: "monochrome" | "hierarchical" | "palette" | "multicolor";
  weight?: SymbolWeight;
  style?: StyleProp<ViewStyle>;
};

const ANDROID_GLYPHS: Partial<Record<SFSymbol, string>> = {
  "antenna.radiowaves.left.and.right": "⌁",
  "arrow.clockwise": "↻",
  "arrow.up": "↑",
  "bubble.left.and.bubble.right.fill": "◇",
  "calendar": "□",
  "calendar.badge.clock": "◷",
  "checkmark": "✓",
  "checkmark.circle.fill": "✓",
  "checkmark.message.fill": "✓",
  "chevron.left": "‹",
  "chevron.right": "›",
  "chevron.down": "⌄",
  "doc.text.magnifyingglass": "⌕",
  "exclamationmark.bubble.fill": "!",
  "gearshape.fill": "⚙",
  "hand.tap.fill": "•",
  "iphone": "▯",
  "location.fill": "◆",
  "message.badge.fill": "◇",
  "message.fill": "◇",
  "person.crop.circle.fill": "●",
  "phone.fill": "☎",
  "rectangle.portrait.and.arrow.right": "↪",
  "slider.horizontal.3": "≡",
  "xmark.circle.fill": "×",
};

export type AppSymbolName = SFSymbol;

export function SymbolIcon({
  name,
  size,
  tintColor,
  type = "hierarchical",
  weight = "semibold",
  style,
}: SymbolIconProps) {
  if (Platform.OS === "ios") {
    return (
      <SymbolView
        name={name}
        size={size}
        type={type}
        tintColor={tintColor}
        weight={weight}
        style={style}
      />
    );
  }

  return (
    <View style={[s.androidFrame, { width: size, height: size }, style]}>
      <Text
        allowFontScaling={false}
        style={[
          s.androidGlyph,
          {
            color: tintColor,
            fontSize: size * 0.92,
            lineHeight: size,
          },
        ]}
      >
        {ANDROID_GLYPHS[name] ?? "•"}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  androidFrame: {
    alignItems: "center",
    justifyContent: "center",
  },
  androidGlyph: {
    fontWeight: "900",
    textAlign: "center",
  },
});
