import ActivityKit
import SwiftUI
import UIKit
import WidgetKit

// The ride Live Activity: a Lock Screen card and the Dynamic Island while a ride is upcoming or under way.
// Started, updated and ended by the app (modules/ride-activity, lib/live-activity.ts).
//
// Privacy: the Lock Screen card is readable on a locked phone, so it shows no PHI (ride number, step, pickup
// time, ETA). The passenger's name and photo appear only in the Dynamic Island's expanded view, which iOS
// shows only on an unlocked phone in use. The compact and minimal views (also used by Apple Watch and CarPlay)
// never show them.

@main
struct TrustedRideLiveActivityBundle: WidgetBundle {
  var body: some Widget {
    RideLiveActivity()
  }
}

private enum Brand {
  static let navy = Color(red: 15 / 255, green: 23 / 255, blue: 42 / 255)      // #0F172A
  static let yellow = Color(red: 250 / 255, green: 204 / 255, blue: 21 / 255)   // #FACC15
  static let green = Color(red: 22 / 255, green: 163 / 255, blue: 74 / 255)     // #16A34A
}

/// The ride's step, from ContentState.step.
private enum RideStep: String {
  case upcoming, en_route, at_pickup, on_board, completed, cancelled

  init(_ raw: String) { self = RideStep(rawValue: raw) ?? .upcoming }

  var title: String {
    switch self {
    case .upcoming: return "Upcoming ride"
    case .en_route: return "En route to pickup"
    case .at_pickup: return "At pickup"
    case .on_board: return "Passenger on board"
    case .completed: return "Ride complete"
    case .cancelled: return "Ride cancelled"
    }
  }

  var short: String {
    switch self {
    case .upcoming: return "Upcoming"
    case .en_route: return "En route"
    case .at_pickup: return "At pickup"
    case .on_board: return "On board"
    case .completed: return "Done"
    case .cancelled: return "Cancelled"
    }
  }

  var symbol: String {
    switch self {
    case .upcoming: return "clock.fill"
    case .en_route: return "car.fill"
    case .at_pickup: return "mappin.circle.fill"
    case .on_board: return "person.fill.checkmark"
    case .completed: return "checkmark.circle.fill"
    case .cancelled: return "xmark.circle.fill"
    }
  }

  /// Position in the four-step bar (Upcoming, En route, At pickup, On board); 4 = all done.
  var index: Int {
    switch self {
    case .upcoming, .cancelled: return 0
    case .en_route: return 1
    case .at_pickup: return 2
    case .on_board: return 3
    case .completed: return 4
    }
  }

  var tint: Color { self == .completed ? Brand.green : Brand.yellow }
}

private func rideTitle(_ context: ActivityViewContext<RideActivityAttributes>) -> String {
  let base = "Ride #\(context.attributes.rideNumber)"
  guard let leg = context.state.legLabel, !leg.isEmpty else { return base }
  return "\(base) · \(leg)"
}

/// Whether to count down to pickup: the ride is upcoming and pickup is still ahead. The activity goes stale at
/// pickup time (RideActivityModule.swift) and iOS re-renders it then, switching to the pickup time.
private func showsCountdown(_ context: ActivityViewContext<RideActivityAttributes>) -> Bool {
  guard let pickupAt = context.state.pickupAt else { return false }
  return RideStep(context.state.step) == .upcoming && !context.isStale && pickupAt > .now
}

/// Whole minutes until the ETA while en route (at least 1), or nil.
private func etaMinutes(_ state: RideActivityAttributes.ContentState) -> Int? {
  guard RideStep(state.step) == .en_route, let etaAt = state.etaAt else { return nil }
  return max(1, Int((etaAt.timeIntervalSinceNow / 60).rounded(.up)))
}

/// "Arriving in 6 min · 11:52 AM" while en route with an ETA; the pickup countdown while upcoming.
private struct StatusLine: View {
  let context: ActivityViewContext<RideActivityAttributes>
  var font: Font = .subheadline.weight(.semibold)

  var body: some View {
    let state = context.state
    if let minutes = etaMinutes(state), let etaAt = state.etaAt {
      (Text("Arriving in \(minutes) min · ") + Text(etaAt, style: .time))
        .font(font)
        .foregroundStyle(Brand.yellow)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    } else if showsCountdown(context), let pickupAt = state.pickupAt {
      HStack(spacing: 4) {
        Text("Pickup in")
        Text(timerInterval: Date.now...pickupAt, countsDown: true)
          .monospacedDigit()
      }
      .font(font)
      .foregroundStyle(Brand.yellow)
      .lineLimit(1)
    }
  }
}

/// Upcoming → En route → At pickup → On board.
private struct StepBar: View {
  let step: RideStep
  private let labels = ["Upcoming", "En route", "At pickup", "On board"]

