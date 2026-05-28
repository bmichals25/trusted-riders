export {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from "expo-haptics";

import * as Haptics from "expo-haptics";

export const impact = (
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium,
) => {
  Haptics.impactAsync(style);
};

export const notification = (type: Haptics.NotificationFeedbackType) => {
  Haptics.notificationAsync(type);
};

export const selection = () => {
  Haptics.selectionAsync();
};
