import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, StyleSheet, View } from "react-native";

import { useAuth } from "@/components/ui/DriverNameGate";
import { AgreementScreen } from "@/features/agreement/agreement-screen";
import { acceptAgreement, fetchAgreement, type TrAgreement } from "@/lib/agreement-api";
import { onAgreementRequired } from "@/lib/agreement-events";
import { DEMO_MODE } from "@/lib/demo-mode";
import { notification, NotificationFeedbackType } from "@/lib/haptics";
import { colors } from "@/lib/theme";

type Phase = "checking" | "accepted" | "required";

// Re-check on returning to the app at most this often, so a new agreement version re-prompts on next open.
const FOREGROUND_RECHECK_MS = 60_000;

/**
 * One-time onboarding step after sign-in (BEN-20): until the driver accepts the current Trusted Rider
 * agreement, the whole app is replaced by the agreement screen. Checked after login and on every app
 * start with a stored session; any API call answered with 403 agreement_required brings it back.
 *
 * If the agreement can't be loaded (offline, older backend) the app opens normally: the backend still
 * refuses ride actions until the agreement is accepted, and that 403 reopens this screen.
 */
export function AgreementGate({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const [phase, setPhase] = useState<Phase>(DEMO_MODE ? "accepted" : "checking");
  const [agreement, setAgreement] = useState<TrAgreement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const requestSeq = useRef(0);
  const lastCheckAt = useRef(0);

  const load = useCallback(
    async (options: { required?: boolean } = {}) => {
      const seq = ++requestSeq.current;
      lastCheckAt.current = Date.now();
      setLoading(true);
      const result = await fetchAgreement();
      if (seq !== requestSeq.current) return;
      setLoading(false);

      if (result.kind === "signed_out") {
        await signOut();
        return;
      }
      if (result.kind === "unavailable") {
        console.log(`[agreement] status unavailable: ${result.message}`);
        setError(result.message);
        // Only keep the driver on the agreement screen when the backend said it's required.
        setPhase((current) => (options.required || current === "required" ? "required" : "accepted"));
        return;
      }
      setError(null);
      setAgreement(result.agreement);
      setPhase(result.agreement.accepted ? "accepted" : "required");
    },
    [signOut],
  );

  useEffect(() => {
    if (DEMO_MODE) return;
    void load();
  }, [load]);

  // Any "403 agreement_required" from the API (accepting a ride, status updates, ride GPS).
  useEffect(() => {
    if (DEMO_MODE) return;
    return onAgreementRequired(() => {
      setPhase("required");
      void load({ required: true });
    });
  }, [load]);

  // Returning to the app: pick up a new agreement version without a restart.
  useEffect(() => {
    if (DEMO_MODE) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && Date.now() - lastCheckAt.current > FOREGROUND_RECHECK_MS) void load();
    });
    return () => subscription.remove();
  }, [load]);

  const handleAccept = useCallback(
    async (version: string) => {
      if (submitting) return;
      setSubmitting(true);
      setError(null);
      setNotice(null);
      const result = await acceptAgreement(version);
      setSubmitting(false);
      if (result.kind === "ok") {
        requestSeq.current += 1; // ignore any status check still in flight
        setLoading(false);
        setAgreement(result.agreement);
        setPhase("accepted");
        try {
          notification(NotificationFeedbackType.Success);
        } catch {
          // haptics are best effort
        }
        return;
      }
      if (result.kind === "signed_out") {
        await signOut();
        return;
      }
      if (result.kind === "outdated") {
        setNotice(result.message);
        await load({ required: true });
        return;
      }
      setError(result.message);
    },
    [load, signOut, submitting],
  );

  if (phase === "accepted") return <>{children}</>;

  if (phase === "checking") {
    return (
      <View style={s.checking} accessibilityLabel="Checking your account">
        <ActivityIndicator color={colors.blue} />
      </View>
    );
  }

  return (
    <AgreementScreen
      agreement={agreement}
      loading={loading}
      error={error}
      notice={notice}
      submitting={submitting}
      onAccept={handleAccept}
      onRetry={() => void load({ required: true })}
      onSignOut={() => void signOut()}
    />
  );
}

const s = StyleSheet.create({
  checking: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceLow,
  },
});
