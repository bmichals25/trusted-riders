import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import { DriverLoginScreen } from "@/features/auth/driver-login-screen";
import { colors, spacing } from "@/lib/theme";
import { clearToken, login, restoreToken } from "@/lib/fleet-api";
import { DEMO_MODE } from "@/lib/demo-mode";
import * as storage from "@/lib/storage";

export type DriverSession = {
  name: string;
};

const DRIVER_NAME_KEY = "trustedriders-driver-name";
const DRIVER_EMAIL_KEY = "trustedriders-driver-email";

type AuthContextValue = { signOut: () => Promise<void>; session: DriverSession | null };
const AuthContext = createContext<AuthContextValue>({
  signOut: async () => {},
  session: null,
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

/**
 * Gates the app behind driver login.
 * Authenticates against the Fleet Tracking API, then renders children with the driver name.
 */
export function DriverNameGate({ children }: { children: (session: DriverSession) => React.ReactNode }) {
  const [session, setSession] = useState<DriverSession | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (DEMO_MODE) {
      setEmail("demo@trustedriders.org");
      setSession({ name: "Jordan Mitchell" });
      setLoading(false);
      return;
    }

    // Rehydrate stored credentials on boot. If the token is still present
    // alongside the name, skip the login form and go straight into the app.
    Promise.all([
      storage.get(DRIVER_EMAIL_KEY),
      storage.get(DRIVER_NAME_KEY),
      restoreToken(),
    ]).then(([storedEmail, storedName, storedToken]) => {
      if (storedEmail) setEmail(storedEmail);
      if (storedName && storedToken) {
        setSession({ name: storedName });
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (loading || session) return;
    setPassword("");
  }, [loading, session]);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;

    setSubmitting(true);
    setError(null);
    try {
      const user = await login(trimmedEmail, password);
      await storage.set(DRIVER_NAME_KEY, user.name);
      await storage.set(DRIVER_EMAIL_KEY, trimmedEmail);
      setSession({ name: user.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = useCallback(async () => {
    await clearToken();
    await storage.remove(DRIVER_NAME_KEY);
    // Intentionally leave the email cached so the login form pre-fills
    // for the next sign-in.
    setPassword("");
    setError(null);
    setSession(null);
  }, []);

  const authValue = useMemo<AuthContextValue>(() => ({ signOut, session }), [signOut, session]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

  if (!session) {
    const canSubmit = !!email.trim() && !!password && !submitting;

    return (
      <DriverLoginScreen
        canSubmit={canSubmit}
        email={email}
        error={error}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
        onTogglePasswordVisible={() => setPasswordVisible((visible) => !visible)}
        password={password}
        passwordVisible={passwordVisible}
        submitting={submitting}
      />
    );
  }

  return <AuthContext.Provider value={authValue}>{children(session)}</AuthContext.Provider>;
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceLow,
    padding: spacing.lg,
  },
});
