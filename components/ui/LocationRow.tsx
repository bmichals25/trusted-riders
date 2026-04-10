import { Text, View } from "react-native";
import { colors } from "@/lib/theme";

export function LocationRow({ color, label, address }: { color: string; label: string; address: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.slate400, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 }}>
          {label}
        </Text>
        <Text selectable style={{ color: colors.primary, fontSize: 16, fontWeight: "700" }}>
          {address}
        </Text>
      </View>
    </View>
  );
}
