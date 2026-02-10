# Chapa — Dev Impact Badge (Hackathon Build)

## One-liner
Chapa generates a **live, embeddable, animated SVG badge** that showcases a developer's **Impact Score v3** (Impact + Confidence) from GitHub activity, with a share page and one-click sharing.

## Goals (Hackathon)
1. GitHub OAuth login (for "Verified" mode + better API limits).
2. Compute **Impact Score v3** from last 90 days:
   - base score (0–100), confidence (50–100) + reasons, adjusted score, tier.
3. Serve **embeddable SVG badge**: `/u/:handle/badge.svg`
4. Serve **share page**: `/u/:handle`
5. Caching + rate limit friendliness (daily cache is fine).
6. Minimal analytics (PostHog) for key events.

## Non-goals (for hackathon)
- No long-term history charts
- No leaderboard
- No paid tiers
- No complex theming system beyond 1–3 theme presets

## Stack decisions
- Next.js (App Router) + TypeScript + Tailwind
- Badge rendering: **React-to-SVG** (JSX template rendered server-side to string)
- Caching: Upstash Redis (via Vercel Marketplace) preferred
- Analytics: PostHog
- Domain: chapa.thecreativetoken.com

## Key routes
- GET `/` Landing + GitHub login
- GET `/u/:handle` Share page (badge preview, breakdown, embed snippet, share CTA)
- GET `/u/:handle/badge.svg` Embeddable badge SVG (cacheable)
- (Optional) POST `/api/refresh?handle=` Force refresh (rate-limited)

## Data & types
Shared types live in: `packages/shared/types.ts`
- `Stats90d`
- `ImpactV3Result`

## Rendering requirements
- Default badge size: 1200×630 (wide)
- Default theme: Midnight Mint (dark + mint accent)
- SVG must be crisp and readable when scaled down
- Animations must be subtle (heatmap fade-in, impact pulse)

## Design system (MANDATORY for UI work)
- Full spec: @docs/design-system.md
- Accent color: `#80CCB4` (muted teal-mint) — NOT neon green. Use `text-mint`, `bg-mint`.
- Heading font: **JetBrains Mono** (`font-heading`) — monospace, no italic.
- Body font: **Plus Jakarta Sans** (`font-body`) — default on `<body>`.
- Dark theme only. No light mode.
- All colors and fonts are defined in `apps/web/styles/globals.css` via Tailwind v4 `@theme`.

## GitHub branding
Include GitHub logo and "Powered by GitHub" text for hackathon.
Must be easy to swap/remove:
- Branding is behind a flag: `includeGithubBranding`
- Branding is isolated in one component/file.

## Caching rules
- Cache computed stats + impact per user/day (TTL 24h)
- Cache SVG output per user/day + theme (TTL 24h)
- Response headers for badge endpoint:
  - `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`

## Agent team roles (no file overlap)
- OAuth Engineer: `apps/web/app/api/auth/*`, `apps/web/lib/auth/*`
- GitHub Data Engineer: `apps/web/lib/github/*`, `apps/web/lib/cache/*`
- Impact v3 Engineer: `apps/web/lib/impact/*`, types section in shared
- SVG Renderer Engineer: `apps/web/lib/render/*`, `apps/web/app/u/[handle]/badge.svg/route.ts`
- Share Page Engineer: `apps/web/app/u/[handle]/page.tsx`, `apps/web/components/*`

## Acceptance criteria (must pass)
- A user can log in with GitHub (OAuth success).
- `/u/:handle/badge.svg` loads publicly without auth (use cached public stats where possible).
- Badge shows: heatmap, commits, PRs merged, reviews, Impact tier, Score, Confidence.
- `/u/:handle` shows badge + breakdown + confidence reasons + embed snippet.
- Caching prevents repeated GitHub API calls for same handle within 24h.
- Confidence messaging is non-accusatory (never claims wrongdoing).
- Repo contains `docs/impact-v3.md` and `docs/svg-design.md` as spec truth.

