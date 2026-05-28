import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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

import { colors, radii, spacing } from "@/lib/theme";

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
  const webInputStyle =
    Platform.OS === "web" ? ({ outlineStyle: "none", outlineWidth: 0 } as any) : null;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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
            paddingTop: keyboardVisible ? insets.top + 8 : insets.top + spacing.sm,
            paddingBottom: keyboardVisible ? spacing.sm : insets.bottom + spacing.sm,
          },
          keyboardVisible ? s.scrollContentCompact : null,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.hero, keyboardVisible ? s.heroCompact : null]}>
          {!keyboardVisible ? (
            <View style={s.heroKicker}>
              <View style={s.dot} />
              <Text style={s.kickerText}>TrustedRiders Portal</Text>
            </View>
          ) : null}

          <Image
            source={require("../../assets/TR_favicon.png")}
            accessibilityLabel="TrustedRiders"
            resizeMode="contain"
            style={[s.heroIcon, keyboardVisible ? s.heroIconCompact : null]}
          />

          <View style={[s.heroText, keyboardVisible ? s.heroTextCompact : null]}>
            <Text style={[s.heroTitle, keyboardVisible ? s.heroTitleCompact : null]}>
              TrustedRiders
            </Text>
            <Text style={[s.heroSub, keyboardVisible ? s.heroSubCompact : null]}>
              Operator authentication
            </Text>
          </View>
        </View>

        <View style={[s.form, keyboardVisible ? s.formCompact : null]}>
          <Text style={s.sectionKicker}>Sign In</Text>

          <View style={[s.field, keyboardVisible ? s.fieldCompact : null]}>
            <Text nativeID="driver-email-label" style={s.fieldLabel}>Email</Text>
            <TextInput
              style={[s.input, keyboardVisible ? s.inputCompact : null, webInputStyle]}
              placeholder="driver@trustedriders.org"
              placeholderTextColor={colors.slate400}
              value={email}
              onChangeText={onEmailChange}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              accessibilityLabel="Email"
              accessibilityHint="Enter the email address assigned to your TrustedRiders driver account."
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              blurOnSubmit={false}
              autoFocus
            />
          </View>

          <View style={[s.field, keyboardVisible ? s.fieldCompact : null]}>
            <Text nativeID="driver-password-label" style={s.fieldLabel}>Password</Text>
            <View style={s.passwordField}>
              <TextInput
                ref={passwordInputRef}
                style={[
                  s.input,
                  s.passwordInput,
                  keyboardVisible ? s.inputCompact : null,
                  webInputStyle,
                ]}
                placeholder=""
                placeholderTextColor={colors.slate400}
                value={password}
                onChangeText={onPasswordChange}
                secureTextEntry={!passwordVisible}
                accessibilityLabel="Password"
                accessibilityHint="Enter your TrustedRiders driver account password."
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
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              s.primaryButton,
              keyboardVisible ? s.primaryButtonCompact : null,
              !canSubmit && s.primaryButtonDisabled,
              pressed && canSubmit ? { backgroundColor: "#1E293B" } : null,
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
          </Pressable>

          {!keyboardVisible ? (
            <View style={s.footer}>
              <Text style={s.footerText}>Build 0.1.0 · Prototype</Text>
              <Text style={s.footerText}>Encrypted</Text>
            </View>
          ) : null}
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
  scrollContentCompact: {
    justifyContent: "flex-start",
    paddingTop: 6,
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
  heroCompact: {
    minHeight: 104,
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    justifyContent: "center",
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
  heroIconCompact: {
    width: 52,
    height: 52,
    marginTop: 0,
  },
  heroText: {
    alignItems: "center",
    gap: 14,
  },
  heroTextCompact: {
    flex: 1,
    alignItems: "flex-start",
    gap: 4,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 0,
  },
  heroTitleCompact: {
    fontSize: 24,
  },
  heroSub: {
    color: colors.slate400,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2.4,
  },
  heroSubCompact: {
    fontSize: 10,
    letterSpacing: 1.8,
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
  formCompact: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
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
  fieldCompact: {
    gap: 6,
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
  inputCompact: {
    paddingVertical: 12,
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
  primaryButtonCompact: {
    minHeight: 50,
    paddingVertical: 14,
    marginTop: 2,
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
