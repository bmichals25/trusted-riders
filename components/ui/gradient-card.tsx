import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren } from "react";

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
    <LinearGradient
      colors={[colors.primary, colors.primarySoft]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius,
        padding,
        borderCurve: "continuous",
        overflow: "hidden",
      }}
    >
      {children}
    </LinearGradient>
  );
}
