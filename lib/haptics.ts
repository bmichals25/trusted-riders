import { Platform } from "react-native";

export {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from "expo-haptics";

import * as Haptics from "expo-haptics";
import { haptic as webHaptic } from "ios-haptics";

export const impact = (
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium,
) => {
  if (Platform.OS === "web") {
    webHaptic();
  } else {
    Haptics.impactAsync(style);
  }
};

export const notification = (type: Haptics.NotificationFeedbackType) => {
  if (Platform.OS === "web") {
    if (type === Haptics.NotificationFeedbackType.Error) {
      webHaptic.error();
    } else if (type === Haptics.NotificationFeedbackType.Success) {
      webHaptic.confirm();
    } else {
      webHaptic();
    }
  } else {
    Haptics.notificationAsync(type);
  }
};

export const selection = () => {
  if (Platform.OS === "web") {
    webHaptic();
  } else {
    Haptics.selectionAsync();
  }
};
