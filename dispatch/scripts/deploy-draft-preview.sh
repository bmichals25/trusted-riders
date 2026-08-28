#!/usr/bin/env bash
# Draft/preview deploy only. Never passes --prod.
set -euo pipefail

if [[ -z "${NETLIFY_AUTH_TOKEN:-}" ]]; then
  echo "NETLIFY_AUTH_TOKEN is required" >&2
  exit 1
fi

SITE="${NETLIFY_SITE_ID:-trustedriders-dispatch}"
PR_NUMBER="${1:-1}"
ALIAS="deploy-preview-${PR_NUMBER}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

cd "$ROOT"

npx --yes netlify-cli deploy \
  --auth "$NETLIFY_AUTH_TOKEN" \
  --site "$SITE" \
  --build \
  --alias "$ALIAS" \
  --message "PR ${PR_NUMBER} draft preview (not production)" \
  --json
