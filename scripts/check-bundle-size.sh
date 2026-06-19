#!/usr/bin/env bash
# check-bundle-size.sh
# Asserts that no individual client-side JS chunk exceeds the budget (uncompressed).
# This is a fast approximation of per-route First Load JS — Turbopack does not
# emit per-route size tables, so we enforce a per-file ceiling instead.
#
# Usage: bash scripts/check-bundle-size.sh [budget_kb]
# Default budget: 350 KB per file (well above current largest ~233 KB)
#
# Exit codes: 0 = pass, 1 = over budget

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NEXT_DIR="${SCRIPT_DIR}/../apps/web/.next"
BUDGET_KB="${1:-350}"
BUDGET_BYTES=$(( BUDGET_KB * 1024 ))

if [ ! -d "${NEXT_DIR}/static" ]; then
  echo "ERROR: .next/static not found — run pnpm run build first."
  exit 1
fi

FAILED=0
OVER_BUDGET_FILES=()

while IFS=$'\t' read -r SIZE_BYTES FILE; do
  SIZE_KB=$(( SIZE_BYTES / 1024 ))
  if [ "${SIZE_BYTES}" -gt "${BUDGET_BYTES}" ]; then
    OVER_BUDGET_FILES+=("${FILE} (${SIZE_KB} KB)")
    FAILED=1
  fi
done < <(find "${NEXT_DIR}/static" -name "*.js" -type f -print0 \
  | xargs -0 -I{} sh -c 'printf "%s\t%s\n" "$(wc -c < "$1")" "$1"' _ {})

if [ "${FAILED}" -eq 0 ]; then
  LARGEST=$(find "${NEXT_DIR}/static" -name "*.js" -type f -print0 \
    | xargs -0 -I{} sh -c 'printf "%s\t%s\n" "$(wc -c < "$1")" "$1"' _ {} \
    | sort -rn | head -1 | awk '{print int($1/1024)" KB: "$2}')
  echo "PASS: All client JS chunks under ${BUDGET_KB} KB budget."
  echo "Largest: ${LARGEST}"
  exit 0
else
  echo "FAIL: The following JS chunks exceed the ${BUDGET_KB} KB budget:"
  for f in "${OVER_BUDGET_FILES[@]}"; do
    echo "  - ${f}"
  done
  exit 1
fi