## Engineering rules
- Keep edits separated by files to avoid overwrites in agent teams.
- Prefer pure functions for scoring & rendering.
- Escape/encode any user-controlled text in SVG (handle, display name).
- Handle GitHub rate limit errors gracefully (serve cached or show "try later").

## What to build first
1) Shared types
2) GitHub OAuth + token storage
3) Stats90d gatherer + caching
4) Impact v3 compute + tests
5) Badge SVG endpoint
6) Share page + embed snippet + sharing

---

# Engineering Process

Everything below defines **how** agents work on this project — git workflow, testing discipline, issue tracking, collaboration patterns, and production safety.

## Git Workflow

**IMPORTANT: Always work on `develop` branch. Only merge to `main` for production releases / hackathon submission.**

```bash
main      # PRODUCTION — deployed to chapa.thecreativetoken.com. Agents MUST NOT touch without explicit user authorization.
develop   # Active development (DEFAULT)
```

1. All development happens on `develop`
2. Never commit directly to `main` — it represents what's deployed
3. Release to production via PR: `develop` → `main` (see Production Safety below)
4. Always run tests before committing
5. **No PRs for `develop`** — commit/merge directly, verify CI, done
6. **PRs required for `main`** — CI must pass before merge

### Commit Messages

Use conventional commits with issue references:

```
feat(badge): add heatmap fade-in animation (#12)
fix(oauth): handle token expiry on callback (#7)
test(impact): add boundary tests for confidence clamp
chore: update dependencies
```

Prefixes: `feat`, `fix`, `test`, `refactor`, `chore`, `docs`

### Branch Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/short-name` | `feature/heatmap-animation` |
| Bug fix | `fix/short-name` | `fix/oauth-token-expiry` |
| Refactor | `refactor/short-name` | `refactor/scoring-pipeline` |
| Chore | `chore/short-name` | `chore/update-deps` |

## Worktree-First Development (MANDATORY)

**Every feature, refactor, bug fix, or change MUST be done in its own git worktree. No exceptions.**

This is the default way of working — you do NOT need to be told to create a worktree. Always create one automatically at the start of any task.

### Workflow

There are two worktree paths depending on context:

**Interactive (main terminal)** — worktree outside the project:
```bash
git worktree add -b feature/short-name ../chapa-short-name develop
cd ../chapa-short-name
```

**Background agents (spawned via Task tool)** — worktree INSIDE the project:
```bash
# IMPORTANT: Background agents are sandboxed to the project directory.
# Worktrees at ../chapa-* are INACCESSIBLE to background agents.
# Always use .worktrees/ which is gitignored.
git worktree add -b feature/short-name .worktrees/short-name develop
cd .worktrees/short-name
```

**How to know which to use:** If you were spawned as a background agent (via `run_in_background: true` or as a team member), you MUST use `.worktrees/`. If you're the main interactive agent, use `../chapa-short-name`.

**Full lifecycle (same for both paths):**
```bash
# 1. CREATE — Start every task by creating a worktree (pick the right path above)
git worktree add -b feature/short-name <path> develop

# 2. WORK — All changes happen in the worktree directory
cd <path>
pnpm install  # Required — worktrees don't share node_modules
# ... write tests first, then implement, then commit

# 3. MERGE — After tests pass, merge back into develop
cd <main-project-directory>
git merge feature/short-name

# 4. CLEAN UP — Always remove the worktree and branch after merge
git worktree remove <path>
git branch -d feature/short-name
```

### Rules

1. **Auto-create**: When the user asks for any code change, immediately create a worktree. Do not ask — just do it.
2. **Isolate**: Each worktree = one logical change. Never mix unrelated changes.
3. **Install deps**: Run `pnpm install` in the worktree before running tests — worktrees don't share `node_modules/`.
4. **Test in worktree**: Run tests and type checks inside the worktree before merging.
5. **Merge cleanly**: Merge the feature branch into `develop` from the main repo directory.
6. **Always clean up**: Remove the worktree directory AND delete the branch after a successful merge. Never leave stale worktrees.
7. **Parallel work**: Multiple agents can work in separate worktrees simultaneously — this is one of the key benefits.
8. **Background agents use `.worktrees/`**: Agents spawned with `run_in_background: true` or as team members are sandboxed to the project directory. They CANNOT access `../chapa-*` paths. Always use `.worktrees/short-name` inside the project.
9. **If merge conflicts arise**: Resolve them in the main repo during merge, never in the worktree.

