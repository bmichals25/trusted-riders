import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import { msUntilNextDay, startOfDay } from "@/features/schedule/schedule-model";

/**
 * Start of the current local day, kept current: re-checked when the screen gains focus, when the app comes
 * back to the foreground, and by a timer at the next midnight (timers don't run while the app is suspended,
 * hence the other two).
 */
export function useToday(focused: boolean): Date {
  const [today, setToday] = useState(() => startOfDay(new Date()));

  const sync = useCallback(() => {
    const next = startOfDay(new Date());
    setToday((current) => (current.getTime() === next.getTime() ? current : next));
  }, []);

  useEffect(() => {
    if (focused) sync();
  }, [focused, sync]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    return () => subscription.remove();
  }, [sync]);

  useEffect(() => {
    // A second past midnight, so the new day has certainly started; `today` changing re-arms it.
    const timer = setTimeout(sync, msUntilNextDay(new Date()) + 1000);
    return () => clearTimeout(timer);
  }, [today, sync]);

  return today;
}
