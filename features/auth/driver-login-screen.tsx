import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { PASSWORD_RESET_CONFIRMATION } from "@/lib/fleet-api";
import { colors, radii, spacing } from "@/lib/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const BRAND_NAME = "TrustedRide Certified";
type FocusedField = "email" | "password" | "resetEmail" | null;
// "forgot" asks for the email; "sent" shows the generic confirmation.
type LoginMode = "signIn" | "forgot" | "sent";

export function DriverLoginScreen({
  canSubmit,
  email,
  error,
  onEmailChange,
  onPasswordChange,
  onRequestPasswordReset,
  onSubmit,
  onTogglePasswordVisible,
  password,
  passwordVisible,
  submitting,
}: {
  canSubmit: boolean;
  email: string;
  error: string | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRequestPasswordReset: (email: string) => Promise<void>;
  onSubmit: () => void;
  onTogglePasswordVisible: () => void;
  password: string;
  passwordVisible: boolean;
  submitting: boolean;
}) {
  const insets = useSafeAreaInsets();
  const passwordInputRef = useRef<TextInput>(null);
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [buttonPressed, setButtonPressed] = useState(false);
  const [mode, setMode] = useState<LoginMode>("signIn");
  const [resetEmail, setResetEmail] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const shouldAnimateForKeyboard = Platform.OS === "ios";
  const keyboardProgress = useSharedValue(0);
  const webInputStyle =
    Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as any) : null;
  const submitIfReady = () => {
    if (canSubmit) onSubmit();
  };
  const canSendReset = !!resetEmail.trim() && !resetSubmitting;

  const openForgotPassword = () => {
    setResetEmail(email.trim());
    setResetError(null);
    setButtonPressed(false);
    setMode("forgot");
  };

  const backToSignIn = () => {
    // Carry an edited email back so the driver doesn't retype it.
    const edited = resetEmail.trim();
    if (edited && edited !== email.trim()) onEmailChange(edited);
    setResetError(null);
    setButtonPressed(false);
    setMode("signIn");
  };

  const sendResetLink = async () => {
    if (!canSendReset) return;
    setResetSubmitting(true);
    setResetError(null);
    try {
      await onRequestPasswordReset(resetEmail);
      Keyboard.dismiss();
      setMode("sent");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Unable to send a reset link.");
    } finally {
      setResetSubmitting(false);
    }
  };

  const animateKeyboardProgress = (visible: boolean, duration?: number) => {
    const toValue = visible ? 1 : 0;

    if (reduced) {
      keyboardProgress.value = toValue;
      return;
    }

    keyboardProgress.value = withTiming(toValue, {
      duration: duration ?? (visible ? 310 : 260),
      easing: Easing.bezier(0.25, 1, 0.5, 1),
    });
  };

  const formAnimatedStyle = useAnimatedStyle(() => ({
    paddingVertical: interpolate(keyboardProgress.value, [0, 1], [spacing.xl, spacing.md]),
    paddingHorizontal: interpolate(keyboardProgress.value, [0, 1], [spacing.xl, spacing.lg]),
    gap: interpolate(keyboardProgress.value, [0, 1], [spacing.md, spacing.sm]),
  }));

  const fieldAnimatedStyle = useAnimatedStyle(() => ({
    gap: interpolate(keyboardProgress.value, [0, 1], [8, 6]),
  }));

  const inputAnimatedStyle = useAnimatedStyle(() => ({
    paddingVertical: interpolate(keyboardProgress.value, [0, 1], [14, 10]),
  }));

  const primaryButtonAnimatedStyle = useAnimatedStyle(() => ({
    minHeight: interpolate(keyboardProgress.value, [0, 1], [56, 48]),
    paddingVertical: interpolate(keyboardProgress.value, [0, 1], [18, 12]),
    marginTop: interpolate(keyboardProgress.value, [0, 1], [6, 0]),
  }));

  useEffect(() => {
    if (!shouldAnimateForKeyboard) return;

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      animateKeyboardProgress(true, event.duration);
    });
    const hideSub = Keyboard.addListener(hideEvent, (event) => {
      animateKeyboardProgress(false, event.duration);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardProgress, reduced, shouldAnimateForKeyboard]);

  useEffect(() => {
    if (password) return;
    passwordInputRef.current?.clear();
    passwordInputRef.current?.setNativeProps({ text: "" });
  }, [password]);

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[
          s.scrollContent,
          {
            paddingTop: insets.top + spacing.xs,
            paddingBottom: insets.bottom + spacing.sm,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "none"}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.credentialCardShadow}>
        <View style={s.credentialCard}>
          <View style={s.hero}>
            <View style={s.brandPlate}>
              <Animated.Image
                source={require("../../assets/trustedride_certified_main_logo_transparent.png")}
                accessibilityLabel={BRAND_NAME}
                resizeMode="contain"
                style={s.heroLogo}
              />
            </View>
          </View>

          <Animated.View style={[s.form, formAnimatedStyle]}>
            {mode === "forgot" ? (
              <>
                <View style={s.panelIntro}>
                  <Text accessibilityRole="header" style={s.panelTitle}>Reset password</Text>
                  <Text style={s.panelBody}>
                    Enter your account email and we'll send you a link to choose a new password.
                  </Text>
                </View>

                <Animated.View style={[s.field, fieldAnimatedStyle]}>
                  <Text nativeID="driver-reset-email-label" style={s.fieldLabel}>Email</Text>
                  <View style={[s.inputShell, focusedField === "resetEmail" ? s.inputShellFocused : null]}>
                    <AnimatedTextInput
                      style={[s.input, inputAnimatedStyle, webInputStyle]}
                      placeholder="driver@trustedriders.org"
                      placeholderTextColor={colors.slate400}
                      value={resetEmail}
                      onChangeText={(value) => {
                        if (resetError) setResetError(null);
                        setResetEmail(value);
                      }}
                      autoCapitalize="none"
                      autoComplete="email"
                      autoCorrect={false}
                      autoFocus={!resetEmail}
                      accessibilityLabel="Email"
                      accessibilityHint="The email address for your TrustedRide Certified driver account."
                      keyboardType="email-address"
                      textContentType="emailAddress"
                      returnKeyType="send"
                      enablesReturnKeyAutomatically
                      onFocus={() => setFocusedField("resetEmail")}
                      onBlur={() => setFocusedField(null)}
                      onSubmitEditing={sendResetLink}
                    />
                  </View>
                </Animated.View>

                {resetError ? (
                  <Text accessibilityRole="alert" style={s.error}>
                    {resetError}
                  </Text>
                ) : null}

                <AnimatedPressable
                  style={[
                    s.primaryButton,
                    primaryButtonAnimatedStyle,
                    !canSendReset
                      ? s.primaryButtonDisabled
                      : buttonPressed
                        ? s.primaryButtonPressed
                        : s.primaryButtonReady,
                  ]}
                  onPress={sendResetLink}
                  onPressIn={() => setButtonPressed(true)}
                  onPressOut={() => setButtonPressed(false)}
                  disabled={!canSendReset}
                  accessibilityRole="button"
                  accessibilityLabel={resetSubmitting ? "Sending reset link" : "Send reset link"}
                  accessibilityState={{ disabled: !canSendReset, busy: resetSubmitting }}
                >
                  {resetSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Text style={s.primaryButtonText}>Send Reset Link</Text>
                      <Text style={s.primaryButtonArrow}>→</Text>
                    </>
                  )}
                </AnimatedPressable>

                <TextLink label="Back to sign in" onPress={backToSignIn} />
              </>
            ) : mode === "sent" ? (
              <>
                <View accessibilityRole="alert" style={s.confirmation}>
                  <Text style={s.confirmationTitle}>Check your email</Text>
                  <Text style={s.confirmationBody}>{PASSWORD_RESET_CONFIRMATION}</Text>
                </View>
                <Text style={s.panelBody}>
                  Open the link to choose a new password (it expires in 30 minutes), then sign in here.
                  No email? Check spam, or send another.
                </Text>

                <AnimatedPressable
                  style={[
                    s.primaryButton,
                    primaryButtonAnimatedStyle,
                    buttonPressed ? s.primaryButtonPressed : s.primaryButtonReady,
                  ]}
                  onPress={backToSignIn}
                  onPressIn={() => setButtonPressed(true)}
                  onPressOut={() => setButtonPressed(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Back to sign in"
                >
                  <Text style={s.primaryButtonText}>Back to Sign In</Text>
                  <Text style={s.primaryButtonArrow}>→</Text>
                </AnimatedPressable>

                <TextLink label="Send another link" onPress={() => setMode("forgot")} />
              </>
            ) : (
              <>
                <Animated.View style={[s.field, fieldAnimatedStyle]}>
                  <Text nativeID="driver-email-label" style={s.fieldLabel}>Email</Text>
                  <View style={[s.inputShell, focusedField === "email" ? s.inputShellFocused : null]}>
                    <AnimatedTextInput
                      style={[s.input, inputAnimatedStyle, webInputStyle]}
                      placeholder="driver@trustedriders.org"
                      placeholderTextColor={colors.slate400}
                      value={email}
                      onChangeText={onEmailChange}
                      autoCapitalize="none"
                      autoComplete="username"
                      autoCorrect={false}
                      accessibilityLabel="Email"
                      accessibilityHint="Enter the email address assigned to your TrustedRide Certified driver account."
                      keyboardType="email-address"
                      showSoftInputOnFocus
                      textContentType="username"
                      returnKeyType="next"
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                      onSubmitEditing={() => passwordInputRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                  </View>
                </Animated.View>

                <Animated.View style={[s.field, fieldAnimatedStyle]}>
                  <Text nativeID="driver-password-label" style={s.fieldLabel}>Password</Text>
                  <View
                    style={[
                      s.inputShell,
                      s.passwordField,
                      focusedField === "password" ? s.inputShellFocused : null,
                    ]}
                  >
                    <AnimatedTextInput
                      ref={passwordInputRef}
                      style={[
                        s.input,
                        s.passwordInput,
                        inputAnimatedStyle,
                        webInputStyle,
                      ]}
                      placeholder=""
                      placeholderTextColor={colors.slate400}
                      value={password}
                      onChangeText={onPasswordChange}
                      secureTextEntry={!passwordVisible}
                      showSoftInputOnFocus
                      accessibilityLabel="Password"
                      accessibilityHint="Enter your TrustedRide Certified driver account password."
                      accessibilityValue={{ text: password ? `${password.length} characters entered` : "No password entered" }}
                      autoCapitalize="none"
                      autoComplete="current-password"
                      autoCorrect={false}
                      enablesReturnKeyAutomatically
                      textContentType="password"
                      returnKeyType="done"
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => setFocusedField(null)}
                      onSubmitEditing={submitIfReady}
                    />
                    <Pressable
                      onPress={onTogglePasswordVisible}
                      accessibilityRole="button"
                      accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                      accessibilityHint="Toggles password visibility"
                      hitSlop={8}
                      style={({ pressed }) => [
                        s.passwordToggle,
                        pressed ? s.passwordTogglePressed : null,
                      ]}
                    >
                      <EyeGlyph visible={passwordVisible} />
                    </Pressable>
                  </View>
                </Animated.View>

                {error ? (
                  <Text accessibilityRole="alert" style={s.error}>
                    {error}
                  </Text>
                ) : null}

                <AnimatedPressable
                  style={[
                    s.primaryButton,
                    primaryButtonAnimatedStyle,
                    !canSubmit
                      ? s.primaryButtonDisabled
                      : buttonPressed
                        ? s.primaryButtonPressed
                        : s.primaryButtonReady,
                  ]}
                  onPress={onSubmit}
                  onPressIn={() => setButtonPressed(true)}
                  onPressOut={() => setButtonPressed(false)}
                  disabled={!canSubmit}
                  accessibilityRole="button"
                  accessibilityLabel={submitting ? "Signing in" : "Sign in"}
                  accessibilityHint="Authenticates this device with the TrustedRide Certified driver portal."
                  accessibilityState={{ disabled: !canSubmit, busy: submitting }}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Text style={s.primaryButtonText}>Sign In</Text>
                      <Text style={s.primaryButtonArrow}>→</Text>
                    </>
                  )}
                </AnimatedPressable>

                <TextLink
                  label="Forgot password?"
                  hint="Sends a password reset link to your email."
                  onPress={openForgotPassword}
                />
              </>
            )}
          </Animated.View>
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TextLink({ label, hint, onPress }: { label: string; hint?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={hint}
      hitSlop={10}
      style={({ pressed }) => [s.textLink, pressed ? s.textLinkPressed : null]}
    >
      <Text style={s.textLinkText}>{label}</Text>
    </Pressable>
  );
}

