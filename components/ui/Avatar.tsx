import { Image, type ImageSource } from "expo-image";
import { useState } from "react";
import { Text, View } from "react-native";
import { GradientCard } from "@/components/ui/gradient-card";
import { colors } from "@/lib/theme";

/**
 * Initials on the brand gradient, with an optional photo on top (lib/passenger-photo.ts). The initials
 * show while the photo loads and stay if it fails (404 once the ride ends, offline, signed out).
 * The photo is decorative: the name is always shown next to it.
 */
export function Avatar({
  initials,
  size,
  source,
}: {
  initials: string;
  size: number;
  source?: ImageSource | null;
}) {
  const uri = source?.uri ?? null;
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showPhoto = !!source && !!uri && failedUri !== uri;

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
        {showPhoto ? (
          <Image
            source={source}
            // Memory only: passenger photos are never written to disk.
            cachePolicy="memory"
            contentFit="cover"
            transition={120}
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            accessibilityIgnoresInvertColors
            onError={() => setFailedUri(uri)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: size,
              height: size,
              borderRadius: size / 2,
            }}
          />
        ) : null}
      </View>
    </GradientCard>
  );
}

export function initialsFor(name: string) {
  // Rides without a rider name are labelled "Ride #11": show "#11" rather than the meaningless "R#".
  const rideNumber = /^ride\s*#?\s*(\d+)$/i.exec(name.trim());
  if (rideNumber) return `#${rideNumber[1]}`;
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "TR";
}
