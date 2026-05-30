import type { PropsWithChildren } from "react";
import { View } from "react-native";

import { colors, radii } from "@/lib/theme";

type GradientCardProps = PropsWithChildren<{
  padding?: number;
  borderRadius?: number;
}>;

export function GradientCard({
  children,
  padding = 16,
  borderRadius = radii.md,
}: GradientCardProps) {
  return (
    <View
      style={{
        experimental_backgroundImage: `linear-gradient(135deg, ${colors.primary}, ${colors.primarySoft})`,
        borderRadius,
        padding,
        borderCurve: "continuous",
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}
