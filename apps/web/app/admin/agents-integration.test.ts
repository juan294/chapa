import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { AGENTS } from "../../lib/agents/agent-config";
import {
  parseHealthStatus,
  parseHealthSummary,
  parseSharedContext,
} from "../../lib/agents/report-parser";
import type {
  AgentStatus,
  SharedContextEntry,
  AgentsDashboardData,
} from "./agents-types";

// ---------------------------------------------------------------------------
// Sample report fixtures — representative of real agent output
// ---------------------------------------------------------------------------

const SAMPLE_COVERAGE_REPORT = `# Coverage Report
> Generated: 2026-02-18 | Health status: green

## Executive Summary
Overall test coverage is 82% with all critical paths above 90%.

## Coverage by Module
| Module | Coverage | Status |
|--------|----------|--------|
| lib/impact | 94% | OK |
| lib/render | 87% | OK |
| lib/db | 71% | Needs attention |

## Gaps & Recommendations
- apps/web/lib/db/snapshots.ts needs edge-case tests for empty results
- apps/web/lib/effects/celebrations/confetti.ts missing integration tests

SHARED_CONTEXT_START
## Coverage Agent — 2026-02-18
- **Status**: GREEN
- Overall coverage: 82%
- Critical gaps: lib/db at 71%
- Flaky tests: 0

**Cross-agent recommendations:**
- [Security]: No security-critical code lacking tests
- [QA]: lib/db module needs additional edge-case coverage
SHARED_CONTEXT_END`;

const SAMPLE_SECURITY_REPORT = `# Security Report
> Generated: 2026-02-17 | Health status: yellow

## Executive Summary
One moderate dependency vulnerability found in transitive dep; no direct code issues.

## Dependency Vulnerabilities
| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
| moderate | nth-check | ReDoS | Update css-select |

## Code Findings
- No hardcoded secrets detected
- All SVG user input properly escaped via escapeHtml()
- RLS enabled on all Supabase tables

## Recommendations
- Update css-select to resolve nth-check vulnerability`;

const SAMPLE_SHARED_CONTEXT = `<!-- ENTRY:START agent=security_scanner timestamp=2026-02-17T09:00:00Z -->
## Security Scanner — 2026-02-17
- **Status**: YELLOW
- Vulnerabilities: 0/0/1/0 (critical/high/moderate/low)
- Secret leaks: none

**Cross-agent recommendations:**
- [Coverage]: css-select dependency path needs test coverage
- [QA]: Verify rate-limit error page renders correctly
<!-- ENTRY:END -->

<!-- ENTRY:START agent=coverage_agent timestamp=2026-02-18T02:00:00Z -->
## Coverage Agent — 2026-02-18
- **Status**: GREEN
- Overall coverage: 82%
- Critical gaps: lib/db at 71%

**Cross-agent recommendations:**
- [Security]: No security-critical code lacking tests
- [QA]: lib/db module needs additional edge-case coverage
<!-- ENTRY:END -->`;

// ---------------------------------------------------------------------------
// Integration: Config → Report parsing → Dashboard data shape
// ---------------------------------------------------------------------------

