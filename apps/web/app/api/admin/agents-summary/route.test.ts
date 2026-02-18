import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth/github", () => ({
  readSessionCookie: vi.fn(),
}));

vi.mock("@/lib/auth/admin", () => ({
  isAdminHandle: vi.fn(),
}));

vi.mock("@/lib/cache/redis", () => ({
  rateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, current: 1, limit: 10 }),
}));

vi.mock("@/lib/http/client-ip", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/db/feature-flags", () => ({
  dbGetFeatureFlags: vi.fn(),
}));

vi.mock("@/lib/agents/agent-config", () => ({
  AGENTS: {
    coverage_agent: {
      key: "coverage_agent",
      label: "Coverage Agent",
      schedule: "Daily at 2:00 AM",
      outputFile: "docs/agents/coverage-report.md",
      defaultPrompt: "...",
      allowedTools: ["Read"],
    },
    security_scanner: {
      key: "security_scanner",
      label: "Security Scanner",
      schedule: "Weekly Monday 9:00 AM",
      outputFile: "docs/agents/security-report.md",
      defaultPrompt: "...",
      allowedTools: ["Read"],
    },
    qa_agent: {
      key: "qa_agent",
      label: "QA Agent",
      schedule: "Weekly Wednesday 9:00 AM",
      outputFile: "docs/agents/qa-report.md",
      defaultPrompt: "...",
      allowedTools: ["Read"],
    },
  },
}));

