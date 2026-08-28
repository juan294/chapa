# Release New Chapa Version

Model tier: **sonnet** — Sonnet session.

`docs/release/release-playbook.md` is the single production-release procedure.
Read it completely before acting and execute it in order. Do not reconstruct,
shorten, or reorder its two gates from this command: **Gate 1 — approve the
release** (version choice and full diff approval, together) and **Gate 2 —
authorize production** (merge authorization and tag authorization, together,
granted once up front for the whole release-PR pipeline).

Also read:

- `CLAUDE.md` and the local authorization instructions;
- `docs/playbooks/e2e-pro-release-verification.md`;
- the current release evidence catalog; and
- each runbook linked by the release playbook when its arc applies.

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

Run the sequential preflight required by the playbook. Do not combine commands
in a way that masks an earlier exit status. Present the version choice and the
complete diff and exact verification results together.

**STOP — Gate 1: approve the release.** Covers version choice and full diff
approval together; approving one alone does not satisfy this gate. Approval
does not authorize a production PR, merge, deployment operation, tag, or
publication.

## Dispatch the playbook

**STOP — Gate 2: authorize production.** Covers PR authorization, merge
authorization, and tag authorization together, granted once, before resuming
the playbook. It authorizes the whole pipeline below — creating/reusing the
release PR, the externally billed verification dispatch, the eventual squash
merge, and the eventual tag/publish — as already-authorized steps that do not
reopen the gate. It does not authorize a non-PASS analyzer override, a
production data mutation, a migration, a cron invocation, a message, or an
environment change; each still needs its own explicit authorization.

After Gate 2, resume at **Authorize production and prepare inputs** in
`docs/release/release-playbook.md` and follow every subsequent section
exactly, without further stops for the steps Gate 2 already covers:

1. Create or reuse the `develop` to `main` release PR; never pass
   `--delete-branch` on merge, `develop` is permanent.
2. Import exact release-PR CI, including applicable pending-migration
   evidence, and obtain a pre-merge analyzer PASS. A non-PASS decision here
   blocks and requires a fresh, explicit override — Gate 2 does not grant it.
3. `gh pr merge --squash --auto`.
4. Verify `mainTreeDigest == candidateTreeDigest`, wait for production
   identity, run only the playbook's read-only production probes, and obtain
   the final analyzer PASS. A non-PASS decision here likewise blocks and
   requires a fresh, explicit override.
5. Only after the final analyzer PASS (or an explicit override), execute the
   playbook's named `git tag`, named tag push, and
   `gh release create --notes-file` commands.

## Integration rules

- `/release` is the sole version and tag authority.
- `/explore-release` receives the prepared candidate record and only returns
  evidence.
- A mutable branch, stale preview, wrong deployment identity, changed squash
  tree, zero-pass run, required miss, missing oracle, cleanup defect, incomplete
  charter, skipped high-risk area, or untriaged finding blocks.
- Required misses cannot be quarantined or excepted.
- Generated evidence remains outside the candidate tree.
- Production operations and outward effects require their own explicit
  authorization.
- Never push all tags; push the named release tag only.
- Never use `--body` for `gh release create`; use `--notes-file`.
- Always check for an existing release PR before creating another.
- Verify exact-SHA CI after every push.
- Attach the final manifest and report, then preserve their references for
  incident response and rollback.
