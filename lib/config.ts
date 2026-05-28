// Fleet Tracking API (Flask backend) — the single source for backend data.
// Set EXPO_PUBLIC_FLEET_API_URL when the backend URL rotates.
export const FLEET_API_URL = (
  process.env.EXPO_PUBLIC_FLEET_API_URL ?? "https://trdev.tailff74b1.ts.net"
).replace(/\/+$/, "");

// TrustedRiders dispatch line used by the Admin Chat call button.
// The 555-prefix default is a placeholder — set EXPO_PUBLIC_DISPATCH_PHONE to
// the real hotline in E.164 format (e.g. +15551234567) before shipping to
// real drivers.
export const DISPATCH_PHONE =
  process.env.EXPO_PUBLIC_DISPATCH_PHONE ?? "+15550000911";

/**
 * "+15550000911" → "+1 (555) 000-0911".
 * Falls through to the raw string on anything that isn't an 11-digit US
 * number starting with country code 1. When real international rider
 * contacts land, this function needs an `intl-tel-input`-style lib.
 */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (__DEV__) {
    console.warn(`[formatPhone] unrecognized number format "${raw}" — returning raw`);
  }
  return raw;
}
