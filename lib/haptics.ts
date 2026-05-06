import { Platform } from "react-native";

export {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from "expo-haptics";

import * as Haptics from "expo-haptics";

type WebHaptic = (() => void) & { confirm: () => void; error: () => void };
const webHaptic: WebHaptic | null =
  Platform.OS === "web" ? require("ios-haptics").haptic : null;

export const impact = (
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium,
) => {
  if (Platform.OS === "web") {
    webHaptic?.();
  } else {
    Haptics.impactAsync(style);
  }
};

export const notification = (type: Haptics.NotificationFeedbackType) => {
  if (Platform.OS === "web") {
    if (type === Haptics.NotificationFeedbackType.Error) {
      webHaptic?.error();
    } else if (type === Haptics.NotificationFeedbackType.Success) {
      webHaptic?.confirm();
    } else {
      webHaptic?.();
    }
  } else {
    Haptics.notificationAsync(type);
  }
};

export const selection = () => {
  if (Platform.OS === "web") {
    webHaptic?.();
  } else {
    Haptics.selectionAsync();
  }
};
