# Plan: Challenge My Score (Issue #933)

> Created 2026-06-25. References research doc: `docs/research/2026-06-25-challenge-my-score.md`.

---

## Overview

Add a "Something seem off?" CTA at the bottom of the `ScoreExplanationPanel` (already shipped by #932). Clicking it reveals an inline textarea form. On submit, a `POST /api/challenge` route validates, rate-limits, and sends an email to `SUPPORT_FORWARD_EMAIL` via Resend. Submission is owner-only. Storage is email-only (no Supabase table). Support receives the handle, current score details, and the user's written concern.

---

## Design Decisions

| Decision | Choice | Rationale |
|---------|--------|-----------|
| Form location | Inline within `ScoreExplanationPanel` | Consistent with existing expand pattern; no dialog needed |
| Storage | Email-only (Resend → `SUPPORT_FORWARD_EMAIL`) | No migration needed; matches `notifications.ts` pattern |
| Reply contact | GitHub handle in email body | Session already authenticated; no extra form field |
| Who can submit | Owner only (`isOwner === true`) | Issue is "challenge MY score" — visitors don't submit |
| Form state machine | `"cta" → "form" → loading → "success" \| "error"` | Matches `EmptyImpactState` status pattern |

---

## Phase Structure

| Phase | Description | Batch-eligible |
|-------|-------------|----------------|
| 1 | i18n keys (en.ts + es.ts) | yes |
| 2 | Email helper (`lib/email/challenge.ts`) | yes |
| 3 | API route (`/api/challenge`) | no — depends on Phase 2 |
| 4 | `ChallengeForm` component + panel wiring | no — depends on Phases 1 + 3 |

**Phases 1 and 2 have no file overlap and no inter-dependency — `/batch` can run them in parallel.**

---

## Constraints

- No `process.env` access outside `apps/web/lib/env.ts` (ESLint `no-process-env` rule).
- All new i18n keys must appear identically in both `en.ts` and `es.ts` or the parity test fails.
- Rate limiter is fail-open when Redis is unavailable (existing design, do not change).
- Email send uses `withTimeout` wrapper (same as all other email helpers).
- TDD: every phase starts with failing tests.
- All new files use the `server-only` import where appropriate.
- No copyleft dependencies.

---

## Success Criteria

### Automated
- [x] `pnpm run test` passes (all 4 new test files green)
- [x] `pnpm run typecheck` passes (no new TS errors)
- [x] `pnpm run lint` passes (no ESLint violations)
- [x] `pnpm run check:circular` passes (no new circular deps)
- [x] Parity test passes (`en.ts` and `es.ts` key trees match)
- [x] Bundle size gate passes (no chunk exceeds 350 KB)

### Manual
- As profile owner: visit `/u/<handle>`, expand "How is my score calculated?", see "Something seem off?" CTA at the bottom.
- Click CTA → textarea form appears with heading, label, placeholder, submit + cancel buttons.
- Submit blank or too-short text → inline validation error appears, form stays open.
- Submit valid text → "Sending…" state → success callout replaces the form.
- As visitor (different logged-in account): no CTA visible.
- Logged-out visitor: no CTA visible.
- Submit 4 challenges within 24h → 4th receives a rate-limit error message.

---

## Phase Files

- [`phase-1.md`](./2026-06-25-challenge-my-score-phases/phase-1.md) — i18n keys
- [`phase-2.md`](./2026-06-25-challenge-my-score-phases/phase-2.md) — Email helper
- [`phase-3.md`](./2026-06-25-challenge-my-score-phases/phase-3.md) — API route
- [`phase-4.md`](./2026-06-25-challenge-my-score-phases/phase-4.md) — Component + wiring
