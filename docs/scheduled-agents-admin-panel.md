# Scheduled AI Agent System — Implementation Template

> A reusable blueprint for building a fleet of scheduled Claude agents with a shared context workspace, admin dashboard, and manual run capabilities.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Agent Shell Scripts](#agent-shell-scripts)
3. [Shared Utilities Library](#shared-utilities-library)
4. [Shared Context System](#shared-context-system)
5. [Agent Prompts & Configuration](#agent-prompts--configuration)
6. [Feature Flags for Agent Control](#feature-flags-for-agent-control)
7. [Scheduling with macOS launchd](#scheduling-with-macos-launchd)
8. [Admin API Routes](#admin-api-routes)
9. [Admin Dashboard UI](#admin-dashboard-ui)
10. [Report Format Convention](#report-format-convention)
11. [Manual Run & Terminal Streaming](#manual-run--terminal-streaming)
12. [Directory Structure](#directory-structure)

---

## Architecture Overview

```
┌────────────────────┐
│   macOS launchd     │  Schedules agent scripts (daily/weekly)
│   (local machine)   │  Fires even if the Mac was asleep (catches up)
└────────┬───────────┘
         │ spawns
         ▼
┌────────────────────┐     ┌─────────────────────┐
│  Agent Shell Script │────▶│  Claude CLI (headless)│
│  (bash)             │     │  -p "prompt"          │
└────────┬───────────┘     └──────────┬────────────┘
         │                            │ writes
         │                            ▼
         │                 ┌─────────────────────┐
         │                 │  docs/agents/        │
         │                 │  ├── report-name.md  │  Individual report
         │                 │  └── shared-context.md│  Cross-agent intel
         │                 └─────────────────────┘
         │                            ▲ reads
         │                            │
┌────────┴───────────┐     ┌─────────┴───────────┐
│  Admin API Routes   │────▶│  Admin Dashboard UI  │
│  (Next.js / Express)│     │  (React)             │
└────────────────────┘     └─────────────────────┘
```

**Key idea**: Each agent is a standalone bash script that invokes the [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) in headless mode (`claude -p "prompt"`). Agents write markdown reports to disk. An admin panel reads those reports and displays health status, shared insights, and a live terminal for manual runs.

---

## Agent Shell Scripts

Each agent is a bash script following this pattern:

```bash
#!/bin/bash
# scripts/my-agent.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load shared utilities
source "$SCRIPT_DIR/lib/agent-utils.sh"

AGENT_KEY="my_agent"       # Must match the feature flag key
REPORT_FILE="docs/agents/my-agent-report.md"

# ── 1. Check if agent is enabled via feature flags ──
check_agent_enabled "$AGENT_KEY"

# ── 2. Fetch the agent prompt (DB override or compiled default) ──
PROMPT=$(get_agent_prompt "$AGENT_KEY")

# ── 3. Read shared context from other agents ──
SHARED_CONTEXT=$(read_shared_context "$AGENT_KEY")

# ── 4. Build the full prompt ──
FULL_PROMPT="$PROMPT

## Context from Other Agents
$SHARED_CONTEXT

$(get_shared_context_write_instruction)"

# ── 5. Run Claude CLI in headless mode ──
cd "$PROJECT_ROOT"
log_info "Starting $AGENT_KEY agent..."

claude -p "$FULL_PROMPT" \
  --allowedTools "Read,Glob,Grep,Bash(npm run test*),Bash(npx vitest*)" \
  --output-format text \
  > "$REPORT_FILE" 2>&1

# ── 6. Extract shared context block and append to shared workspace ──
extract_and_write_shared_context "$AGENT_KEY" "$REPORT_FILE"

log_info "$AGENT_KEY agent complete."
```

### Key Points

- **`--allowedTools`**: Restrict which tools each agent can use. A security agent might get `Bash(npm audit*)` and `Bash(curl*)`. A coverage agent might get `Bash(npx vitest*)`. Lock it down to the minimum needed.
- **`--output-format text`**: Writes the raw markdown output to the report file.
- **Exit gracefully**: If the feature flag is off, `check_agent_enabled` exits 0 (not an error).

---

## Shared Utilities Library

Create `scripts/lib/agent-utils.sh` with these core functions:

```bash
#!/bin/bash
# scripts/lib/agent-utils.sh — Shared functions for all agents

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SHARED_CONTEXT_FILE="$PROJECT_ROOT/docs/agents/shared-context.md"
LOGS_DIR="$PROJECT_ROOT/logs"

mkdir -p "$LOGS_DIR"

# ── Logging ──

log_info()  { echo "[$(date '+%H:%M:%S')] INFO:  $*"; }
log_warn()  { echo "[$(date '+%H:%M:%S')] WARN:  $*" >&2; }
log_error() { echo "[$(date '+%H:%M:%S')] ERROR: $*" >&2; }

# ── Feature Flag Check ──
# Checks both the master toggle and the individual agent flag.
# Exits 0 (gracefully) if disabled.

check_agent_enabled() {
  local agent_key="$1"
  local flags_url="${FLAGS_API_URL:-https://yoursite.com/api/feature-flags}"

  # Check master toggle
  local master_enabled
  master_enabled=$(curl -sf "$flags_url" | python3 -c "
import sys, json
flags = json.load(sys.stdin)
for f in flags:
    if f['key'] == 'automated_agents':
        print('true' if f['enabled'] else 'false')
        sys.exit(0)
print('false')
" 2>/dev/null || echo "false")

  if [ "$master_enabled" != "true" ]; then
    log_info "Master agent toggle is OFF. Exiting."
    exit 0
  fi

  # Check individual agent flag
  local agent_enabled
  agent_enabled=$(curl -sf "$flags_url" | python3 -c "
import sys, json
flags = json.load(sys.stdin)
for f in flags:
    if f['key'] == '$agent_key':
        print('true' if f['enabled'] else 'false')
        sys.exit(0)
print('false')
" 2>/dev/null || echo "false")

  if [ "$agent_enabled" != "true" ]; then
    log_info "$agent_key is disabled. Exiting."
    exit 0
  fi
}

# ── Prompt Fetching ──
# Tries to fetch a custom prompt from the DB (via feature flag config).
# Falls back to the compiled-in default.

get_agent_prompt() {
  local agent_key="$1"
  local flags_url="${FLAGS_API_URL:-https://yoursite.com/api/feature-flags}"

  local db_prompt
  db_prompt=$(curl -sf "$flags_url" | python3 -c "
import sys, json
flags = json.load(sys.stdin)
for f in flags:
    if f['key'] == '$agent_key':
        config = f.get('config') or {}
        prompt = config.get('prompt', '')
        if prompt.strip():
            print(prompt)
            sys.exit(0)
sys.exit(1)
" 2>/dev/null)

  if [ $? -eq 0 ] && [ -n "$db_prompt" ]; then
    echo "$db_prompt"
  else
    get_default_prompt "$agent_key"
  fi
}

get_default_prompt() {
  local agent_key="$1"
  npx tsx "$SCRIPT_DIR/print-default-prompt.ts" "$agent_key"
}

# ── Shared Context ──

read_shared_context() {
  local agent_key="$1"
  if [ ! -f "$SHARED_CONTEXT_FILE" ]; then
    echo "(No shared context available yet.)"
    return
  fi
  # Return all entries EXCEPT this agent's own
  python3 -c "
import re, sys
content = open('$SHARED_CONTEXT_FILE').read()
pattern = r'<!-- ENTRY:START agent=$agent_key .*?-->.*?<!-- ENTRY:END -->'
filtered = re.sub(pattern, '', content, flags=re.DOTALL).strip()
print(filtered if filtered else '(No context from other agents yet.)')
"
}

get_shared_context_write_instruction() {
  cat <<'INSTRUCTION'
## Shared Context Output

At the END of your report, include a block for other agents to reference.
Format it EXACTLY like this:

SHARED_CONTEXT_START
## [Your Agent Name] — [YYYY-MM-DD]
- Key finding 1
- Key finding 2 (with metrics if available)

**Cross-agent recommendations:**
- [Other Agent]: suggestion based on your findings
SHARED_CONTEXT_END
INSTRUCTION
}

extract_and_write_shared_context() {
  local agent_key="$1"
  local report_file="$2"
  local timestamp
  timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Extract the SHARED_CONTEXT block
  local context_block
  context_block=$(sed -n '/SHARED_CONTEXT_START/,/SHARED_CONTEXT_END/p' "$report_file" \
    | sed '1d;$d')  # Strip the START/END markers

  if [ -n "$context_block" ]; then
    # Append tagged entry
    {
      echo ""
      echo "<!-- ENTRY:START agent=$agent_key timestamp=$timestamp -->"
      echo "$context_block"
      echo "<!-- ENTRY:END -->"
    } >> "$SHARED_CONTEXT_FILE"

    # Prune to keep only last N entries per agent
    prune_shared_context 3

    # Strip the block from the report
    python3 -c "
import re
content = open('$report_file').read()
cleaned = re.sub(r'SHARED_CONTEXT_START.*?SHARED_CONTEXT_END', '', content, flags=re.DOTALL).strip()
open('$report_file', 'w').write(cleaned + '\n')
"
    log_info "Shared context updated for $agent_key."
  fi
}

prune_shared_context() {
  local max_per_agent="${1:-3}"
  python3 -c "
import re
content = open('$SHARED_CONTEXT_FILE').read()
entries = re.findall(r'(<!-- ENTRY:START agent=(\S+) timestamp=(\S+) -->.*?<!-- ENTRY:END -->)', content, re.DOTALL)

# Group by agent, keep only latest N per agent
from collections import defaultdict
by_agent = defaultdict(list)
for full_match, agent, ts in entries:
    by_agent[agent].append((ts, full_match))

result = []
for agent, items in by_agent.items():
    items.sort(key=lambda x: x[0], reverse=True)
    for ts, entry in items[:$max_per_agent]:
        result.append((ts, entry))

result.sort(key=lambda x: x[0])
open('$SHARED_CONTEXT_FILE', 'w').write('\n'.join(e for _, e in result) + '\n')
"
}
```

---

## Shared Context System

The shared context is the mechanism by which agents communicate findings to each other asynchronously.

### File: `docs/agents/shared-context.md`

```markdown
<!-- ENTRY:START agent=security_scanner timestamp=2026-02-17T09:00:00Z -->
## Security Scanner — 2026-02-17
- No critical CVEs found in dependencies
- CSP headers validated, all policies enforced
- Rate limiting active on all public endpoints

**Cross-agent recommendations:**
- Performance Agent: CSP evaluation-time overhead is negligible
- QA Agent: Test the new rate-limit error page (429 response)
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage_agent timestamp=2026-02-18T02:00:00Z -->
## Coverage Agent — 2026-02-18
- Overall coverage: 74.2% (+1.1% from last run)
- Uncovered critical path: payment webhook handler
- 3 new test files added for auth module

**Cross-agent recommendations:**
- Security Agent: Payment webhook lacks test coverage — potential risk
- QA Agent: Auth module now has full unit coverage, ready for E2E
<!-- ENTRY:END -->
```

### How It Flows

1. **Before running**: Each agent reads all entries *except its own* via `read_shared_context`.
2. **During execution**: Claude sees what other agents discovered and can factor it in.
3. **After running**: The agent's shared context block is extracted, tagged with a timestamp, and appended.
4. **Pruning**: Only the last N entries (default: 3) per agent are kept to prevent unbounded growth.

### Why This Matters

Without shared context, agents operate in silos. With it:
- The security agent can warn the coverage agent about untested critical paths.
- The QA agent can prioritize testing areas flagged by the performance agent.
- The cost analyst can correlate spending spikes with deployment patterns found by CI agents.

---

## Agent Prompts & Configuration

### Default Prompts (TypeScript)

Create a single source of truth for all agent metadata:

```typescript
// src/config/agent-prompts.ts

export interface AgentConfig {
  key: string;
  label: string;
  schedule: string;           // Human-readable schedule
  outputFile: string;         // Path relative to project root
  defaultPrompt: string;      // The full system prompt for Claude
  allowedTools: string[];     // Claude CLI --allowedTools
}

export const AGENTS: Record<string, AgentConfig> = {
  coverage_agent: {
    key: 'coverage_agent',
    label: 'Coverage Agent',
    schedule: 'Daily at 2:00 AM',
    outputFile: 'docs/agents/coverage-report.md',
    defaultPrompt: `You are a test coverage analyst for [Project Name].

Your job:
1. Run the test suite with coverage enabled
2. Identify modules with coverage below 70%
3. Flag recently changed files with no test coverage
4. Recommend specific tests to write

Output a markdown report with:
## Health Status: GREEN | YELLOW | RED
## Executive Summary
## Coverage by Module
## Uncovered Critical Paths
## Recommendations`,
    allowedTools: [
      'Read', 'Glob', 'Grep',
      'Bash(npx vitest --coverage*)',
      'Bash(git log*)',
    ],
  },

  security_scanner: {
    key: 'security_scanner',
    label: 'Security Scanner',
    schedule: 'Weekly on Monday at 9:00 AM',
    outputFile: 'docs/agents/security-report.md',
    defaultPrompt: `You are a security auditor for [Project Name].
...`,
    allowedTools: [
      'Read', 'Glob', 'Grep',
      'Bash(npm audit*)',
      'Bash(curl*)',
    ],
  },

  // Add more agents as needed...
};

export const AGENT_PROMPT_DEFAULTS: Record<string, string> = Object.fromEntries(
  Object.values(AGENTS).map(a => [a.key, a.defaultPrompt])
);
```

### Bridge Script (TypeScript → Bash)

```typescript
// scripts/lib/print-default-prompt.ts
import { AGENT_PROMPT_DEFAULTS } from '../../src/config/agent-prompts';

const key = process.argv[2];
if (!key || !AGENT_PROMPT_DEFAULTS[key]) {
  console.error(`Unknown agent key: ${key}`);
  process.exit(1);
}
console.log(AGENT_PROMPT_DEFAULTS[key]);
```

This lets the bash scripts fetch the compiled-in default prompt without duplicating it.

---

## Feature Flags for Agent Control

Agents are toggled on/off via feature flags stored in the database.

### Schema

```sql
CREATE TABLE feature_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  enabled     BOOLEAN DEFAULT false,
  description TEXT,
  config      JSONB DEFAULT '{}',   -- { prompt?: string, ... }
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Master toggle
INSERT INTO feature_flags (key, enabled, description)
VALUES ('automated_agents', true, 'Master toggle for all scheduled agents');

-- Individual agent flags
INSERT INTO feature_flags (key, enabled, description, config)
VALUES
  ('coverage_agent', true, 'Daily test coverage report', '{}'),
  ('security_scanner', true, 'Weekly security audit', '{}'),
  ('qa_agent', true, 'Weekly QA report', '{}');
```

### API Endpoint

```
GET /api/feature-flags          → Returns all flags (public, read-only)
PATCH /api/admin/feature-flags  → Toggle flags, update config (admin-only)
```

The `config.prompt` field allows admins to override the default prompt from the dashboard without redeploying code.

---

## Scheduling with macOS launchd

### Why launchd (not cron)

- **Catch-up execution**: If the Mac was asleep when a job was scheduled, launchd runs it when it wakes up. `cron` silently skips it.
- **Logging**: Built-in stdout/stderr redirection.
- **Process management**: launchd can restart failed jobs.

### Plist Template

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.yourproject.coverage-agent</string>

  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/path/to/project/scripts/coverage-agent.sh</string>
  </array>

  <!-- Daily at 2:00 AM -->
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>2</integer>
    <key>Minute</key>
    <integer>0</integer>
    <!-- Add <key>Weekday</key><integer>1</integer> for weekly (Monday) -->
  </dict>

  <key>WorkingDirectory</key>
  <string>/path/to/project</string>

  <key>StandardOutPath</key>
  <string>/path/to/project/logs/coverage-agent-launchd.log</string>

  <key>StandardErrorPath</key>
  <string>/path/to/project/logs/coverage-agent-launchd-err.log</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:~/.local/bin</string>
  </dict>
</dict>
</plist>
```

### Installation

```bash
# Copy plist to LaunchAgents
cp scripts/launchd/com.yourproject.coverage-agent.plist ~/Library/LaunchAgents/

# Load (activate)
launchctl load ~/Library/LaunchAgents/com.yourproject.coverage-agent.plist

# Manual trigger (for testing)
launchctl start com.yourproject.coverage-agent

# Unload (deactivate)
launchctl unload ~/Library/LaunchAgents/com.yourproject.coverage-agent.plist
```

### Schedule Reference

| Interval | Keys needed |
|----------|-------------|
| Every day at 2 AM | `Hour: 2, Minute: 0` |
| Weekly Monday 9 AM | `Weekday: 1, Hour: 9, Minute: 0` |
| Every hour | `Minute: 0` |
| Every 6 hours | Use `StartInterval` (seconds): `21600` |

---

## Admin API Routes

### GET /api/admin/agents-summary

Returns structured data for the dashboard by reading all report files from disk.

```typescript
// Pseudocode — adapt to your framework

interface AgentStatus {
  key: string;
  label: string;
  schedule: string;
  enabled: boolean;
  health: 'green' | 'yellow' | 'red' | 'unknown';
  healthSummary: string;
  lastRun: string | null;       // ISO timestamp from file mtime
  outputFile: string;
  reportContent: string | null;
}

interface SharedContextEntry {
  agent: string;
  timestamp: string;
  content: string;
}

interface AgentsDashboardData {
  agents: AgentStatus[];
  sharedContext: SharedContextEntry[];
}

export async function GET(request: Request) {
  // 1. Validate admin auth
  // 2. Read feature flags from DB
  // 3. For each agent config:
  //    a. stat() the report file → lastRun = mtime
  //    b. readFile() → extract health status and summary
  // 4. Parse shared-context.md → SharedContextEntry[]
  // 5. Return AgentsDashboardData

  // Health parsing logic:
  // - Look for "Health Status: GREEN" / "YELLOW" / "RED" (case-insensitive)
  // - Look for "## Executive Summary" and take the first sentence after it
  // - Default to "unknown" if no health indicator found
}
```

### POST /api/admin/agents/run

Triggers a manual agent run and streams logs.

```typescript
export async function POST(request: Request) {
  // 1. Validate admin auth
  // 2. Extract { agentKey } from body
  // 3. Spawn the agent shell script as a child process:
  //    spawn("bash", [scriptPath], { detached: true })
  // 4. Capture stdout/stderr into an in-memory ring buffer (500 lines)
  // 5. Return { pid, startedAt }
}

export async function GET(request: Request) {
  // Stream logs for a running agent
  // 1. Extract agentKey and since (line offset) from query params
  // 2. Return new log lines since the offset
  // 3. Return status: running | completed | failed | stopped
}

export async function DELETE(request: Request) {
  // Stop a running agent
  // 1. Extract agentKey from query params
  // 2. Send SIGTERM to the process group
  // 3. Return { stopped: true }
}
```

---

## Admin Dashboard UI

The dashboard is composed of these React components:

### Component Hierarchy

```
AgentsDashboard
├── OverallHealthBanner          — Aggregate health (green/yellow/red)
├── AgentTogglesTable            — Feature flag toggles per agent
│   ├── AgentConfigPanel         — Expandable: schedule, output path, prompt editor
│   └── OptimizerConfigPanel     — (Optional) For agents with special config
├── AgentStatusGrid              — Card grid of all agents
│   └── AgentCard                — Health dot, summary, last run, play/stop
├── TerminalDisplay              — Live log streaming for manual runs
├── CrossAgentInsights           — Shared context entries as cards
└── RecentActivityTimeline       — Chronological list of agent runs
```

### AgentCard

Each card shows:
- **Health dot**: Green (healthy), yellow (warnings), red (critical), gray (never run), pulsing amber (running).
- **Label & schedule**: e.g., "Coverage Agent — Daily at 2:00 AM"
- **Health summary**: One sentence from the Executive Summary section.
- **Last run**: Relative time ("2h ago", "3d ago") from the report file's mtime.
- **Actions**: Play button (manual trigger), Stop button (when running).

### TerminalDisplay

When an agent is manually started:
- Dark-themed terminal panel with monospace font.
- Timestamped log lines streamed via polling (every 2 seconds).
- Stderr lines colored red.
- Shows elapsed time, status badge, and copy-to-clipboard.

### CrossAgentInsights

- Horizontal pill/tab selector showing one card per agent.
- Displays the most recent shared context entry for each agent.
- Renders markdown content (headings, lists, bold).
- Paginated with prev/next if many agents exist.

### OverallHealthBanner

```
┌──────────────────────────────────────────────┐
│  ● All Systems Healthy  (5/5 agents green)   │  ← Green background
│  ● Warnings Detected    (3/5 agents green)   │  ← Yellow background
│  ● Issues Found         (1 agent red)        │  ← Red background
└──────────────────────────────────────────────┘
```

---

## Report Format Convention

Every agent report **must** follow this structure for the dashboard to parse it:

```markdown
## Health Status: GREEN

## Executive Summary

One or two sentences summarizing findings. This is displayed on the agent card.

## [Section 1]

Detailed findings...

## [Section 2]

More findings...

## Recommendations

- Actionable item 1
- Actionable item 2

SHARED_CONTEXT_START
## [Agent Name] — YYYY-MM-DD
- Key finding 1
- Key finding 2

**Cross-agent recommendations:**
- [Other Agent]: suggestion
SHARED_CONTEXT_END
```

### Health Status Values

| Value | Meaning | Dashboard Color |
|-------|---------|-----------------|
| `GREEN` | No issues found | Green |
| `YELLOW` | Warnings, non-critical issues | Yellow/Amber |
| `RED` | Critical issues requiring attention | Red |

### Parsing Rules

The API route parses reports with these regexes (in priority order):

1. `/health status:\s*(green|yellow|red)/i` — Primary
2. `/status:\s*(healthy)/i` — Fallback (maps to GREEN)
3. If neither found → `unknown` (gray dot)

The **health summary** is extracted from the first sentence after the `## Executive Summary` heading.

---

## Manual Run & Terminal Streaming

### Flow

1. Admin clicks the **Play** button on an agent card.
2. `POST /api/admin/agents/run` spawns the shell script.
3. The terminal display polls `GET /api/admin/agents/run?agentKey=...&since=0` every 2 seconds.
4. Each poll returns new log lines (with line numbers for offset tracking).
5. When the process exits, the final poll returns `status: completed` or `status: failed`.
6. Admin can click **Stop** which sends `DELETE /api/admin/agents/run?agentKey=...`.

### Security Considerations

- **Restrict to development** by default: check `NODE_ENV === 'development'` or require an explicit `ALLOW_AGENT_RUN=true` env var.
- **One agent at a time** (optional): prevent concurrent manual runs to avoid resource contention.
- **Log sanitization**: Strip ANSI escape codes from captured output before sending to the client.

### In-Memory Log Buffer

```typescript
// Keep only the last 500 lines per agent run
const MAX_LOG_LINES = 500;
const logBuffers = new Map<string, { lines: LogLine[]; status: string; pid: number }>();

interface LogLine {
  timestamp: string;
  text: string;
  stream: 'stdout' | 'stderr';
}
```

---

## Directory Structure

```
project-root/
├── docs/
│   └── agents/
│       ├── coverage-report.md          # Agent reports (one per agent)
│       ├── security-report.md
│       ├── qa-report.md
│       ├── performance-report.md
│       ├── cost-analyst-report.md
│       └── shared-context.md           # Cross-agent shared workspace
│
├── scripts/
│   ├── coverage-agent.sh               # One shell script per agent
│   ├── security-agent.sh
│   ├── qa-agent.sh
│   ├── lib/
│   │   ├── agent-utils.sh              # Shared bash utilities
│   │   ├── print-default-prompt.ts     # Bridge: TS → bash for prompts
│   │   └── print-shared-context-instructions.ts
│   └── launchd/
│       ├── com.yourproject.coverage-agent.plist
│       ├── com.yourproject.security-agent.plist
│       └── ...
│
├── logs/                                # Agent execution logs (gitignored)
│   ├── coverage-agent-2026-02-18.log
│   └── ...
│
├── src/
│   ├── config/
│   │   └── agent-prompts.ts            # Single source of truth for prompts
│   ├── app/api/admin/
│   │   ├── agents-summary/route.ts     # Dashboard data API
│   │   └── agents/run/route.ts         # Manual run API
│   └── components/admin/
│       └── agents-dashboard/
│           ├── index.tsx               # Main dashboard container
│           ├── agent-card.tsx          # Individual agent card
│           ├── terminal-display.tsx    # Live log terminal
│           ├── cross-agent-insights.tsx # Shared context viewer
│           ├── overall-health-banner.tsx
│           ├── activity-item.tsx       # Timeline entry
│           ├── agent-config-panel.tsx  # Prompt editor, schedule display
│           └── markdown.ts            # Safe markdown → HTML renderer
│
└── .gitignore                          # Include: logs/
```

---

## Checklist for New Projects

- [ ] Create `docs/agents/` directory and `shared-context.md`
- [ ] Create `scripts/lib/agent-utils.sh` with shared functions
- [ ] Define agents in `src/config/agent-prompts.ts`
- [ ] Create one shell script per agent in `scripts/`
- [ ] Create launchd plists in `scripts/launchd/`
- [ ] Add feature flags to the database (master toggle + per-agent flags)
- [ ] Expose `GET /api/feature-flags` (public, read-only)
- [ ] Build `GET /api/admin/agents-summary` (admin-only, reads reports)
- [ ] Build `POST/GET/DELETE /api/admin/agents/run` (admin-only, manual runs)
- [ ] Build the admin dashboard components
- [ ] Add `logs/` to `.gitignore`
- [ ] Install launchd plists: `cp scripts/launchd/*.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/com.yourproject.*.plist`
- [ ] Test: manually trigger each agent via `launchctl start` and verify reports appear
- [ ] Test: verify the dashboard reads and displays reports correctly

---

## Suggested Agents Starter Pack

These are common agents that provide value in most projects:

| Agent | Schedule | Purpose |
|-------|----------|---------|
| **Coverage** | Daily | Track test coverage trends, flag uncovered critical paths |
| **Security** | Weekly | `npm audit`, dependency CVEs, header checks, OWASP basics |
| **QA** | Weekly | E2E smoke tests, accessibility checks, broken link detection |
| **Performance** | Weekly | Bundle size tracking, Lighthouse scores, API response times |
| **Documentation** | Weekly | Detect stale docs, missing API docs, outdated READMEs |
| **Cost Analyst** | Daily | Track API spend, forecast scaling costs, detect anomalies |
| **Localization** | Weekly | Translation completeness, missing i18n keys |

Start with 2-3 agents and add more as the project matures. The shared context system becomes more valuable as more agents contribute to it.

---

## Chapa-Specific Implementation

This section documents the concrete Chapa implementation of the template above.

### Agents

| Agent | Key | Schedule | Report File |
|-------|-----|----------|-------------|
| Coverage Agent | `coverage_agent` | Daily at 2:00 AM | `docs/agents/coverage-report.md` |
| Security Scanner | `security_scanner` | Weekly Monday 9:00 AM | `docs/agents/security-report.md` |
| QA Agent | `qa_agent` | Weekly Wednesday 9:00 AM | `docs/agents/qa-report.md` |
| Performance Agent | `performance_agent` | Weekly Thursday 9:00 AM | `docs/agents/performance-report.md` |
| Documentation Agent | `documentation_agent` | Weekly Friday 9:00 AM | `docs/agents/documentation-report.md` |
| Cost Analyst | `cost_analyst` | Daily at 3:00 AM | `docs/agents/cost-analyst-report.md` |
| Localization Agent | `localization_agent` | Weekly Saturday 9:00 AM | `docs/agents/localization-report.md` |

### File Locations

```
scripts/
  coverage-agent.sh             # Coverage agent shell script
  security-agent.sh             # Security scanner shell script
  qa-agent.sh                   # QA agent shell script
  performance-agent.sh          # Performance agent shell script
  documentation-agent.sh        # Documentation agent shell script
  cost-analyst.sh               # Cost analyst shell script
  localization-agent.sh         # Localization agent shell script
  install-agents.sh             # launchd installation helper
  lib/
    agent-utils.sh              # Shared bash utilities
    print-default-prompt.ts     # Bridge: TS config → bash
  launchd/
    com.chapa.coverage-agent.plist
    com.chapa.security-agent.plist
    com.chapa.qa-agent.plist
    com.chapa.performance-agent.plist
    com.chapa.documentation-agent.plist
    com.chapa.cost-analyst.plist
    com.chapa.localization-agent.plist

apps/web/
  lib/agents/
    agent-config.ts             # Agent metadata + default prompts
    agent-config.test.ts
    report-parser.ts            # Parses health status, summary, shared context
    report-parser.test.ts
  lib/db/
    feature-flags.ts            # DB-backed feature flag access layer
    feature-flags.test.ts
  app/api/
    feature-flags/route.ts      # GET /api/feature-flags (public, read-only)
    admin/
      feature-flags/route.ts    # PATCH /api/admin/feature-flags (admin-only)
      agents-summary/route.ts   # GET /api/admin/agents-summary (admin-only)
      agents/run/route.ts       # POST/GET/DELETE /api/admin/agents/run (dev-only)
  app/admin/
    agents-types.ts             # TypeScript types for dashboard data
    agents/
      agents-dashboard.tsx      # Main container component
      overall-health-banner.tsx  # Aggregate health status
      agent-card.tsx            # Individual agent card
      agent-status-grid.tsx     # Responsive card grid
      agent-toggles-table.tsx   # Feature flag toggles
      terminal-display.tsx      # Live log viewer
      cross-agent-insights.tsx  # Shared context viewer
```

### Installation

```bash
# Install agents into macOS launchd
bash scripts/install-agents.sh

# Verify they're loaded
launchctl list | grep com.chapa

# Manually trigger an agent (for testing)
launchctl start com.chapa.coverage-agent

# Uninstall all agents
bash scripts/install-agents.sh --unload
```

The install script automatically:
1. Copies plist files to `~/Library/LaunchAgents/`
2. Replaces `CHAPA_PROJECT_DIR` placeholder with the actual project path
3. Creates the `logs/` directory
4. Loads all agents into launchd

### Feature Flags (Supabase)

Run this SQL in your Supabase SQL editor to create the required table:

```sql
CREATE TABLE feature_flags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  enabled     BOOLEAN DEFAULT false,
  description TEXT,
  config      JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags_read_all" ON feature_flags FOR SELECT USING (true);

INSERT INTO feature_flags (key, enabled, description) VALUES
  ('automated_agents', false, 'Master toggle for all scheduled agents'),
  ('coverage_agent', true, 'Daily test coverage report agent'),
  ('security_scanner', true, 'Weekly security audit agent'),
  ('qa_agent', true, 'Weekly QA and accessibility report agent'),
  ('studio_enabled', false, 'Creator Studio feature'),
  ('experiments_enabled', false, 'Experiments pages feature');
```

### Admin Dashboard

Navigate to `/admin` and click the **Agents** tab to see:

- Overall health banner (aggregate status across all agents)
- Toggle switches for each agent (calls `PATCH /api/admin/feature-flags`)
- Agent cards with health status, last run time, and manual run buttons
- Live terminal display when manually running an agent
- Cross-agent insights from the shared context file

### Terminal Commands

The admin command bar supports these agent-related commands:

| Command | Action |
|---------|--------|
| `/agents` | Switch to Agents tab |
| `/users` | Switch to Users tab |
| `/run <agent_key>` | Manually trigger an agent |
| `/refresh` | Refresh dashboard data |

### Testing

```bash
# Run all tests (includes agent integration tests)
pnpm run test

# Run only agent-related tests
pnpm vitest run apps/web/lib/agents/
pnpm vitest run apps/web/app/admin/agents-integration.test.ts
pnpm vitest run apps/web/app/api/admin/agents-summary/
pnpm vitest run apps/web/app/api/admin/agents/run/
```

### Prerequisites

- **Claude CLI** must be installed and authenticated (`claude --version`)
- **macOS** with launchd (the scheduling system)
- **Python 3** available at `/usr/bin/python3` (used by `agent-utils.sh` for JSON parsing)
- **Chapa dev server** running at `localhost:3001` (for feature flag API calls)
