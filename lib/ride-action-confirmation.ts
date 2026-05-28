import { Alert } from "react-native";

import { type DispatchedRide } from "./rides";

export function confirmDeclineRideRequest(
  ride: Pick<DispatchedRide, "id">,
  onConfirm: () => void,
) {
  Alert.alert(
    "Decline ride request?",
    `Ride #${normalizeRideId(ride.id)} will be removed from your queue.`,
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline Request",
        style: "destructive",
        onPress: onConfirm,
      },
    ],
  );
}

function normalizeRideId(value: string) {
  return String(value).trim().replace(/^(?:ride[\s_-]*#?|#)/i, "").trim();
}
