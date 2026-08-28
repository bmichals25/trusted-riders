export const SERVICE = "trustedriders-dispatch";

export const NOT_BACKEND_MESSAGE =
  "This host is the TrustedRiders dispatch UI only. It is not the fleet/MCP backend.";

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export function deploySha() {
  const sha = process.env.COMMIT_REF || process.env.CACHED_COMMIT_REF || "";
  return sha || null;
}

export function healthBody() {
  const body = {
    ok: true,
    service: SERVICE,
  };
  const sha = deploySha();
  if (sha) {
    body.sha = sha;
  }
  return body;
}

export function notBackendBody(status) {
  return {
    ok: false,
    error: status === 501 ? "not_implemented" : "not_found",
    status,
    service: SERVICE,
    message: NOT_BACKEND_MESSAGE,
  };
}

export function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  };
}
