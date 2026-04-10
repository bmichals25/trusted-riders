// Fleet Tracking API client — handles auth + location updates to Flask backend

import { FLEET_API_URL } from "./config";

let token: string | null = null;

export async function login(email: string, password: string): Promise<{ id: number; name: string; email: string }> {
  const res = await fetch(`${FLEET_API_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  const data = await res.json();
  token = data.token;
  return data.user;
}

export function getToken(): string | null {
  return token;
}

export function clearToken() {
  token = null;
}

export async function updateLocation(loc: {
  lat: number;
  lon: number;
  timestamp: string;
  ride_id: number | null;
}): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch(`${FLEET_API_URL}/api/update_location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(loc),
    });
    if (res.status === 401) {
      // Token expired — clear so app can re-auth
      token = null;
      return false;
    }
    return res.ok;
  } catch {
    // Network error — don't crash, just skip this update
    return false;
  }
}