## Test-Driven Development (MANDATORY)

**NO code is written without a failing test first. No exceptions. Not even "small" changes.**

This is non-negotiable. Every feature, bug fix, and refactor follows this exact sequence:

1. **Red**: Write a failing test FIRST — before touching any implementation code
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Clean up while tests stay green

### Rules

- **Tests before code, always.** If you catch yourself writing implementation code without a test, stop and write the test first.
- **Bug fixes need a regression test.** Before fixing a bug, write a test that reproduces it. Then fix the code so the test passes.
- **Refactors need existing tests.** Before refactoring, ensure tests exist that cover the current behavior. If they don't, write them first.
- **No "I'll add tests later."** There is no later. Tests are written in the same worktree, in the same commit sequence, before the implementation.

### Test Conventions

- **File placement:** Tests live next to source files: `impact.ts` → `impact.test.ts`
- **Naming:** `<source-file-name>.test.ts` or `.test.tsx`
- **Structure:** Use `describe` blocks grouped by behavior area
- **Mocking:** Dependencies mocked at module level with `vi.mock()`, configured per test with `vi.mocked()`
- **API routes:** Test by importing the handler directly and passing a `NextRequest`

## Push Accountability (MANDATORY — Background)

**Every push to `develop` requires CI verification. No exceptions. No matter how small the change.**

**This runs as a background agent so the terminal stays unblocked.** After ANY `git push origin develop`, immediately spawn a background task (using `run_in_background: true`) that:

1. **Polls CI status** — `gh run list --limit 5` until the run completes
2. **If CI passes** — Log success, no interruption needed
3. **If CI fails** — Investigate with `gh run view <run-id> --log-failed`, fix the issue, and re-push — all in the background
4. **NEVER push to `main`** — Even if a background fix seems urgent, it stays on `develop`

The main terminal continues working on the next task immediately after pushing. The background agent owns the push outcome until CI is green on `develop`.

**If a background fix requires changes that conflict with current work**, notify the user before applying fixes.

## Production Safety (MANDATORY)

**Once deployed, the site is live at chapa.thecreativetoken.com. No agent touches `main` without explicit user authorization.**

**No agent may perform ANY of the following without the user explicitly saying "do it" or "go ahead" in the current conversation:**

1. **Push to `main`** — NEVER. Not even a typo fix.
2. **Create a PR targeting `main`** — NEVER. Only when the user requests a release.
3. **Merge a PR into `main`** — NEVER. The user authorizes production merges.
4. **Run `vercel` deploy commands** — NEVER for production. Preview deployments on `develop` are fine.
5. **Modify Vercel environment variables** — NEVER. The user does this.

**"Explicit authorization" means the user types something like:**
- "Create the release PR"
- "Go ahead and merge it"
- "Push to main"
- "Deploy to production"

