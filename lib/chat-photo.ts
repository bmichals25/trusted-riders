// Photos of the people in the TR's dispatch chat (the small avatars next to message bubbles).
//
// Same rules as passenger photos (lib/passenger-photo.ts): the session token goes in the Authorization
// header, never in the URL; <Avatar> keeps images in expo-image's memory cache only; sign-out clears it.
//   the TR's own messages   GET /api/me/photo
//   a dispatcher's messages  GET /api/chat/participants/<user_id>/photo  (404 unless they wrote in this chat)

import { type ImageSource } from "expo-image";

import { FLEET_API_URL } from "./config";
import { DEMO_MODE } from "./demo-mode";

export type ChatPhotoSize = "thumb" | "full";

export type ChatSenderPhoto = {
  userId: number | null;
  hasPhoto: boolean;
  photoUpdatedAt: string | null;
};

/** Relative API path for a chat sender's photo; `v` only busts caches when the photo changes. */
export function buildChatSenderPhotoPath(
  sender: ChatSenderPhoto,
  isOwn: boolean,
  size: ChatPhotoSize,
): string | null {
  const version = sender.photoUpdatedAt ? `&v=${encodeURIComponent(sender.photoUpdatedAt)}` : "";
  if (isOwn) return `/api/me/photo?size=${size}${version}`;
  if (sender.userId === null || !Number.isSafeInteger(sender.userId) || sender.userId <= 0) return null;
  return `/api/chat/participants/${sender.userId}/photo?size=${size}${version}`;
}

/**
 * Image source for a chat sender's avatar, or null (initials only) when there is no photo, no account
 * behind the message (automatic GPS asks, older messages), no session, or the app runs on demo data.
 */
export function chatSenderPhotoSource(
  sender: ChatSenderPhoto,
  isOwn: boolean,
  size: ChatPhotoSize,
  token: string | null,
  options: { baseUrl?: string; demoMode?: boolean } = {},
): ImageSource | null {
  if (options.demoMode ?? DEMO_MODE) return null;
  if (!sender.hasPhoto || !token) return null;
  const path = buildChatSenderPhotoPath(sender, isOwn, size);
  if (!path) return null;
  return {
    uri: `${options.baseUrl ?? FLEET_API_URL}${path}`,
    headers: { Authorization: `Bearer ${token}` },
  };
}
