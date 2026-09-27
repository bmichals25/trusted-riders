import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { useDispatchData } from "@/lib/dispatch-context";
import {
  finishedRidePayload,
  pickLiveActivityRide,
  rideActivityPayload,
  type RideActivityPayload,
} from "@/lib/live-activity";
import type { DispatchedRide } from "@/lib/rides";
import { RideActivity } from "@/modules/ride-activity";

// Re-check once a minute so an accepted ride appears when it enters the two-hour window.
const TICK_MS = 60 * 1000;

/**
 * Keeps the ride Live Activity (Lock Screen + Dynamic Island) in step with the TR's rides. Renders nothing.
 * Mounted inside DispatchProvider, so signing out unmounts it and ends the activity.
 */
export function RideLiveActivitySync() {
  const { activeRide, rides, recentlyFinishedRides } = useDispatchData();
  const [now, setNow] = useState(() => Date.now());
  const shownRef = useRef<DispatchedRide | null>(null);
  const lastSentRef = useRef<string>("null");
  // Set once the shown ride's final state (completed/cancelled) has been sent: native ends the activity itself
  // (leaving "Ride complete" up a few minutes), so it must not be followed by an immediate end.
  const finishedRef = useRef(false);

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

  useEffect(() => {
    if (!RideActivity || !RideActivity.isSupported()) return;
    const ride = pickLiveActivityRide(activeRide, rides, now);
    let payload: RideActivityPayload | null = null;
    if (ride) {
      payload = rideActivityPayload(ride);
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
  }, [activeRide, rides, recentlyFinishedRides, now]);

  return null;
}
