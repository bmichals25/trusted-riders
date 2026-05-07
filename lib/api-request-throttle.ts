export type ApiRequestResult = "sent" | "skipped" | "failed" | "paused";

export class ApiRequestThrottle {
  private lastAttemptAt: number | null = null;
  private backoffUntil = 0;
  private inFlight = false;

  constructor(
    private readonly minIntervalMs: number,
    private readonly failureBackoffMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  begin(): boolean {
    const timestamp = this.now();
    if (
      this.inFlight ||
      timestamp < this.backoffUntil ||
      (this.lastAttemptAt !== null && timestamp - this.lastAttemptAt < this.minIntervalMs)
    ) {
      return false;
    }

    this.lastAttemptAt = timestamp;
    this.inFlight = true;
    return true;
  }

  pauseFor(durationMs: number): void {
    this.backoffUntil = Math.max(this.backoffUntil, this.now() + durationMs);
  }

  finish(result: Exclude<ApiRequestResult, "skipped">): void {
    this.inFlight = false;
    if (result === "paused") {
      return;
    }
    if (result === "failed") {
      this.pauseFor(this.failureBackoffMs);
    } else {
      this.backoffUntil = 0;
    }
  }
}
