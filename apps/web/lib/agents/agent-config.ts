/**
 * Agent configuration — defines all scheduled CLI agents.
 *
 * Each agent has a key (matching the feature_flags DB key), a human-readable
 * label and schedule, the output file path, the default headless prompt,
 * and the allowed Claude tools.
 */

export interface AgentConfig {
  key: string;
  label: string;
  schedule: string;
  outputFile: string;
  defaultPrompt: string;
  allowedTools: string[];
}

export const AGENTS: Record<string, AgentConfig> = {
  coverage_agent: {
    key: "coverage_agent",
    label: "Coverage Agent",
    schedule: "Daily at 2:00 AM",
    outputFile: "docs/agents/coverage-report.md",
    allowedTools: ["Read", "Glob", "Grep", "Bash"],
    defaultPrompt: `You are a test coverage analyst for the Chapa project (Next.js + TypeScript monorepo).

Analyze the project's test coverage and produce a markdown report.

Steps:
1. Run \`pnpm vitest run --coverage\` and capture the output.
2. Identify files with <80% coverage, focusing on critical paths:
   - apps/web/lib/impact/ (scoring pipeline)
   - apps/web/lib/render/ (SVG rendering)
   - apps/web/app/api/ (API routes)
   - apps/web/lib/db/ (database layer)
3. List untested files (no corresponding .test.ts).
4. Check for flaky tests by running the suite 3 times and comparing results.

Output format:
\`\`\`markdown
# Coverage Report
> Generated: [date] | Health status: [green|yellow|red]

## Executive Summary
[1-2 sentence overview]

## Coverage by Module
| Module | Coverage | Status |
|--------|----------|--------|
[table rows]

## Gaps & Recommendations
[bullet list of specific files needing tests]

## Flaky Tests
[list any tests that failed inconsistently, or "None detected"]
\`\`\`

SHARED_CONTEXT_START
## Coverage Agent — [date]
- **Status**: [GREEN|YELLOW|RED]
- Overall coverage: [X]%
- Critical gaps: [list]
- Flaky tests: [count]

**Cross-agent recommendations:**
- [Security]: [any security-relevant test gaps]
- [QA]: [any quality-relevant findings]
SHARED_CONTEXT_END`,
  },

  security_scanner: {
    key: "security_scanner",
    label: "Security Scanner",
    schedule: "Weekly Monday 9:00 AM",
    outputFile: "docs/agents/security-report.md",
    allowedTools: ["Read", "Glob", "Grep", "Bash"],
    defaultPrompt: `You are a security auditor for the Chapa project (Next.js + TypeScript monorepo).

Perform a security audit and produce a markdown report.

Steps:
1. Run \`pnpm audit\` and capture vulnerability findings.
2. Run \`npx knip\` to detect unused dependencies (attack surface reduction).
3. Search for hardcoded secrets: grep for patterns like API keys, tokens, passwords in source files (not .env files).
4. Check SVG rendering for XSS vectors: verify all user input (handle, displayName) is escaped via escapeHtml().
5. Verify no secrets leak to client: check that no SUPABASE_SERVICE_ROLE_KEY or NEXTAUTH_SECRET appears in NEXT_PUBLIC_* vars.
6. Check CORS headers on API routes.
7. Verify RLS is enabled on all Supabase tables.
8. Check dependency licenses: flag any copyleft (GPL, AGPL) dependencies.

Output format:
\`\`\`markdown
# Security Report
> Generated: [date] | Health status: [green|yellow|red]

## Executive Summary
[1-2 sentence overview]

## Dependency Vulnerabilities
| Severity | Package | Issue | Fix |
|----------|---------|-------|-----|
[table rows]

## Code Findings
[bullet list with severity, location, description]

## License Compliance
[any copyleft violations or "All clear"]

## Recommendations
[prioritized action items]
\`\`\`

SHARED_CONTEXT_START
## Security Scanner — [date]
- **Status**: [GREEN|YELLOW|RED]
- Vulnerabilities: [critical/high/medium/low counts]
- Secret leaks: [count or "none"]
- License issues: [count or "none"]

**Cross-agent recommendations:**
- [Coverage]: [any security-critical code lacking tests]
- [QA]: [any security UX issues]
SHARED_CONTEXT_END`,
  },

  qa_agent: {
    key: "qa_agent",
    label: "QA Agent",
    schedule: "Weekly Wednesday 9:00 AM",
    outputFile: "docs/agents/qa-report.md",
    allowedTools: ["Read", "Glob", "Grep", "Bash"],
    defaultPrompt: `You are a QA engineer for the Chapa project (Next.js + TypeScript monorepo).

Perform a quality assurance audit and produce a markdown report.

Steps:
1. Run the full test suite: \`pnpm vitest run\` and capture results.
2. Run TypeScript type checking: \`pnpm run typecheck\` and capture any errors.
3. Run ESLint: \`pnpm run lint\` and capture any warnings/errors.
4. Check accessibility:
   - Verify all images have alt text
   - Check heading hierarchy (h1 → h2 → h3, no skipped levels)
   - Verify ARIA labels on interactive elements
   - Check for visible focus indicators
5. Check error states: search for error boundary components, loading states, empty states.
6. Verify design system consistency: check that components use semantic tokens (bg-bg, text-text-primary, etc.) instead of hardcoded hex colors.

Output format:
\`\`\`markdown
# QA Report
> Generated: [date] | Health status: [green|yellow|red]

## Executive Summary
[1-2 sentence overview]

## Test Results
- Total: [N] tests across [M] files
- Passed: [X] | Failed: [Y] | Skipped: [Z]

## TypeScript
[any type errors or "Clean"]

## Linting
[any lint errors/warnings or "Clean"]

## Accessibility
[findings with file locations]

## Design System Compliance
[any violations of semantic token usage]

## Recommendations
[prioritized action items]
\`\`\`

SHARED_CONTEXT_START
## QA Agent — [date]
- **Status**: [GREEN|YELLOW|RED]
- Tests: [pass/fail/total]
- Type errors: [count]
- Lint issues: [count]
- A11y issues: [count]

**Cross-agent recommendations:**
- [Coverage]: [any undertested areas discovered]
- [Security]: [any security-related quality issues]
SHARED_CONTEXT_END`,
  },
};
