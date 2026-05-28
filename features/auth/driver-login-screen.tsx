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

import { colors, radii, spacing } from "@/lib/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);
const BRAND_NAME = "TrustedRide Certified";
type FocusedField = "email" | "password" | null;

export function DriverLoginScreen({
  canSubmit,
  email,
  error,
  onEmailChange,
  onPasswordChange,
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
  onSubmit: () => void;
  onTogglePasswordVisible: () => void;
  password: string;
  passwordVisible: boolean;
  submitting: boolean;
}) {
  const insets = useSafeAreaInsets();
  const passwordInputRef = useRef<TextInput>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const reduced = useReducedMotion();
  const keyboardProgress = useSharedValue(0);
  const webInputStyle =
    Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as any) : null;
  const submitIfReady = () => {
    if (canSubmit) onSubmit();
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

  const heroAnimatedStyle = useAnimatedStyle(() => ({
    paddingVertical: interpolate(keyboardProgress.value, [0, 1], [34, spacing.md]),
    paddingHorizontal: interpolate(keyboardProgress.value, [0, 1], [spacing.xl, spacing.lg]),
    gap: interpolate(keyboardProgress.value, [0, 1], [0, 0]),
  }));

  const brandPlateAnimatedStyle = useAnimatedStyle(() => ({
    width: interpolate(keyboardProgress.value, [0, 1], [354, 300]),
    height: interpolate(keyboardProgress.value, [0, 1], [124, 96]),
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    width: interpolate(keyboardProgress.value, [0, 1], [330, 284]),
    height: interpolate(keyboardProgress.value, [0, 1], [100, 86]),
  }));

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

  const footerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - keyboardProgress.value,
    height: interpolate(keyboardProgress.value, [0, 1], [24, 0]),
    marginTop: interpolate(keyboardProgress.value, [0, 1], [14, 0]),
    overflow: "hidden",
  }));

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      animateKeyboardProgress(true, event.duration);
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, (event) => {
      animateKeyboardProgress(false, event.duration);
      setKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardProgress, reduced]);

  useEffect(() => {
    if (password) return;
    passwordInputRef.current?.clear();
    passwordInputRef.current?.setNativeProps({ text: "" });
  }, [password]);

  return (
    <KeyboardAvoidingView
      style={s.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
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
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.credentialCard}>
          <Animated.View style={[s.hero, heroAnimatedStyle]}>
            <Animated.View style={[s.brandPlate, brandPlateAnimatedStyle]}>
              <Animated.Image
                source={require("../../assets/trustedride_certified_main_logo_transparent.png")}
                accessibilityLabel={BRAND_NAME}
                resizeMode="contain"
                style={[s.heroLogo, logoAnimatedStyle]}
              />
            </Animated.View>
          </Animated.View>

          <Animated.View style={[s.form, formAnimatedStyle]}>
            <View style={s.formHeader}>
              <Text style={s.sectionKicker}>Sign In</Text>
              <View style={s.formSignal} />
            </View>

            <Animated.View style={[s.field, fieldAnimatedStyle]}>
              <Text nativeID="driver-email-label" style={s.fieldLabel}>Email</Text>
              <View style={[s.inputShell, focusedField === "email" ? s.inputShellFocused : null]}>
                <View style={[s.inputRail, focusedField === "email" ? s.inputRailFocused : null]} />
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
                  textContentType="username"
                  returnKeyType="next"
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  blurOnSubmit={false}
                  autoFocus
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
                <View
                  style={[
                    s.inputRail,
                    focusedField === "password" ? s.inputRailFocused : null,
                  ]}
                />
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
                canSubmit ? s.primaryButtonReady : s.primaryButtonDisabled,
              ]}
              onPress={onSubmit}
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

            <Animated.View style={[s.footer, footerAnimatedStyle]} pointerEvents="none">
              <Text style={s.footerText}>Build 0.1.0 · Prototype</Text>
              <Text style={s.footerText}>Encrypted</Text>
            </Animated.View>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  credentialCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderCurve: "continuous",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(148, 163, 184, 0.22)",
    shadowColor: colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
  },
  hero: {
    width: "100%",
    backgroundColor: colors.surface,
    paddingVertical: 40,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceHigh,
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
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  formSignal: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.blue,
  },
  sectionKicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 2.2,
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
  inputRail: {
    alignSelf: "stretch",
    width: 4,
    backgroundColor: colors.surfaceHigh,
  },
  inputRailFocused: {
    backgroundColor: colors.blue,
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
    backgroundColor: colors.blueStrong,
  },
  primaryButtonDisabled: {
    backgroundColor: "#AEB5C0",
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
