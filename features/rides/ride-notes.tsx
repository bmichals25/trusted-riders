import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Keyboard, Platform, Pressable, Text, TextInput, View } from "react-native";

import { useAuth } from "@/components/ui/DriverNameGate";
import { SymbolIcon } from "@/components/ui/SymbolIcon";
import { parseBackendDate, sortRideNotes } from "@/lib/fleet-normalization";
import { ImpactFeedbackStyle } from "@/lib/haptics";
import { useHaptics } from "@/lib/haptics-context";
import { addRideNote, fetchRideNotes, RIDE_NOTE_MAX_LENGTH, RideNotesError } from "@/lib/ride-notes-api";
import { type DispatchedRide, type RideNote } from "@/lib/rides";
import { colors, radii, shadows, spacing } from "@/lib/theme";

type LoadState = "loading" | "ready" | "error" | "unavailable";

/** True while the software keyboard is up (lets the ride screen hide its floating action bar). */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return visible;
}

/**
 * Ride notes shared between dispatch and the assigned TR. Starts from the notes in the ride detail
 * payload, refreshes from GET /api/rides/<id>/notes, and lets the TR add notes.
 * Round trip: notes are stored per ride, so the other leg's notes are fetched too and merged in time order
 * (best effort; new notes go on this leg).
 */
