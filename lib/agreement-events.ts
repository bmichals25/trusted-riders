// "Agreement required" signal (BEN-20). Any Fleet API call answered with
// 403 {"code": "agreement_required"} notifies the AgreementGate, which brings
// the Trusted Rider agreement back up. No imports so the API transport can use
// it without an import cycle.

export const AGREEMENT_REQUIRED_CODE = "agreement_required";

type Listener = () => void;
const listeners = new Set<Listener>();

/** True for the backend's 403 body: {"error": "...", "code": "agreement_required"}. */
export function isAgreementRequiredBody(body: unknown): boolean {
  return !!body && typeof body === "object" && (body as Record<string, unknown>).code === AGREEMENT_REQUIRED_CODE;
}

export function onAgreementRequired(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyAgreementRequired(): void {
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch (error) {
      console.log("[agreement] listener failed", error instanceof Error ? error.message : error);
    }
  }
}

/** Inspect a response and notify listeners when it is the agreement_required 403. Never throws. */
export async function detectAgreementRequired(res: { status: number; clone(): { json(): Promise<unknown> } }): Promise<boolean> {
  if (res.status !== 403) return false;
  try {
    const body = await res.clone().json();
    if (!isAgreementRequiredBody(body)) return false;
  } catch {
    return false;
  }
  notifyAgreementRequired();
  return true;
}
