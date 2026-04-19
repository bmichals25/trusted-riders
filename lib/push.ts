// Push notification registration — TEMPORARILY DISABLED.
//
// Why: installing `expo-notifications` into the iOS binary triggered a startup
// crash inside `ObjCTurboModule::performVoidMethodInvocation` on iOS 26.3.1
// with Expo SDK 55 (see TestFlight crash logs, builds 0.1.0 (2) and (3)).
// The crash happened during native module init — before any of our JS ran.
//
// This module is kept as a no-op stub so existing call sites
// (`registerForPushNotifications()`) compile unchanged. When we revisit push,
// the plan is:
//   1. bump Expo SDK so the notifications module matches iOS 26's runtime
//   2. OR ship a tiny `notifee`/APNs-direct integration that doesn't use
//      expo-notifications' TurboModule
//   3. re-install the package, re-add the plugin in app.json, restore the
//      lazy-require implementation from git history (commit 9903254)

export async function registerForPushNotifications(): Promise<string | null> {
  return null;
}
