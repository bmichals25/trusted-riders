import { FLEET_API_URL } from "./config";
import { demoChatMessages, demoChatStatus } from "./demo-data";
import { DEMO_MODE } from "./demo-mode";
import { getToken } from "./fleet-api";

export type ChatSender = "driver" | "dispatch" | "admin" | "system";

export type RideChatMessage = {
  id: string;
  ride_id: string;
  text: string;
  sender: ChatSender;
  sender_name: string | null;
  client_message_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ChatTypingState = {
  sender: ChatSender;
  sender_name: string | null;
  is_typing: boolean;
  updated_at: string;
  expires_at_ms: number;
};

export type ChatReadReceipt = {
  sender: ChatSender;
  sender_name: string | null;
  last_read_message_id: string | null;
  read_at: string;
};

export type ChatCommandType = "gps_ask" | "gps_yes" | "gps_off";

export type RideChatStatus = {
  ride_id: string;
  typing: ChatTypingState[];
  read_receipts: Partial<Record<ChatSender, ChatReadReceipt>>;
};

type ListMessagesResponse = RideChatMessage[] | {
  ride_id: string;
  messages: RideChatMessage[];
};

type CreateMessageResponse = RideChatMessage | {
  message: RideChatMessage;
};

const CHAT_FETCH_TIMEOUT_MS = 8000;
const DISPATCH_CHAT_ROOM_ID = "dispatch";

async function chatFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) {
    throw new Error("Missing auth token for chat request.");
  }

  const url = `${FLEET_API_URL}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHAT_FETCH_TIMEOUT_MS);
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    let note = "";
    try {
      const body = await res.json();
      note = typeof body?.error === "string" ? `: ${body.error}` : "";
    } catch {}
    throw new Error(`Chat API ${res.status}${note}`);
  }
  return res.json() as Promise<T>;
}

export async function listRideChatMessages(
  rideId: string,
  afterId?: string,
  options: { includeCommands?: boolean } = {},
): Promise<RideChatMessage[]> {
  if (DEMO_MODE) {
    const messages = demoChatMessages(rideId);
    if (!afterId) return messages;
    const index = messages.findIndex((message) => message.id === afterId);
    return index >= 0 ? messages.slice(index + 1) : messages;
  }

  const data = await chatFetch<ListMessagesResponse>(
    buildListChatMessagesPath(afterId),
  );
  const messages = Array.isArray(data) ? data : data.messages;
  return messages
    .map((message) => normalizeChatMessage(message, rideId))
    .filter(options.includeCommands ? isRelevantChatMessage : isDisplayableChatMessage);
}

export async function getRideChatStatus(rideId: string): Promise<RideChatStatus> {
  if (DEMO_MODE) return demoChatStatus(rideId);

  return {
    ride_id: rideId,
    typing: [],
    read_receipts: {},
  };
}

export async function sendRideChatMessage({
  rideId,
  text,
  sender = "driver",
  senderName,
  clientMessageId,
  metadata,
}: {
  rideId: string;
  text: string;
  sender?: ChatSender;
  senderName?: string;
  clientMessageId?: string;
  metadata?: Record<string, unknown>;
}): Promise<RideChatMessage> {
  if (DEMO_MODE) {
    return {
      id: clientMessageId ?? `demo-${Date.now()}`,
      ride_id: rideId,
      text,
      sender,
      sender_name: senderName ?? "Jordan",
      client_message_id: clientMessageId ?? null,
      metadata: metadata ?? {},
      created_at: new Date().toISOString(),
    };
  }

  const metadataPayload = {
    ...(metadata ?? {}),
    ...(rideId && rideId !== DISPATCH_CHAT_ROOM_ID ? { ride_id: rideId } : {}),
  };
  const request = buildSendChatMessageRequest({
    text,
    clientMessageId,
    metadata: Object.keys(metadataPayload).length ? metadataPayload : undefined,
  });
  const data = await chatFetch<CreateMessageResponse>(
    request.path,
    request.init,
  );
  const normalized = normalizeChatMessage(unwrapCreateMessageResponse(data), rideId);
  return normalized.text.trim() ? normalized : { ...normalized, text };
}

export async function setRideChatTyping({
  rideId,
}: {
  rideId: string;
  sender?: ChatSender;
  senderName?: string;
  isTyping: boolean;
}): Promise<RideChatStatus> {
  return getRideChatStatus(rideId);
}

export async function markRideChatRead({
  rideId,
}: {
  rideId: string;
  sender?: ChatSender;
  senderName?: string;
  lastReadMessageId?: string;
}): Promise<RideChatStatus> {
  return getRideChatStatus(rideId);
}

export function buildListChatMessagesPath(afterId?: string): string {
  return afterId
    ? `/api/chat/messages?after_id=${encodeURIComponent(afterId)}`
    : "/api/chat/messages";
}

export function buildSendChatMessageRequest({
  text,
  clientMessageId,
  metadata,
}: {
  text: string;
  clientMessageId?: string;
  metadata?: Record<string, unknown>;
}): { path: string; init: RequestInit } {
  return {
    path: "/api/chat/messages",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        client_message_id: clientMessageId,
        message_metadata: metadata,
      }),
    },
  };
}

export function normalizeChatMessage(
  raw: unknown,
  fallbackRideId = DISPATCH_CHAT_ROOM_ID,
): RideChatMessage {
  const record = raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const metadata = record.metadata ?? record.message_metadata;
  const clientMessageId = typeof record.client_message_id === "string" ? record.client_message_id : null;
  const sender = typeof record.sender === "string" ? record.sender : "admin";
  const isEchoedDriverMessage = clientMessageId?.startsWith("driver-") === true;
  const normalizedSender = isEchoedDriverMessage
    ? "driver"
    : isChatSender(sender)
      ? sender
      : "admin";

  return {
    id: String(record.id ?? clientMessageId ?? `${Date.now()}`),
    ride_id: String(record.ride_id ?? record.rideId ?? fallbackRideId),
    text: readMessageText(record),
    sender: normalizedSender,
    sender_name: isEchoedDriverMessage
      ? "Driver"
      : typeof record.sender_name === "string"
        ? record.sender_name
        : null,
    client_message_id: clientMessageId,
    metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata as Record<string, unknown>
      : {},
    created_at: typeof record.created_at === "string" ? record.created_at : new Date().toISOString(),
  };
}

export function unwrapCreateMessageResponse(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;

  const record = raw as Record<string, unknown>;
  const wrapped = record.message;
  return wrapped && typeof wrapped === "object" && !Array.isArray(wrapped)
    ? wrapped
    : raw;
}

export function isDisplayableChatMessage(message: RideChatMessage): boolean {
  if (message.text.trim()) return true;
  return message.metadata.type === "mission_command_status";
}

export function isRelevantChatMessage(message: RideChatMessage): boolean {
  return isDisplayableChatMessage(message) || getChatCommandType(message.metadata) !== null;
}

export function getChatCommandType(metadata: Record<string, unknown> | undefined): ChatCommandType | null {
  const value = metadata?.type ?? metadata?.command ?? metadata?.action;
  return value === "gps_ask" || value === "gps_yes" || value === "gps_off" ? value : null;
}

export function buildGpsResponseMetadata({
  command,
  reason,
}: {
  command: "gps_yes" | "gps_off";
  reason?: string;
}): Record<string, unknown> {
  return {
    type: command,
    ...(reason ? { reason } : {}),
  };
}

function readMessageText(record: Record<string, unknown>): string {
  for (const key of ["text", "message", "content", "body", "message_text"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return "";
}

function isChatSender(value: string): value is ChatSender {
  return value === "driver" || value === "dispatch" || value === "admin" || value === "system";
}

export function formatChatTimestamp(
  value: string,
  options: { locale?: string; timeZone?: string } = {},
): string {
  const normalized = normalizeBackendTimestamp(value);
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(options.locale, {
    hour: "numeric",
    minute: "2-digit",
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  });
}

function normalizeBackendTimestamp(value: string): string {
  const trimmed = value.trim();
  const isoDateTimeWithoutZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;
  return isoDateTimeWithoutZone.test(trimmed) ? `${trimmed}Z` : trimmed;
}
