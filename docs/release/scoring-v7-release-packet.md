# Scoring v7 — release readiness packet

Date: 2026-09-06. Prepared under S20 (#1315).

**This packet authorizes nothing.** It records what was built, what was
verified, and what still blocks relaunch, so the owner can decide with the
facts in front of them. Release authorization, production migration
authorization, production recompute authorization and final owner review each
remain separate and explicit.

## Verdict

**Not ready to relaunch.** One blocker is open and it cannot be waived.

| | |
| --- | --- |
| Implementation | Complete: S01–S17, S19, S20. |
| Local verification | Complete and green. |
| Empirical pilot (S18) | **Not started. Blocks relaunch.** |
| S04 issue-API scope amendment | Awaiting the owner's explicit approval. |

## What is blocked, and why it stays blocked

The frozen policy requires a retrospective pilot of 24 profiles with at least
one independent human domain reviewer before relaunch. Nothing has been
executed. Starting it needs the owner's authorization to review the selected
public profiles read-only, to approach candidate participants for consenting
private evidence, and to engage that reviewer.

The fixtures in `apps/web/lib/impact/v7-fairness.test.ts` do not substitute for
it. They test this rubric against its own rules — arithmetic conformance, not
evidence about whether real reviewers can apply the rubric consistently. Calling
19 passing invariants a pilot would be the exact substitution the policy
forbids, and the results document says so in its own status table.

Full status: `docs/research/scoring-v7-validation-results.md`.

## What was built

| Phase | Delivered | Evidence |
| --- | --- | --- |
| S08 | Source evidence bound to the current grant; distributed refresh barrier | `supabase/migrations/046_*.sql`, `docs/research/2026-09-05-platform-refresh-safety.md` |
| S15 | One materializer, one projection, one what-if calculator, checked consumer registry | `docs/scoring-consumer-inventory.md` |
| S16 | Explanation from the receipt's own trace; evidence-aware badge labels; owner evidence workflow | `apps/web/lib/dashboard/receipt-explanation.ts` |
| S17 | v7 methodology with generated figures; bilingual copy; prohibited-claims gate | `docs/impact-v7.md`, `apps/web/lib/i18n/dictionaries/claims.test.ts` |
| S18 | 19 matched-pair invariants; 16-variant sensitivity analysis | `docs/research/scoring-v7-validation-results.md` |
| S19 | Additive cache namespace; idempotent dry-run migration; transition runbook | `docs/runbooks/scoring-v7-transition.md` |

## Local verification

Run sequentially, never concurrently, against the release candidate:

| Gate | Result |
| --- | --- |
| `pnpm run typecheck` | pass |
| `pnpm run lint` | pass (0 errors) |
| `pnpm run test` | pass |
| `pnpm run build` | pass |
| `pnpm run test:coverage` | pass, all module thresholds met |
| `pnpm run check:circular` | pass |
| `pnpm run check:write-registration` | pass |
| `pnpm run validate:migrations` | pass, 001 → 046 |
| `pnpm run test:contract:local` | pass, against migrations 001–046 on the disposable project |
| SVG/PNG raster path | `svg-to-png.raster.test.ts` rasterizes for real, in-suite |

Logs are under `logs/scoring-v7/`.

## Reconciling the playbook's Preview requirement with the no-Preview rule

`docs/release/release-playbook.md` §3 requires a Vercel Preview proof bound to
the exact candidate commit. The frozen policy for this work states that **no
Vercel preview deployment is permitted**. Both stand; they are not reconciled by
waiving either.

The resolution is sequencing, not substitution:

1. **During implementation** — the state this packet describes — no Preview is
   created and the playbook's §3 is not entered. Verification is the local
   evidence above, which is why every gate is run against the exact candidate
   tree rather than a deployed artifact.
2. **At the moment the owner authorizes publication**, the no-Preview
   constraint is lifted by that authorization and §3 runs unchanged. The
   playbook's Preview proof is a required check and is never skipped, waived, or
   replaced by the local evidence.

Local artifact verification is therefore a *precondition* for requesting
authorization, not a replacement for the Preview proof. Anyone reading this
packet as permission to skip §3 has read it wrong.

## Remote triggers, audited read-only

A push to `develop` starts these GitHub Actions workflows. This was read from
`.github/workflows/` and nothing was dispatched:

| Workflow | Trigger on `develop` push |
| --- | --- |
| `ci.yml` | yes |
| `security.yml` | yes (docs paths ignored) |
| `gitleaks.yml` | yes |
| `coverage.yml` | yes |
| `bundle-size.yml` | yes (docs paths ignored) |
| `knip.yml` | yes (docs paths ignored) |
| `lighthouse.yml` | no — pull_request only |
| `release-verification.yml` | no — `workflow_dispatch` only |
| `nightly-prod-probe.yml` | no — schedule / dispatch only |
| `claude-review.yml` | no — pull_request / comment only |
| `validate-merged-pr.yml` | no — `workflow_call` only |

Two consequences the owner should decide on before any push:

- **Six workflows consume paid minutes per push to `develop`.** Three of them
  ignore documentation-only paths; three do not.
- **The Vercel Git integration, if connected, deploys on push.** A push to
  `develop` would create a Preview and a push to `main` would deploy
  production. That must be confirmed read-only before pushing, because a
  Git-triggered Preview is exactly what the policy prohibits during this work.
  Nothing here dispatches a workflow, opens a PR, sends email or mutates
  production data.

## What the owner is being asked to decide

1. Authorize (or decline) the S18 pilot: read-only review of selected public
   profiles, outreach for consenting private evidence, and engagement of an
   independent human domain reviewer.
2. Approve (or decline) the S04 issue-API scope amendment.
3. Separately, when and if the above close: release authorization, production
   migration authorization and production recompute authorization.

Until 1 and 2 close, relaunch stays blocked. That is the honest state, and it is
not improved by describing it any other way.
