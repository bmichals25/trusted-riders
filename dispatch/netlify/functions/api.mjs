import { jsonResponse, notBackendBody } from "./_lib.mjs";

export async function handler() {
  return jsonResponse(404, notBackendBody(404));
}
