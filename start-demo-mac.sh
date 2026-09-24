#!/usr/bin/env bash
# TrustedRiders offline driver-app demo (April tree + DEMO_MODE)
set -euo pipefail
ROOT="/Users/benmichals/ClaudeCodeTest/COMPANIES/TRUSTEDRIDERS_April_2026"
cd "$ROOT"
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm use 20
export EXPO_PUBLIC_DEMO_MODE=1
# Prefer free port if 8081 busy
PORT=8081
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  PORT=8082
fi
echo "Starting TrustedRiders web demo on http://localhost:$PORT (DEMO_MODE=1)"
echo "Login: any email + any password (demo accepts all; shows Jordan Mitchell)"
echo "Stop: Ctrl+C in this terminal"
exec npx expo start --web --port "$PORT"
