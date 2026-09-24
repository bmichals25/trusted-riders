import { useCallback } from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";

import { SymbolIcon } from "@/components/ui/SymbolIcon";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { type DispatchedRide, type RidePassenger } from "@/lib/rides";
import { colors, radii, shadows, spacing } from "@/lib/theme";

/** `tel:` URL for a free-form phone string, or null when there are no digits to dial. */
export function telUrlFor(phone: string): string | null {
  const dialable = phone.replace(/[^\d+*#]/g, "");
  return /\d/.test(dialable) ? `tel:${dialable}` : null;
}

/**
 * Passenger brief for the assigned TR. Hidden when the backend sent no passenger info at all (older
 * backend); a quiet placeholder when dispatch hasn't attached a passenger to the ride.
 */
export function RidePassengerPanel({ ride }: { ride: DispatchedRide }) {
  if (ride.passenger === undefined) return null;

  if (!ride.passenger) {
    // The backend only sends passenger details while the ride is active (minimum necessary); a finished ride
    // still carries the passenger's name.
    const knownName = ride.passengerId && !/^Ride #/.test(ride.passengerName) ? ride.passengerName : null;
    return (
      <View style={{ backgroundColor: colors.surfaceLow, borderRadius: radii.sm, padding: spacing.md, gap: 4 }}>
        <SectionKicker>Passenger</SectionKicker>
        <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
          {knownName ?? "No passenger details"}
        </Text>
        {knownName ? (
          <Text style={{ color: colors.slate500, fontSize: 13, lineHeight: 18 }}>
            Contact details are shown only while the ride is active.
          </Text>
        ) : null}
      </View>
    );
  }

  return <PassengerDetails passenger={ride.passenger} fallbackName={ride.passengerName} />;
}

function PassengerDetails({ passenger, fallbackName }: { passenger: RidePassenger; fallbackName: string }) {
  const name = passenger.name || fallbackName;
  const emergencyLabel = [passenger.emergencyContactName, passenger.emergencyContactPhone].filter(Boolean).join(" · ");

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, gap: spacing.md, ...shadows.soft }}>
      <View style={{ gap: 4 }}>
        <SectionKicker>Passenger</SectionKicker>
        <Text selectable style={{ color: colors.primary, fontSize: 18, fontWeight: "900", lineHeight: 24 }}>
          {name}
        </Text>
      </View>

      {passenger.phone ? (
        <CallRow label="Phone" value={passenger.phone} phone={passenger.phone} who={name} />
      ) : null}

      {passenger.mobilityNeeds ? (
        <DetailField label="Mobility / assistance" value={passenger.mobilityNeeds} />
      ) : null}

      {emergencyLabel ? (
        passenger.emergencyContactPhone ? (
          <CallRow
            label="Emergency contact"
            value={emergencyLabel}
            phone={passenger.emergencyContactPhone}
            who={passenger.emergencyContactName || "emergency contact"}
          />
        ) : (
          <DetailField label="Emergency contact" value={emergencyLabel} />
        )
      ) : null}

      {passenger.notes ? (
        <View style={{ backgroundColor: colors.surfaceLow, borderRadius: radii.sm, padding: spacing.sm, gap: 4 }}>
          <SectionKicker>Notes from dispatch</SectionKicker>
          <Text selectable style={{ color: colors.primary, fontSize: 15, fontWeight: "600", lineHeight: 21 }}>
            {passenger.notes}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function CallRow({ label, value, phone, who }: { label: string; value: string; phone: string; who: string }) {
  const { impact } = useHaptics();
  const url = telUrlFor(phone);

  const call = useCallback(() => {
    if (!url) return;
    impact(ImpactFeedbackStyle.Light);
    Linking.openURL(url).catch(() => {
      Alert.alert("Can't place call", `Dial ${phone} from your phone app.`);
    });
  }, [impact, phone, url]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <DetailField label={label} value={value} />
      </View>
      {url ? (
        <Pressable
          onPress={call}
          accessibilityRole="button"
          accessibilityLabel={`Call ${who}`}
          accessibilityHint={`Dials ${phone}`}
          hitSlop={4}
          style={({ pressed }) => ({
            minWidth: 72,
            minHeight: 44,
            paddingHorizontal: 12,
            borderRadius: radii.sm,
            backgroundColor: pressed ? colors.slate200 : colors.surfaceHigh,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          })}
        >
          <SymbolIcon name="phone.fill" size={14} tintColor={colors.greenStrong} />
          <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "800" }}>Call</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ color: colors.slate400, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2 }}>
        {label}
      </Text>
      <Text selectable style={{ color: colors.primary, fontSize: 15, fontWeight: "700", lineHeight: 21 }}>
        {value}
      </Text>
    </View>
  );
}

export function SectionKicker({ children }: { children: string }) {
  return (
    <Text style={{ color: colors.slate500, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2 }}>
      {children}
    </Text>
  );
}
