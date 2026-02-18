#!/usr/bin/env bash
# Install Chapa scheduled agents into macOS launchd.
#
# Usage:
#   bash scripts/install-agents.sh          # Install and load all agents
#   bash scripts/install-agents.sh --unload # Unload and remove all agents
#
# This script copies the launchd plist files to ~/Library/LaunchAgents/,
# replaces CHAPA_PROJECT_DIR with the actual project path, and loads them.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LAUNCH_AGENTS_DIR="${HOME}/Library/LaunchAgents"

PLISTS=(
  "com.chapa.coverage-agent"
  "com.chapa.security-agent"
  "com.chapa.qa-agent"
  "com.chapa.performance-agent"
  "com.chapa.documentation-agent"
  "com.chapa.cost-analyst"
  "com.chapa.localization-agent"
)

# Ensure logs directory exists
mkdir -p "${PROJECT_DIR}/logs"

unload_agents() {
  echo "Unloading Chapa agents..."
  for plist in "${PLISTS[@]}"; do
    local target="${LAUNCH_AGENTS_DIR}/${plist}.plist"
    if [ -f "${target}" ]; then
      launchctl unload "${target}" 2>/dev/null || true
      rm -f "${target}"
      echo "  Removed ${plist}"
    else
      echo "  ${plist} not installed, skipping"
    fi
  done
  echo "Done."
}

install_agents() {
  echo "Installing Chapa agents to ${LAUNCH_AGENTS_DIR}..."
  echo "Project directory: ${PROJECT_DIR}"
  echo ""

  mkdir -p "${LAUNCH_AGENTS_DIR}"

  for plist in "${PLISTS[@]}"; do
    local source="${SCRIPT_DIR}/launchd/${plist}.plist"
    local target="${LAUNCH_AGENTS_DIR}/${plist}.plist"

    if [ ! -f "${source}" ]; then
      echo "  ERROR: ${source} not found"
      continue
    fi

    # Unload if already loaded
    if [ -f "${target}" ]; then
      launchctl unload "${target}" 2>/dev/null || true
    fi

    # Copy and replace placeholder with actual project path
    sed "s|CHAPA_PROJECT_DIR|${PROJECT_DIR}|g" "${source}" > "${target}"

    # Load the agent
    launchctl load "${target}"
    echo "  Installed and loaded ${plist}"
  done

  echo ""
  echo "All agents installed. Verify with:"
  echo "  launchctl list | grep com.chapa"
  echo ""
  echo "To manually trigger an agent:"
  echo "  launchctl start com.chapa.coverage-agent"
  echo ""
  echo "To uninstall:"
  echo "  bash ${SCRIPT_DIR}/install-agents.sh --unload"
}

# Main
case "${1:-}" in
  --unload|--remove|--uninstall)
    unload_agents
    ;;
  *)
    install_agents
    ;;
esac
