# Plan: Creator Studio Revival

Date: 2026-08-26
Research input: `docs/research/2026-08-26-creator-studio-revival-viability.md`
Scope: bring the hidden Creator Studio back to production-ready state.
**Excluded** (explicit decisions): config→share-page rendering bridge, SVG
customization, all WebMCP/tool-registration work, judge demo mode — those
belong to the follow-up hackathon plan.

## Context (from research, all verified)

The Studio is hidden behind `studio_enabled=false` (prod DB, since
2026-02-18). Code health is green: typecheck clean, 168/168 studio tests
pass, schema parity enforced by test, CI release gate exercises save/readback
every release. Defects to fix before re-enabling: the page's initial load
bypasses the durable store; PUT maps every DB failure to a flat 500; the
preview no longer matches the served badge (missing branding row +
verification strip); three hand-maintained alias tables; hardcoded prod URLs
in `/embed` & `/share`; stale docs.

## Phase overview

| Phase | Title | Files | Batch |
| --- | --- | --- | --- |
| 1 | Config persistence hardening (load path + PUT seam) | `app/studio/page.tsx`, `app/api/studio/config/route.ts`, `lib/db/studio.ts` (+tests) | — |
| 2 | Command-layer cleanup (alias consolidation + base URL) | `components/terminal/command-registry.ts`, `app/studio/useStudioCommands.ts`, `app/studio/QuickControls.tsx` (+tests) | [batch-eligible] |
| 3 | Preview parity (branding row + verification strip) | `app/studio/BadgePreviewCard.tsx`, new `PreviewFooter`, `app/studio/StudioClient.tsx`, `app/studio/page.tsx` (+tests) | after Phase 1 (page.tsx overlap); [batch-eligible] with Phase 2 |
| 4 | Documentation refresh | `docs/spec.md`, `docs/user-manual.md`, `docs/demo.md` | [batch-eligible] |
| 5 | Production flag flip (runbook, MANUAL) | none (admin API call) | last; requires Juan's explicit authorization |

## Implementation status

- [x] Phase 1 — Config persistence hardening
- [x] Phase 2 — Command-layer cleanup
- [x] Phase 3 — Preview parity
- [ ] Phase 4 — Documentation refresh
- [ ] Phase 5 — Production flag flip

Phases 2 and 4 have no file overlap with anything → `/batch` can run them in
parallel with each other and with Phase 3 (Phase 3 only after Phase 1).

## Success criteria

Automated (all phases): `pnpm run typecheck && pnpm run lint && pnpm run
test` green from repo root; studio-scoped `vitest run apps/web/app/studio
apps/web/app/api/studio` green; coverage thresholds (global 75/70/65/75,
`vitest.config.ts:48`) hold via `pnpm run test:coverage`; write-route
registration gate `pnpm run check:write-registration` passes; contract tests
for `/api/studio/config` pass via `pnpm run test:contract:local` (needs
`supabase start`; fails loudly if the local stack is unreachable). Full suite after every
phase (repo rule: run all verification after config/infra-adjacent changes).

Manual (Phase 5 only): flag flip + live verification checklist — see
phase-5.md. Production-affecting: **do not execute without Juan's explicit
go**.

## TDD

Every behavioral change lands red-green: the phase files name the failing
test to write first, pointing at the existing test file it extends.

Phase details in `2026-08-26-creator-studio-revival-phases/phase-N.md`.
