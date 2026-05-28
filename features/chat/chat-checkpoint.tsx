import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { type CheckpointCardData } from "@/features/chat/chat-model";
import { colors, radii, spacing } from "@/lib/theme";

export function CheckpointUpdateCard({
  data,
  isOperator,
  onPress,
}: {
  data: CheckpointCardData;
  isOperator: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="View checkpoint update details"
      style={({ pressed }) => [
        {
          width: 286,
          borderRadius: radii.md,
          borderBottomRightRadius: isOperator ? 5 : radii.md,
          borderBottomLeftRadius: isOperator ? radii.md : 5,
          borderCurve: "continuous",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.slate200,
          padding: 14,
          gap: 10,
          opacity: pressed ? 0.76 : 1,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: colors.greenSoftDark,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.greenLight, fontSize: 18, fontWeight: "900" }}>✓</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              color: colors.green,
              fontSize: 11,
              fontWeight: "900",
              textTransform: "uppercase",
              letterSpacing: 1.2,
            }}
            numberOfLines={1}
          >
            Driver checkpoint
          </Text>
          <Text
            style={{
              color: colors.primary,
              fontSize: 16,
              fontWeight: "900",
              lineHeight: 20,
            }}
            numberOfLines={1}
          >
            {data.commandLabel}
          </Text>
        </View>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>
          {data.statusLabel} · {data.timeLabel}
        </Text>
        {data.address ? (
          <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "700", lineHeight: 16 }} numberOfLines={2}>
            {data.address}
          </Text>
        ) : null}
      </View>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.slate100,
          paddingTop: 9,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: colors.slate400, fontSize: 11, fontWeight: "800" }}>
          View checkpoint details
        </Text>
        <Text style={{ color: colors.blue, fontSize: 15, fontWeight: "900" }}>›</Text>
      </View>
    </Pressable>
  );
}

export function CheckpointDetailModal({
  checkpoint,
  onClose,
}: {
  checkpoint: CheckpointCardData | null;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={!!checkpoint}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(15, 23, 42, 0.28)",
        }}
      >
        <View
          style={{
            maxHeight: "78%",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingTop: 14,
            paddingBottom: 18,
            gap: 12,
          }}
        >
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                width: 46,
                height: 5,
                borderRadius: radii.pill,
                backgroundColor: colors.slate200,
              }}
            />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.green, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2 }}>
                Checkpoint details
              </Text>
              <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "900" }} numberOfLines={1}>
                {checkpoint?.commandLabel ?? "Checkpoint"}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close checkpoint details"
              hitSlop={10}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.surfaceLow,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.68 : 1,
              })}
            >
              <Text style={{ color: colors.primary, fontSize: 20, fontWeight: "900" }}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            style={{
              borderRadius: radii.md,
            }}
            contentContainerStyle={{
              gap: 10,
              paddingBottom: 4,
            }}
            showsVerticalScrollIndicator
          >
            {checkpoint ? (
              <>
                <View
                  style={{
                    borderRadius: radii.lg,
                    borderCurve: "continuous",
                    backgroundColor: colors.greenSoft,
                    padding: 14,
                    gap: 6,
                  }}
                >
                  <Text style={{ color: colors.green, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.1 }}>
                    {checkpoint.completedMission ? "Mission completed" : "Driver update"}
                  </Text>
                  <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "900", lineHeight: 23 }}>
                    {checkpoint.commandLabel}
                  </Text>
                  <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "800" }}>
                    {checkpoint.statusLabel} · {checkpoint.timeLabel}
                  </Text>
                </View>

                <CheckpointDetailRow
                  label="Step"
                  value={checkpoint.stepLabel ?? "Current mission step"}
                />
                <CheckpointDetailRow
                  label="Current stop"
                  value={[checkpoint.currentStageTitle, checkpoint.currentStageAddress].filter(Boolean).join("\n")}
                />
                {checkpoint.nextStageTitle || checkpoint.nextStageAddress ? (
                  <CheckpointDetailRow
                    label="Next stop"
                    value={[checkpoint.nextStageTitle, checkpoint.nextStageAddress].filter(Boolean).join("\n")}
                  />
                ) : null}
                {checkpoint.targetAddress && checkpoint.targetAddress !== checkpoint.currentStageAddress ? (
                  <CheckpointDetailRow
                    label="Target"
                    value={checkpoint.targetAddress}
                  />
                ) : null}
                {checkpoint.driverLocationLabel ? (
                  <CheckpointDetailRow
                    label="Driver location"
                    value={checkpoint.driverLocationLabel}
                  />
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function CheckpointDetailRow({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  if (!value) return null;

  return (
    <View
      style={{
        borderRadius: radii.md,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceLow,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 5,
      }}
    >
      <Text style={{ color: colors.slate400, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.1 }}>
        {label}
      </Text>
      <Text selectable style={{ color: colors.primary, fontSize: 15, fontWeight: "800", lineHeight: 21 }}>
        {value}
      </Text>
    </View>
  );
}
