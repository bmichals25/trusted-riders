#!/usr/bin/env sh
# BEN-14: list user-visible "driver"/"Driver" (and one-word "TrustedRider") copy left in the
# TR app. Prints nothing and exits 0 when clean. See scripts/check-tr-copy.mjs for rules.
# Usage: scripts/check-tr-copy.sh [dir ...]   (default: app components features lib)
cd "$(dirname "$0")/.." || exit 1
status=0
# Native permission strings (shown in iOS system prompts).
if grep -nE '\b[Dd]rivers?\b|\bTrustedRiders?\b' app.json ios/*/Info.plist 2>/dev/null | grep -E '<string>|Description"'; then
  status=1
fi
node scripts/check-tr-copy.mjs "$@" || status=1
exit $status
