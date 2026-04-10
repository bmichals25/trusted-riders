import { Text, View } from "react-native";
import { radii, statusColors, statusLabels, type StatusKey } from "@/lib/theme";

export function StatusBadge({ status }: { status: StatusKey }) {
  const scheme = statusColors[status];
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Status: ${statusLabels[status]}`}
      style={{
        backgroundColor: scheme.bg,
        borderRadius: radii.xs,
        paddingHorizontal: 8,
        paddingVertical: 3,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          color: scheme.text,
          fontSize: 11,
          fontWeight: "900",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        {statusLabels[status]}
      </Text>
    </View>
  );
}
