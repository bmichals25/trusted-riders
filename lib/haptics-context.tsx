import React, { createContext, useContext, useState, useCallback } from "react";
import {
  impact as rawImpact,
  notification as rawNotification,
  selection as rawSelection,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
} from "./haptics";

interface HapticsContextValue {
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
  impact: (style?: ImpactFeedbackStyle) => void;
  notification: (type: NotificationFeedbackType) => void;
  selection: () => void;
}

const HapticsContext = createContext<HapticsContextValue | null>(null);

export function HapticsProvider({ children }: { children: React.ReactNode }) {
  const [hapticsEnabled, setHapticsEnabled] = useState(true);

  const impact = useCallback(
    (style?: ImpactFeedbackStyle) => {
      if (hapticsEnabled) rawImpact(style);
    },
    [hapticsEnabled],
  );

  const notification = useCallback(
    (type: NotificationFeedbackType) => {
      if (hapticsEnabled) rawNotification(type);
    },
    [hapticsEnabled],
  );

  const selection = useCallback(() => {
    if (hapticsEnabled) rawSelection();
  }, [hapticsEnabled]);

  return (
    <HapticsContext.Provider
      value={{ hapticsEnabled, setHapticsEnabled, impact, notification, selection }}
    >
      {children}
    </HapticsContext.Provider>
  );
}

export function useHaptics(): HapticsContextValue {
  const ctx = useContext(HapticsContext);
  if (!ctx) throw new Error("useHaptics must be used within HapticsProvider");
  return ctx;
}