**These do NOT count as authorization:**
- The user asking you to "fix a bug" (fix it on `develop`, don't release it)
- The user saying "ship it" about a feature (merge to `develop`, not `main`)
- CI being green (necessary but not sufficient)
- A previous conversation's authorization (authorization does not carry over)

### Production Release (develop → main)

**Step 1: User requests a release.** The agent does NOT initiate this.

**Step 2: Agent prepares a release summary:**
```bash
git log main..develop --oneline
gh run list --branch develop --limit 3
pnpm run test && pnpm run typecheck && pnpm run lint
```

Present: commits since last release, CI status, any known risks.

**Step 3: User confirms.** Only after explicit "go ahead":
```bash
gh pr create --base main --head develop --title "Release: description"
```

**Step 4: User authorizes merge.**
```bash
gh pr merge --merge
```

## Key Commands

```bash
# Before committing
pnpm run test           # Run all tests
pnpm run typecheck      # Check types
pnpm run lint           # Check linting

# Testing
pnpm run test:watch     # Watch mode
pnpm run test:coverage  # Coverage report

# Development
pnpm run dev            # Local dev server
pnpm run build          # Production build
```

## Environment Variables

Required in `.env.local`:
```
GITHUB_CLIENT_ID=          # GitHub OAuth App
GITHUB_CLIENT_SECRET=      # GitHub OAuth App
NEXTAUTH_SECRET=           # Session signing (if NextAuth)

UPSTASH_REDIS_REST_URL=    # Upstash Redis
UPSTASH_REDIS_REST_TOKEN=  # Upstash Redis

NEXT_PUBLIC_POSTHOG_KEY=   # PostHog analytics
NEXT_PUBLIC_POSTHOG_HOST=  # PostHog ingestion host
```

### Environment Variable Safety

**Always `.trim()` environment variables before use, especially API keys.**

When deploying to Vercel, env vars copied via CLI can include invisible trailing whitespace or newlines. This causes mysterious auth failures that look like wrong credentials.

```typescript
// ALWAYS do this:
const token = process.env.GITHUB_CLIENT_SECRET?.trim();

// Diagnosis if API calls fail mysteriously:
const rawLength = process.env.MY_VAR?.length ?? 0;
const trimmedLength = process.env.MY_VAR?.trim().length ?? 0;
if (rawLength !== trimmedLength) {
  console.error('Env var has invisible characters!');
}
```

## Development Guardrails

1. **No secrets in code** — Use env vars. Never commit tokens, keys, or credentials.
2. **No copyleft dependencies** — MIT, Apache-2.0, BSD, ISC only.
3. **Escape user input in SVG** — Any user-controlled text (handle, display name) must be escaped before rendering into SVG markup. This prevents XSS in embeddable badges.
4. **Health endpoint** — `/api/health` should exist for monitoring. Don't break it.
5. **No dead code** — Remove unused exports, imports, and files. Clean as you go.
6. **Pure functions for scoring** — Impact v3 compute and normalization must be pure functions with deterministic output for a given input. This makes them trivially testable.

---

# Agent Collaboration

## Agent Shared Context (The Chair Space)

**File:** `docs/agents/shared-context.md`

This is the cross-agent intelligence file. Every agent reads it before starting work and writes findings after finishing. It prevents duplicate work and compounds intelligence across sessions.

### Format

```markdown
<!-- ENTRY:START agent=agent_name timestamp=ISO8601 -->
## Agent Name — Date
- **Status**: GREEN/YELLOW/RED
- Key findings (bullet points)
- Metrics (numbers, coverage, sizes)

**Cross-agent recommendations:**
- [Other Agent]: specific actionable recommendation
<!-- ENTRY:END -->
```

### Rules

1. **Read before working.** Every agent checks shared context for relevant findings before starting.
2. **Write after finishing.** Every agent appends an entry with findings and cross-agent recommendations.
3. **Keep it pruned.** Maximum 3 entries per agent type. Oldest gets removed when a new one is added.
4. **Cross-agent recommendations are mandatory.** If your work affects another agent's domain, say so explicitly.
5. **Be specific.** "Security looks fine" is useless. "No XSS vectors in SVG rendering — all user input escaped via `escapeHtml()`" is useful.

### What Goes Here

- Test results and coverage numbers
- Security findings and accepted risks
- Performance metrics (bundle sizes, load times)
- Dependency changes and their impact
- Patterns discovered that other agents should follow
- Warnings about fragile areas of the codebase

## GitHub Issues Workflow

**GitHub Issues is the single source of truth for all planned work.**

### Auto-Filing Issues (MANDATORY)

**When the user mentions a bug, feature idea, enhancement, or task — create a GitHub issue immediately.** Do not wait to be asked. Do not ask "should I create an issue?" Just file it.

The user will throw ideas, complaints, observations, and requests in conversation. The agent's job is to:

1. **Parse what the user said** into a clear issue title and description.
2. **Classify it** with the right type, priority, and area labels.
3. **Create it via CLI** — `gh issue create --title "..." --label "..." --body "..."`.
4. **Report back** — show the issue number and URL so the user knows it's tracked.

If the description would benefit from more detail, **ask the user** before creating — but bias toward filing it now with what you have rather than blocking on perfect information. Issues can always be edited later.

**Multiple items in one message?** Create multiple issues. One issue per concern.

### Label Taxonomy

Every issue gets **exactly one type label** + **one priority label** + **area label(s)**.

**Type labels:**

| Label | Use when... |
|-------|-------------|
| `type: bug` | Something is broken |
| `type: feature` | Brand new functionality |
| `type: enhancement` | Improvement to an existing feature |
| `type: chore` | Maintenance, deps, CI, cleanup |
| `type: security` | Security vulnerability or hardening |
| `type: docs` | Documentation improvements |

**Priority labels:**

| Label | Meaning |
|-------|---------|
| `priority: critical` | Blocks demo, data loss, security vuln |
| `priority: high` | Major functionality affected |
| `priority: medium` | Important but not urgent |
| `priority: low` | Backlog, nice to have |

If unsure about priority, default to `priority: medium`.

**Area labels:**

| Label | Scope |
|-------|-------|
| `area: oauth` | GitHub OAuth, sessions, tokens |
| `area: scoring` | Impact v3 compute, normalization, tiers |
| `area: badge` | SVG rendering, themes, animations |
| `area: share-page` | Share page UI, embed snippets, OG meta |
| `area: cache` | Upstash Redis, TTL, cache invalidation |
| `area: infra` | CI/CD, Vercel, deployment, monitoring |
| `area: ux` | UI/UX, design, accessibility |

### Agent Rules for Issues

1. **Reference issues in commits.** Use `Fixes #N` or `Refs #N` in commit messages.
2. **Close issues when merged to `develop` with green CI.** No need to wait for production.
3. **When starting work on an issue**, mention the issue number in your first commit.
4. **Use the CLI:**
   ```bash
   # Create an issue
   gh issue create --title "Badge: heatmap colors too dark on light themes" --label "type: bug,priority: high,area: badge" --body "..."

   # List open issues by priority
   gh issue list --label "priority: critical"
   gh issue list --label "priority: high"
   ```

## Agent Autonomy

**Before asking the user to perform any manual step, exhaust all available tools first.**

Use these before telling the user "go to the dashboard and...":

1. **GitHub CLI** — `gh pr create`, `gh run list`, `gh issue view`
2. **Vercel CLI** — `vercel` for preview deployments (develop only)
3. **Bash** — pnpm scripts, git, curl
4. **MCP servers** — Check available tools in the session

Only ask for manual intervention when genuinely required (OAuth consent, billing, service-specific dashboards).

**EXCEPTION — Production-affecting actions require user authorization (see Production Safety):**
- Anything touching `main` branch (push, PR, merge)
- Production deployments
- External service configuration changes (Vercel env vars, DNS)

Agent autonomy applies to **development work on `develop`**. Production is user-controlled.

---

# Agent Teams

## Debug Mode

**Trigger:** User says "enter debug mode", "debug this", or "let's debug this"

When triggered, create a team of parallel investigators to diagnose the issue:

1. **Assess complexity** — Simple bugs (single component, clear error): 3 investigators. Cross-cutting issues (multiple systems, intermittent): up to 5.

2. **Create team** called "debug-squad" with investigators, each assigned a different hypothesis:
   - Each investigator focuses on a different area (API / client / cache / config / dependencies / etc.)
   - Each investigator must state their hypothesis upfront, then gather evidence
   - Investigators should actively try to disprove their own hypothesis
   - Time-boxed: if no evidence found after thorough investigation, report "hypothesis unlikely" and stop

3. **Synthesize findings** — After all investigators complete:
   - Rank hypotheses by evidence strength
   - Present the most likely root cause with supporting evidence
   - Propose a specific fix with code changes

4. **Do NOT auto-apply fixes** — Present the diagnosis and proposed fix to the user for approval. Only implement after the user confirms.

**Example team for a "badge SVG returns 500" bug:**
- Investigator 1: API route — check if the stats fetch and impact compute are working, verify request/response chain
- Investigator 2: Cache layer — check if Redis is reachable, verify cache hit/miss logic, check TTL behavior
- Investigator 3: SVG rendering — check if the React-to-SVG pipeline handles edge cases (missing data, null fields)

## Pre-Launch Audit (Agent Team)

**Trigger:** User says "run pre-launch audit", "audit before submission", or "pre-hackathon review"

Create a team called "pre-launch" with 3 parallel specialists to review the codebase before hackathon submission:

### Specialists

1. **qa-lead** — Quality Assurance
   - Run the full test suite: `pnpm run test && pnpm run typecheck && pnpm run lint`
   - Report total test count, pass rate, and any failures
   - Check test coverage for critical paths (scoring pipeline, SVG rendering, OAuth callback)
   - Verify all acceptance criteria from CLAUDE.md are met
   - Test the badge endpoint manually: `curl -s /u/test-handle/badge.svg`
   - Check for console errors, unhandled promise rejections
   - Verify graceful degradation: what happens when Redis is down? When GitHub rate-limits?

2. **security-reviewer** — Security Audit
   - Run `pnpm audit` and report vulnerabilities by severity
   - Check for hardcoded secrets (grep for API keys, tokens, passwords in source)
   - Verify OAuth implementation: token storage, callback validation, CSRF protection
   - Check SVG XSS vectors: is all user input (handle, display name) properly escaped?
   - Verify environment variables are not leaked to the client (no secrets in `NEXT_PUBLIC_*`)
   - Check CORS configuration on API routes
   - Verify cache keys cannot be manipulated (no injection in Redis key construction)
   - Check dependency licenses: no copyleft violations

3. **devops-reviewer** — Infrastructure & Deployment
   - Verify the production build succeeds: `pnpm run build`
   - Check all CI workflows are passing on `develop`
   - Verify environment variable documentation matches what's actually required
   - Check response headers on the badge endpoint (Cache-Control, Content-Type)
   - Verify domain configuration and redirects work
   - Check error boundaries and 404/500 pages exist
   - Verify health endpoint returns valid JSON
   - Check bundle sizes for any oversized chunks

### Output

Each specialist writes findings to `docs/agents/shared-context.md` using the standard entry format. The team lead synthesizes a final report:

```markdown
# Pre-Launch Audit Report
> Generated on [date]

## Verdict: READY / NOT READY

## Blockers (must fix before submission)
[Any critical issues]

## Warnings (accepted risks)
[Non-critical issues with justification]

## Detailed Findings
### Quality Assurance
[qa-lead findings]

### Security
[security-reviewer findings]

### Infrastructure
[devops-reviewer findings]
```

**Do NOT auto-fix issues.** Present the full audit to the user. The user decides what to fix and what to accept as risk before submission.

---

# Troubleshooting

## Vercel Environment Variables with Invisible Characters

**Symptom**: API calls fail with connection errors or "invalid request" despite correct-looking credentials.

**Cause**: Trailing whitespace/newlines from CLI copy-paste.

**Fix**: Always `.trim()` env vars (see Environment Variable Safety above).

**Prevention**: When adding env vars to Vercel via CLI, pipe values directly:
```bash
# Good
grep '^MY_VAR=' .env.local | cut -d'=' -f2- | vercel env add MY_VAR production

# Bad — may capture extra output
echo $MY_VAR | vercel env add MY_VAR production
```

## GitHub Rate Limiting

**Symptom**: Stats fetch returns 403 or empty data.

**Cause**: GitHub API rate limits (60/hr unauthenticated, 5000/hr authenticated).

**Fix**: Always serve cached data when available. If no cache exists and rate limit is hit, return a "try later" response — never an error page. Authenticated requests (OAuth token) get 80x more headroom.
