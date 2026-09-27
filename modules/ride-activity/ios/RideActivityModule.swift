import ActivityKit
import ExpoModulesCore

/// JS payload for sync(): the ride's Live Activity content. PHI-free (see RideActivityAttributes.swift).
struct RideActivityPayload: Record {
  @Field var rideNumber: String = ""
  /// "upcoming" | "en_route" | "at_pickup" | "on_board" | "completed" | "cancelled"
  @Field var step: String = "upcoming"
  /// Scheduled pickup, epoch milliseconds.
  @Field var pickupAtMs: Double? = nil
  @Field var legLabel: String? = nil
}

/// The app keeps at most one ride Live Activity: sync() starts it, updates it, or ends it.
public class RideActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RideActivity")

    /// Whether this phone can show Live Activities now (iOS 16.2+ and allowed in Settings).
    Function("isSupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    /// payload nil: end every ride activity at once. step "completed": end it, showing the final state for
    /// a few minutes. "cancelled": end it now. Otherwise start it (only allowed while the app is in the
    /// foreground) or update the one already showing this ride. Resolves with the activity id, or nil.
    AsyncFunction("sync") { (payload: RideActivityPayload?) async -> String? in
      guard #available(iOS 16.2, *) else { return nil }
      return await RideActivityController.sync(payload)
    }
  }
}

@available(iOS 16.2, *)
enum RideActivityController {
  static func sync(_ payload: RideActivityPayload?) async -> String? {
    let running = Activity<RideActivityAttributes>.activities
    guard let payload, !payload.rideNumber.isEmpty else {
      for activity in running { await activity.end(nil, dismissalPolicy: .immediate) }
      return nil
    }

    let pickupAt = payload.pickupAtMs.map { Date(timeIntervalSince1970: $0 / 1000) }
    let state = RideActivityAttributes.ContentState(step: payload.step, pickupAt: pickupAt, legLabel: payload.legLabel)
    // Before pickup the stale date is the pickup time itself: iOS re-renders the activity when it goes stale,
    // so the countdown turns into the pickup time even while the app is suspended (a timer would stop at 0:00).
    // After that, the content is outdated an hour on if the app hasn't updated it since.
    let now = Date()
    let staleDate = pickupAt.map { at in
      payload.step == "upcoming" && at > now ? at : max(at, now).addingTimeInterval(60 * 60)
    }
    let content = ActivityContent(state: state, staleDate: staleDate)
    let current = running.first { $0.attributes.rideNumber == payload.rideNumber }

    // Only one ride activity at a time.
    for activity in running where activity.id != current?.id {
      await activity.end(nil, dismissalPolicy: .immediate)
    }

    switch payload.step {
    case "completed":
      await current?.end(content, dismissalPolicy: .after(Date().addingTimeInterval(5 * 60)))
      return nil
    case "cancelled":
      await current?.end(content, dismissalPolicy: .immediate)
      return nil
    default:
      if let current {
        if current.content.state != state { await current.update(content) }
        return current.id
      }
      do {
        let activity = try Activity.request(
          attributes: RideActivityAttributes(rideNumber: payload.rideNumber),
          content: content,
          pushType: nil
        )
        return activity.id
      } catch {
        // e.g. the app is in the background, or the TR turned Live Activities off.
        NSLog("[RideActivity] could not start: %@", String(describing: error))
        return nil
      }
    }
  }
}
