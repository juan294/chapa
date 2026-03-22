#!/usr/bin/env bash
# Shared utilities for Chapa scheduled agents.
# Source this file from each agent script.

set -euo pipefail

# ---------------------------------------------------------------------------
# File descriptor limit — Claude Code needs more than the default 256
# that launchd provides. Raise it early so all downstream tools benefit.
# ---------------------------------------------------------------------------
ulimit -n 2147483646 2>/dev/null || ulimit -n 10240 2>/dev/null || true

# ---------------------------------------------------------------------------
# Prevent nested Claude session errors when triggered from an active session.
# Under launchd this is a no-op (CLAUDECODE isn't set).
# ---------------------------------------------------------------------------
unset CLAUDECODE 2>/dev/null || true

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

CHAPA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOGS_DIR="${CHAPA_DIR}/logs"
SHARED_CONTEXT_FILE="${CHAPA_DIR}/docs/agents/shared-context.md"
API_BASE="${CHAPA_API_BASE:-http://localhost:3001}"

mkdir -p "${LOGS_DIR}"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

log_info()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]  $*"; }
log_warn()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARN]  $*" >&2; }
log_error() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*" >&2; }

# ---------------------------------------------------------------------------
# Feature flag check
# ---------------------------------------------------------------------------

# check_agent_enabled <agent_key>
# Returns 0 if both master toggle and individual agent are enabled.
# Returns 1 if explicitly disabled.
# Fail-open: if no API is reachable, proceeds with execution (returns 0).
check_agent_enabled() {
  local agent_key="$1"

  # Try production first, then local dev server.
  # Production is always available; localhost only works when dev server is running.
  local flags_json=""
  local production_url="${CHAPA_PRODUCTION_URL:-https://chapa.thecreativetoken.com}"

  flags_json=$(curl -s --max-time 5 "${production_url}/api/feature-flags" 2>/dev/null) \
    || flags_json=$(curl -s --max-time 5 "${API_BASE}/api/feature-flags" 2>/dev/null) \
    || true

  # Fail-open: if neither API responded, run the agent
  if [ -z "${flags_json}" ]; then
    log_info "Feature flags API unreachable — fail-open, proceeding with execution."
    return 0
  fi

  local master_enabled
  master_enabled=$(echo "${flags_json}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
flags = {f['key']: f['enabled'] for f in data.get('flags', [])}
print('true' if flags.get('automated_agents', False) else 'false')
" 2>/dev/null || echo "true")

  if [ "${master_enabled}" != "true" ]; then
    log_info "Master toggle 'automated_agents' is disabled. Skipping."
    return 1
  fi

  local agent_enabled
  agent_enabled=$(echo "${flags_json}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
flags = {f['key']: f['enabled'] for f in data.get('flags', [])}
print('true' if flags.get('${agent_key}', False) else 'false')
" 2>/dev/null || echo "true")

  if [ "${agent_enabled}" != "true" ]; then
    log_info "Agent '${agent_key}' is disabled. Skipping."
    return 1
  fi

  return 0
}

# ---------------------------------------------------------------------------
# Prompt fetching
# ---------------------------------------------------------------------------

# get_agent_prompt <agent_key>
# Checks DB config for a custom prompt override, falls back to compiled default.
get_agent_prompt() {
  local agent_key="$1"

  # Try to get custom prompt from feature flag config (production first, then local)
  local custom_prompt
  local production_url="${CHAPA_PRODUCTION_URL:-https://chapa.thecreativetoken.com}"
  local prompt_flags_json
  prompt_flags_json=$(curl -s --max-time 5 "${production_url}/api/feature-flags" 2>/dev/null) \
    || prompt_flags_json=$(curl -s --max-time 5 "${API_BASE}/api/feature-flags" 2>/dev/null) \
    || true
  custom_prompt=$(echo "${prompt_flags_json}" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for f in data.get('flags', []):
    if f['key'] == '${agent_key}':
        prompt = f.get('config', {}).get('prompt', '')
        if prompt:
            print(prompt)
            sys.exit(0)
sys.exit(1)
" 2>/dev/null)

  if [ -n "${custom_prompt}" ]; then
    echo "${custom_prompt}"
    return
  fi

  # Fall back to compiled default prompt
  npx tsx "${CHAPA_DIR}/scripts/lib/print-default-prompt.ts" "${agent_key}" 2>/dev/null
}

# ---------------------------------------------------------------------------
# Shared context
# ---------------------------------------------------------------------------

# read_shared_context [exclude_agent]
# Reads shared context file, optionally excluding entries from a specific agent.
read_shared_context() {
  local exclude="${1:-}"

  if [ ! -f "${SHARED_CONTEXT_FILE}" ]; then
    echo ""
    return
  fi

  if [ -z "${exclude}" ]; then
    cat "${SHARED_CONTEXT_FILE}"
  else
    # Remove entries from the excluded agent
    python3 -c "
import sys, re
content = open('${SHARED_CONTEXT_FILE}').read()
pattern = r'<!-- ENTRY:START agent=${exclude} .*?-->.*?<!-- ENTRY:END -->\n?'
cleaned = re.sub(pattern, '', content, flags=re.DOTALL)
print(cleaned.strip())
" 2>/dev/null || cat "${SHARED_CONTEXT_FILE}"
  fi
}

# extract_and_write_shared_context <agent_key> <report_file>
# Extracts SHARED_CONTEXT_START/END block from report and appends to shared context.
extract_and_write_shared_context() {
  local agent_key="$1"
  local report_file="$2"

  if [ ! -f "${report_file}" ]; then
    log_warn "Report file not found: ${report_file}"
    return
  fi

  local entry
  entry=$(python3 -c "
import re, sys
content = open('${report_file}').read()
match = re.search(r'SHARED_CONTEXT_START\n(.*?)SHARED_CONTEXT_END', content, re.DOTALL)
if match:
    print(match.group(1).strip())
else:
    sys.exit(1)
" 2>/dev/null)

  if [ -z "${entry}" ]; then
    log_warn "No shared context block found in ${report_file}"
    return
  fi

  local timestamp
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

  # Append new entry
  {
    echo ""
    echo "<!-- ENTRY:START agent=${agent_key} timestamp=${timestamp} -->"
    echo "${entry}"
    echo "<!-- ENTRY:END -->"
  } >> "${SHARED_CONTEXT_FILE}"

  # Prune old entries
  prune_shared_context "${agent_key}"

  log_info "Shared context updated for ${agent_key}"
}

# prune_shared_context <agent_key>
# Keep only the last 3 entries per agent.
prune_shared_context() {
  local agent_key="$1"

  python3 -c "
import re

with open('${SHARED_CONTEXT_FILE}', 'r') as f:
    content = f.read()

pattern = r'(<!-- ENTRY:START agent=${agent_key} .*?-->.*?<!-- ENTRY:END -->)'
entries = re.findall(pattern, content, re.DOTALL)

if len(entries) <= 3:
    exit(0)

# Remove oldest entries (keep last 3)
for old_entry in entries[:-3]:
    content = content.replace(old_entry, '')

# Clean up extra blank lines
content = re.sub(r'\n{3,}', '\n\n', content)

with open('${SHARED_CONTEXT_FILE}', 'w') as f:
    f.write(content.strip() + '\n')
" 2>/dev/null || log_warn "Failed to prune shared context for ${agent_key}"
}