export function RideNotesPanel({ ride }: { ride: DispatchedRide }) {
  const { session } = useAuth();
  const { impact } = useHaptics();
  const [loaded, setLoaded] = useState<RideNote[] | null>(null);
  const [otherLegLoaded, setOtherLegLoaded] = useState<RideNote[]>([]);
  const [added, setAdded] = useState<RideNote[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const hasDetailNotes = ride.rideNotes !== undefined;
  const otherLegId = ride.trip?.otherRideId ?? null;

  const load = useCallback(async () => {
    setLoadState("loading");
    const otherLeg = otherLegId ? fetchRideNotes(otherLegId).catch(() => null) : Promise.resolve(null);
    try {
      setLoaded(await fetchRideNotes(ride.id));
      setLoadState("ready");
    } catch (error) {
      const status = error instanceof RideNotesError ? error.status : 0;
      // A 404 with no notes in the ride detail means this backend (or this ride) has no notes for us.
      setLoadState(status === 404 && !hasDetailNotes ? "unavailable" : "error");
    }
    setOtherLegLoaded((await otherLeg) ?? []);
  }, [ride.id, otherLegId, hasDetailNotes]);

  useEffect(() => {
    void load();
  }, [load]);

  const notes = useMemo(() => {
    const byId = new Map<string, RideNote>();
    for (const note of [...otherLegLoaded, ...(loaded ?? ride.rideNotes ?? []), ...added]) byId.set(note.id, note);
    return sortRideNotes([...byId.values()]);
  }, [otherLegLoaded, loaded, ride.rideNotes, added]);

  const ownIds = useMemo(() => new Set(added.map((note) => note.id)), [added]);
  const driverName = session?.name?.trim().toLowerCase() ?? "";
  const canAdd = ride.status !== "completed" && ride.status !== "cancelled";
  const trimmedDraft = draft.trim();
  const canSend = canAdd && !sending && trimmedDraft.length > 0;

  const send = useCallback(async () => {
    if (!canSend) return;
    setSending(true);
    setSendError(null);
    try {
      const note = await addRideNote(ride.id, trimmedDraft, session?.name || "You");
      setAdded((current) => [...current, note]);
      setDraft("");
      impact(ImpactFeedbackStyle.Light);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Couldn't add the note. Try again.");
    } finally {
      setSending(false);
    }
  }, [canSend, ride.id, trimmedDraft, session?.name, impact]);

  if (loadState === "unavailable" && notes.length === 0) return null;

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, gap: spacing.md, ...shadows.soft }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
        <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "800" }}>Notes</Text>
        {loadState === "loading" ? <ActivityIndicator size="small" color={colors.slate400} /> : null}
      </View>

      {notes.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          {notes.map((note) => (
            <RideNoteRow
              key={note.id}
              note={note}
              isOwn={ownIds.has(note.id) || (note.authorRole === "tr" && !!driverName && note.authorName.trim().toLowerCase() === driverName)}
            />
          ))}
        </View>
      ) : loadState !== "loading" ? (
        <Text style={{ color: colors.slate500, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
          No notes on this ride yet.
        </Text>
      ) : null}

      {loadState === "error" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text style={{ flex: 1, color: colors.amberStrong, fontSize: 13, fontWeight: "700", lineHeight: 18 }}>
            Couldn't load the latest notes.
          </Text>
          <Pressable
            onPress={() => void load()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading notes"
            style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", paddingHorizontal: 8, opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ color: colors.blueStrong, fontSize: 14, fontWeight: "800" }}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {canAdd ? (
        <View style={{ gap: spacing.sm }}>
          <TextInput
            value={draft}
            onChangeText={(value) => {
              setDraft(value);
              if (sendError) setSendError(null);
            }}
            editable={!sending}
            placeholder="Add a note for dispatch"
            placeholderTextColor={colors.slate400}
            multiline
            maxLength={RIDE_NOTE_MAX_LENGTH}
            accessibilityLabel="New ride note"
            style={{
              minHeight: 72,
              maxHeight: 160,
              borderRadius: radii.sm,
              borderWidth: 1,
              borderColor: colors.slate200,
              backgroundColor: colors.surfaceLowest,
              padding: 12,
              fontSize: 15,
              lineHeight: 21,
              color: colors.primary,
              textAlignVertical: "top",
            }}
          />
          {sendError ? (
            <Text accessibilityLiveRegion="polite" style={{ color: colors.error, fontSize: 14, fontWeight: "700", lineHeight: 20 }}>
              {sendError}
            </Text>
          ) : null}
          <Pressable
            onPress={() => void send()}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="Add note"
            accessibilityState={{ disabled: !canSend, busy: sending }}
            style={({ pressed }) => ({
              minHeight: 48,
              borderRadius: radii.sm,
              backgroundColor: pressed ? colors.primaryPressed : colors.primary,
              opacity: canSend ? 1 : 0.45,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            })}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <SymbolIcon name="arrow.up" size={14} tintColor={colors.surface} />
            )}
            <Text style={{ color: colors.surface, fontSize: 14, fontWeight: "800" }}>
              {sending ? "Adding…" : "Add note"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function RideNoteRow({ note, isOwn }: { note: RideNote; isOwn: boolean }) {
  const label = note.authorRole === "dispatch" ? "Dispatch" : isOwn ? "You" : "TR";
  const time = formatRideNoteTime(note.createdAt);
  const tone = note.authorRole === "dispatch"
    ? { bg: colors.blueSoft, text: colors.blueStrong }
    : { bg: colors.slate100, text: colors.primarySoft };

  return (
    <View
      accessible
      accessibilityLabel={`${label} note from ${note.authorName}${time ? `, ${time}` : ""}. ${note.text}`}
      style={{ backgroundColor: colors.surfaceLow, borderRadius: radii.sm, padding: spacing.sm, gap: 6 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ flexShrink: 1, color: colors.primary, fontSize: 14, fontWeight: "800" }} numberOfLines={1}>
          {note.authorName}
        </Text>
        <View style={{ backgroundColor: tone.bg, borderRadius: radii.xs, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ color: tone.text, fontSize: 10, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }}>
            {label}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        {time ? (
          <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
            {time}
          </Text>
        ) : null}
      </View>
      <Text selectable style={{ color: colors.primary, fontSize: 15, fontWeight: "500", lineHeight: 21 }}>
        {note.text}
      </Text>
    </View>
  );
}

function formatRideNoteTime(value: string): string {
  const date = parseBackendDate(value);
  if (!date) return "";
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (date.toDateString() === new Date().toDateString()) return time;
  return `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}