vi.mock("@/lib/agents/report-parser", () => ({
  parseHealthStatus: (content: string) => {
    const match = content.match(/health status:\s*(green|yellow|red)/i);
    if (!match) return "unknown";
    return match[1]!.toLowerCase();
  },
  parseHealthSummary: (content: string) => {
    const match = content.match(/##\s*Executive Summary\s*\n+\s*(.+)/i);
    if (!match) return "No summary available";
    const line = match[1]!.trim();
    const sentenceMatch = line.match(/^(.+?\.)\s/);
    if (sentenceMatch) return sentenceMatch[1]!;
    if (line.endsWith(".")) return line;
    return line;
  },
  parseSharedContext: (content: string) => {
    if (!content) return [];
    const entries: { agent: string; timestamp: string; content: string }[] = [];
    const pattern =
      /<!-- ENTRY:START agent=(\S+) timestamp=(\S+) -->\n([\s\S]*?)<!-- ENTRY:END -->/g;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      entries.push({
        agent: match[1]!,
        timestamp: match[2]!,
        content: match[3]!.trim(),
      });
    }
    return entries;
  },
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

import { readSessionCookie } from "@/lib/auth/github";
import { isAdminHandle } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/cache/redis";
import { dbGetFeatureFlags } from "@/lib/db/feature-flags";
import { readFile, stat } from "node:fs/promises";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): NextRequest {
  return new NextRequest(
    "https://chapa.thecreativetoken.com/api/admin/agents-summary",
    { headers: { cookie: "chapa_session=encrypted-value" } },
  );
}

const MOCK_COVERAGE_REPORT = `# Coverage Report
> Generated: 2026-02-18 | Health status: green

## Executive Summary
Overall coverage is at 87%. Two modules need attention.

## Coverage by Module
| Module | Coverage | Status |
|--------|----------|--------|
| impact | 92%      | GREEN  |
`;

const MOCK_SHARED_CONTEXT = `# Shared Context

<!-- ENTRY:START agent=coverage_agent timestamp=2026-02-18T02:00:00Z -->
## Coverage Agent — 2026-02-18
- **Status**: GREEN
- Overall coverage: 87%
<!-- ENTRY:END -->

<!-- ENTRY:START agent=security_scanner timestamp=2026-02-17T09:00:00Z -->
## Security Scanner — 2026-02-17
- **Status**: GREEN
- No vulnerabilities found
<!-- ENTRY:END -->
`;

const MOCK_FLAGS = [
  {
    id: "1",
    key: "automated_agents",
    enabled: true,
    description: "Master toggle",
    config: {},
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "2",
    key: "coverage_agent",
    enabled: true,
    description: "Coverage agent",
    config: {},
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "3",
    key: "security_scanner",
    enabled: false,
    description: "Security scanner",
    config: {},
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "4",
    key: "qa_agent",
    enabled: true,
    description: "QA agent",
    config: {},
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXTAUTH_SECRET", "test-secret");
  vi.stubEnv("ADMIN_HANDLES", "admin1");

  vi.mocked(readSessionCookie).mockReturnValue({
    login: "admin1",
    name: "Admin One",
    avatar_url: "https://example.com/avatar.png",
    token: "gho_fake",
  });
  vi.mocked(isAdminHandle).mockReturnValue(true);
  vi.mocked(rateLimit).mockResolvedValue({
    allowed: true,
    current: 1,
    limit: 10,
  });
  vi.mocked(dbGetFeatureFlags).mockResolvedValue(MOCK_FLAGS);

  // Default: coverage report exists, others don't
  vi.mocked(stat).mockImplementation((path) => {
    if (String(path).includes("coverage-report")) {
      return Promise.resolve({
        mtime: new Date("2026-02-18T02:30:00Z"),
      }) as ReturnType<typeof stat>;
    }
    return Promise.reject(new Error("ENOENT"));
  });

  vi.mocked(readFile).mockImplementation((path) => {
    const p = String(path);
    if (p.includes("coverage-report")) {
      return Promise.resolve(MOCK_COVERAGE_REPORT);
    }
    if (p.includes("shared-context")) {
      return Promise.resolve(MOCK_SHARED_CONTEXT);
    }
    return Promise.reject(new Error("ENOENT"));
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/admin/agents-summary", () => {
  it("returns 429 when rate limited", async () => {
    vi.mocked(rateLimit).mockResolvedValue({
      allowed: false,
      current: 11,
      limit: 10,
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(429);
  });

  it("returns 401 when session is missing", async () => {
    vi.mocked(readSessionCookie).mockReturnValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    vi.mocked(isAdminHandle).mockReturnValue(false);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns agent statuses with parsed health data", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.agents).toHaveLength(3);

    // Coverage agent has a report
    const coverage = body.agents.find(
      (a: { key: string }) => a.key === "coverage_agent",
    );
    expect(coverage).toBeDefined();
    expect(coverage.health).toBe("green");
    expect(coverage.healthSummary).toBe("Overall coverage is at 87%.");
    expect(coverage.enabled).toBe(true);
    expect(coverage.lastRun).toBe("2026-02-18T02:30:00.000Z");
    expect(coverage.reportContent).toContain("Coverage Report");
  });

  it("returns unknown health when report file is missing", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    const security = body.agents.find(
      (a: { key: string }) => a.key === "security_scanner",
    );
    expect(security).toBeDefined();
    expect(security.health).toBe("unknown");
    expect(security.healthSummary).toBe("No summary available");
    expect(security.lastRun).toBeNull();
    expect(security.reportContent).toBeNull();
  });

  it("maps feature flag enabled state to agents", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    const security = body.agents.find(
      (a: { key: string }) => a.key === "security_scanner",
    );
    expect(security.enabled).toBe(false);

    const qa = body.agents.find(
      (a: { key: string }) => a.key === "qa_agent",
    );
    expect(qa.enabled).toBe(true);
  });

  it("includes agent label and schedule from config", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    const coverage = body.agents.find(
      (a: { key: string }) => a.key === "coverage_agent",
    );
    expect(coverage.label).toBe("Coverage Agent");
    expect(coverage.schedule).toBe("Daily at 2:00 AM");
    expect(coverage.outputFile).toBe("docs/agents/coverage-report.md");
  });

  it("returns parsed shared context entries", async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.sharedContext).toHaveLength(2);
    expect(body.sharedContext[0].agent).toBe("coverage_agent");
    expect(body.sharedContext[0].timestamp).toBe("2026-02-18T02:00:00Z");
    expect(body.sharedContext[1].agent).toBe("security_scanner");
  });

  it("returns empty shared context when file is missing", async () => {
    vi.mocked(readFile).mockImplementation((path) => {
      const p = String(path);
      if (p.includes("coverage-report")) {
        return Promise.resolve(MOCK_COVERAGE_REPORT);
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.sharedContext).toEqual([]);
  });

  it("defaults agent enabled to false when flag is missing", async () => {
    vi.mocked(dbGetFeatureFlags).mockResolvedValue([]);

    const res = await GET(makeRequest());
    const body = await res.json();

    body.agents.forEach((agent: { enabled: boolean }) => {
      expect(agent.enabled).toBe(false);
    });
  });

  it("has no-store cache control header", async () => {
    const res = await GET(makeRequest());
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
