import { Fragment, useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LocationRow } from "@/components/ui/LocationRow";
import { SymbolIcon, type AppSymbolName } from "@/components/ui/SymbolIcon";
import { useDispatchActions } from "@/lib/dispatch-context";
import { NotificationFeedbackType } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import {
  buildReadyToReturnNote,
  findTripEntry,
  READY_TO_RETURN_NOTE_MAX,
  READY_TO_RETURN_NOTES,
  readyToReturnState,
  readyToReturnTargetId,
  TRIP_LEG_LABELS,
  tripDisplayNumber,
  type TripLegStep,
  tripLegSteps,
} from "@/lib/round-trip";
import { sendReadyToReturn } from "@/lib/round-trip-api";
import { type DispatchedRide } from "@/lib/rides";
import { colors, radii, shadows, spacing } from "@/lib/theme";

/**
 * "Round trip" tag + the two legs as steps: Outbound, then Ride home, each done (check) / current / upcoming.
 * Cards pass nothing and get the steps from the ride (its current leg); ride details pass the trip's steps.
 */
export function TripLegProgress({ ride, steps }: { ride: DispatchedRide; steps?: TripLegStep[] }) {
  const legSteps = steps ?? tripLegSteps(ride);
  if (!ride.trip || legSteps.length === 0) return null;
  const summary = legSteps.map((step) => `${TRIP_LEG_LABELS[step.leg]} ${LEG_STATE_WORDS[step.state]}`).join(", ");
  return (
    <View
      accessible
      accessibilityLabel={`Round trip. ${summary}.`}
      style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: spacing.sm, rowGap: 4 }}
    >
      <View style={{ backgroundColor: colors.purpleSoft, borderRadius: radii.xs, paddingHorizontal: 6, paddingVertical: 2 }}>
        <Text style={{ color: colors.purpleStrong, fontSize: 11, fontWeight: "900", letterSpacing: 0.4 }}>Round trip</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {legSteps.map((step, index) => (
          <Fragment key={step.leg}>
            {index > 0 ? (
              <View
                style={{ width: 14, height: 2, borderRadius: 1, backgroundColor: step.state === "upcoming" ? colors.slate200 : colors.purple }}
              />
            ) : null}
            <TripLegStepView step={step} />
          </Fragment>
        ))}
      </View>
    </View>
  );
}

const LEG_STATE_WORDS: Record<TripLegStep["state"], string> = { done: "done", current: "now", upcoming: "next" };

function TripLegStepView({ step }: { step: TripLegStep }) {
  const done = step.state === "done";
  const current = step.state === "current";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: done ? colors.purple : current ? colors.purpleSoft : colors.surface,
          borderWidth: done ? 0 : 2,
          borderColor: current ? colors.purple : colors.slate300,
        }}
      >
        {done ? (
          <SymbolIcon name="checkmark" size={9} type="monochrome" tintColor={colors.surface} weight="bold" />
        ) : current ? (
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.purple }} />
        ) : null}
      </View>
      <Text
        numberOfLines={1}
        style={{ color: current ? colors.purpleStrong : done ? colors.slate500 : colors.slate400, fontSize: 12, fontWeight: current ? "900" : "700" }}
      >
        {TRIP_LEG_LABELS[step.leg]}
      </Text>
    </View>
  );
}

function clockTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "";
}

/**
 * BEN-12: the passenger is at the appointment. Shows "Ready to Return" until the TR taps it, then what
 * dispatch is doing about the ride home. `ride` is the return leg (the completed outbound leg isn't listed).
 */
