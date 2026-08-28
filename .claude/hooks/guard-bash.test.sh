#!/usr/bin/env bash
# guard-bash.test.sh — table-driven smoke test for .claude/hooks/guard-bash.sh
#
# Not wired into CI. Run manually:
#   bash .claude/hooks/guard-bash.test.sh
#
# Feeds representative commands into guard-bash.sh via the same PreToolUse
# JSON stdin contract the hook expects, and asserts the exit code (0 = allow,
# 2 = block). This targets the Error #44 (--tags) and Error #48 (main/master)
# push guards specifically — see docs/... for the false-positive report that
# prompted this test.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$SCRIPT_DIR/guard-bash.sh"

pass=0
fail=0

# run_case <expect: block|allow> <label> <command>
run_case() {
  local expect="$1" label="$2" command="$3"
  local payload
  payload=$(jq -cn --arg cmd "$command" '{tool_name:"Bash",tool_input:{command:$cmd},session_id:"test"}')
  local out rc
  out=$(printf '%s' "$payload" | CLAUDE_PROJECT_DIR="$SCRIPT_DIR/../.." bash "$HOOK" 2>&1)
  rc=$?
  local actual="allow"
  [[ "$rc" -eq 2 ]] && actual="block"

  if [[ "$actual" == "$expect" ]]; then
    pass=$((pass + 1))
    printf 'PASS  [%s] %s\n' "$expect" "$label"
  else
    fail=$((fail + 1))
    printf 'FAIL  expected=%s actual=%s  [%s]\n      command: %s\n      output: %s\n' \
      "$expect" "$actual" "$label" "$command" "$out"
  fi
}

echo "=== MUST BLOCK (true positives) ==="
run_case block "push --tags"                 "git push --tags"
run_case block "push origin main"            "git push origin main"
run_case block "push -u origin main"         "git push -u origin main"
run_case block "push origin master"          "git push origin master"

echo
echo "=== MUST NOT BLOCK (false positives under old guard) ==="
run_case allow "ls-remote --tags"            "git ls-remote --tags origin"
run_case allow "ls-remote --tags v2.24.0"    "git ls-remote --tags origin 'refs/tags/v2.24.0*'"
run_case allow "pull --quiet origin main"    "git pull --quiet origin main"
run_case allow "push origin develop"         "git push origin develop"
run_case allow "push origin v2.24.0 (tag)"   "git push origin v2.24.0"
run_case allow "push main --follow-tags"     "git push origin main --follow-tags"
run_case allow "rev-parse origin/main"       "git rev-parse origin/main"
run_case allow "echo mentioning main"        'echo "main -> x"'
run_case allow "fetch origin main"           "git fetch origin main"

echo
echo "=== Compound commands (the actual reported false positives) ==="
# A release one-liner: push the tag, then verify it landed via ls-remote.
# The old whole-string "--tags" check fired on the ls-remote clause even
# though the push itself never used --tags.
run_case allow "push tag && verify via ls-remote" \
  "git push origin v2.24.0 && git ls-remote --tags origin 'refs/tags/v2.24.0*'"
# A pull from main followed by a push to a non-protected branch. The old
# whole-string main|master regex fired on the unrelated pull clause.
run_case allow "pull main && push develop" \
  "git pull --quiet origin main && git push origin develop"
# Sanity: a compound command that legitimately pushes to main must still block.
run_case block "unrelated cmd && push origin main" \
  "git fetch origin && git push origin main"
# Sanity: a compound command with a real --tags push must still block even
# when chained with something else.
run_case block "push --tags && echo done" \
  "git push --tags && echo done"

echo
echo "-----------------------------------------"
echo "pass=$pass fail=$fail"
[[ "$fail" -eq 0 ]]
