# Release Capability Checklist

Canonical authority: `docs/release/release-playbook.md`.
[The release playbook](../release/release-playbook.md) is the sole ordering and
authorization authority. This checklist grants no push, PR, production,
migration, message, tag or publication permission.

## Local-candidate observations

Record the exact candidate commit/full tree, allowlisted build manifest,
loopback target, executor, time and evidence paths outside the tracked candidate.
Use a production-mode local server and synthetic fixtures. Required selectors
must be discovered and executed; skipped/absent gates are not passes.

| Flow | Local evidence |
|---|---|
| Source/build identity | Clean exact commit/tree and manifest artifact hashes match the running local build. |
| Public badge/share | Read-only fixture SVG and page show the same policy, canonical points and receipt identity. |
| Craft states | Four axes without report; measured57/0 have five; expired keeps label without current numeric vertex. |
| Verification | Current, superseded, revoked and unknown states retain issuance/arithmetic distinctions. |
| Locale | EN/ES and320px figures preserve score precision and unlocked Craft state. |
| Protected write | Unauthenticated fixture request is denied without success. |
| Owner interactions | Only local synthetic fixture writes; Save/readback/restore prove their actual outcomes. |
| Flag rollback | Active receipts survive; read selection changes, both image policies are fenced/purged, failure outcomes stay explicit. |

The full applicable browser suite is required alongside the release probes.
Elapsed observation time alone proves nothing. No hosted Preview, live email,
provider workflow or production rehearsal is part of this local checklist.

## Production admission, after separate authorization

Inspect remote workflow/platform triggers read-only before any push. Prevent
Preview creation; an Ignored Build Step that skips a created deployment is
insufficient. Stop before push if documented non-destructive prevention is absent.

Real production migration admission remains pending until authorized read
credentials are available. Missing/skipped/failed required migration checks
block promotion; a local database result cannot replace them. Applying a
migration or recompute is separately authorized. See [migrations.md](migrations.md).

Identify the previous actual production deployment/commit and annotated
rollback reference. Confirm its proof/artifact is retrievable, distinguish code
rollback from schema recovery, and name the operator and triggers. Scoring
selection rollback uses [the flag protocol](scoring-v7-transition.md), not
receipt deletion or a migration rollback.

## Operational readiness

Inspect actual authorized production alert configuration and cron heartbeats;
do not assume configuration recorded in an old runbook is still current.
`apps/web/vercel.json` owns schedule and duration declarations.
`pnpm run check:vercel-config` checks their local configuration.

Reading readiness is separate from invoking a job. Do not call warm-cache,
audience synchronization, campaign processing or latency cron routes merely
to complete this checklist. Messages, environment changes and job invocations
require explicit authorization and their own readback.

## Release metadata and final readback

Version, changelog and current references must be finalized before candidate
qualification. No tracked commit may follow qualification without rebinding and
rerunning the resulting candidate. The authorized release PR references exact
local proof; it does not introduce a new source tree.

After promotion verify main/candidate tree equality, actual production identity,
production probes and migration admission. Only then tag/publish and read back
the remote tag target and GitHub Release. Preserve schema2 final proof alongside
its local-candidate proof. Production success with incomplete publication is
`PUBLICATION_PENDING`, not permission to redeploy.