  var body: some View {
    VStack(spacing: 4) {
      HStack(spacing: 4) {
        ForEach(0..<4, id: \.self) { i in
          Capsule()
            .fill(color(for: i))
            .frame(height: 5)
        }
      }
      HStack(spacing: 4) {
        ForEach(0..<4, id: \.self) { i in
          Text(labels[i])
            .font(.system(size: 10, weight: i == step.index ? .bold : .regular))
            .foregroundStyle(.white.opacity(i <= step.index ? 0.95 : 0.5))
            .lineLimit(1)
            .minimumScaleFactor(0.8)
            .frame(maxWidth: .infinity)
        }
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Step \(min(step.index + 1, 4)) of 4: \(step.title)")
  }

  private func color(for i: Int) -> Color {
    if step == .completed { return Brand.green }
    if i < step.index { return .white.opacity(0.9) }
    if i == step.index { return Brand.yellow }
    return .white.opacity(0.22)
  }
}

/// "Pickup 12:24 AM" (small, trailing): shown until the passenger is on board.
private struct PickupCaption: View {
  let state: RideActivityAttributes.ContentState

  var body: some View {
    if let pickupAt = state.pickupAt, RideStep(state.step).index < 3 {
      (Text("Pickup ") + Text(pickupAt, style: .time))
        .font(.caption.weight(.semibold))
        .foregroundStyle(.white.opacity(0.8))
        .lineLimit(1)
        .fixedSize()
    }
  }
}

/// Lock Screen card. No PHI (see the file header).
private struct LockScreenView: View {
  let context: ActivityViewContext<RideActivityAttributes>

  var body: some View {
    let step = RideStep(context.state.step)
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 8) {
        Image("Badge")
          .resizable()
          .scaledToFit()
          .frame(width: 22, height: 22)
          .accessibilityHidden(true)
        Text("TrustedRide · \(rideTitle(context))")
          .font(.caption.weight(.semibold))
          .foregroundStyle(.white.opacity(0.8))
          .lineLimit(1)
          .minimumScaleFactor(0.8)
        Spacer(minLength: 8)
        PickupCaption(state: context.state)
      }
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Image(systemName: step.symbol)
          .foregroundStyle(step.tint)
        Text(step.title)
          .foregroundStyle(.white)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      }
      .font(.title3.weight(.bold))
      StatusLine(context: context)
      StepBar(step: step)
        .padding(.top, 2)
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
    .activityBackgroundTint(Brand.navy)
    .activitySystemActionForegroundColor(.white)
  }
}

/// The passenger's photo from the App Group (PassengerPhotoStore), else their initials. Dynamic Island only.
private struct PassengerAvatar: View {
  let state: RideActivityAttributes.ContentState
  var size: CGFloat = 44

  var body: some View {
    Group {
      if let file = state.photoFile,
         let url = RideActivityShared.photoURL(file),
         let image = UIImage(contentsOfFile: url.path) {
        Image(uiImage: image)
          .resizable()
          .scaledToFill()
      } else {
        ZStack {
          Circle().fill(Color.white.opacity(0.18))
          Text(initials(state.passengerName))
            .font(.system(size: size * 0.38, weight: .bold))
            .foregroundStyle(.white)
        }
      }
    }
    .frame(width: size, height: size)
    .clipShape(Circle())
    .accessibilityHidden(true)
  }

  private func initials(_ name: String?) -> String {
    let words = (name ?? "")
      .replacingOccurrences(of: "(demo)", with: "")
      .split(separator: " ")
    let letters = words.prefix(2).compactMap(\.first).map(String.init).joined()
    return letters.isEmpty ? "TR" : letters.uppercased()
  }
}

/// Minutes to pickup, the countdown, or the step: the Dynamic Island's trailing slot.
private struct IslandTrailing: View {
  let context: ActivityViewContext<RideActivityAttributes>
  var compact = false

  var body: some View {
    let step = RideStep(context.state.step)
    if let minutes = etaMinutes(context.state) {
      Text("\(minutes) min")
        .font(compact ? .caption.weight(.semibold) : .headline)
        .monospacedDigit()
        .foregroundStyle(Brand.yellow)
        .lineLimit(1)
    } else if showsCountdown(context), let pickupAt = context.state.pickupAt {
      Text(timerInterval: Date.now...pickupAt, countsDown: true)
        .font(compact ? .caption.weight(.semibold) : .headline)
        .monospacedDigit()
        .multilineTextAlignment(.trailing)
        .foregroundStyle(Brand.yellow)
        .frame(maxWidth: compact ? 48 : 72, alignment: .trailing)
    } else {
      Text(step.short)
        .font(compact ? .caption.weight(.semibold) : .subheadline.weight(.semibold))
        .foregroundStyle(compact ? .white : step.tint)
        .lineLimit(1)
    }
  }
}

struct RideLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RideActivityAttributes.self) { context in
      LockScreenView(context: context)
    } dynamicIsland: { context in
      let step = RideStep(context.state.step)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          HStack(spacing: 6) {
            Image("Badge").resizable().scaledToFit().frame(width: 20, height: 20)
            Text(rideTitle(context))
              .font(.subheadline.weight(.semibold))
              .lineLimit(1)
              .minimumScaleFactor(0.8)
          }
          .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          IslandTrailing(context: context)
            .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 12) {
              PassengerAvatar(state: context.state)
              VStack(alignment: .leading, spacing: 2) {
                if let name = context.state.passengerName, !name.isEmpty {
                  Text(name)
                    .font(.headline)
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                }
                Label(step.title, systemImage: step.symbol)
                  .font(.subheadline.weight(.semibold))
                  .foregroundStyle(step.tint)
                  .lineLimit(1)
                  .minimumScaleFactor(0.8)
                StatusLine(context: context, font: .caption.weight(.semibold))
              }
              Spacer(minLength: 0)
            }
            StepBar(step: step)
          }
          .padding(.horizontal, 4)
        }
      } compactLeading: {
        Image(systemName: step.symbol).foregroundStyle(step.tint)
      } compactTrailing: {
        IslandTrailing(context: context, compact: true)
      } minimal: {
        Image(systemName: step.symbol).foregroundStyle(step.tint)
      }
      .widgetURL(URL(string: "trustedriders://"))
      .keylineTint(Brand.yellow)
    }
  }
}
