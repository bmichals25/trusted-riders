import { Text, View } from "react-native";
import { GradientCard } from "@/components/ui/gradient-card";
import { colors } from "@/lib/theme";

export function Avatar({ initials, size }: { initials: string; size: number }) {
  return (
    <GradientCard padding={0} borderRadius={size / 2}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: colors.surface,
            fontSize: size * 0.34,
            fontWeight: "900",
          }}
        >
          {initials}
        </Text>
      </View>
    </GradientCard>
  );
}
