import ActivityKit
import ExpoModulesCore
import MapKit
import UIKit

/// JS payload for sync(): the ride's Live Activity content (see RideActivityAttributes.swift for what may be
/// shown where).
struct RideActivityPayload: Record {
  @Field var rideNumber: String = ""
  /// "upcoming" | "en_route" | "at_pickup" | "on_board" | "completed" | "cancelled"
  @Field var step: String = "upcoming"
  /// Scheduled pickup, epoch milliseconds.
  @Field var pickupAtMs: Double? = nil
  @Field var legLabel: String? = nil
  /// Expected arrival at pickup, epoch milliseconds (en route only).
  @Field var etaAtMs: Double? = nil
  /// Dynamic Island expanded view only.
  @Field var passengerName: String? = nil
  /// From savePassengerPhoto().
  @Field var photoFile: String? = nil
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

    /// Downloads the passenger's photo (the app's authenticated thumb URL) into the App Group for the Dynamic
    /// Island. Resolves with the file name to pass as photoFile, or nil when it couldn't be fetched.
    AsyncFunction("savePassengerPhoto") { (rideNumber: String, url: String, token: String) async -> String? in
      await PassengerPhotoStore.save(rideNumber: rideNumber, url: url, token: token)
    }

    /// Driving time in seconds to the pickup (Apple Maps), or nil. From the given position, else the phone's
    /// current location (the app has location permission).
    AsyncFunction("drivingEta") { (toLat: Double, toLon: Double, fromLat: Double?, fromLon: Double?) async -> Double? in
      let request = MKDirections.Request()
      if let fromLat, let fromLon {
        request.source = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: fromLat, longitude: fromLon)))
      } else {
        request.source = MKMapItem.forCurrentLocation()
      }
      request.destination = MKMapItem(placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: toLat, longitude: toLon)))
      request.transportType = .automobile
      request.departureDate = Date()
      do {
        return try await MKDirections(request: request).calculateETA().expectedTravelTime
      } catch {
        return nil
      }
    }
  }
}

@available(iOS 16.2, *)
enum RideActivityController {
  static func sync(_ payload: RideActivityPayload?) async -> String? {
    let running = Activity<RideActivityAttributes>.activities
    guard let payload, !payload.rideNumber.isEmpty else {
      for activity in running { await activity.end(nil, dismissalPolicy: .immediate) }
      PassengerPhotoStore.clear()
      return nil
    }

    let pickupAt = payload.pickupAtMs.map { Date(timeIntervalSince1970: $0 / 1000) }
    let state = RideActivityAttributes.ContentState(
      step: payload.step,
      pickupAt: pickupAt,
      legLabel: payload.legLabel,
      etaAt: payload.etaAtMs.map { Date(timeIntervalSince1970: $0 / 1000) },
      passengerName: payload.passengerName,
      photoFile: payload.photoFile
    )
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
      PassengerPhotoStore.clear()
      return nil
    case "cancelled":
      await current?.end(content, dismissalPolicy: .immediate)
      PassengerPhotoStore.clear()
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

/// The passenger photo shown in the Dynamic Island. The widget extension can't reach the network or the
/// app's session, so the app writes a small copy into the shared App Group container. Privacy: one file at a
/// time, with complete file protection (unreadable while the phone is locked), deleted when the activity ends
/// or the TR signs out (sync(nil)).
enum PassengerPhotoStore {
  /// Big enough for the 44pt avatar at 3x.
  private static let side: CGFloat = 132

  static func save(rideNumber: String, url: String, token: String) async -> String? {
    guard let requestURL = URL(string: url), let directory = directoryURL() else { return nil }
    var request = URLRequest(url: requestURL)
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.cachePolicy = .reloadIgnoringLocalCacheData
    guard
      let (data, response) = try? await URLSession.shared.data(for: request),
      (response as? HTTPURLResponse)?.statusCode == 200,
      let image = UIImage(data: data),
      let jpeg = square(image).jpegData(compressionQuality: 0.8)
    else { return nil }

    // A fresh name each time, so a new photo changes the content state and the activity re-renders.
    let safeRide = rideNumber.filter { $0.isLetter || $0.isNumber }
    let file = "passenger-\(safeRide)-\(Int(Date().timeIntervalSince1970)).jpg"
    do {
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      clear(keeping: nil)
      try jpeg.write(to: directory.appendingPathComponent(file), options: [.atomic, .completeFileProtection])
      return file
    } catch {
      return nil
    }
  }

  static func clear() { clear(keeping: nil) }

  private static func clear(keeping: String?) {
    guard
      let directory = directoryURL(),
      let files = try? FileManager.default.contentsOfDirectory(atPath: directory.path)
    else { return }
    for file in files where file != keeping {
      try? FileManager.default.removeItem(at: directory.appendingPathComponent(file))
    }
  }

  private static func directoryURL() -> URL? {
    FileManager.default
      .containerURL(forSecurityApplicationGroupIdentifier: RideActivityShared.appGroup)?
      .appendingPathComponent(RideActivityShared.photoDirectory, isDirectory: true)
  }

  /// Center-cropped square, `side` points on a side at scale 1.
  private static func square(_ image: UIImage) -> UIImage {
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    let size = CGSize(width: side, height: side)
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in
      let scale = max(side / image.size.width, side / image.size.height)
      let drawn = CGSize(width: image.size.width * scale, height: image.size.height * scale)
      image.draw(in: CGRect(
        x: (side - drawn.width) / 2,
        y: (side - drawn.height) / 2,
        width: drawn.width,
        height: drawn.height
      ))
    }
  }
}
