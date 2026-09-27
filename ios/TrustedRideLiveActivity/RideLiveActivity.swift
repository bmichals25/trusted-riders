import ActivityKit
import SwiftUI
import WidgetKit

// The ride Live Activity: a Lock Screen card and the Dynamic Island while a ride is upcoming or under way.
// Started, updated and ended by the app (modules/ride-activity, lib/live-activity.ts). PHI-free by design:
// ride number, step and pickup time only (RideActivityAttributes.swift).

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

/// Pickup countdown while the ride is upcoming and the pickup is ahead; the pickup time otherwise.
private struct PickupTime: View {
  let context: ActivityViewContext<RideActivityAttributes>
  var compact = false

  var body: some View {
    let state = context.state
    let step = RideStep(state.step)
    if let pickupAt = state.pickupAt, showsCountdown(context) {
      VStack(alignment: .trailing, spacing: 0) {
        if !compact {
          Text("Pickup in").font(.caption2).foregroundStyle(.white.opacity(0.7))
        }
        Text(timerInterval: Date.now...pickupAt, countsDown: true)
          .font(compact ? .body.weight(.semibold) : .title3.weight(.bold))
          .monospacedDigit()
          .multilineTextAlignment(.trailing)
          .foregroundStyle(Brand.yellow)
      }
    } else if let pickupAt = state.pickupAt, step.index < 3 {
      VStack(alignment: .trailing, spacing: 0) {
        if !compact {
          Text("Pickup").font(.caption2).foregroundStyle(.white.opacity(0.7))
        }
        Text(pickupAt, style: .time)
          .font(compact ? .body.weight(.semibold) : .title3.weight(.bold))
          .monospacedDigit()
          .foregroundStyle(.white)
      }
    } else {
      Image(systemName: step.symbol)
        .font(compact ? .body : .title2)
        .foregroundStyle(step.tint)
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

private struct LockScreenView: View {
  let context: ActivityViewContext<RideActivityAttributes>

  var body: some View {
    let step = RideStep(context.state.step)
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .center, spacing: 10) {
        Image("Badge")
          .resizable()
          .scaledToFit()
          .frame(width: 32, height: 32)
          .accessibilityHidden(true)
        VStack(alignment: .leading, spacing: 2) {
          Text("TrustedRide · \(rideTitle(context))")
            .font(.caption)
            .foregroundStyle(.white.opacity(0.7))
            .lineLimit(1)
          Text(step.title)
            .font(.headline)
            .foregroundStyle(.white)
            .lineLimit(1)
        }
        Spacer(minLength: 8)
        PickupTime(context: context)
      }
      StepBar(step: step)
    }
    .padding(16)
    .activityBackgroundTint(Brand.navy)
    .activitySystemActionForegroundColor(.white)
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
            Image("Badge").resizable().scaledToFit().frame(width: 22, height: 22)
            Text(rideTitle(context)).font(.subheadline.weight(.semibold)).lineLimit(1)
          }
          .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          PickupTime(context: context, compact: true)
            .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 8) {
            Label(step.title, systemImage: step.symbol)
              .font(.headline)
              .foregroundStyle(.white)
            StepBar(step: step)
          }
          .padding(.horizontal, 4)
        }
      } compactLeading: {
        Image(systemName: step.symbol).foregroundStyle(step.tint)
      } compactTrailing: {
        if let pickupAt = context.state.pickupAt, showsCountdown(context) {
          Text(timerInterval: Date.now...pickupAt, countsDown: true)
            .monospacedDigit()
            .font(.caption.weight(.semibold))
            .foregroundStyle(Brand.yellow)
            .frame(maxWidth: 48)
        } else {
          Text(step.short).font(.caption.weight(.semibold)).foregroundStyle(.white)
        }
      } minimal: {
        Image(systemName: step.symbol).foregroundStyle(step.tint)
      }
      .widgetURL(URL(string: "trustedriders://"))
      .keylineTint(Brand.yellow)
    }
  }
}
