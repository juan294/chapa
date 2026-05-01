#!/usr/bin/env bash
# scripts/check-craft-propagation.sh
#
# CI grep guard for issue #680.
#
# Three v2.7.x bugs shipped because no test enforced the invariant:
#   "every call to computeImpactV6 must pass craft as the second argument."
#
# This script greps the non-test source tree for any single-argument call to
# computeImpactV6 and exits non-zero if it finds one not on the documented
# opt-out list. The matching test
# (apps/web/lib/impact/craft-propagation.test.ts) enforces the same invariant
# during pnpm run test; this script is its standalone CI-shell-friendly twin.
#
# Usage:
#   bash scripts/check-craft-propagation.sh
#
# Exit codes:
#   0 — no offenders
#   1 — at least one call site missing craft (or a tooling failure)

set -euo pipefail

# Allowlist of files that may legitimately call computeImpactV6 with one arg.
# Each entry MUST come with a comment explaining why craft is omitted.
# Keep this list in sync with CRAFT_OPTOUTS in
# apps/web/lib/impact/craft-propagation.test.ts.
ALLOWED=(
  # Cache warm only: result is discarded; the badge route reads craft via
  # materializeProfile, so the user-visible badge is unaffected.
  "apps/web/app/api/generate/route.ts"
  # Studio preview computes a same-day display from primary stats; the share
  # page (which goes through materializePublicProfile) is the source of truth.
  "apps/web/app/studio/page.tsx"
)

# Resolve repo root (this script lives at <repo>/scripts/).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

echo "[check-craft-propagation] scanning apps/ and packages/ for computeImpactV6 call sites..."

# Recursive grep for the function name. We do not try to do balanced-paren
# parsing in bash — Python (preinstalled on macOS, Ubuntu, and the GitHub
# Actions runners) handles that. Bash regex cannot reliably detect top-level
# commas inside arbitrary call expressions.
RAW_HITS=$(grep -RHn --include='*.ts' --include='*.tsx' \
  --exclude-dir=node_modules \
  --exclude-dir=node_modules.nosync \
  --exclude-dir=.next \
  --exclude-dir=.turbo \
  --exclude-dir=.git \
  --exclude-dir=.worktrees \
  --exclude-dir=coverage \
  --exclude-dir=dist \
  --exclude-dir=build \
  -E 'computeImpactV6[[:space:]]*\(' apps packages || true)

if [ -z "${RAW_HITS}" ]; then
  echo "[check-craft-propagation] no call sites found — this is suspicious. Failing safe."
  exit 1
fi

# Run the analyzer in a subshell with the input via env var and the allowlist
# as positional args. This avoids stdin/heredoc collisions in the parent shell.
PY_ANALYZER="${SCRIPT_DIR}/lib/check-craft-propagation.py"
if [ ! -f "${PY_ANALYZER}" ]; then
  echo "[check-craft-propagation] ERROR: missing analyzer at ${PY_ANALYZER}"
  exit 1
fi

OFFENDERS=$(CRAFT_GUARD_INPUT="${RAW_HITS}" python3 "${PY_ANALYZER}" "${ALLOWED[@]+"${ALLOWED[@]}"}")

if [ -n "${OFFENDERS}" ]; then
  echo
  echo "[check-craft-propagation] FAIL — computeImpactV6 called without craft:"
  echo "${OFFENDERS}" | sed 's/^/  - /'
  echo
  echo "Each call to computeImpactV6 must pass the craft score as the second"
  echo "argument (or be added to the ALLOWED list with justification). This"
  echo "guard exists because three v2.7.x production bugs shipped from a"
  echo "single-arg call. See issue #680."
  exit 1
fi

echo "[check-craft-propagation] OK — every computeImpactV6 call site passes craft (or is on the allowlist)."
