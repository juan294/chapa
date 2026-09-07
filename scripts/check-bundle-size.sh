#!/usr/bin/env bash
# check-bundle-size.sh
# Asserts that no individual client-side JS chunk exceeds the budget (uncompressed).
# This is a fast approximation of per-route First Load JS — Turbopack does not
# emit per-route size tables, so we enforce a per-file ceiling instead.
#
# Usage: bash scripts/check-bundle-size.sh [budget_kb]
# Default budget: 350 KB per file
#
# ONE documented exception (#1319): the AI insights report parser. It is reached
# through a dynamic import (`use-insights-import.ts` -> `lib/insights/parser`
# -> `report-v7` -> zod), so it is fetched only when someone imports a report
# and adds nothing to any page's weight. The budget exists to stop pages
# getting heavy, and this chunk does not make a page heavy, so it is exempted
# explicitly rather than by raising the ceiling for every chunk. See
# docs/accepted-risks.md.
#
# The exemption is bounded: the chunk is identified by a stable literal from
# the insights schema rather than by its content-hashed filename, and it still
# has to stay under EXEMPT_CEILING_KB, so the allowance cannot grow unnoticed.
#
# Exit codes: 0 = pass, 1 = over budget

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEXT_DIR="${SCRIPT_DIR}/../apps/web/.next"
BUDGET_KB="${1:-350}"
BUDGET_BYTES=$(( BUDGET_KB * 1024 ))
EXEMPT_SIGNATURE="claude-code"
EXEMPT_CEILING_KB=400
EXEMPT_CEILING_BYTES=$(( EXEMPT_CEILING_KB * 1024 ))

if [ ! -d "${NEXT_DIR}/static" ]; then
  echo "ERROR: .next/static not found — run pnpm run build first."
  exit 1
fi

FAILED=0
OVER_BUDGET_FILES=()
EXEMPTED=""

while IFS=$'\t' read -r SIZE_BYTES FILE; do
  SIZE_KB=$(( SIZE_BYTES / 1024 ))
  if [ "${SIZE_BYTES}" -le "${BUDGET_BYTES}" ]; then
    continue
  fi
  # The documented exception, and only while it stays under its own ceiling.
  if [ -z "${EXEMPTED}" ] \
    && [ "${SIZE_BYTES}" -le "${EXEMPT_CEILING_BYTES}" ] \
    && grep -q "${EXEMPT_SIGNATURE}" "${FILE}"; then
    EXEMPTED="${FILE} (${SIZE_KB} KB)"
    continue
  fi
  OVER_BUDGET_FILES+=("${FILE} (${SIZE_KB} KB)")
  FAILED=1
done < <(find "${NEXT_DIR}/static" -name "*.js" -type f -print0 \
  | xargs -0 -I{} sh -c 'printf "%s\t%s\n" "$(wc -c < "$1")" "$1"' _ {})

if [ "${FAILED}" -eq 0 ]; then
  # NOTE: `awk 'NR==1'` (not `head -1`) intentionally consumes the entire
  # sorted stream. Under `set -o pipefail`, `sort | head -1` makes `head` close
  # the pipe early, `sort` receives SIGPIPE ("Broken pipe: write error"), and
  # the whole script exits non-zero even though every chunk is under budget.
  LARGEST=$(find "${NEXT_DIR}/static" -name "*.js" -type f -print0 \
    | xargs -0 -I{} sh -c 'printf "%s\t%s\n" "$(wc -c < "$1")" "$1"' _ {} \
    | sort -rn | awk 'NR==1{print int($1/1024)" KB: "$2}')
  echo "PASS: All client JS chunks under ${BUDGET_KB} KB budget."
  echo "Largest: ${LARGEST}"
  if [ -n "${EXEMPTED}" ]; then
    echo "Documented exception (#1319), under its ${EXEMPT_CEILING_KB} KB ceiling:"
    echo "  - ${EXEMPTED}  [lazily imported AI insights report parser]"
  fi
  exit 0
else
  echo "FAIL: The following JS chunks exceed the ${BUDGET_KB} KB budget:"
  for f in "${OVER_BUDGET_FILES[@]}"; do
    echo "  - ${f}"
  done
  exit 1
fi
