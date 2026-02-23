#!/usr/bin/env bash
# Chapa cc-rpi Blueprint Sync Agent — Nightly sync with cc-rpi blueprint.
# Runs via launchd (com.chapa.cc-rpi-update) or manually.
#
# Unlike other Chapa agents, this one does NOT use feature flags or the
# prompt API. It reads instructions directly from the cc-rpi repository
# at runtime, so when cc-rpi improves the /update command, this project
# automatically gets the new logic on the next run.

set -euo pipefail

# ── Configuration ──
CC_RPI_PATH="/Users/juan/Documents/GenAI_Projects/cc-rpi"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOGS_DIR="${PROJECT_ROOT}/logs"
REPORT_FILE="${PROJECT_ROOT}/docs/agents/cc-rpi-update-report.md"
UPDATE_INSTRUCTIONS="${CC_RPI_PATH}/templates/commands/update.md"

mkdir -p "${LOGS_DIR}"
mkdir -p "$(dirname "${REPORT_FILE}")"

# ── Logging ──
log_info()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
log_error() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*" >&2; }

# ── Preflight checks ──

if [ ! -d "${CC_RPI_PATH}" ]; then
  log_error "cc-rpi not found at ${CC_RPI_PATH}"
  exit 1
fi

if [ ! -f "${UPDATE_INSTRUCTIONS}" ]; then
  log_error "Update command not found at ${UPDATE_INSTRUCTIONS}"
  exit 1
fi

# ── Build the prompt ──
# The agent reads the update instructions from cc-rpi at runtime.
# This means when cc-rpi updates the /update command, this script
# automatically uses the new logic without any changes needed here.

PROMPT="You are the cc-rpi-update scheduled agent for this project.

Your job: sync this project with the latest cc-rpi blueprint.

Read and follow the instructions in: ${UPDATE_INSTRUCTIONS}

Important context:
- The cc-rpi blueprint is at: ${CC_RPI_PATH}
- This project is at: ${PROJECT_ROOT}
- Apply all updates non-interactively. Do not ask for confirmation.
- Commit changes when done.
- Write your final summary as your text output (it becomes the report).

If there are no changes needed, just output: 'cc-rpi sync: already up to date as of <version>.'"

# ── Run with retry ──

MAX_RETRIES=2
RETRY_COUNT=0

cd "${PROJECT_ROOT}"
log_info "=== cc-rpi Blueprint Sync starting ==="
log_info "Project: ${PROJECT_ROOT}"
log_info "Blueprint: ${CC_RPI_PATH}"

while [ ${RETRY_COUNT} -lt ${MAX_RETRIES} ]; do
  if claude -p "${PROMPT}" \
    --allowedTools "Read,Write,Edit,Glob,Grep,Bash(git *)" \
    --output-format text \
    > "${REPORT_FILE}" 2>&1; then
    log_info "Report written to ${REPORT_FILE}"
    log_info "=== cc-rpi Blueprint Sync complete ==="
    exit 0
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  log_error "Attempt ${RETRY_COUNT} failed. Retrying in 10s..."
  sleep 10
done

log_error "cc-rpi Blueprint Sync FAILED after ${MAX_RETRIES} attempts"
echo "cc-rpi sync: FAILED after ${MAX_RETRIES} attempts — $(date)" >> "${REPORT_FILE}"
exit 1