describe("agents integration: config → parsing → dashboard data", () => {
  describe("all agent configs produce parseable reports", () => {
    it("coverage_agent report parses correctly", () => {
      const health = parseHealthStatus(SAMPLE_COVERAGE_REPORT);
      const summary = parseHealthSummary(SAMPLE_COVERAGE_REPORT);
      const config = AGENTS.coverage_agent!;

      expect(health).toBe("green");
      expect(summary.length).toBeGreaterThan(0);
      expect(config.key).toBe("coverage_agent");
      expect(config.outputFile).toBe("docs/agents/coverage-report.md");
    });

    it("security_scanner report parses correctly", () => {
      const health = parseHealthStatus(SAMPLE_SECURITY_REPORT);
      const summary = parseHealthSummary(SAMPLE_SECURITY_REPORT);

      expect(health).toBe("yellow");
      expect(summary).toContain("dependency vulnerability");
    });

    it("unknown agent report returns 'unknown' health", () => {
      const health = parseHealthStatus("# Report\nNothing useful here.");
      expect(health).toBe("unknown");
    });
  });

  describe("shared context round-trip", () => {
    it("parses shared context entries from multiple agents", () => {
      const entries = parseSharedContext(SAMPLE_SHARED_CONTEXT);
      expect(entries).toHaveLength(2);
      expect(entries[0]!.agent).toBe("security_scanner");
      expect(entries[1]!.agent).toBe("coverage_agent");
    });

    it("each entry has required fields", () => {
      const entries = parseSharedContext(SAMPLE_SHARED_CONTEXT);
      for (const entry of entries) {
        expect(entry.agent).toBeTruthy();
        expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(entry.content.length).toBeGreaterThan(0);
      }
    });

    it("entries contain cross-agent recommendations", () => {
      const entries = parseSharedContext(SAMPLE_SHARED_CONTEXT);
      const securityEntry = entries.find(
        (e) => e.agent === "security_scanner",
      );
      expect(securityEntry!.content).toContain("Cross-agent recommendations");
      expect(securityEntry!.content).toContain("[Coverage]");
    });
  });

  describe("AgentsDashboardData structure", () => {
    it("can be constructed from parsed data", () => {
      const agents: AgentStatus[] = Object.values(AGENTS).map((config) => ({
        key: config.key,
        label: config.label,
        schedule: config.schedule,
        enabled: true,
        health: "unknown" as const,
        healthSummary: "",
        lastRun: null,
        outputFile: config.outputFile,
        reportContent: null,
      }));

      const sharedContext: SharedContextEntry[] =
        parseSharedContext(SAMPLE_SHARED_CONTEXT);

      const data: AgentsDashboardData = { agents, sharedContext };

      expect(data.agents).toHaveLength(7);
      expect(data.sharedContext).toHaveLength(2);
      expect(data.agents.map((a) => a.key)).toEqual([
        "coverage_agent",
        "security_scanner",
        "qa_agent",
        "performance_agent",
        "documentation_agent",
        "cost_analyst",
        "localization_agent",
      ]);
    });

    it("agent keys match between config and feature flag keys", () => {
      for (const config of Object.values(AGENTS)) {
        expect(config.key).toBe(
          Object.keys(AGENTS).find((k) => AGENTS[k] === config),
        );
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Integration: Agent config consistency
// ---------------------------------------------------------------------------

describe("agents integration: config consistency", () => {
  it("all agents have non-empty prompts mentioning Chapa", () => {
    for (const config of Object.values(AGENTS)) {
      expect(config.defaultPrompt.length).toBeGreaterThan(50);
      expect(config.defaultPrompt.toLowerCase()).toContain("chapa");
    }
  });

  it("all agent output files are in docs/agents/", () => {
    for (const config of Object.values(AGENTS)) {
      expect(config.outputFile).toMatch(/^docs\/agents\//);
    }
  });

  it("all agents have at least Read,Glob,Grep in allowedTools", () => {
    for (const config of Object.values(AGENTS)) {
      expect(config.allowedTools).toContain("Read");
      expect(config.allowedTools).toContain("Glob");
      expect(config.allowedTools).toContain("Grep");
    }
  });

  it("all agent prompts include SHARED_CONTEXT markers", () => {
    for (const config of Object.values(AGENTS)) {
      expect(config.defaultPrompt).toContain("SHARED_CONTEXT_START");
      expect(config.defaultPrompt).toContain("SHARED_CONTEXT_END");
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: Shell scripts and launchd plists exist and are consistent
// ---------------------------------------------------------------------------

describe("agents integration: shell scripts and launchd plists", () => {
  const projectRoot = path.resolve(__dirname, "../../../..");

  it("each agent has a corresponding shell script", () => {
    const expected: Record<string, string> = {
      coverage_agent: "scripts/coverage-agent.sh",
      security_scanner: "scripts/security-agent.sh",
      qa_agent: "scripts/qa-agent.sh",
      performance_agent: "scripts/performance-agent.sh",
      documentation_agent: "scripts/documentation-agent.sh",
      cost_analyst: "scripts/cost-analyst.sh",
      localization_agent: "scripts/localization-agent.sh",
    };
    for (const [key, scriptPath] of Object.entries(expected)) {
      const fullPath = path.join(projectRoot, scriptPath);
      expect(
        fs.existsSync(fullPath),
        `missing script for ${key}: ${scriptPath}`,
      ).toBe(true);
    }
  });

  it("each agent has a corresponding launchd plist", () => {
    const expected = [
      "scripts/launchd/com.chapa.coverage-agent.plist",
      "scripts/launchd/com.chapa.security-agent.plist",
      "scripts/launchd/com.chapa.qa-agent.plist",
      "scripts/launchd/com.chapa.performance-agent.plist",
      "scripts/launchd/com.chapa.documentation-agent.plist",
      "scripts/launchd/com.chapa.cost-analyst.plist",
      "scripts/launchd/com.chapa.localization-agent.plist",
    ];
    for (const plistPath of expected) {
      const fullPath = path.join(projectRoot, plistPath);
      expect(
        fs.existsSync(fullPath),
        `missing plist: ${plistPath}`,
      ).toBe(true);
    }
  });

  it("shell scripts reference the correct AGENT_KEY", () => {
    const scripts: Record<string, string> = {
      coverage_agent: "scripts/coverage-agent.sh",
      security_scanner: "scripts/security-agent.sh",
      qa_agent: "scripts/qa-agent.sh",
      performance_agent: "scripts/performance-agent.sh",
      documentation_agent: "scripts/documentation-agent.sh",
      cost_analyst: "scripts/cost-analyst.sh",
      localization_agent: "scripts/localization-agent.sh",
    };
    for (const [key, scriptPath] of Object.entries(scripts)) {
      const fullPath = path.join(projectRoot, scriptPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain(`AGENT_KEY="${key}"`);
    }
  });

  it("shell scripts source agent-utils.sh", () => {
    const scripts = [
      "scripts/coverage-agent.sh",
      "scripts/security-agent.sh",
      "scripts/qa-agent.sh",
      "scripts/performance-agent.sh",
      "scripts/documentation-agent.sh",
      "scripts/cost-analyst.sh",
      "scripts/localization-agent.sh",
    ];
    for (const scriptPath of scripts) {
      const fullPath = path.join(projectRoot, scriptPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("agent-utils.sh");
    }
  });

  it("launchd plists have valid XML structure", () => {
    const plists = [
      "scripts/launchd/com.chapa.coverage-agent.plist",
      "scripts/launchd/com.chapa.security-agent.plist",
      "scripts/launchd/com.chapa.qa-agent.plist",
      "scripts/launchd/com.chapa.performance-agent.plist",
      "scripts/launchd/com.chapa.documentation-agent.plist",
      "scripts/launchd/com.chapa.cost-analyst.plist",
      "scripts/launchd/com.chapa.localization-agent.plist",
    ];
    for (const plistPath of plists) {
      const fullPath = path.join(projectRoot, plistPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      expect(content).toContain("<?xml version=");
      expect(content).toContain("<plist version=");
      expect(content).toContain("<key>Label</key>");
      expect(content).toContain("<key>ProgramArguments</key>");
      expect(content).toContain("<key>StartCalendarInterval</key>");
    }
  });

  it("install-agents.sh script exists", () => {
    const fullPath = path.join(projectRoot, "scripts/install-agents.sh");
    expect(
      fs.existsSync(fullPath),
      "scripts/install-agents.sh should exist",
    ).toBe(true);
  });

  it("install-agents.sh references all seven plist files", () => {
    const fullPath = path.join(projectRoot, "scripts/install-agents.sh");
    const content = fs.readFileSync(fullPath, "utf-8");
    expect(content).toContain("com.chapa.coverage-agent");
    expect(content).toContain("com.chapa.security-agent");
    expect(content).toContain("com.chapa.qa-agent");
    expect(content).toContain("com.chapa.performance-agent");
    expect(content).toContain("com.chapa.documentation-agent");
    expect(content).toContain("com.chapa.cost-analyst");
    expect(content).toContain("com.chapa.localization-agent");
  });
});

// ---------------------------------------------------------------------------
// Integration: report format adherence
// ---------------------------------------------------------------------------

describe("agents integration: report format conventions", () => {
  it("health status regex works for all valid values", () => {
    expect(parseHealthStatus("Health status: GREEN")).toBe("green");
    expect(parseHealthStatus("health status: yellow")).toBe("yellow");
    expect(parseHealthStatus("Health Status: Red")).toBe("red");
  });

  it("health status regex is case-insensitive", () => {
    expect(parseHealthStatus("Health STATUS: GrEeN")).toBe("green");
  });

  it("executive summary extracts first sentence", () => {
    const summary = parseHealthSummary(SAMPLE_COVERAGE_REPORT);
    expect(summary).toBe(
      "Overall test coverage is 82% with all critical paths above 90%.",
    );
  });

  it("returns fallback for missing executive summary", () => {
    const summary = parseHealthSummary("# Report\nNo summary here.");
    expect(summary).toBe("No summary available");
  });
});
