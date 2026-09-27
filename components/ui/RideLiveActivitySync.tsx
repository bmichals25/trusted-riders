import { useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";

import { useDispatchData } from "@/lib/dispatch-context";
import { getToken } from "@/lib/fleet-api";
import {
  etaAtFromDrivingTime,
  finishedRidePayload,
  pickLiveActivityRide,
  rideActivityPayload,
  type RideActivityPayload,
} from "@/lib/live-activity";
import { useLocation } from "@/lib/location-context";
import { passengerPhotoSource } from "@/lib/passenger-photo";
import type { DispatchedRide } from "@/lib/rides";
import { RideActivity } from "@/modules/ride-activity";

// Re-check once a minute so an accepted ride appears when it enters the two-hour window, and the ETA stays
// fresh while en route.
const TICK_MS = 60 * 1000;

/**
 * Keeps the ride Live Activity (Lock Screen + Dynamic Island) in step with the TR's rides. Renders nothing.
 * Mounted inside DispatchProvider, so signing out unmounts it and ends the activity (which also deletes the
 * passenger photo it saved for the Dynamic Island).
 */
export function RideLiveActivitySync() {
  const { activeRide, rides, recentlyFinishedRides } = useDispatchData();
  const { location } = useLocation();
  const [now, setNow] = useState(() => Date.now());
  const [photo, setPhoto] = useState<{ rideId: string; file: string } | null>(null);
  const [eta, setEta] = useState<{ rideId: string; etaAtMs: number } | null>(null);
  const shownRef = useRef<DispatchedRide | null>(null);
  const lastSentRef = useRef<string>("null");
  // Set once the shown ride's final state (completed/cancelled) has been sent: native ends the activity itself
  // (leaving "Ride complete" up a few minutes), so it must not be followed by an immediate end.
  const finishedRef = useRef(false);
  const locationRef = useRef(location);
  locationRef.current = location;

  const ride = useMemo(() => pickLiveActivityRide(activeRide, rides, now), [activeRide, rides, now]);

  useEffect(() => {
    if (!RideActivity) return;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    const sub = AppState.addEventListener("change", (state) => {
      // A Live Activity can only be started while the app is in the foreground: retry when it comes back.
      if (state === "active") {
        lastSentRef.current = "";
        setNow(Date.now());
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
      void RideActivity?.sync(null);
    };
  }, []);

  // The passenger's photo for the Dynamic Island: saved once per ride (and again if it changes).
  const photoRideId = ride?.passengerHasPhoto ? ride.id : null;
  const photoVersion = ride?.passengerPhotoUpdatedAt ?? null;
  useEffect(() => {
    if (!RideActivity || !ride || !photoRideId) return;
    const token = getToken();
    const source = passengerPhotoSource(ride, "thumb", token);
    if (!token || !source?.uri) return;
    let cancelled = false;
    void RideActivity.savePassengerPhoto(rideActivityPayload(ride).rideNumber, source.uri, token)
      .then((file) => {
        if (!cancelled && file) setPhoto({ rideId: photoRideId, file });
      })
      .catch(() => undefined); // initials instead
    return () => {
      cancelled = true;
    };
    // Only when the ride or its photo changes, not on every rides refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoRideId, photoVersion]);

  // Apple Maps driving ETA to the pickup while en route, refreshed every tick.
  // From the tracked GPS position when there is one, else the phone's current location.
  const etaRideId = ride?.status === "en_route" && ride.pickupCoords ? ride.id : null;
  const hasLocation = location !== null;
  useEffect(() => {
    if (!RideActivity || !ride || !etaRideId || !ride.pickupCoords) return;
    const from = locationRef.current;
    let cancelled = false;
    void RideActivity.drivingEta(ride.pickupCoords.latitude, ride.pickupCoords.longitude, from?.latitude, from?.longitude)
      .then((seconds) => {
        const etaAtMs = etaAtFromDrivingTime(Date.now(), seconds);
        if (!cancelled && etaAtMs !== null) setEta({ rideId: etaRideId, etaAtMs });
      })
      .catch(() => undefined); // keep the last ETA
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etaRideId, hasLocation, now]);

  useEffect(() => {
    if (!RideActivity || !RideActivity.isSupported()) return;
    let payload: RideActivityPayload | null = null;
    if (ride) {
      payload = rideActivityPayload(ride, ride.status, {
        etaAtMs: eta?.rideId === ride.id ? eta.etaAtMs : null,
        photoFile: photo?.rideId === ride.id ? photo.file : null,
      });
      shownRef.current = ride;
    } else if (shownRef.current) {
      // The ride just finished: send its final state once (native keeps "Ride complete" up a few minutes).
      // A ride the TR just completed is still in `rides` until the next fetch moves it to recentlyFinishedRides.
      payload = finishedRidePayload(shownRef.current, [...rides, ...recentlyFinishedRides]);
      if (!payload) shownRef.current = null;
    }

    if (!payload && finishedRef.current) return;
    const key = JSON.stringify(payload);
    if (key === lastSentRef.current) return;
    lastSentRef.current = key;
    finishedRef.current = payload?.step === "completed" || payload?.step === "cancelled";
    void RideActivity.sync(payload).catch(() => {
      lastSentRef.current = ""; // try again on the next change or tick
    });
  }, [ride, rides, recentlyFinishedRides, eta, photo]);

  return null;
}
