# Release New Chapa Version

Read `docs/release/release-playbook.md` completely before acting. It is the
single release procedure. Also read `CLAUDE.md`, the standing owner instructions
and applicable operational runbooks. `/release` alone owns version/tag work;
implementation completion does not authorize production.

## Prepare a concrete candidate

Identify the version, full release diff, changed manifests, migrations,
retirement review and risks. Finish version/changelog/docs before local
qualification. Present them with completed local results at
**Gate 1 — approve the release**: version choice and full diff approval
together.
Existing authorization persists; do not reopen a gate already explicitly
satisfied by the user.

Freeze the exact commit and full `candidateTreeDigest`. Run the full local
checks and production-mode loopback probes required by the playbook. Record
schema2 `local-candidate` proof with an allowlisted build manifest. Required
gates cannot be absent, failed or skipped. Proof and reports stay outside the
tracked candidate. Any later tracked commit, including documentation, requires
requalification; artifact equality alone is insufficient.

No Vercel Preview deployment, workflow dispatch, hosted build or remote PR is
part of qualification. Never call localhost Preview or set
an invented Preview environment. Keep implementation branches/worktrees local and merge
finished work locally into `develop`.

## Remote admission and production

Before any push, inspect remote workflow/platform triggers read-only and prove
Preview creation is prevented. An Ignored Build Step that skips a created
deployment is insufficient. If documented non-destructive prevention is not
available, stop before push and identify that trigger.

**Gate 2 — authorize production** covers the PR authorization, merge authorization,
tag authorization and publication together. It does not authorize migrations,
production recompute, crons, messages, environment changes or rollback. Follow
the playbook's exact ordering after authorization:

1. Push only the completed, locally qualified integration branch once, after
   proving Preview prevention. Create/reuse the authorized `develop` to `main`
   release PR with a body file; never a feature-PR debugging loop.
2. Require exact-head checks, real production migration admission, immutable
   local proof and prospective merge-tree equality. Missing/skipped checks block.
3. Merge with `gh pr merge --merge --auto`; never squash or delete `develop`.
4. Require `mainTreeDigest == candidateTreeDigest`, actual production identity,
   and the default production probes. Local proof is not production proof.
5. Only then execute the named tag push and `gh release create --notes-file`,
   read back tag/release, and write schema2 final proof referencing the exact
   local-candidate proof.

A post-deployment failure is not a pre-deployment `BLOCKED` result. Use the
playbook's `PAUSED`, `BLOCKED`, `ROLLED_BACK` and `PUBLICATION_PENDING` meanings.
Never claim a rollback happened without separately authorized execution.
`/prodplaybook` and `/explore-release` remain explicit risk-selected checks,
not required remote work during local qualification.
