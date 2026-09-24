import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SymbolIcon } from "@/components/ui/SymbolIcon";
import type { TrAgreement } from "@/lib/agreement-api";
import { parseAgreementMarkdown, type AgreementBlock, type InlineSpan } from "@/lib/agreement-markdown";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme";

/**
 * Full-screen, non-dismissible onboarding step (BEN-20): the Trusted Rider chaperone & privacy
 * agreement. Same visual language as the location onboarding step (LocationSetupGate): surfaceLow
 * backdrop, white floating card, blue icon tile, bold uppercase blue primary button.
 */
export function AgreementScreen({
  agreement,
  loading,
  error,
  notice,
  submitting,
  onAccept,
  onRetry,
  onSignOut,
}: {
  agreement: TrAgreement | null;
  loading: boolean;
  error: string | null;
  notice: string | null;
  submitting: boolean;
  onAccept: (version: string) => void;
  onRetry: () => void;
  onSignOut: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Tied to the version on screen: a new text (re-prompt) needs a fresh tick.
  const [checkedVersion, setCheckedVersion] = useState<string | null>(null);
  const checked = !!agreement && checkedVersion === agreement.version;
  const blocks = useMemo(() => parseAgreementMarkdown(agreement?.bodyMarkdown ?? ""), [agreement?.bodyMarkdown]);
  const canAccept = checked && !submitting && !!agreement;

  return (
    <View style={[s.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={s.header}>
        <View style={s.iconWrap}>
          <SymbolIcon name="person.fill.checkmark" size={30} tintColor={colors.surface} weight="bold" />
        </View>
        <Text style={s.kicker}>One-time step</Text>
        <Text style={s.title} accessibilityRole="header">
          {agreement?.title ?? "Trusted Rider Agreement"}
        </Text>
        <Text style={s.subtitle}>
          Please read this before your first ride. You'll need to accept it to take rides.
        </Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator
      >
        <View style={s.card}>
          {agreement ? (
            blocks.map((block, index) => <AgreementBlockView key={index} block={block} />)
          ) : loading ? (
            <View style={s.placeholder}>
              <ActivityIndicator color={colors.blue} />
              <Text style={s.placeholderText}>Loading the agreement…</Text>
            </View>
          ) : (
            <View style={s.placeholder}>
              <Text style={s.placeholderText}>{error ?? "The agreement couldn't be loaded."}</Text>
              <Pressable style={s.secondaryButton} onPress={onRetry} accessibilityRole="button">
                <Text style={s.secondaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {notice ? <Text style={s.notice}>{notice}</Text> : null}
        {agreement && error ? <Text style={s.error} accessibilityRole="alert">{error}</Text> : null}

        <Pressable
          style={s.checkRow}
          disabled={!agreement || submitting}
          onPress={() => agreement && setCheckedVersion(checked ? null : agreement.version)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked, disabled: !agreement || submitting }}
          accessibilityLabel="I have read and agree to the Trusted Rider agreement"
        >
          <View style={[s.checkbox, checked && s.checkboxChecked]}>
            {checked ? <Text style={s.checkmark}>✓</Text> : null}
          </View>
          <Text style={s.checkLabel}>I have read and agree</Text>
        </Pressable>

        <Pressable
          style={[s.button, !canAccept && s.buttonDisabled]}
          disabled={!canAccept}
          onPress={() => agreement && onAccept(agreement.version)}
          accessibilityRole="button"
          accessibilityLabel={submitting ? "Saving your acceptance" : "Accept and continue"}
          accessibilityState={{ disabled: !canAccept, busy: submitting }}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : (
            <Text style={s.buttonText}>Accept and continue</Text>
          )}
        </Pressable>

        <Pressable onPress={onSignOut} hitSlop={10} accessibilityRole="button" style={s.signOut}>
          <Text style={s.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Inline({ spans }: { spans: InlineSpan[] }) {
  return (
    <>
      {spans.map((span, index) => (
        <Text key={index} style={span.bold ? s.bold : undefined}>
          {span.text}
        </Text>
      ))}
    </>
  );
}

function AgreementBlockView({ block }: { block: AgreementBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <Text style={block.level === 1 ? s.h1 : block.level === 2 ? s.h2 : s.h3} accessibilityRole="header">
          <Inline spans={block.spans} />
        </Text>
      );
    case "callout":
      return (
        <View style={s.callout}>
          <Text style={s.calloutText}>
            <Inline spans={block.spans} />
          </Text>
        </View>
      );
    case "bullet":
    case "numbered":
      return (
        <View style={s.listRow}>
          <Text style={s.listMarker}>{block.type === "bullet" ? "•" : `${block.number}.`}</Text>
          <Text style={s.listText}>
            <Inline spans={block.spans} />
          </Text>
        </View>
      );
    default:
      return (
        <Text style={s.paragraph}>
          <Inline spans={block.spans} />
        </Text>
      );
  }
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surfaceLow,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  kicker: {
    ...typography.sectionKicker,
    color: colors.blue,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.primary,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.slate500,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 360,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.floating,
  },
  placeholder: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  placeholderText: {
    ...typography.body,
    color: colors.slate500,
    fontWeight: "600",
    textAlign: "center",
  },
  h1: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    color: colors.primary,
    letterSpacing: -0.3,
    marginTop: spacing.xs,
  },
  h2: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: colors.primary,
    marginTop: spacing.sm,
  },
  h3: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
    color: colors.primarySoft,
    marginTop: spacing.xs,
  },
  paragraph: {
    ...typography.body,
    color: colors.primarySoft,
  },
  bold: {
    fontWeight: "800",
    color: colors.primary,
  },
  listRow: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingLeft: 2,
  },
  listMarker: {
    ...typography.body,
    color: colors.blue,
    fontWeight: "900",
    minWidth: 16,
  },
  listText: {
    ...typography.body,
    color: colors.primarySoft,
    flex: 1,
  },
  callout: {
    backgroundColor: colors.amberSoft,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  calloutText: {
    ...typography.footnote,
    color: colors.amberStrong,
    fontWeight: "600",
  },
  footer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.slate200,
    alignItems: "center",
  },
  notice: {
    ...typography.footnote,
    color: colors.amberStrong,
    fontWeight: "700",
    textAlign: "center",
  },
  error: {
    ...typography.footnote,
    color: colors.error,
    fontWeight: "700",
    textAlign: "center",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "stretch",
    maxWidth: 560,
    minHeight: 44,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: radii.xs + 2,
    borderWidth: 2,
    borderColor: colors.slate300,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.blue,
    borderColor: colors.blue,
  },
  checkmark: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 18,
  },
  checkLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
    flex: 1,
  },
  button: {
    alignSelf: "stretch",
    maxWidth: 560,
    backgroundColor: colors.blue,
    borderRadius: radii.sm,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.surface,
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  secondaryButton: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.blue,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  signOut: {
    paddingVertical: spacing.xs,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.slate500,
    textDecorationLine: "underline",
  },
});
