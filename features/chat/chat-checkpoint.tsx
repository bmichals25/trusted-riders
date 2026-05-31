import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SymbolIcon } from "@/components/ui/SymbolIcon";

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
      accessibilityLabel={`View checkpoint update details. ${data.commandLabel}. ${data.statusLabel} at ${data.timeLabel}.`}
      style={({ pressed }) => [
        {
          width: 286,
          borderRadius: radii.sm,
          borderBottomRightRadius: isOperator ? 4 : radii.sm,
          borderBottomLeftRadius: isOperator ? radii.sm : 4,
          borderCurve: "continuous",
          backgroundColor: colors.surfaceLow,
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
          <SymbolIcon
            name="checkmark"
            size={17}
            type="hierarchical"
            tintColor={colors.greenLight}
            weight="semibold"
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
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
          <Text style={{ color: colors.slate500, fontSize: 12, fontWeight: "700", lineHeight: 16 }}>
            {data.address}
          </Text>
        ) : null}
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
            borderTopLeftRadius: radii.lg,
            borderTopRightRadius: radii.lg,
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
                    {checkpoint.completedMission ? "Mission completed" : "TrustedRider update"}
                  </Text>
                  <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "900", lineHeight: 23 }}>
                    {checkpoint.commandLabel}
                  </Text>
                  <Text style={{ color: colors.slate500, fontSize: 13, fontWeight: "800" }}>
                    {checkpoint.statusLabel} · {checkpoint.timeLabel}
                  </Text>
                </View>

                <View
                  style={{
                    borderRadius: radii.sm,
                    borderCurve: "continuous",
                    backgroundColor: colors.surfaceLow,
                    paddingHorizontal: 14,
                    paddingVertical: 14,
                    gap: 14,
                  }}
                >
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
                      label="TrustedRider location"
                      value={checkpoint.driverLocationLabel}
                    />
                  ) : null}
                </View>
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
    <View style={{ gap: 5 }}>
      <Text style={{ color: colors.slate500, fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.1 }}>
        {label}
      </Text>
      <Text selectable style={{ color: colors.primary, fontSize: 15, fontWeight: "800", lineHeight: 21 }}>
        {value}
      </Text>
    </View>
  );
}
