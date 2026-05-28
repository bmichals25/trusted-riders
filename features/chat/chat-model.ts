import {
  formatChatTimestamp,
  type RideChatMessage,
} from "@/lib/chat-api";

export type Message = {
  id: string;
  text: string;
  sender: "operator" | "admin";
  timestamp: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  checkpoint?: CheckpointCardData;
  pending?: boolean;
};

export type CheckpointCardData = {
  title: string;
  commandLabel: string;
  statusLabel: string;
  timeLabel: string;
  address?: string;
  stepLabel?: string;
  currentStageTitle?: string;
  currentStageAddress?: string;
  nextStageTitle?: string;
  nextStageAddress?: string;
  targetAddress?: string;
  driverLocationLabel?: string;
  completedMission: boolean;
};

export function mapApiMessage(message: RideChatMessage): Message {
  const timestamp = formatChatTimestamp(message.created_at);
  return {
    id: message.id,
    text: message.text,
    sender: message.sender === "driver" ? "operator" : "admin",
    timestamp,
    createdAt: message.created_at,
    metadata: message.metadata,
    checkpoint: getCheckpointCardData(message.text, message.metadata, timestamp),
  };
}

function humanizeToken(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  if (!value.trimStart().startsWith("{")) return null;

  try {
    return readRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

function getCheckpointCardData(
  text: string,
  metadata: Record<string, unknown> | undefined,
  fallbackTimeLabel: string,
): CheckpointCardData | undefined {
  const payload = readRecord(metadata)?.type === "mission_command_status"
    ? readRecord(metadata)
    : parseJsonObject(text);

  if (!payload || payload.type !== "mission_command_status") return undefined;

  const mission = readRecord(payload.mission);
  const ride = readRecord(payload.ride);
  const currentStage = readRecord(mission?.current_stage);
  const nextStage = readRecord(mission?.next_stage);
  const target = readRecord(mission?.target);
  const driverLocation = readRecord(payload.driver_location);
  const timestamp = readString(payload.timestamp);
  const timeLabel = timestamp ? formatChatTimestamp(timestamp) : fallbackTimeLabel;
  const commandLabel =
    readString(mission?.current_action) ||
    humanizeToken(payload.command) ||
    "Checkpoint";
  const statusLabel =
    humanizeToken(ride?.status_check) ||
    humanizeToken(ride?.status) ||
    "Status update";
  const stageTitle = readString(currentStage?.title);
  const address = readString(currentStage?.address);
  const step = readNumber(mission?.step);
  const totalSteps = readNumber(mission?.total_steps);
  const latitude = readNumber(driverLocation?.latitude);
  const longitude = readNumber(driverLocation?.longitude);
  const driverLocationLabel =
    latitude !== undefined && longitude !== undefined
      ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
      : undefined;

  return {
    title: stageTitle ? `${stageTitle} checkpoint` : "Checkpoint update",
    commandLabel,
    statusLabel,
    timeLabel,
    address,
    stepLabel: step && totalSteps ? `${step} of ${totalSteps}` : undefined,
    currentStageTitle: stageTitle,
    currentStageAddress: address,
    nextStageTitle: readString(nextStage?.title),
    nextStageAddress: readString(nextStage?.address),
    targetAddress: readString(target?.address),
    driverLocationLabel,
    completedMission: payload.completed_mission === true,
  };
}