export function ReadyToReturnCard({
  ride,
  onOpen,
  onChat,
}: {
  ride: DispatchedRide;
  /** Omit on the ride's own details screen. */
  onOpen?: () => void;
  onChat: () => void;
}) {
  const { refreshRides } = useDispatchActions();
  const { notification } = useHaptics();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentNote, setSentNote] = useState("");
  const [sentAt, setSentAt] = useState<string | null>(null);
  const state = readyToReturnState(ride, sent);
  const trip = ride.trip;
  if (!state || !trip) return null;

  const confirm = async (note: string) => {
    const result = await sendReadyToReturn(readyToReturnTargetId(ride), note);
    if (!result.ok) return result;
    setSent(true);
    setSentNote(note);
    setSentAt(new Date().toISOString());
    setSheetOpen(false);
    notification(NotificationFeedbackType.Success);
    void refreshRides();
    // A refresh inside the request throttle is skipped; try again just after it.
    setTimeout(() => void refreshRides(), 3500);
    return result;
  };

  const readyAt = clockTime(trip.readyToReturnAt ?? sentAt);
  const note = trip.readyToReturnNote || sentNote;

  return (
    <View style={cardStyle}>
      <Pressable
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole={onOpen ? "button" : undefined}
        accessibilityLabel={`Ride ${tripDisplayNumber(ride)}, the ride home for ${ride.passengerName}`}
        style={({ pressed }) => ({ gap: spacing.md, opacity: pressed ? 0.78 : 1 })}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.purpleStrong, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2 }}>
            {state === "offer" ? "At the appointment" : "Waiting for the ride home"}
          </Text>
          <Text style={{ color: colors.primary, fontSize: 19, fontWeight: "800" }}>{ride.passengerName}</Text>
          <TripLegProgress ride={ride} />
        </View>
        <View style={{ gap: spacing.md }}>
          <LocationRow color={colors.green} label="Pickup" address={ride.pickupAddress} />
          <LocationRow color={colors.blue} label="Dropoff" address={ride.dropoffAddress} />
        </View>
      </Pressable>

      {state === "offer" ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "600", lineHeight: 20 }}>
            When {ride.passengerName.startsWith("Ride #") ? "the passenger is" : `${ride.passengerName} is`} ready to go
            home, tap Ready to Return. Dispatch will arrange the ride.
          </Text>
          <Pressable
            onPress={() => setSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Ready to Return"
            style={({ pressed }) => ({
              minHeight: 56,
              borderRadius: radii.sm,
              backgroundColor: pressed ? colors.purpleStrong : colors.purple,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: spacing.sm,
            })}
          >
            <SymbolIcon name="house.fill" size={19} type="hierarchical" tintColor={colors.surface} weight="bold" />
            <Text style={{ color: colors.surface, fontSize: 17, fontWeight: "900" }}>Ready to Return</Text>
          </Pressable>
        </View>
      ) : (
        <View
          accessibilityLiveRegion="polite"
          style={{
            borderRadius: radii.sm,
            padding: spacing.md,
            gap: 4,
            backgroundColor: state === "arranged" ? colors.greenSoft : colors.amberSoft,
          }}
        >
          <Text style={{ color: state === "arranged" ? colors.greenStrong : colors.amberStrong, fontSize: 15, fontWeight: "800" }}>
            {state === "arranged" ? `Ride home: ${trip.transportMethod}` : "Dispatch is arranging the ride home"}
          </Text>
          {state === "arranged" && trip.transportNote ? (
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600", lineHeight: 20 }}>{trip.transportNote}</Text>
          ) : null}
          <Text style={{ color: colors.primarySoft, fontSize: 13, fontWeight: "600", lineHeight: 18 }}>
            {readyAt ? `You told dispatch at ${readyAt}.` : "Dispatch has your message."}
            {note ? ` Note: ${note}` : ""}
            {state === "arranged" ? " Dispatch will start the ride home in the app when it's time." : " Stay with the passenger; check chat for updates."}
          </Text>
        </View>
      )}

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <SmallButton label="Chat" icon="bubble.left.and.bubble.right.fill" onPress={onChat} />
        {onOpen ? <SmallButton label="Details" icon="doc.text.magnifyingglass" onPress={onOpen} /> : null}
      </View>

      <ReadyToReturnSheet
        ride={ride}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onConfirm={confirm}
      />
    </View>
  );
}

function SmallButton({ label, icon, onPress }: { label: string; icon: AppSymbolName; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 44,
        borderRadius: radii.sm,
        backgroundColor: pressed ? colors.slate200 : colors.surfaceHigh,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 7,
      })}
    >
      <SymbolIcon name={icon} size={15} type="hierarchical" tintColor={colors.primary} weight="semibold" />
      <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

