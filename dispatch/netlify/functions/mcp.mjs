import { jsonResponse, notBackendBody } from "./_lib.mjs";

export async function handler() {
  return jsonResponse(501, notBackendBody(501));
}
