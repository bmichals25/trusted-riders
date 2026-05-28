import { NativeTabs } from "expo-router/unstable-native-tabs";

import { colors } from "@/lib/theme";

export default function TabsLayout() {
  return (
    <NativeTabs
      tintColor={colors.blue}
      iconColor={{ default: colors.slate400, selected: colors.blue }}
      labelStyle={{
        default: { fontSize: 11, fontWeight: "700" },
        selected: { fontSize: 11, fontWeight: "800", color: colors.blue },
      }}
      blurEffect="systemDefault"
      minimizeBehavior="automatic"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label hidden>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mission" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Label hidden>Schedule</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "calendar", selected: "calendar.badge.clock" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label hidden>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
