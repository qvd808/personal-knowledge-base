#!/usr/bin/env bash
#
# SessionStart hook: force the current CLAUDE.md into context at every session
# start, read fresh from disk. The auto-loaded copy can lag the file or be
# trimmed; this guarantees the real rules (read-only default, approval gate)
# are present before any tool call.
#
# Portable: resolves the repo root from $CLAUDE_PROJECT_DIR (set by Claude
# Code), so copying .claude/ + CLAUDE.md to another repo works unchanged.
# Requires: jq.
set -uo pipefail

md="${CLAUDE_PROJECT_DIR:-$(pwd)}/CLAUDE.md"
[[ -f "$md" ]] || exit 0

jq -n --rawfile body "$md" '{
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: ("MANDATORY project rules from CLAUDE.md — read before any tool call:\n\n" + $body)
  }
}'
exit 0
