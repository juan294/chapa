# Release New Chapa Version

Model tier: **sonnet** — Sonnet session.

`docs/release/release-playbook.md` is the single production-release
procedure. Read it completely before acting and execute it in order. Do not
reconstruct, shorten, or reorder its two gates from this command: **Gate 1 —
approve the release** (version choice and full diff approval, together) and
**Gate 2 — authorize production** (merge authorization and tag authorization,
together, granted once up front for the whole release pipeline).

Also read `CLAUDE.md` and the local authorization instructions, and each
runbook linked by the release playbook when its arc applies. Deep/exhaustive
verification (`/prodplaybook`, `/explore-release`) is separate, explicit, and
risk-selected — it is not a required step of this command and never gates a
default release.

## Inputs and orientation

Detect the current version from `apps/web/package.json`. Resolve the release
baseline from the exact production identity as specified by the playbook:
production `/api/version` must report `production`, its commit must equal
`origin/main`, and the annotated release tag must dereference to that commit.
Do not use `git describe` or `develop` ancestry to select the baseline. Compute
changes from that immutable tag to current `develop`. Search both the bare and
`v`-prefixed current version across the repository so all manifests, badges,
documentation, and lockfile references are included.

Present:

- current version and latest release tag;
- categorized commits and changed paths;
- every version-bearing file;
- migrations and release-sensitive vendor/infrastructure changes;
- exact `develop` and `main` refs;
- exact-SHA CI state;
- known risks; and
- the retirement review result.

Do not stop here. Choose the version (never guess or auto-increment beyond a
reasoned semver decision) and carry it into Preparation; it will be presented
for approval together with the diff at Gate 1, not on its own.

## Preparation

Update the selected version, changelog entry, and every current version
reference. Re-run the old-version search and explain every remaining historical
match.

Run the bounded local release checks required by the playbook. Do not combine
commands in a way that masks an earlier exit status. Present the version
choice and the complete diff and results together.

**STOP — Gate 1: approve the release.** Covers version choice and full diff
approval together; approving one alone does not satisfy this gate. Approval
does not authorize a production PR, merge, deployment operation, tag, or
publication.

## Dispatch the playbook

**STOP — Gate 2: authorize production.** Covers PR authorization, merge
authorization, and tag authorization together, granted once, before resuming
the playbook. It authorizes the whole pipeline below — creating/reusing the
release PR, the Preview proof dispatch, the eventual squash merge, and the
eventual tag/publish — as already-authorized steps that do not reopen the
gate. It does not authorize a production data mutation, a migration, a cron
invocation, a message, an environment change, or a rollback; each still needs
its own explicit authorization.

After Gate 2, resume at **Authorize production and push the candidate** in
`docs/release/release-playbook.md` and follow every subsequent section
exactly, without further stops for the steps Gate 2 already covers:

1. Create or reuse the `develop` to `main` release PR; never pass
   `--delete-branch` on merge, `develop` is permanent.
2. In one concurrent observation wave, watch the exact required PR checks
   (including `Pending Migrations Check (release PR)`) and the dispatched
   Preview proof's `release-result.json`. A missing, skipped, or failed
   required check, or a non-passed direct-check status, blocks (`BLOCKED`).
3. `gh pr merge --squash --auto`.
4. Verify `mainTreeDigest == candidateTreeDigest`, wait for production
   identity, and run only the playbook's four default production scenarios.
   A failure here means production already changed (`ROLLED_BACK`-eligible),
   not `BLOCKED` — see the playbook's Recovery outcomes.
5. Only after those pass, execute the playbook's named `git tag`, named tag
   push, and `gh release create --notes-file` commands, then read back the
   tag and GitHub Release before reporting done.

## Integration rules

- `/release` is the sole version and tag authority.
- Direct commands are authoritative: a required CI check conclusion, the
  `release-result.json` direct-check status, and a plain identity comparison
  are the proof — there is no analyzer decision layered on top of them.
- A mutable branch, stale preview, wrong deployment identity, changed squash
  tree, a failed or missing required check, or a failed direct probe blocks.
- Required misses cannot be quarantined or excepted.
- Generated results remain outside the candidate tree.
- Production operations and outward effects require their own explicit
  authorization.
- Never push all tags; push the named release tag only.
- Never use `--body` for `gh release create`; use `--notes-file`.
- Always check for an existing release PR before creating another.
- Verify exact-SHA CI after every push.
- Preserve the final `release-result.json` reference for incident response
  and rollback.
