import { FLEET_API_URL } from "./config";
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
): Promise<RideChatMessage[]> {
  const query = afterId ? `?after_id=${encodeURIComponent(afterId)}` : "";
  const data = await chatFetch<ListMessagesResponse>(
    `/api/chat/rides/${encodeURIComponent(rideId)}/messages${query}`,
  );
  return Array.isArray(data) ? data : data.messages;
}

export async function getRideChatStatus(rideId: string): Promise<RideChatStatus> {
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
  const data = await chatFetch<CreateMessageResponse>(
    `/api/chat/rides/${encodeURIComponent(rideId)}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        sender,
        sender_name: senderName,
        client_message_id: clientMessageId,
        metadata,
      }),
    },
  );
  return "message" in data ? data.message : data;
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
