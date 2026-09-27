import ActivityKit
import Foundation

/// The ride Live Activity's data. Keep this file identical to
/// modules/ride-activity/ios/RideActivityAttributes.swift: ActivityKit matches the app's and the widget's
/// copies by type name and shape.
///
/// It shows on the Lock Screen without unlocking, so it carries no PHI: a ride number, the step and the
/// pickup time only. Never add names, addresses, phone numbers or notes.
struct RideActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// "upcoming" | "en_route" | "at_pickup" | "on_board" | "completed" | "cancelled"
    var step: String
    /// Scheduled pickup, if known.
    var pickupAt: Date?
    /// "Ride home" for the return leg of a round trip, else nil.
    var legLabel: String?
  }

  /// What the TR sees as the ride number ("42").
  var rideNumber: String
}
