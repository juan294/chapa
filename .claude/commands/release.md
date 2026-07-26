# Release New Chapa Version

Model tier: **sonnet** — Sonnet session.

`docs/release/release-playbook.md` is the single production-release procedure.
Read it completely before acting and execute it in order. Do not reconstruct,
shorten, or reorder its gates from this command.

Also read:

- `CLAUDE.md` and the local authorization instructions;
- `docs/playbooks/e2e-pro-release-verification.md`;
- the current release evidence catalog; and
- each runbook linked by the release playbook when its arc applies.

## Inputs and orientation

Detect the current version from `apps/web/package.json`, find the latest release
tag, and compute changes from that immutable baseline to current `develop`.
Search both the bare and `v`-prefixed current version across the repository so
all manifests, badges, documentation, and lockfile references are included.

Present:

- current version and latest release tag;
- categorized commits and changed paths;
- every version-bearing file;
- migrations and release-sensitive vendor/infrastructure changes;
- exact `develop` and `main` refs;
- exact-SHA CI state;
- known risks; and
- the retirement review result.

**STOP — version choice.** Never guess or automatically increment the version.

## Preparation

Update the selected version, changelog entry, and every current version
reference. Re-run the old-version search and explain every remaining historical
match.

Run the sequential preflight required by the playbook. Do not combine commands
in a way that masks an earlier exit status. Present the complete diff and exact
verification results.

**STOP — full diff approval.** Approval of the diff does not authorize a
production PR, merge, deployment operation, tag, or publication.

## Dispatch the playbook

After full diff approval, resume at **Fix the candidate** in
`docs/release/release-playbook.md` and follow every subsequent section exactly.

Maintain these independent stops:

1. **STOP — external CI/preview authorization** when a new paid or
   externally-dispatched verification run is required.
2. **STOP — PR authorization** before creating or reusing the `develop` to
   `main` release PR as an active release operation.
3. Import exact release-PR CI, including applicable pending-migration evidence,
   and obtain a pre-merge analyzer PASS.
4. **STOP — merge authorization.** PR authorization never implies merge
   authorization.
5. Only after merge authorization:

   ```bash
   gh pr merge --squash --auto
   ```

   Never pass `--delete-branch`; `develop` is permanent.
6. Verify `mainTreeDigest == candidateTreeDigest`, wait for production identity,
   run only the playbook's read-only production probes, and obtain the final
   analyzer PASS.
7. **STOP — tag authorization and GitHub release authorization.** Analyzer PASS
   never implies authorization.
8. Only then execute the playbook's named `git tag`, named tag push, and
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
