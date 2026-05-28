import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppLoadingAnimation } from "@/components/ui/AppLoadingAnimation";
import { DriverLoginScreen } from "@/features/auth/driver-login-screen";
import { clearToken, login, restoreToken } from "@/lib/fleet-api";
import { DEMO_MODE } from "@/lib/demo-mode";
import * as storage from "@/lib/storage";

export type DriverSession = {
  name: string;
};

const DRIVER_NAME_KEY = "trustedriders-driver-name";
const DRIVER_EMAIL_KEY = "trustedriders-driver-email";
const STARTUP_REVEAL_DELAY_MS = 0;

type AuthContextValue = { signOut: () => Promise<void>; session: DriverSession | null };
const AuthContext = createContext<AuthContextValue>({
  signOut: async () => {},
  session: null,
});

type StartupPresentationValue = {
  reloadAppToHome: () => void;
  replayStartupAnimation: () => void;
  startupAnimationVisible: boolean;
  startupAnimationExiting: boolean;
  startupAnimationComplete: boolean;
};

const StartupPresentationContext = createContext<StartupPresentationValue>({
  reloadAppToHome: () => {},
  replayStartupAnimation: () => {},
  startupAnimationVisible: false,
  startupAnimationExiting: false,
  startupAnimationComplete: true,
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function useStartupPresentation(): StartupPresentationValue {
  return useContext(StartupPresentationContext);
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
  const [authRestoring, setAuthRestoring] = useState(true);
  const [startupAnimationVisible, setStartupAnimationVisible] = useState(true);
  const [startupAnimationExiting, setStartupAnimationExiting] = useState(false);
  const [startupAnimationReady, setStartupAnimationReady] = useState(false);
  const [startupAnimationComplete, setStartupAnimationComplete] = useState(false);
  const [startupAnimationKey, setStartupAnimationKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (DEMO_MODE) {
      setEmail("demo@trustedriders.org");
      setSession({ name: "Jordan Mitchell" });
      setAuthRestoring(false);
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
      setAuthRestoring(false);
    });
  }, []);

  useEffect(() => {
    if (!startupAnimationReady) return;

    const startupTimer = setTimeout(() => {
      setStartupAnimationComplete(true);
      setStartupAnimationExiting(true);
    }, STARTUP_REVEAL_DELAY_MS);

    return () => clearTimeout(startupTimer);
  }, [startupAnimationReady]);

  useEffect(() => {
    if (authRestoring || session) return;
    setPassword("");
  }, [authRestoring, session]);

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
  const handleStartupAnimationReady = useCallback(() => {
    setStartupAnimationReady(true);
  }, []);
  const handleStartupAnimationExitComplete = useCallback(() => {
    setStartupAnimationVisible(false);
  }, []);
  const replayStartupAnimation = useCallback(() => {
    setStartupAnimationComplete(false);
    setStartupAnimationReady(false);
    setStartupAnimationExiting(false);
    setStartupAnimationVisible(true);
    setStartupAnimationKey((key) => key + 1);
  }, []);
  const reloadAppToHome = useCallback(() => {
    setStartupAnimationComplete(false);
    setStartupAnimationReady(false);
    setStartupAnimationExiting(false);
    setStartupAnimationVisible(true);
    setStartupAnimationKey((key) => key + 1);
  }, []);
  const startupPresentationValue = useMemo<StartupPresentationValue>(
    () => ({
      reloadAppToHome,
      replayStartupAnimation,
      startupAnimationVisible,
      startupAnimationExiting,
      startupAnimationComplete,
    }),
    [reloadAppToHome, replayStartupAnimation, startupAnimationComplete, startupAnimationExiting, startupAnimationVisible],
  );

  const appContent = session ? (
    <AuthContext.Provider value={authValue}>{children(session)}</AuthContext.Provider>
  ) : authRestoring ? null : (
    <DriverLoginScreen
      canSubmit={!!email.trim() && !!password && !submitting}
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

  return (
    <StartupPresentationContext.Provider value={startupPresentationValue}>
      <View style={s.root}>
        {appContent}
        {startupAnimationVisible ? (
          <AppLoadingAnimation
            key={startupAnimationKey}
            exiting={startupAnimationExiting}
            onExitComplete={handleStartupAnimationExitComplete}
            onReady={handleStartupAnimationReady}
            style={s.startupOverlay}
          />
        ) : null}
      </View>
    </StartupPresentationContext.Provider>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  startupOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
});
