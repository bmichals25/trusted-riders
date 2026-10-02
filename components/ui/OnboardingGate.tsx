import { useCallback, useEffect, useRef, useState } from "react";
import { type Href, usePathname, useRootNavigationState, useRouter } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth, useStartupPresentation } from "@/components/ui/DriverNameGate";
import { OnboardingFlow } from "@/features/onboarding/onboarding-flow";
import { DEMO_MODE } from "@/lib/demo-mode";
import * as storage from "@/lib/storage";
import { colors } from "@/lib/theme";

const DRIVER_EMAIL_KEY = "trustedriders-driver-email";
const ONBOARDING_KEY_PREFIX = "trustedriders-onboarding-v1:";

// Where to go once the app opens (onboarding's last step can send the TR to My availability).
let pendingDestination: Href | null = null;
const replayListeners = new Set<() => void>();

/** Settings > App Preferences: show the welcome again (it re-asks nothing iOS already decided). */
export function replayOnboarding() {
  replayListeners.forEach((listener) => listener());
}

/**
 * First sign-in welcome (after the TrustedRider agreement, before the app): welcome, location,
 * notifications, availability. Shown once per TrustedRider on this phone; permissions can be changed
 * later in Settings, and LocationSetupGate still requires location before the app works.
 * Mounted before DispatchProvider so the notification prompt comes from this explained step,
 * not the moment the app opens.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [phase, setPhase] = useState<"checking" | "show" | "done">(DEMO_MODE ? "done" : "checking");
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    if (DEMO_MODE) return;
    let cancelled = false;
    (async () => {
      const email = (await storage.get(DRIVER_EMAIL_KEY))?.trim().toLowerCase() || session?.name || "driver";
      const key = `${ONBOARDING_KEY_PREFIX}${email}`;
      keyRef.current = key;
      const seen = await storage.get(key);
      if (!cancelled) setPhase(seen ? "done" : "show");
    })().catch(() => !cancelled && setPhase("done"));
    return () => {
      cancelled = true;
    };
  }, [session?.name]);

  useEffect(() => {
    const listener = () => {
      // Forget "seen" first: the app may remount this gate, which re-reads it.
      const key = keyRef.current;
      void (key ? storage.remove(key) : Promise.resolve()).finally(() => setPhase("show"));
    };
    replayListeners.add(listener);
    return () => {
      replayListeners.delete(listener);
    };
  }, []);

  const finish = useCallback(async (destination: Href | null) => {
    pendingDestination = destination;
    if (keyRef.current) await storage.set(keyRef.current, new Date().toISOString()).catch(() => {});
    setPhase("done");
  }, []);

  if (phase === "checking") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceLow }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (phase === "show") {
    return <OnboardingFlow firstName={(session?.name ?? "").split(/\s+/)[0] || null} onFinish={finish} />;
  }
  return <>{children}</>;
}

/**
 * Mounted next to the Stack: opens the screen onboarding asked for once the app is showing. The tabs
 * mount (on Home) a moment after the Stack, so it retries until the screen is actually open.
 */
export function OnboardingDestination() {
  const router = useRouter();
  const pathname = usePathname();
  const ready = Boolean(useRootNavigationState()?.key);
  const { startupAnimationComplete } = useStartupPresentation();
  const attemptsRef = useRef(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const href = pendingDestination;
    if (!href || !ready || !startupAnimationComplete) return;
    const targetPath = String(href).split("?")[0];
    if (pathname === targetPath || attemptsRef.current >= 8) {
      pendingDestination = null;
      attemptsRef.current = 0;
      return;
    }
    const timer = setTimeout(() => {
      attemptsRef.current += 1;
      try {
        router.navigate(href);
      } catch (error) {
        console.log("[onboarding] navigation failed", error instanceof Error ? error.message : error);
      }
      setTick((n) => n + 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [pathname, ready, router, startupAnimationComplete, tick]);
  return null;
}
