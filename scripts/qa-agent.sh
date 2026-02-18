#!/usr/bin/env bash
# Chapa QA Agent — Weekly quality assurance audit.
# Runs via launchd (com.chapa.qa-agent) or manually.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/lib/agent-utils.sh"

AGENT_KEY="qa_agent"
OUTPUT_FILE="${CHAPA_DIR}/docs/agents/qa-report.md"
LOG_FILE="${LOGS_DIR}/qa-agent-$(date '+%Y-%m-%d').log"

log_info "=== QA Agent starting ==="

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

# Run Claude in headless mode
cd "${CHAPA_DIR}"
claude -p "${PROMPT}" \
  --allowedTools "Read,Glob,Grep,Bash" \
  --output-format text \
  > "${OUTPUT_FILE}" 2>>"${LOG_FILE}" || {
    log_error "Claude execution failed. Check ${LOG_FILE}"
    exit 1
  }

log_info "Report written to ${OUTPUT_FILE}"

# Extract shared context and update shared file
extract_and_write_shared_context "${AGENT_KEY}" "${OUTPUT_FILE}"

log_info "=== QA Agent complete ==="
