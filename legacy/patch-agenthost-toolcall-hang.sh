#!/usr/bin/env bash
# Patch/revert the Claude client-tool completion race in a devcontainer's
# VS Code server (the agent host), so the fix can be tested without a build.
#
# Bug: Claude's `completeClientToolCall` uses `PendingRequestRegistry.respond`,
# which DROPS the result when no deferred is parked yet. The SDK's in-process
# MCP handler ("mcp__client__<tool>") and the workbench completion race, so a
# completion can legitimately arrive first. When it does, the handler awaits a
# promise that never settles: the tool visibly succeeds, nothing is logged, and
# the turn hangs forever. The Copilot and Codex agents already use the
# race-safe `respondOrBuffer` on their equivalent round-trip; Claude is the
# only one that does not.
#
# Patch: buffer instead of dropping, preserving the boolean return.
# `_earlyResults` is bounded, `rejectAll` clears it on rebind and dispose.
#
# Usage:
#   ./patch-agenthost-toolcall-hang.sh status
#   ./patch-agenthost-toolcall-hang.sh apply
#   ./patch-agenthost-toolcall-hang.sh revert
#
# Then REBUILD/reopen the devcontainer window (the server process must restart).
set -euo pipefail

VOLUME="${AGENTHOST_VOLUME:-vscode}"
ACTION="${1:-status}"
REL="out/vs/platform/agentHost/node/agentHostMain.js"

OLD='completeClientToolCall(e,t){let o=yN(t,e);return this._pendingClientToolCalls.respond(e,o)}'
NEW='completeClientToolCall(e,t){let o=yN(t,e);const __hadPending=this._pendingClientToolCalls.has(e);this._pendingClientToolCalls.respondOrBuffer(e,o);return __hadPending}'

docker run --rm -i -v "$VOLUME":/v alpine sh -s "$ACTION" "$REL" "$OLD" "$NEW" <<'INNER'
set -eu
action="$1"; rel="$2"; old="$3"; new="$4"
found=0
for dir in /v/vscode-server/bin/*/*/; do
  f="$dir$rel"
  [ -f "$f" ] || continue
  # Only bundles that contain the unpatched or patched site are relevant.
  if grep -qF "$old" "$f"; then state="unpatched"
  elif grep -qF "$new" "$f"; then state="PATCHED"
  else continue; fi
  found=$((found+1))
  short=$(basename "$dir")
  case "$action" in
    status)
      echo "  $short: $state  (backup: $([ -f "$f.prepatch" ] && echo yes || echo no))"
      ;;
    apply)
      if [ "$state" = "PATCHED" ]; then echo "  $short: already patched"; continue; fi
      n=$(grep -oF "$old" "$f" | wc -l)
      if [ "$n" -ne 1 ]; then echo "  $short: ABORT, expected 1 occurrence, found $n"; continue; fi
      [ -f "$f.prepatch" ] || cp "$f" "$f.prepatch"
      # Use awk for a literal, single-occurrence replacement (sed would treat
      # the payload as a regex and choke on the braces/dots).
      awk -v old="$old" -v new="$new" '
        { i = index($0, old); if (i > 0) { $0 = substr($0,1,i-1) new substr($0,i+length(old)) } print }
      ' "$f" > "$f.tmp" && mv "$f.tmp" "$f"
      echo "  $short: PATCHED (backup at $(basename "$f").prepatch)"
      ;;
    revert)
      if [ -f "$f.prepatch" ]; then cp "$f.prepatch" "$f"; echo "  $short: reverted"; else echo "  $short: no backup"; fi
      ;;
  esac
done
[ "$found" -gt 0 ] || echo "  no matching agent host bundle found in volume"
INNER
