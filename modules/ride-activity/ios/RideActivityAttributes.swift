import ActivityKit
import Foundation

/// The ride Live Activity's data. Keep this file identical to
/// modules/ride-activity/ios/RideActivityAttributes.swift: ActivityKit matches the app's and the widget's
/// copies by type name and shape.
///
/// Where it shows decides what it may show. The Lock Screen card is readable without unlocking, so it
/// carries no PHI: ride number, step, pickup time and ETA. The passenger's name and photo appear only in the
/// Dynamic Island's expanded view, which iOS shows only on an unlocked phone in use (RideLiveActivity.swift).
/// Never add addresses, phone numbers, needs or notes.
struct RideActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// "upcoming" | "en_route" | "at_pickup" | "on_board" | "completed" | "cancelled"
    var step: String
    /// Scheduled pickup, if known.
    var pickupAt: Date?
    /// "Ride home" for the return leg of a round trip, else nil.
    var legLabel: String?
    /// Expected arrival at pickup while en route (Apple Maps driving ETA from the TR's position), else nil.
    var etaAt: Date?
    /// The passenger's name: Dynamic Island expanded view only, never the Lock Screen card.
    var passengerName: String?
    /// File name of the passenger's photo in the App Group container (PassengerPhotoStore), else nil.
    var photoFile: String?
  }

  /// What the TR sees as the ride number ("42").
  var rideNumber: String
}

/// The App Group the app and the widget extension share; the passenger photo is written there.
enum RideActivityShared {
  static let appGroup = "group.com.trustedriders.prototype"
  static let photoDirectory = "LiveActivity"

  static func photoURL(_ file: String) -> URL? {
    FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
      .appendingPathComponent(photoDirectory, isDirectory: true)
      .appendingPathComponent(file)
  }
}
