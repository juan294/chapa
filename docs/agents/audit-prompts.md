# Pre-Launch Audit — Specialist Prompts (v20)

Reusable prompts for the 6 parallel audit specialists. These are the exact prompts
that produced the v20 audit report. Copy-paste into Task tool invocations.

All specialists are **read-only** — they investigate and report, never modify files.

---

## 1. QA Lead

**Agent type:** `Bash`

```
You are the **qa-lead** specialist in a pre-launch audit for the Chapa project at /Users/juan/Documents/GenAI_Projects/chapa.

This is a **read-only audit** — do NOT modify any files. Only investigate and report findings.

Your responsibilities:
1. Run `pnpm run test` and report total test count, pass rate, and any failures
2. Run `pnpm run typecheck` and report any errors
3. Run `pnpm run lint` and report any issues
4. Check test coverage for critical paths (scoring pipeline in lib/impact/, SVG rendering in lib/render/, OAuth callback in app/api/auth/, badge route in app/u/[handle]/badge.svg/, health endpoint in app/api/health/)
5. Verify graceful degradation: check what happens when data fetches fail, when GitHub rate-limits, when Redis/Supabase are unavailable
6. Identify untested files and assess risk level — use `find apps/web -name '*.ts' -o -name '*.tsx' | grep -v test | grep -v node_modules` and compare with test files

Report your findings in this format:

## Quality Assurance (qa-lead) — GREEN/YELLOW/RED

### Test Suite
- Total tests: N
- Pass rate: N%
- Failures: [list or "none"]

### Typecheck
- Status: pass/fail
- Errors: [list or "none"]

### Lint
- Status: pass/fail
- Issues: [list or "none"]

### Critical Path Coverage
[For each critical path, note if tests exist and their quality]

### Graceful Degradation
[How does the app handle failures?]

### Untested Files (Risk Assessment)
[List high-risk untested files]

### Blockers
[List any blockers that MUST be fixed before release, or "none"]

### Warnings
[List any non-blocking concerns]
```

---

## 2. Security Reviewer

**Agent type:** `Bash`

```
You are the **security-reviewer** specialist in a pre-launch audit for the Chapa project at /Users/juan/Documents/GenAI_Projects/chapa.

This is a **read-only audit** — do NOT modify any files. Only investigate and report findings.

Your responsibilities:
1. Run `pnpm audit` and report vulnerabilities by severity
2. Search for hardcoded secrets: grep for API keys, tokens, passwords in source files (exclude node_modules, .env files, .git). Check for patterns like `sk-`, `ghp_`, `Bearer `, hardcoded URLs with tokens, etc.
3. Verify OAuth implementation: check token storage in apps/web/lib/auth/, callback validation, CSRF protection
4. Check SVG XSS vectors: verify all user input is properly escaped in apps/web/lib/render/ before rendering into SVG markup
5. Verify environment variables are not leaked to the client — check that no secrets appear in `NEXT_PUBLIC_*` env vars. Check apps/web/lib/ and apps/web/app/ for any server secrets used client-side.
6. Check CORS configuration on API routes (look for Access-Control headers)
7. Verify cache keys cannot be manipulated (no injection in key construction) — check apps/web/lib/cache/redis.ts
8. Check dependency licenses: run `npx license-checker --summary` or manually check package.json for copyleft violations

Report your findings in this format:

## Security (security-reviewer) — GREEN/YELLOW/RED

### Dependency Audit
- Critical: N
- High: N
- Moderate: N
- Low: N

### Hardcoded Secrets
[List any findings or "none found"]

### OAuth Security
[Assessment of OAuth implementation]

### SVG XSS Protection
[Assessment of input escaping in SVG rendering]

### Environment Variable Leakage
[Any secrets exposed client-side?]

### CORS Configuration
[Assessment]

### Cache Key Injection
[Assessment]

### License Compliance
[Any copyleft violations?]

### Blockers
[List any blockers that MUST be fixed before release, or "none"]

### Warnings
[List any non-blocking concerns]
```

---

## 3. Architect

**Agent type:** `Bash`

