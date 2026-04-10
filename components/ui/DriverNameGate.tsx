import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { login, getToken } from "@/lib/fleet-api";

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
    // Pre-fill email if stored from a previous login
    getStored(DRIVER_EMAIL_KEY).then((storedEmail) => {
      if (storedEmail) setEmail(storedEmail);
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
    } catch {
      setError("Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

  if (!name) {
    return (
      <KeyboardAvoidingView
        style={s.center}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={s.card}>
          <View style={s.logoRow}>
            <View style={s.logo}>
              <Text style={s.logoText}>TR</Text>
            </View>
          </View>
          <Text style={s.title}>TrustedRiders</Text>
          <Text style={s.subtitle}>Sign in to start driving</Text>

          <TextInput
            style={s.input}
            placeholder="Email"
            placeholderTextColor={colors.slate400}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoFocus
          />

          <TextInput
            style={s.input}
            placeholder="Password"
            placeholderTextColor={colors.slate400}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          {error && <Text style={s.error}>{error}</Text>}

          <Pressable
            style={[s.button, (!email.trim() || !password.trim() || submitting) && s.buttonDisabled]}
            onPress={handleLogin}
            disabled={!email.trim() || !password.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.buttonText}>Sign In</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return <>{children(name)}</>;
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surfaceLow,
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  logoRow: {
    marginBottom: spacing.sm,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.blue,
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.slate500,
    marginBottom: spacing.sm,
  },
  input: {
    width: "100%",
    backgroundColor: colors.surfaceLow,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.slate200,
    padding: spacing.md,
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
  },
  error: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626",
  },
  button: {
    width: "100%",
    backgroundColor: colors.blue,
    borderRadius: radii.sm,
    padding: spacing.md,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
});
