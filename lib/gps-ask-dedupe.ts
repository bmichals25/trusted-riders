/**
 * One dispatch gps_ask can reach the app four ways: the Expo push (received in the
 * foreground), a tap on that push, a tap on the app's own local notification, and
 * the dispatch-chat command poll. This tracker makes sure each gps_ask message id
 * opens the in-app prompt at most once and gets at most one notification banner.
 */
export type GpsAskTracker = {
  /** True the first time for an id: the caller should show the prompt now. */
  claimPrompt: (messageId: string) => boolean;
  hasPrompted: (messageId: string) => boolean;
  /** Record that the OS already delivered a notification (push) for this id. */
  markNotified: (messageId: string) => void;
  /** True the first time for an id that was neither prompted nor already notified. */
  claimLocalNotification: (messageId: string) => boolean;
};

export function normalizeGpsAskMessageId(messageId: unknown): string | null {
  if (typeof messageId === "number" && Number.isFinite(messageId)) return String(messageId);
  if (typeof messageId !== "string") return null;
  const trimmed = messageId.trim();
  return trimmed || null;
}

export function createGpsAskTracker(): GpsAskTracker {
  const prompted = new Set<string>();
  const notified = new Set<string>();

  return {
    claimPrompt(messageId) {
      const id = normalizeGpsAskMessageId(messageId);
      if (!id || prompted.has(id)) return false;
      prompted.add(id);
      return true;
    },
    hasPrompted(messageId) {
      const id = normalizeGpsAskMessageId(messageId);
      return id ? prompted.has(id) : false;
    },
    markNotified(messageId) {
      const id = normalizeGpsAskMessageId(messageId);
      if (id) notified.add(id);
    },
    claimLocalNotification(messageId) {
      const id = normalizeGpsAskMessageId(messageId);
      if (!id || prompted.has(id) || notified.has(id)) return false;
      notified.add(id);
      return true;
    },
  };
}