function EyeGlyph({ visible }: { visible: boolean }) {
  const color = visible ? colors.primary : colors.slate400;

  return (
    <View style={s.eyeGlyph}>
      <View style={[s.eyeOuter, { borderColor: color }]}>
        <View style={[s.eyePupil, { backgroundColor: color }]} />
      </View>
      {!visible ? (
        <View style={[s.eyeSlash, { backgroundColor: color }]} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceLow,
  },
  scroll: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  credentialCardShadow: {
    width: "100%",
    maxWidth: 440,
    borderRadius: radii.sm,
    shadowColor: "#0f172a",
    shadowOpacity: 0.1,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
  },
  credentialCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  hero: {
    width: "100%",
    backgroundColor: colors.surface,
    paddingVertical: 40,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    gap: 14,
  },
  brandPlate: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroLogo: {
    width: 330,
    height: 100,
  },
  form: {
    width: "100%",
    backgroundColor: colors.surfaceLowest,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: colors.primarySoft,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2.2,
    paddingLeft: 1,
  },
  inputShell: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.24)",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  inputShellFocused: {
    borderColor: "rgba(37, 99, 235, 0.55)",
    backgroundColor: "#FFFFFF",
  },
  input: {
    flex: 1,
    backgroundColor: "transparent",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
  passwordField: {
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 54,
  },
  passwordToggle: {
    position: "absolute",
    right: 6,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  passwordTogglePressed: {
    backgroundColor: colors.surfaceHigh,
  },
  eyeGlyph: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeOuter: {
    width: 21,
    height: 13,
    borderWidth: 2,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  eyePupil: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  eyeSlash: {
    position: "absolute",
    width: 24,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: "-35deg" }],
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
  primaryButtonReady: {
    backgroundColor: colors.primary,
  },
  primaryButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.slate400,
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
  textLink: {
    alignSelf: "center",
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  textLinkPressed: {
    backgroundColor: colors.surfaceHigh,
  },
  textLinkText: {
    color: colors.primarySoft,
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  panelIntro: {
    gap: spacing.xs,
  },
  panelTitle: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "800",
  },
  panelBody: {
    color: colors.slate500,
    fontSize: 14,
    lineHeight: 20,
  },
  confirmation: {
    backgroundColor: colors.greenSoft,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: 4,
  },
  confirmationTitle: {
    color: colors.greenStrong,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2.2,
  },
  confirmationBody: {
    color: colors.primary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
  },
});
