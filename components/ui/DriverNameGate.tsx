import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, spacing, radii } from "@/lib/theme";
import { clearToken, login, restoreToken } from "@/lib/fleet-api";
import { registerForPushNotifications } from "@/lib/push";

const DRIVER_NAME_KEY = "trustedriders-driver-name";
const DRIVER_EMAIL_KEY = "trustedriders-driver-email";

async function getStored(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return localStorage.getItem(key);
    }
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function setStored(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  } catch {}
}

async function removeStored(key: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  } catch {}
}

type AuthContextValue = { signOut: () => Promise<void> };
const AuthContext = createContext<AuthContextValue>({
  signOut: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

/**
 * Gates the app behind driver login.
 * Authenticates against the Fleet Tracking API, then renders children with the driver name.
 */
export function DriverNameGate({ children }: { children: (name: string) => React.ReactNode }) {
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Rehydrate stored credentials on boot. If the token is still present
    // alongside the name, skip the login form and go straight into the app.
    Promise.all([
      getStored(DRIVER_EMAIL_KEY),
      getStored(DRIVER_NAME_KEY),
      restoreToken(),
    ]).then(([storedEmail, storedName, storedToken]) => {
      if (storedEmail) setEmail(storedEmail);
      if (storedName && storedToken) {
        setName(storedName);
        // Re-register the push token on every cold boot so dispatch always
        // has the current one (tokens can rotate on reinstall or OS restore).
        void registerForPushNotifications();
      }
      setLoading(false);
    });
  }, []);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) return;

    setSubmitting(true);
    setError(null);
    try {
      const user = await login(trimmedEmail, trimmedPassword);
      await setStored(DRIVER_NAME_KEY, user.name);
      await setStored(DRIVER_EMAIL_KEY, trimmedEmail);
      setName(user.name);
      // Ask for notification permission + hand our push token to the backend.
      // Fire-and-forget — failures don't block entry to the app.
      void registerForPushNotifications();
    } catch {
      setError("Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  };

  const signOut = useCallback(async () => {
    await clearToken();
    await removeStored(DRIVER_NAME_KEY);
    // Intentionally leave the email cached so the login form pre-fills
    // for the next sign-in.
    setPassword("");
    setError(null);
    setName(null);
  }, []);

  const authValue = useMemo<AuthContextValue>(() => ({ signOut }), [signOut]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

  if (!name) {
    const canSubmit = !!email.trim() && !!password.trim() && !submitting;
    const webInputStyle =
      Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as any) : null;

    return (
      <KeyboardAvoidingView
        style={s.screen}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* HERO — dark dispatch panel with the brand icon front-and-center */}
        <View style={s.hero}>
          <View style={s.heroKicker}>
            <View style={s.dot} />
            <Text style={s.kickerText}>TrustedRiders Portal</Text>
          </View>

          <Image
            source={require("../../assets/TR_favicon.png")}
            accessibilityLabel="TrustedRiders"
            resizeMode="contain"
            style={s.heroIcon}
          />

          <Text style={s.heroTitle}>TrustedRiders</Text>
          <Text style={s.heroSub}>Operator authentication</Text>
        </View>

        {/* FORM — dispatch-terminal style fields on the light surface */}
        <View style={s.form}>
          <Text style={s.sectionKicker}>Sign In</Text>

          <View style={s.field}>
            <Text style={s.fieldLabel}>Email</Text>
            <TextInput
              style={[s.input, webInputStyle]}
              placeholder="driver@trustedriders.org"
              placeholderTextColor={colors.slate400}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoFocus
            />
          </View>

          <View style={s.field}>
            <Text style={s.fieldLabel}>Password</Text>
            <TextInput
              style={[s.input, webInputStyle]}
              placeholder="••••••••"
              placeholderTextColor={colors.slate400}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              s.primaryButton,
              !canSubmit && s.primaryButtonDisabled,
              pressed && canSubmit ? { backgroundColor: "#1E293B" } : null,
            ]}
            onPress={handleLogin}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Text style={s.primaryButtonText}>Sign In</Text>
                <Text style={s.primaryButtonArrow}>→</Text>
              </>
            )}
          </Pressable>

          <View style={s.footer}>
            <Text style={s.footerText}>Build 0.1.0 · Prototype</Text>
            <Text style={s.footerText}>Encrypted</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return <AuthContext.Provider value={authValue}>{children(name)}</AuthContext.Provider>;
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceLow,
    padding: spacing.lg,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.primary,
    paddingVertical: 40,
    paddingHorizontal: spacing.xl,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    borderCurve: "continuous",
    alignItems: "center",
    gap: 14,
  },
  heroKicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(22, 163, 74, 0.16)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#86EFAC",
  },
  kickerText: {
    color: "#86EFAC",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  heroIcon: {
    width: 96,
    height: 96,
    marginTop: 4,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  heroSub: {
    color: colors.slate400,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2.4,
  },
  form: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: radii.md,
    borderBottomRightRadius: radii.md,
    borderCurve: "continuous",
    gap: spacing.md,
  },
  sectionKicker: {
    color: colors.slate400,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2.8,
    marginBottom: 2,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2.2,
    paddingLeft: 2,
  },
  input: {
    width: "100%",
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
  error: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.error,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginTop: -4,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    marginTop: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.35,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2.6,
  },
  primaryButtonArrow: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  footerText: {
    color: colors.slate400,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
});
