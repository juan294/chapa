#!/usr/bin/env bash
# Chapa Documentation Agent — Weekly docs freshness & completeness audit.
# Runs via launchd (com.chapa.documentation-agent) or manually.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/lib/agent-utils.sh"

AGENT_KEY="documentation_agent"
MODEL="claude-haiku-4-5-20251001"
OUTPUT_FILE="${CHAPA_DIR}/docs/agents/documentation-report.md"
LOG_FILE="${LOGS_DIR}/documentation-agent-$(date '+%Y-%m-%d').log"

log_info "=== Documentation Agent starting ==="

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

# Run Claude in headless mode. Publish only validated output so a failed run
# cannot replace the last good report.
cd "${CHAPA_DIR}"
TMP_OUTPUT=$(create_report_temp "${OUTPUT_FILE}")
trap 'rm -f "${TMP_OUTPUT}"' EXIT
claude -p "${PROMPT}" \
  --model "${MODEL}" \
  --allowedTools "Read,Glob,Grep,Bash" \
  --output-format text \
  > "${TMP_OUTPUT}" 2>>"${LOG_FILE}" || {
    log_error "Claude execution failed. Check ${LOG_FILE}"
    exit 1
  }

publish_report_file "${TMP_OUTPUT}" "${OUTPUT_FILE}" "documentation-agent"
trap - EXIT

# Extract shared context and update shared file
extract_and_write_shared_context "${AGENT_KEY}" "${OUTPUT_FILE}"

log_info "Report written to ${OUTPUT_FILE}"
log_info "=== Documentation Agent complete ==="
