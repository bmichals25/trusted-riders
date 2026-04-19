// API keys for external services.
// Set EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY in your environment or .env file.
// For development, you can hardcode a key here temporarily.

export const GOOGLE_DIRECTIONS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY ?? "";

// Fleet Tracking API (Flask backend)
export const FLEET_API_URL =
  process.env.EXPO_PUBLIC_FLEET_API_URL ?? "https://pretyphoid-electrovalently-zena.ngrok-free.dev";

// TrustedRiders emergency dispatch line used by the in-app Emergency modals.
// The 555-prefix default is a placeholder — set EXPO_PUBLIC_DISPATCH_PHONE to
// the real hotline in E.164 format (e.g. +15551234567) before shipping to
// real drivers.
export const DISPATCH_PHONE =
  process.env.EXPO_PUBLIC_DISPATCH_PHONE ?? "+15550000911";

/** "+15550000911" → "+1 (555) 000-0911" */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

// TODO(backend): remove once ride assignments plumb real ride ids through
// dispatch. Until then every location ping stamps with this single id so the
// Flask backend can still associate pings with a ride.
export const PROTOTYPE_RIDE_ID = 1;