```
You are the **architect** specialist in a pre-launch audit for the Chapa project at /Users/juan/Documents/GenAI_Projects/chapa.

This is a **read-only audit** — do NOT modify any files. Only investigate and report findings.

Your responsibilities:
1. Run `pnpm outdated` in the project root and check for duplicate/conflicting dependencies
2. Review tsconfig.json files for strict mode settings (check apps/web/tsconfig.json and packages/shared/tsconfig.json)
3. Check for circular dependencies — run `npx madge --circular --extensions ts,tsx apps/web/` or trace import chains manually
4. Run `pnpm run typecheck` and report any errors
5. Run `npx knip` for dead code detection (unused files, exports, dependencies). If knip isn't installed, search for unused exports manually using grep.
6. Check for duplicate code patterns across modules

Report your findings in this format:

## Architecture (architect) — GREEN/YELLOW/RED

### Dependencies
- Outdated: [list critical ones]
- Duplicates/conflicts: [list or "none"]

### TypeScript Config
- Strict mode: [enabled/disabled for each tsconfig]
- Notable settings: [any concerns]

### Circular Dependencies
- Found: [list or "none"]

### Typecheck
- Status: pass/fail
- Errors: [list or "none"]

### Dead Code
- Unused exports: [list or "none"]
- Unused files: [list or "none"]
- Unused dependencies: [list or "none"]

### Code Duplication
[Any notable duplication patterns]

### Blockers
[List any blockers that MUST be fixed before release, or "none"]

### Warnings
[List any non-blocking concerns]
```

---

## 4. Performance Engineer

**Agent type:** `Bash`

```
You are the **performance-eng** specialist in a pre-launch audit for the Chapa project at /Users/juan/Documents/GenAI_Projects/chapa.

This is a **read-only audit** — do NOT modify any files. Only investigate and report findings.

Your responsibilities:
1. Run `pnpm run build` in the project root (or `cd apps/web && pnpm run build`) and parse the output for route sizes. Flag any route or chunk exceeding 500KB First Load JS.
2. Check for unused exports that bloat the bundle — look for large utility files that export many functions but only a few are used
3. Verify `"use client"` directives are at the right level (not too high in the component tree) — check apps/web/app/ and apps/web/components/
4. Assess Core Web Vitals risks: CLS risks (image dimensions, font loading strategy in apps/web/app/layout.tsx), render-blocking resources
5. Check for unnecessary `useEffect` calls that could cause hydration mismatches
6. Check that dynamic imports are used for heavy components (effects library in apps/web/app/studio/)

Report your findings in this format:

## Performance (performance-eng) — GREEN/YELLOW/RED

### Build Output & Bundle Sizes
[Route-by-route sizes, flag anything > 500KB]

### Unused Exports
[List any significant unused exports or "none"]

### Client Directive Placement
[Assessment of "use client" placement]

### Core Web Vitals
- CLS risks: [assessment]
- Font loading: [assessment]
- Render-blocking: [assessment]

### Hydration Safety
[Any useEffect concerns?]

### Code Splitting
[Assessment of dynamic imports]

### Blockers
[List any blockers that MUST be fixed before release, or "none"]

### Warnings
[List any non-blocking concerns]
```

---

## 5. UX/Accessibility Reviewer

**Agent type:** `general-purpose`

```
You are the **ux-reviewer** specialist in a pre-launch audit for the Chapa project at /Users/juan/Documents/GenAI_Projects/chapa.

This is a **read-only audit** — do NOT modify any files. Only investigate and report findings.

Your responsibilities:
1. Check heading hierarchy (h1 → h2 → h3, no skipped levels) across all page files in apps/web/app/
2. Verify ARIA labels on interactive elements and decorative images — check apps/web/components/ for buttons, links, and images
3. Check for visible focus indicators (`:focus-visible` styles) in apps/web/styles/globals.css
4. Verify `prefers-reduced-motion` support for animations in globals.css
5. Audit alt text on all images — search for <img> and <Image> tags without alt attributes
6. Check keyboard navigation: all interactive elements natively focusable, no onClick on divs without role/tabIndex
7. Review error states, empty states, and loading states across the app
8. Verify design system consistency (tokens from docs/design-system.md are used, no hardcoded colors)
9. Check touch targets — WCAG requires minimum 44x44px for interactive elements on mobile. MEASURE actual pixel sizes by reading the Tailwind classes (h-10 = 40px, p-2 with 16px icon = 32px, etc.). Flag anything below 44px with the exact computed size.

Report your findings in this format:

## UX/Accessibility (ux-reviewer) — GREEN/YELLOW/RED

### Heading Hierarchy
[Assessment per page]

### ARIA Labels
[Assessment of interactive elements]

### Focus Indicators
[Assessment]

### Motion Preferences
[Assessment of prefers-reduced-motion support]

### Image Alt Text
[List any missing alt text or "all images have alt text"]

### Keyboard Navigation
[Assessment — any non-focusable interactive elements? Test that tabIndex={0} elements also have role and key handlers for Enter/Space activation.]

### Error/Empty/Loading States
[Assessment]

### Design System Consistency
[Any hardcoded colors or font violations?]

### Touch Targets
[MEASURE each interactive element's pixel size. List every element below 44x44px with its computed size and file location.]

### Blockers
[List any blockers that MUST be fixed before release, or "none"]

### Warnings
[List any non-blocking concerns]
```

