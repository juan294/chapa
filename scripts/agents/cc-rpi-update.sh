#!/usr/bin/env bash
# scripts/agents/cc-rpi-update.sh
#
# Nightly cc-rpi blueprint sync agent.
# Checks for blueprint updates and applies them automatically.
# Produces a report at docs/agents/cc-rpi-update-report.md.
#
# SCHEDULE: daily 03:30

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/lib/agent-utils.sh"

AGENT_NAME="cc-rpi-update"
REPORT_FILE="${AGENTS_DIR}/cc-rpi-update-report.md"

log_info "Starting ${AGENT_NAME} agent"

# Preflight
preflight_claude

PROMPT="You are the nightly cc-rpi blueprint sync agent for chapa.
Working directory: ${PROJECT_DIR}

Run the /update command to sync this project with the latest cc-rpi blueprint.

The /update command will:
1. Pull the latest cc-rpi from /Users/juan/Documents/code/cc-rpi
2. Check if there are updates since the last sync
3. Update slash commands, CLAUDE.md sections, and settings.json
4. Commit changes if any

If the blueprint is already up to date, report 'Already up to date' and stop.

Write your output as a report summarizing what was updated (or that nothing changed).

Important:
- This is a non-interactive scheduled run — do not ask for confirmation.
- Only commit to the develop branch. Never touch main.
- If there are merge conflicts or issues, report them but do not force anything."

log_info "Running Claude CLI for cc-rpi update..."

if "$CLAUDE_BIN" -p "$PROMPT" \
  --allowedTools "Read,Write,Edit,Glob,Grep,Bash(git *),Bash(gh *),Bash(pnpm *)" \
  --output-format text \
  > "${REPORT_FILE}" 2>"${LOGS_DIR}/${AGENT_NAME}.error.log"; then

  log_info "cc-rpi update completed successfully"

  # Extract and write shared context if present
  extract_and_write_shared_context "${AGENT_NAME}" "${REPORT_FILE}"
else
  log_error "cc-rpi update failed (exit code: $?)"
  exit 1
fi

log_info "${AGENT_NAME} agent finished"