/** Confirm sheet with an optional note for dispatch. */
export function ReadyToReturnSheet({
  ride,
  visible,
  onClose,
  onConfirm,
}: {
  ride: DispatchedRide;
  visible: boolean;
  onClose: () => void;
  onConfirm: (note: string) => Promise<{ ok: boolean; message?: string }>;
}) {
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPicked(null);
    setDetails("");
    setError(null);
    setSubmitting(false);
  }, [visible]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await onConfirm(buildReadyToReturnNote(picked, details));
    setSubmitting(false);
    if (!result.ok) setError(result.message ?? "Couldn't reach dispatch. Try again, or message them in chat.");
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Close" onPress={submitting ? undefined : onClose} style={{ flex: 1, backgroundColor: colors.overlay }} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
            maxHeight: "85%",
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md }}>
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.primary, fontSize: 21, fontWeight: "900" }}>Ready to return?</Text>
              <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "600", lineHeight: 20 }}>
                Dispatch gets a message that the passenger is ready to go home from {ride.pickupAddress}. They'll
                arrange the ride and tell you in chat.
              </Text>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1 }}>
                Note for dispatch (optional)
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {READY_TO_RETURN_NOTES.map((option) => {
                  const selected = picked === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setPicked(selected ? null : option)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={({ pressed }) => ({
                        paddingHorizontal: 14,
                        minHeight: 40,
                        justifyContent: "center",
                        borderRadius: 999,
                        borderWidth: 1.5,
                        borderColor: selected ? colors.primary : colors.surfaceHigh,
                        backgroundColor: selected ? colors.primary : pressed ? colors.surfaceHigh : colors.surface,
                      })}
                    >
                      <Text style={{ color: selected ? colors.surface : colors.primary, fontSize: 14, fontWeight: "700" }}>{option}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="Anything else dispatch should know?"
                placeholderTextColor={colors.slate500}
                multiline
                maxLength={READY_TO_RETURN_NOTE_MAX}
                accessibilityLabel="Note for dispatch"
                style={{
                  minHeight: 72,
                  borderRadius: radii.sm,
                  borderWidth: 1,
                  borderColor: colors.surfaceHigh,
                  padding: 12,
                  fontSize: 15,
                  color: colors.primary,
                  textAlignVertical: "top",
                }}
              />
            </View>

            {error ? (
              <Text accessibilityLiveRegion="polite" style={{ color: colors.error, fontSize: 14, fontWeight: "700" }}>
                {error}
              </Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable
                onPress={onClose}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Not yet"
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 52,
                  borderRadius: radii.sm,
                  backgroundColor: pressed ? colors.slate200 : colors.surfaceHigh,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <Text style={{ color: colors.primary, fontSize: 16, fontWeight: "800" }}>Not yet</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={submitting}
                accessibilityRole="button"
                accessibilityLabel="Tell dispatch"
                accessibilityState={{ disabled: submitting, busy: submitting }}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 52,
                  borderRadius: radii.sm,
                  backgroundColor: pressed ? colors.purpleStrong : colors.purple,
                  opacity: submitting ? 0.6 : 1,
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                <Text style={{ color: colors.surface, fontSize: 16, fontWeight: "800" }}>
                  {submitting ? "Sending…" : "Tell dispatch"}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Round-trip panel for the ride details screen: the trip's leg progress (so the two legs read as one ride)
 * and a link to the other leg when this phone still lists it (a completed leg isn't shown in the app).
 */
export function TripLegPanel({
  ride,
  rides,
  onOpenRide,
}: {
  ride: DispatchedRide;
  rides: DispatchedRide[];
  onOpenRide: (rideId: string) => void;
}) {
  const trip = ride.trip;
  if (!trip) return null;
  // Progress follows the whole trip; the details below are for `ride`, which may be the leg after the current one.
  const entry = findTripEntry([ride, ...rides.filter((candidate) => candidate.id !== ride.id)], ride);
  const other = trip.otherRideId ? rides.find((candidate) => candidate.id === trip.otherRideId) ?? null : null;
  const thisLabel = trip.leg === "outbound" ? "ride there" : "ride home";
  const otherLabel = trip.leg === "outbound" ? "ride home" : "ride there";
  return (
    <View style={[cardStyle, { gap: spacing.sm }]}>
      <TripLegProgress ride={ride} steps={entry?.legSteps} />
      <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "600", lineHeight: 20 }}>
        {entry && entry.ride.id !== ride.id ? `These details are for the ${thisLabel}. ` : ""}
        {trip.returnTimeOpen
          ? "The ride home starts when you tap Ready to Return after the appointment."
          : "The ride home is booked for a set time."}{" "}
        Accepting or declining covers both legs.
      </Text>
      {other ? (
        <SmallButton label={`View the ${otherLabel}`} icon="arrow.left.arrow.right" onPress={() => onOpenRide(other.id)} />
      ) : null}
    </View>
  );
}

const cardStyle = {
  backgroundColor: colors.surface,
  borderRadius: radii.sm,
  padding: spacing.md,
  gap: spacing.md,
  ...shadows.soft,
} as const;