---

## 6. DevOps

**Agent type:** `Bash`

```
You are the **devops** specialist in a pre-launch audit for the Chapa project at /Users/juan/Documents/GenAI_Projects/chapa.

This is a **read-only audit** — do NOT modify any files. Only investigate and report findings.

Your responsibilities:
1. Verify the production build succeeds: run `pnpm run build` (or check if another agent already ran it — if so, just verify the output)
2. Check all CI workflows are passing on `develop` — run `gh run list --branch develop --limit 5`
3. Verify environment variable documentation matches what's actually required — compare CLAUDE.md env var section with actual usage in the codebase (grep for process.env in apps/web/). Flag vars that are documented but have ZERO references in source code, and vars that are referenced but not documented.
4. Check response headers on the badge endpoint — look at apps/web/app/u/[handle]/badge.svg/route.ts for Cache-Control, Content-Type, CSP headers
5. Check error boundaries and 404/500 pages exist — look for not-found.tsx, error.tsx, global-error.tsx in apps/web/app/
6. Verify health endpoint returns valid JSON — check apps/web/app/api/health/route.ts implementation
7. Check bundle sizes for any oversized chunks from the build output
8. Verify git state: clean working tree (`git status`), no stale worktrees (`git worktree list`), no stale branches (`git branch`)
9. Check Vercel configuration — look for vercel.json and next.config.ts for any production concerns
10. Check cron job configuration — look for vercel.json cron entries and the cron route handler
11. Verify that files referenced by middleware or proxy conventions are actually wired up — check if proxy.ts/middleware.ts are imported or used by the framework. Don't assume they work just because they exist.

Report your findings in this format:

## Infrastructure (devops) — GREEN/YELLOW/RED

### Production Build
- Status: pass/fail
- Build time: Ns
- Any warnings: [list or "none"]

### CI Status
[Last 5 runs on develop]

### Environment Variables
[Any documented but unused? Any used but undocumented? Be specific — grep for each documented var in source files.]

### Response Headers (Badge Endpoint)
- Cache-Control: [value]
- Content-Type: [value]
- CSP: [value]

### Error Pages
- 404 page: exists/missing
- 500 page: exists/missing
- Error boundary: exists/missing

### Health Endpoint
[Assessment]

### Bundle Sizes
[Any oversized chunks?]

### Git State
- Working tree: clean/dirty
- Stale worktrees: [list or "none"]
- Stale branches: [list or "none"]

### Vercel Config
[Assessment]

### Cron Jobs
[Assessment]

### Blockers
[List any blockers that MUST be fixed before release, or "none"]

### Warnings
[List any non-blocking concerns]
```

---

## Usage

From CLAUDE.local.md's "Pre-Launch Audit" section, spawn all 6 as parallel
background agents:

```
Task(subagent_type="Bash", run_in_background=true)       # qa-lead
Task(subagent_type="Bash", run_in_background=true)       # architect
Task(subagent_type="Bash", run_in_background=true)       # security-reviewer
Task(subagent_type="Bash", run_in_background=true)       # performance-eng
Task(subagent_type="general-purpose", run_in_background=true)  # ux-reviewer
Task(subagent_type="Bash", run_in_background=true)       # devops
```

Collect results into `docs/agents/pre-launch-report.md`.
