import { healthBody, jsonResponse } from "./_lib.mjs";

export async function handler() {
  return jsonResponse(200, healthBody());
}
