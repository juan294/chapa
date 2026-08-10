#!/usr/bin/env bash
# Chapa Coverage Agent — Daily test coverage analysis.
# Runs via launchd (com.chapa.coverage-agent) or manually.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/lib/agent-utils.sh"

AGENT_KEY="coverage_agent"
MODEL="claude-haiku-4-5-20251001"
OUTPUT_FILE="${CHAPA_DIR}/docs/agents/coverage-report.md"
LOG_FILE="${LOGS_DIR}/coverage-agent-$(date '+%Y-%m-%d').log"
CLAUDE_MAX_ATTEMPTS=3
CLAUDE_RETRY_DELAY_SECONDS=30

log_info "=== Coverage Agent starting ==="

# Check if agent is enabled
if ! check_agent_enabled "${AGENT_KEY}"; then
  exit 0
fi

# Get prompt (DB override or compiled default)
PROMPT=$(get_agent_prompt "${AGENT_KEY}")
if [ -z "${PROMPT}" ]; then
  log_error "Failed to get prompt for ${AGENT_KEY}"
  exit 1
fi

# Read shared context from other agents
SHARED_CONTEXT=$(read_shared_context "${AGENT_KEY}")
if [ -n "${SHARED_CONTEXT}" ]; then
  PROMPT="${PROMPT}

--- Cross-Agent Context ---
${SHARED_CONTEXT}"
fi

log_info "Running Claude headless mode..."

# Run Claude in headless mode. Write to a temp file first so transient API
# failures never replace the last valid report with an error stub.
cd "${CHAPA_DIR}"
acquire_agent_lock "vitest-heavy-agent" "coverage-agent"
trap 'release_agent_lock "vitest-heavy-agent"' EXIT

TMP_OUTPUT=$(mktemp)
claude_ok=false
for attempt in $(seq 1 "${CLAUDE_MAX_ATTEMPTS}"); do
  if claude -p "${PROMPT}" \
    --model "${MODEL}" \
    --allowedTools "Read,Glob,Grep,Bash" \
    --output-format text \
    > "${TMP_OUTPUT}" 2>>"${LOG_FILE}" && validate_report_file "${TMP_OUTPUT}" "coverage-agent"; then
    claude_ok=true
    break
  fi

  if [ "${attempt}" -lt "${CLAUDE_MAX_ATTEMPTS}" ]; then
    log_warn "Claude execution failed; retrying after ${CLAUDE_RETRY_DELAY_SECONDS}s"
    sleep "${CLAUDE_RETRY_DELAY_SECONDS}"
  fi
done

if [ "${claude_ok}" != "true" ]; then
  rm -f "${TMP_OUTPUT}"
  log_error "Claude execution failed after ${CLAUDE_MAX_ATTEMPTS} attempts. Check ${LOG_FILE}"
  exit 1
fi

mv "${TMP_OUTPUT}" "${OUTPUT_FILE}"
release_agent_lock "vitest-heavy-agent"
trap - EXIT

log_info "Report written to ${OUTPUT_FILE}"

validate_report_file "${OUTPUT_FILE}" "coverage-agent"

# Extract shared context and update shared file
extract_and_write_shared_context "${AGENT_KEY}" "${OUTPUT_FILE}"

log_info "=== Coverage Agent complete ==="
