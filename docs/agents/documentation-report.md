# Documentation Report
> Generated: 2026-04-10 | Health status: **GREEN**

## Executive Summary
All documentation is current and accurate — 44/44 API routes documented (100%), 38/38 color tokens verified, all required docs present and non-empty, and no stale or missing documentation detected. No action items required.

---

## Route Documentation

### Status Summary
- **Total pages documented**: 15/15 (100%)
- **Total API routes documented**: 44/44 (100%)
- **Mismatches found**: 0

### Pages
| Route | Documented in CLAUDE.md | Exists in code | Status |
|-------|------------------------|---------------|--------|
| `/` | ✓ | ✓ | OK |
| `/studio` | ✓ | ✓ | OK |
| `/admin` | ✓ | ✓ | OK |
| `/u/:handle` | ✓ | ✓ | OK |
| `/verify/:hash` | ✓ | ✓ | OK |
| `/about` | ✓ | ✓ | OK |
| `/about/scoring` | ✓ | ✓ | OK |
| `/about/verification` | ✓ | ✓ | OK |
| `/archetypes/*` (7 routes) | ✓ | ✓ | OK |
| `/generating/:handle` | ✓ | ✓ | OK |
| `/cli/authorize` | ✓ | ✓ | OK |
| `/privacy` | ✓ | ✓ | OK |
| `/terms` | ✓ | ✓ | OK |
| `/coming-soon` | ✓ | ✓ | OK |
| `/verify` | ✓ | ✓ | OK |
| `/experiments/*` (13 routes) | ✓ | ✓ | OK |

### API Routes
All 44 API routes documented and present in code:
- **Auth routes**: 11/11 ✓
- **Public API routes**: 10/10 ✓
- **Authenticated API routes**: 9/9 ✓
- **Admin API routes**: 9/9 ✓
- **Webhooks & Cron routes**: 5/5 ✓

---

## Color Token Audit

### Status Summary
- **Total tokens in globals.css**: 38
- **Total tokens in design-system.md**: 38
- **Mismatches**: 0

All tokens verified across base colors, semantic colors, dimension colors (delivery, quality, consistency, breadth, craft + light variants), archetype colors (7), track, and shadows. All hex values in globals.css match design-system.md for both light and dark theme variants.

---

## Required Docs Status

| File | Exists | Non-empty | Notes |
|------|--------|-----------|-------|
| `docs/impact-v4.md` | ✓ | ✓ | 131 lines |
| `docs/impact-v6.md` | ✓ | ✓ | 270 lines |
| `docs/svg-design.md` | ✓ | ✓ | 173 lines |
| `README.md` | ✓ | ✓ | 215 lines — description, setup, key commands present |
| `docs/design-system.md` | ✓ | ✓ | 234 lines |
| `docs/agents/shared-context.md` | ✓ | ✓ | Latest entry: 2026-04-10 (Coverage Agent) |

---

## Stale Documentation

None detected. All documentation is synchronized with current code.

---

## Missing Documentation

None identified. JSDoc coverage is complete on all public exports across critical paths:
- `lib/validation.ts`: all public functions documented ✓
- `lib/cache/redis.ts`: all exported functions documented ✓
- `lib/render/BadgeSvg.tsx`: `renderBadgeSvg` documented with param descriptions ✓
- `packages/shared/src/types.ts`: all interfaces documented ✓

---

## Environment Variables

### Status Summary
- Documented in CLAUDE.md: 31 variables
- Production vars used in code: 31 (all match)
- Standard/test-only vars used in code: 6 (intentionally not in CLAUDE.md)

### Documented and in use (31/31 — all GREEN)
All vars listed in CLAUDE.md lines 292–337 are actively used in production code.

### In code but not documented (intentional omissions)
| Variable | Usage | Justification |
|----------|-------|---------------|
| `ANALYZE` | `next.config.ts:5` | Dev-only bundle analyzer — documented inline |
| `CI` | `playwright.config.ts` | Universal CI marker — not project-specific |
| `NODE_ENV` | `next.config.ts:8` | Universal Node.js — not project-specific |
| `VERCEL_ENV` | Various | Documented in CLAUDE.md line 335 |
| `TESTPLATFORM_CLIENT_ID` | `platform-oauth.test.ts` | Test scaffolding only — confirmed prior audit |
| `TESTPLATFORM_CLIENT_SECRET` | `platform-oauth.test.ts` | Test scaffolding only — confirmed prior audit |

**Assessment**: No production env var gaps. All omissions are standard build/test vars.

---

## TODO/FIXME Doc References

None found in production code. No genuine unresolved doc-related TODOs.

---

## Recommendations

All documentation is current. No action items required.

| Priority | Item | Status |
|----------|------|--------|
| — | Route documentation (44/44) | ✓ COMPLETE |
| — | Color token verification (38/38) | ✓ COMPLETE |
| — | Required docs (6/6) | ✓ COMPLETE |
| — | Env var coverage (31/31 production) | ✓ COMPLETE |
| — | JSDoc on public exports | ✓ COMPLETE |
| CARRIED | BadgeToolbar flaky test (from coverage agent) | Not a docs issue — see coverage report |
