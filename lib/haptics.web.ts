export {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from "expo-haptics";

import * as Haptics from "expo-haptics";
import { haptic as webHaptic } from "ios-haptics";

export const impact = (
  _style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium,
) => {
  webHaptic();
};

export const notification = (type: Haptics.NotificationFeedbackType) => {
  if (type === Haptics.NotificationFeedbackType.Error) {
    webHaptic.error();
  } else if (type === Haptics.NotificationFeedbackType.Success) {
    webHaptic.confirm();
  } else {
    webHaptic();
  }
};

export const selection = () => {
  webHaptic();
};
