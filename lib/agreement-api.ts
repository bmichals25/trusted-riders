// Trusted Rider agreement API (BEN-20).
//   GET  /api/me/agreement         -> {version, title, body_markdown, accepted, accepted_at}
//   POST /api/me/agreement/accept  {version} -> same body; 400 when the version is no longer current

import { DEMO_MODE } from "./demo-mode";
import { expireSession, getToken } from "./fleet-api";
import { fleetFetch, readApiErrorMessage } from "./fleet-api-transport";

export type TrAgreement = {
  version: string;
  title: string;
  bodyMarkdown: string;
  accepted: boolean;
  acceptedAt: string | null;
};

export type AgreementFetchResult =
  | { kind: "ok"; agreement: TrAgreement }
  // Signed out / token rejected: the caller signs the driver out.
  | { kind: "signed_out" }
  // Offline, backend without the endpoint, or a server error: don't lock the driver out; the backend
  // still enforces the agreement on ride actions (403 agreement_required brings the screen back).
  | { kind: "unavailable"; message: string };

export type AgreementAcceptResult =
  | { kind: "ok"; agreement: TrAgreement }
  | { kind: "signed_out" }
  // The agreement changed while it was on screen: reload it and ask again.
  | { kind: "outdated"; message: string }
  | { kind: "error"; message: string };

export const AGREEMENT_PATH = "/api/me/agreement";
export const AGREEMENT_ACCEPT_PATH = "/api/me/agreement/accept";

const DEMO_AGREEMENT: TrAgreement = {
  version: "demo",
  title: "Trusted Rider Chaperone & Privacy Agreement",
  bodyMarkdown: "Demo mode.",
  accepted: true,
  acceptedAt: null,
};

export function normalizeAgreement(raw: unknown): TrAgreement | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const version = typeof body.version === "string" ? body.version.trim() : "";
  if (!version) return null;
  return {
    version,
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Trusted Rider Agreement",
    bodyMarkdown: typeof body.body_markdown === "string" ? body.body_markdown : "",
    accepted: body.accepted === true,
    acceptedAt: typeof body.accepted_at === "string" ? body.accepted_at : null,
  };
}

export function buildAcceptAgreementRequest(version: string): { path: string; init: RequestInit } {
  return {
    path: AGREEMENT_ACCEPT_PATH,
    init: {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ version }),
    },
  };
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function isSignedOutStatus(status: number): boolean {
  return status === 401 || status === 422;
}

export async function fetchAgreement(): Promise<AgreementFetchResult> {
  if (DEMO_MODE) return { kind: "ok", agreement: DEMO_AGREEMENT };
  if (!getToken()) return { kind: "signed_out" };

  const { res } = await fleetFetch(
    "GET",
    AGREEMENT_PATH,
    { headers: authHeaders() },
    { minIntervalMs: 1500, failureBackoffMs: 0, throttleKey: `GET ${AGREEMENT_PATH}` },
  );
  if (!res) return { kind: "unavailable", message: "Couldn't reach dispatch." };
  if (isSignedOutStatus(res.status)) {
    await expireSession();
    return { kind: "signed_out" };
  }
  if (!res.ok) {
    return { kind: "unavailable", message: (await readApiErrorMessage(res)) ?? `Agreement unavailable (${res.status}).` };
  }
  try {
    const agreement = normalizeAgreement(await res.json());
    return agreement
      ? { kind: "ok", agreement }
      : { kind: "unavailable", message: "The agreement response was incomplete." };
  } catch {
    return { kind: "unavailable", message: "Couldn't read the agreement." };
  }
}

export async function acceptAgreement(version: string): Promise<AgreementAcceptResult> {
  if (DEMO_MODE) return { kind: "ok", agreement: { ...DEMO_AGREEMENT, version } };
  if (!getToken()) return { kind: "signed_out" };

  const { path, init } = buildAcceptAgreementRequest(version);
  const { res } = await fleetFetch("POST", path, init, {
    minIntervalMs: 1000,
    failureBackoffMs: 0,
    throttleKey: `POST ${path}`,
  });
  if (!res) return { kind: "error", message: "Couldn't reach dispatch. Check your connection and try again." };
  if (isSignedOutStatus(res.status)) {
    await expireSession();
    return { kind: "signed_out" };
  }
  if (res.status === 400) {
    return {
      kind: "outdated",
      message: "The agreement was just updated. Please review the latest version.",
    };
  }
  if (!res.ok) {
    return {
      kind: "error",
      message: (await readApiErrorMessage(res)) ?? `Dispatch couldn't record that (${res.status}). Try again.`,
    };
  }
  try {
    const agreement = normalizeAgreement(await res.json());
    if (agreement?.accepted) return { kind: "ok", agreement };
  } catch {
    // fall through
  }
  return { kind: "error", message: "Dispatch didn't confirm your acceptance. Try again." };
}
