# Open-Issue Remediation Plan — 2026-06-20

## Context
Triaged all 44 open GitHub issues against current code (post v2.11.0, which shipped GitLab
+ 60 remediation findings). 16 were verified STALE and closed. This plan covers the 28
remaining VALID issues, grouped into implementation lanes by file-locality to enable
isolated, conflict-free TDD work.

## Triage outcome
- **Closed STALE (16):** #855, #811, #758, #759, #761, #776, #755, #791, #769, #779, #782,
  #777, #814, #729, #754, #772.
- **Valid, in scope (28):** below.

## Implementation lanes

### Lane A — Platform stats / shared (code)
- **#748** AR-M6: add `tsc -b` build step to `packages/shared`, emit `dist/`, fix main/types/exports.
- **#747** AR-M5: add `normalizeStats(partial): StatsData` in `@chapa/shared`; route all 3
  (bitbucket/codeberg/gitlab) aggregators through it — single source of truth for defaults.
- **#757** PE-M2: short-circuit platform DB reads on stats cache miss (skip `dbGetLinkedPlatform`
  when no linked platforms; cache a `platforms:<handle>` Redis flag).
- **#744** AR-H2: unify duplicated platform fetch stacks behind a `PlatformFetcher` interface /
  `fetchLinkedPlatform()` helper.

### Lane B — TypeScript config (code)
- **#746** AR-M4 (+#772): add `tsconfig.base.json`; all tsconfigs extend it; bump `apps/web`
  ES2017 → ES2022 (validate edge-runtime compatibility).

### Lane C — Frontend core (hooks/stores/components) (code)
- **#745** AR-M1: consolidate `apps/web/lib/hooks/` into `apps/web/hooks/`; fix import sites.
- **#774** FE-S1: add `createModuleStore<T>()` primitive + ADR; migrate `useSession`,
  `KeyboardShortcutsListener`, `UserMenu` to it.
- **#756** FE-M7: extract duplicated inline SVG icons into a shared icon module.
- **#780** UX-L2: replace `rounded-full` with `rounded-lg` on text/CTA content (AuthorTypewriter).

### Lane D — Render (code)
- **#760** PE-M5: add `disableAnimation` flag to heatmap render; emit `opacity=1` cells for
  `<img>` embeds (GitHub README visibility).

### Lane E — Test infra & coverage (tests)
- **#762** QA-M1: replace `fs.readFileSync` source-grep page tests with real server-component
  tests (mock `next/headers`, invoke page, assert redirect).
- **#763** QA-L1: add render smoke test for `experiments/hexmap/page.tsx` (or document acceptance).
- **#764** QA-L3: add warm-cache failure-path tests (rotation wrap-around, cleanup throws,
  warmHandle null).
- **#765** QA-L5: suppress jsdom navigation warnings in `vitest.setup.ts`.
- **#817** QA-L1: stub navigation/error logging in GlobalCommandBar + agent-utils tests.

### Lane F — Landing UX (code)
- **#770** UX-M8: add loading/pending state to landing CTA buttons.
- **#781** UX-L4: vary colors across enterprise example rows.

### Lane G — CI config
- **#752** DO-L2: add `/u/:handle` to Lighthouse URLs; flip accessibility to error threshold.
- **#753** DO-L3: document/strengthen the existing `deployment-smoke` preview job.

### Lane H — Docs / ADRs (no code risk; delegated, parallel)
- **#771** AR-S1: package-extraction roadmap ADR (`packages/impact-engine`, `packages/badge-renderer`).
- **#773** DO-S1: deployment-stack ADR (Vercel + Upstash + Supabase + Resend).
- **#815** AR-S1: runtime-boundary ADR (public vs admin/cron/campaign split).
- **#775** PE-L1: Supabase-client weight investigation note + recommendation.
- **#783** UX-S1: terminal-metaphor escape-hatch ADR (needs product sign-off — recommend, don't force).
- **#778** SE-L4: CSP `unsafe-inline` accepted-risk + nonce migration plan (do NOT ship risky
  middleware to the live site untested).
- **#751** DO-L1: observability / log-drain runbook (Axiom). Actual drain wiring is a user dashboard action.

### Lane I — ESLint 10 (code, attempt-or-document)
- **#531**: attempt ESLint 9 → 10. With flat config + `eslint-config-next@^16`, the old
  `eslint-plugin-react` deprecation blocker may be gone. If clean, ship; else document findings
  and keep deferred.

### Lane J — Experiments refactor (code, lowest value)
- **#516**: extract sub-components from the 800+-line gated experiment pages (tier-visuals,
  particles, glassmorphism).

## Execution
- All work on branch `chore/issue-remediation-2026-06-20` (off `develop`), TDD per change.
- Verify `pnpm run test && pnpm run typecheck && pnpm run lint` green before merge.
- Merge to `develop` locally, then a **single** push. Monitor CI to green. **No push to `main`.**
