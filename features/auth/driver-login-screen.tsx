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
const BRAND_NAME = "TrustedRIde Certified";

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
  const reduced = useReducedMotion();
  const keyboardProgress = useSharedValue(0);
  const webInputStyle =
    Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as any) : null;

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
    paddingVertical: interpolate(keyboardProgress.value, [0, 1], [40, spacing.md]),
    paddingHorizontal: interpolate(keyboardProgress.value, [0, 1], [spacing.xl, spacing.lg]),
    gap: interpolate(keyboardProgress.value, [0, 1], [14, 8]),
  }));

  const heroKickerAnimatedStyle = useAnimatedStyle(() => ({
    paddingHorizontal: interpolate(keyboardProgress.value, [0, 1], [12, 10]),
    paddingVertical: interpolate(keyboardProgress.value, [0, 1], [6, 5]),
  }));

  const heroIconAnimatedStyle = useAnimatedStyle(() => ({
    width: interpolate(keyboardProgress.value, [0, 1], [96, 58]),
    height: interpolate(keyboardProgress.value, [0, 1], [96, 58]),
    marginTop: interpolate(keyboardProgress.value, [0, 1], [4, 0]),
  }));

  const heroTextAnimatedStyle = useAnimatedStyle(() => ({
    gap: interpolate(keyboardProgress.value, [0, 1], [14, 3]),
  }));

  const heroTitleAnimatedStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(keyboardProgress.value, [0, 1], [32, 24]),
    lineHeight: interpolate(keyboardProgress.value, [0, 1], [38, 29]),
  }));

  const heroSubAnimatedStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(keyboardProgress.value, [0, 1], [12, 10]),
    letterSpacing: interpolate(keyboardProgress.value, [0, 1], [2.4, 1.8]),
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
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[s.hero, heroAnimatedStyle]}>
          <Animated.View style={[s.heroKicker, heroKickerAnimatedStyle]}>
            <View style={s.dot} />
            <Text style={s.kickerText}>TrustedRIde Certified Portal</Text>
          </Animated.View>

          <Animated.Image
            source={require("../../assets/TR_favicon.png")}
            accessibilityLabel={BRAND_NAME}
            resizeMode="contain"
            style={[s.heroIcon, heroIconAnimatedStyle]}
          />

          <Animated.View style={[s.heroText, heroTextAnimatedStyle]}>
            <Animated.Text style={[s.heroTitle, heroTitleAnimatedStyle]}>
              {BRAND_NAME}
            </Animated.Text>
            <Animated.Text style={[s.heroSub, heroSubAnimatedStyle]}>
              Operator authentication
            </Animated.Text>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[s.form, formAnimatedStyle]}>
          <Text style={s.sectionKicker}>Sign In</Text>

          <Animated.View style={[s.field, fieldAnimatedStyle]}>
            <Text nativeID="driver-email-label" style={s.fieldLabel}>Email</Text>
            <AnimatedTextInput
              style={[s.input, inputAnimatedStyle, webInputStyle]}
              placeholder="driver@trustedriders.org"
              placeholderTextColor={colors.slate400}
              value={email}
              onChangeText={onEmailChange}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              accessibilityLabel="Email"
              accessibilityHint="Enter the email address assigned to your TrustedRIde Certified driver account."
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              blurOnSubmit={false}
              autoFocus
            />
          </Animated.View>

          <Animated.View style={[s.field, fieldAnimatedStyle]}>
            <Text nativeID="driver-password-label" style={s.fieldLabel}>Password</Text>
            <View style={s.passwordField}>
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
                accessibilityHint="Enter your TrustedRIde Certified driver account password."
                autoCapitalize="none"
                autoComplete="current-password"
                autoCorrect={false}
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={onSubmit}
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
              !canSubmit && s.primaryButtonDisabled,
            ]}
            onPress={onSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={submitting ? "Signing in" : "Sign in"}
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
  heroText: {
    alignItems: "center",
    gap: 14,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 0,
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
  passwordField: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 54,
  },
  passwordToggle: {
    position: "absolute",
    right: 8,
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
