// API keys for external services.
// Set EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY in your environment or .env file.
// For development, you can hardcode a key here temporarily.

export const GOOGLE_DIRECTIONS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_DIRECTIONS_KEY ?? "";

// Fleet Tracking API (Flask backend)
export const FLEET_API_URL =
  process.env.EXPO_PUBLIC_FLEET_API_URL ?? "https://pretyphoid-electrovalently-zena.ngrok-free.dev";
