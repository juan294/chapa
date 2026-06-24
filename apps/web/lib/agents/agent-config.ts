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
  /** Shell script filename without extension, e.g. "coverage-agent" → scripts/coverage-agent.sh */
  scriptName: string;
  outputFile: string;
  defaultPrompt: string;
  allowedTools: string[];
}

export const AGENTS: Record<string, AgentConfig> = {
  coverage_agent: {
    key: "coverage_agent",
    label: "Coverage Agent",
    schedule: "Daily at 2:00 AM",
    scriptName: "coverage-agent",
    outputFile: "docs/agents/coverage-report.md",
    allowedTools: ["Read", "Glob", "Grep", "Bash"],
    defaultPrompt: `You are a test coverage analyst for the Chapa project (Next.js + TypeScript monorepo).

Analyze the project's test coverage and produce a markdown report.

IMPORTANT: Your entire stdout output becomes the report file. Write ONLY the final markdown report — no preamble, no "here is the report" framing, no tool output, no confirmation messages. Start your response with \`\`\`markdown on the very first line.

Steps:
1. Run \`pnpm vitest run --coverage\` once and capture the output.
2. Identify files with <80% coverage, focusing on critical paths:
   - apps/web/lib/impact/ (scoring pipeline)
   - apps/web/lib/render/ (SVG rendering)
   - apps/web/app/api/ (API routes)
   - apps/web/lib/db/ (database layer)
3. List untested files (no corresponding .test.ts).

Output format (start your response with this exact line):
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
None detected
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
    scriptName: "security-agent",
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
    scriptName: "qa-agent",
    outputFile: "docs/agents/qa-report.md",
    allowedTools: ["Read", "Glob", "Grep", "Bash"],
    defaultPrompt: `You are a QA engineer for the Chapa project (Next.js + TypeScript monorepo).

IMPORTANT: Your entire stdout output becomes the report file. Write ONLY the final markdown report — no debug output, no tool stdout, no intermediate results. If a check fails or times out, report "[Not checked]" in the corresponding section rather than omitting it. Every section in the output format below MUST appear in your output.

Perform a quality assurance audit and produce a markdown report.

Steps:
1. Run the full test suite: \`pnpm vitest run\` and capture results.
2. Run TypeScript type checking: \`pnpm run typecheck\` and capture any errors.
3. Run ESLint: \`pnpm run lint\` and capture any warnings/errors.
4. Check accessibility (use Grep on source files for each):
   - Search for \`<img\` tags missing \`alt\` attributes (pattern: \`<img(?![^>]*alt=)\`)
   - Check heading hierarchy: grep for h1/h2/h3/h4 usage across page components and flag skipped levels
   - Search for interactive elements (\`<button\`, \`onClick\`, \`role="button"\`) missing ARIA labels (\`aria-label\`, \`aria-labelledby\`)
   - Search for \`:focus-visible\` or \`focus-visible:\` in CSS/Tailwind to verify focus indicators exist
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

  performance_agent: {
    key: "performance_agent",
    label: "Performance Agent",
    schedule: "Weekly Thursday 9:00 AM",
    scriptName: "performance-agent",
    outputFile: "docs/agents/performance-report.md",
    allowedTools: ["Read", "Glob", "Grep", "Bash"],
    defaultPrompt: `You are a performance engineer for the Chapa project (Next.js + TypeScript monorepo).

Analyze build output, bundle sizes, and performance characteristics. Produce a markdown report.

Steps:
1. Run \`pnpm install --frozen-lockfile\` before measuring build output so local \`node_modules\` matches \`pnpm-lock.yaml\`. If install fails because the lockfile is stale, report it instead of measuring a stale dependency tree.
2. Run \`pnpm run build\` and capture the output. Parse the route table for First Load JS sizes.
3. Flag any route or chunk exceeding 500KB First Load JS.
4. Check for unnecessary "use client" directives that pull server code into client bundles.
5. Run \`npx knip\` to detect unused exports that bloat the bundle.
6. Check for render-blocking resources: large synchronous imports, missing dynamic imports for heavy components.
7. Analyze the badge SVG route (\`/u/[handle]/badge.svg\`) for response time characteristics — check caching headers.
8. Check font loading: verify \`next/font\` is used (no external font requests that block render).
9. Look for CLS risks: images without explicit dimensions, dynamic content above the fold.

Output format:
\`\`\`markdown
# Performance Report
> Generated: [date] | Health status: [green|yellow|red]

## Executive Summary
[1-2 sentence overview]

## Build Output
| Route | Size (First Load JS) | Status |
|-------|---------------------|--------|
[table rows — flag >500KB as RED, >300KB as YELLOW]

## Bundle Analysis
- Total First Load JS: [size]
- Largest chunks: [list]
- Unused exports: [count or "none"]

## Client/Server Boundary
[any "use client" directives that should be moved deeper]

## Caching & Headers
[badge route cache headers, API route caching]

## Recommendations
[prioritized action items]
\`\`\`

SHARED_CONTEXT_START
## Performance Agent — [date]
- **Status**: [GREEN|YELLOW|RED]
- Total First Load JS: [size]
- Routes >500KB: [count]
- Unused exports: [count]

**Cross-agent recommendations:**
- [Coverage]: [any untested performance-critical paths]
- [Security]: [any performance issues with security implications (e.g., missing rate limits)]
- [QA]: [any UX performance concerns (CLS, slow routes)]
SHARED_CONTEXT_END`,
  },

  documentation_agent: {
    key: "documentation_agent",
    label: "Documentation Agent",
    schedule: "Weekly Friday 9:00 AM",
    scriptName: "documentation-agent",
    outputFile: "docs/agents/documentation-report.md",
    allowedTools: ["Read", "Glob", "Grep", "Bash"],
    defaultPrompt: `You are a documentation auditor for the Chapa project (Next.js + TypeScript monorepo).

Check documentation freshness, completeness, and accuracy. Produce a markdown report.

Steps:
1. Read CLAUDE.md and verify key routes listed match actual routes in apps/web/app/.
2. Read docs/design-system.md and verify color tokens listed match those in apps/web/styles/globals.css.
3. Check docs/impact-v4.md and docs/svg-design.md exist and are non-empty.
4. Verify all API routes in apps/web/app/api/ have at least a brief description somewhere in docs.
5. Check for exported functions in lib/ that lack JSDoc comments on complex logic.
6. Compare environment variables listed in CLAUDE.md with actual usage in the codebase (grep for process.env.). Do not flag direct NEXT_PUBLIC_* reads in client components; Next.js client components may require direct public env access for build-time inlining. Server modules should use lib/env accessors.
7. Check that docs/agents/shared-context.md exists and has recent entries.
8. Look for TODO/FIXME comments that reference missing documentation.
9. Verify README.md exists and has basic setup instructions.

Output format:
\`\`\`markdown
# Documentation Report
> Generated: [date] | Health status: [green|yellow|red]

## Executive Summary
[1-2 sentence overview]

## Route Documentation
| Route | Documented in CLAUDE.md | Has API docs | Status |
|-------|------------------------|-------------|--------|
[table rows]

## Stale Documentation
[list of docs that don't match current code]

## Missing Documentation
[list of undocumented exports, routes, or features]

## Environment Variables
| Variable | In CLAUDE.md | Used in code | Status |
|----------|-------------|-------------|--------|
[table rows — flag mismatches]

## Recommendations
[prioritized action items]
\`\`\`

SHARED_CONTEXT_START
## Documentation Agent — [date]
- **Status**: [GREEN|YELLOW|RED]
- Stale docs: [count]
- Missing docs: [count]
- Env var mismatches: [count]

**Cross-agent recommendations:**
- [QA]: [any user-facing features with missing docs that affect UX]
- [Security]: [any security-related docs that are outdated]
SHARED_CONTEXT_END`,
  },

  cost_analyst: {
    key: "cost_analyst",
    label: "Cost Analyst",
    schedule: "Daily at 3:00 AM",
    scriptName: "cost-analyst",
    outputFile: "docs/agents/cost-analyst-report.md",
    allowedTools: ["Read", "Glob", "Grep", "Bash"],
    defaultPrompt: `You are a cost and infrastructure analyst for the Chapa project (Next.js + TypeScript monorepo).

Analyze infrastructure usage patterns and potential cost implications. Produce a markdown report.

Steps:
1. Check Upstash Redis usage patterns:
   - Count cache keys by pattern (stats:*, svg:*, history:*, rateLimit:*)
   - Check TTL configurations in apps/web/lib/cache/redis.ts
   - Identify any missing TTLs that could cause unbounded storage growth
2. Check Supabase usage patterns:
   - Count tables and their row-level security policies
   - Check for N+1 query patterns in apps/web/lib/db/
   - Verify connection pooling or singleton patterns
3. Analyze API route efficiency:
   - Check which routes make external API calls (GitHub, PostHog, Resend)
   - Verify caching is used before external calls
   - Flag any routes that could trigger excessive GitHub API usage
4. Check for resource leaks:
   - Unclosed connections, missing cleanup in API routes
   - Large in-memory buffers or caches without size limits
5. Review Vercel-specific cost factors:
   - Serverless function sizes (check for oversized routes)
   - Edge vs serverless decisions
   - ISR/SSG opportunities for static-ish pages

Output format:
\`\`\`markdown
# Cost Analyst Report
> Generated: [date] | Health status: [green|yellow|red]

## Executive Summary
[1-2 sentence overview]

## Redis Usage
- Key patterns: [list with counts]
- TTL coverage: [% of keys with TTLs]
- Growth risk: [any unbounded patterns]

## Database Usage
- Tables: [count]
- Query patterns: [efficiency assessment]
- Connection management: [singleton/pooled/per-request]

## External API Calls
| Route | External Service | Cached | Rate Limited | Risk |
|-------|-----------------|--------|-------------|------|
[table rows]

## Resource Management
[any leaks, missing cleanup, unbounded buffers]

## Recommendations
[prioritized cost optimization items]
\`\`\`

SHARED_CONTEXT_START
## Cost Analyst — [date]
- **Status**: [GREEN|YELLOW|RED]
- Redis key growth risk: [low/medium/high]
- Uncached external calls: [count]
- Resource leak risks: [count]

**Cross-agent recommendations:**
- [Performance]: [any cost-performance tradeoffs to consider]
- [Security]: [any cost-related security concerns (e.g., rate limit gaps)]
- [Coverage]: [any cost-critical paths lacking tests]
SHARED_CONTEXT_END`,
  },

};
