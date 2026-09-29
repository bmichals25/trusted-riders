import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { AppLoadingAnimation } from "@/components/ui/AppLoadingAnimation";
import { DriverLoginScreen } from "@/features/auth/driver-login-screen";
import { login, onSessionExpired, requestPasswordReset, restoreToken } from "@/lib/fleet-api";
import {
  biometricSignInEmail,
  biometricSupport,
  readBiometricSignIn,
  removeBiometricSignIn,
  saveBiometricSignIn,
} from "@/lib/biometric-sign-in";
import { signOutDriver } from "@/lib/sign-out";
import { DEMO_MODE } from "@/lib/demo-mode";
import * as storage from "@/lib/storage";

export type DriverSession = {
  name: string;
};

const DRIVER_NAME_KEY = "trustedriders-driver-name";
const DRIVER_EMAIL_KEY = "trustedriders-driver-email";
const STARTUP_REVEAL_DELAY_MS = 0;
// Absolute backstop: reveal the app even if the startup overlay never reports
// ready (e.g. the loading video fails to load/decode in a production build).
// Without this, a stuck overlay keeps homeEntranceReady false forever and the
// home content stays hidden behind it.
const STARTUP_REVEAL_HARD_TIMEOUT_MS = 8000;

/** signOut(message): the sign-in screen then shows message (e.g. why the session ended). */
export const SESSION_EXPIRED_MESSAGE = "Your session expired. Sign in again.";

type AuthContextValue = {
  signOut: (message?: string) => Promise<void>;
  session: DriverSession | null;
  /** "Face ID" / "Touch ID" when biometric sign-in is saved on this phone, else null (Settings > Account). */
  biometricSignInLabel: string | null;
  turnOffBiometricSignIn: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue>({
  signOut: async () => {},
  session: null,
  biometricSignInLabel: null,
  turnOffBiometricSignIn: async () => {},
});

type BiometricState = { available: boolean; label: string; savedEmail: string | null };

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
  const [biometric, setBiometric] = useState<BiometricState>({ available: false, label: "Face ID", savedEmail: null });

  const refreshBiometric = useCallback(async () => {
    if (DEMO_MODE) return;
    const [support, savedEmail] = await Promise.all([biometricSupport(), biometricSignInEmail()]);
    setBiometric({ ...support, savedEmail: support.available ? savedEmail : null });
  }, []);

  // On boot and whenever the sign-in screen comes back: is "Sign in with Face ID" on offer?
  useEffect(() => {
    if (!session) void refreshBiometric();
  }, [session, refreshBiometric]);

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

  // Backstop the startup overlay: if it never reports ready (failed video
  // load/decode in a production build), force the reveal anyway so the app is
  // never permanently stuck behind the loading animation.
  useEffect(() => {
    const hardTimer = setTimeout(() => {
      setStartupAnimationReady(true);
      setStartupAnimationComplete(true);
      setStartupAnimationExiting(true);
    }, STARTUP_REVEAL_HARD_TIMEOUT_MS);

    return () => clearTimeout(hardTimer);
  }, [startupAnimationKey]);

  useEffect(() => {
    if (authRestoring || session) return;
    setPassword("");
  }, [authRestoring, session]);

  // The session ended on the server and couldn't be renewed (refresh token expired or revoked): back to
  // sign-in, instead of a Home screen that can't load anything.
  useEffect(
    () =>
      onSessionExpired(() => {
        setSession(null);
        setError(SESSION_EXPIRED_MESSAGE);
      }),
    [],
  );

  const completeSignIn = async (signInEmail: string, signInPassword: string) => {
    const user = await login(signInEmail, signInPassword);
    await storage.set(DRIVER_NAME_KEY, user.name);
    await storage.set(DRIVER_EMAIL_KEY, signInEmail);
    setSession({ name: user.name });
  };

  // After a password sign-in: offer Face ID / Touch ID for next time (once per sign-in, never nagging
  // a TR who already has it for this email).
  const offerBiometricSignIn = (signInEmail: string, signInPassword: string) => {
    const { available, label, savedEmail } = biometric;
    if (!available || savedEmail === signInEmail) return;
    Alert.alert(`Sign in with ${label}?`, `Next time, use ${label} instead of typing your password.`, [
      { text: "Not now", style: "cancel" },
      {
        text: `Use ${label}`,
        onPress: () => {
          void saveBiometricSignIn({ email: signInEmail, password: signInPassword }, label).then((saved) => {
            if (saved) setBiometric((current) => ({ ...current, savedEmail: signInEmail }));
          });
        },
      },
    ]);
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    const typedPassword = password;
    try {
      await completeSignIn(trimmedEmail, typedPassword);
      offerBiometricSignIn(trimmedEmail, typedPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (submitting) return;
    setError(null);
    const saved = await readBiometricSignIn();
    if (saved === "cancelled") return;
    if (saved === "unavailable") {
      setError(`${biometric.label} sign-in is no longer set up on this phone. Sign in with your password.`);
      void refreshBiometric();
      return;
    }
    setSubmitting(true);
    try {
      await completeSignIn(saved.email, saved.password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in.";
      setEmail(saved.email);
      if (/invalid email or password/i.test(message)) {
        // The password changed since it was saved: forget it, the TR signs in (and saves) again.
        await removeBiometricSignIn();
        void refreshBiometric();
        setError(`Your password has changed. Sign in with the new one to use ${biometric.label} again.`);
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const turnOffBiometricSignIn = useCallback(async () => {
    await removeBiometricSignIn();
    setBiometric((current) => ({ ...current, savedEmail: null }));
  }, []);

  const signOut = useCallback(async (message?: string) => {
    // Stops background location, unregisters this device's push token, revokes the token on the
    // server and wipes every "trustedriders-*" key, including the cached name and email (a shared
    // phone must not show the previous TrustedRider anything). A choice to sign out also forgets Face ID
    // sign-in; a session that ended on its own (message) keeps it for the same TR.
    await signOutDriver({ keepBiometricSignIn: !!message });
    setEmail("");
    setPassword("");
    setError(message ?? null);
    setSession(null);
  }, []);

  const biometricSignInLabel = biometric.savedEmail ? biometric.label : null;
  const authValue = useMemo<AuthContextValue>(
    () => ({ signOut, session, biometricSignInLabel, turnOffBiometricSignIn }),
    [signOut, session, biometricSignInLabel, turnOffBiometricSignIn],
  );
  const handleEmailChange = useCallback((value: string) => {
    if (error) setError(null);
    setEmail(value);
  }, [error]);
  const handlePasswordChange = useCallback((value: string) => {
    if (error) setError(null);
    setPassword(value);
  }, [error]);
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
      biometricLabel={biometricSignInLabel}
      onBiometricSignIn={handleBiometricLogin}
      canSubmit={!!email.trim() && !!password && !submitting}
      email={email}
      error={error}
      onEmailChange={handleEmailChange}
      onPasswordChange={handlePasswordChange}
      onRequestPasswordReset={requestPasswordReset}
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
