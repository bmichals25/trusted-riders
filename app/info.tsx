import { ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FadeInBlock } from "@/components/ui/FadeInBlock";
import { PageTransition } from "@/components/ui/PageTransition";
import { colors, radii, spacing } from "@/lib/theme";

/**
 * Generic info screen used by Settings subpages (Help Center, Terms, Privacy,
 * Report an Issue, Earnings). Driven by query params so one route covers
 * every placeholder page in the prototype without creating six files.
 *
 *   /info?slug=help
 *   /info?slug=terms
 *   …
 */

type InfoContent = {
  title: string;
  kicker: string;
  sections: { heading: string; body: string }[];
};

const CONTENT: Record<string, InfoContent> = {
  help: {
    title: "Help Center",
    kicker: "Operator support",
    sections: [
      {
        heading: "Contact dispatch",
        body:
          "For ride-level issues during an active mission, use Admin Chat from the ride card. For anything urgent, the Emergency button in the operator sheet reaches dispatch and 9-1-1 directly.",
      },
      {
        heading: "Off-shift questions",
        body:
          "Reach support@trustedriders.org with your operator ID (099-242) and a short description. We reply within one business day.",
      },
      {
        heading: "Lost access?",
        body:
          "If you can't sign in, contact your fleet lead or email accounts@trustedriders.org to verify your credentials.",
      },
    ],
  },
  report: {
    title: "Report an Issue",
    kicker: "Incidents",
    sections: [
      {
        heading: "During a ride",
        body:
          "Use the Emergency button in the operator sheet. It opens direct lines to 9-1-1 and TrustedRiders Dispatch, and files an incident timestamped to your current ride.",
      },
      {
        heading: "After a ride",
        body:
          "Email incidents@trustedriders.org with your operator ID, ride number, and a short description. Attach photos if relevant.",
      },
      {
        heading: "App feedback",
        body:
          "Send feature requests and bug reports to product@trustedriders.org. We read every one.",
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    kicker: "Operator agreement",
    sections: [
      {
        heading: "Placeholder",
        body:
          "Full terms are delivered in your onboarding packet and available on the operator web portal. This view is a placeholder for the prototype.",
      },
      {
        heading: "Summary",
        body:
          "You agree to operate the vehicle safely, follow all local laws, maintain your certifications, and keep rider information confidential.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    kicker: "Data practices",
    sections: [
      {
        heading: "Location data",
        body:
          "We collect your GPS location only while you are on-shift or in an active mission. Background tracking pauses when you go off-duty.",
      },
      {
        heading: "Rider data",
        body:
          "Rider names, addresses, and care notes are provided under a Business Associate Agreement. Do not share this information outside the app.",
      },
      {
        heading: "Retention",
        body:
          "Trip logs are retained for 13 months for billing and audit. Location pings older than 90 days are aggregated and anonymized.",
      },
    ],
  },
  earnings: {
    title: "Earnings",
    kicker: "This week",
    sections: [
      {
        heading: "Placeholder",
        body:
          "Real earnings come from the Flask backend. This screen will show weekly payouts, trip counts, tips, and a CSV export button when wired up.",
      },
    ],
  },
};

export default function InfoScreen() {
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  if (__DEV__ && slug && !CONTENT[slug]) {
    console.warn(`[info] unknown slug "${slug}" — falling back to help content`);
  }
  const content = CONTENT[slug] ?? CONTENT.help;

  return (
    <PageTransition>
      <Stack.Screen options={{ title: content.title }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: colors.surfaceLow }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 40, gap: spacing.lg }}
      >
        <FadeInBlock delay={40}>
          <View
            style={{
              backgroundColor: colors.primary,
              borderRadius: radii.sm,
              borderCurve: "continuous",
              paddingVertical: spacing.lg,
              paddingHorizontal: spacing.lg,
              gap: 6,
            }}
          >
            <Text
              style={{
                color: colors.slate400,
                fontSize: 11,
                fontWeight: "900",
                textTransform: "uppercase",
                letterSpacing: 2.4,
              }}
            >
              {content.kicker}
            </Text>
            <Text style={{ color: "#FFFFFF", fontSize: 28, fontWeight: "900", letterSpacing: -0.6 }}>
              {content.title}
            </Text>
          </View>
        </FadeInBlock>

        {content.sections.map((section, i) => (
          <FadeInBlock key={section.heading} delay={120 + i * 80}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.sm,
                borderCurve: "continuous",
                padding: spacing.md,
                gap: 8,
              }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 11,
                  fontWeight: "900",
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
              >
                {section.heading}
              </Text>
              <Text style={{ color: colors.slate500, fontSize: 15, fontWeight: "600", lineHeight: 22 }}>
                {section.body}
              </Text>
            </View>
          </FadeInBlock>
        ))}
      </ScrollView>
    </PageTransition>
  );
}
