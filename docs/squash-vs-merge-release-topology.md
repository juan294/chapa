# Does your repo pay the squash-release tax?

A finding from chapa, 2026-08-30, written to be read by other repositories.
Portable to any repo with a long-lived `develop` and `main`.

**Evaluate it, do not apply it blindly.** The "When this does NOT apply"
section near the end is the part to read first. Every number below was measured
on one machine at one moment — re-run the diagnostic in your own repo rather
than trusting this table.

Chapa's own change is `d4eb9abb`; the reasoning is on issue #1228.

## The mechanism

If you release by squash-merging `develop` into `main`:

A squash creates a commit on `main` whose *content* matches `develop` but whose
*ancestry* does not. Git can no longer see that `main`'s changes are already in
`develop`. So `main`'s tip stops being an ancestor of `develop`, and the **next**
release PR computes its merge-base against a stale point.

The consequences compound per release:

1. The release PR eventually comes back `CONFLICTING`.
2. A conflicting PR means GitHub never creates `refs/pull/N/merge`.
3. No `refs/pull/N/merge` means **no `pull_request` event fires**.
4. So every `pull_request`-triggered check reports **`skipped`, not `failed`**.

Step 4 is the dangerous one. A gate that reports `skipped` looks fine on a
dashboard. In chapa this nearly let a database migration ship behind a
migrations gate that never ran.

The usual mitigation is to merge `main` back into `develop` with
`git merge -s ours` after every release, preserving `develop`'s tree
byte-for-byte while restoring ancestry. That works — but it is a permanent tax
on every release, and it is silent when skipped.

## Diagnostic: run this in your repo

```bash
git fetch origin

# 1. Are you diverged right now?
git merge-base --is-ancestor origin/main origin/develop \
  && echo "CLEAN" || echo "DIVERGED"

# 2. How much have you already paid by hand?
git log --oneline origin/develop \
  --grep="Merge branch 'main'" --grep="back-merge" | wc -l

# 3. Would the next release PR conflict?
git merge-tree --write-tree origin/main origin/develop >/dev/null 2>&1 \
  && echo "would merge clean" || echo "WOULD CONFLICT"

# 4. Are you squash-only? (the precondition for all of the above)
gh api repos/OWNER/REPO --jq '{allow_merge_commit, allow_squash_merge}'
```

Reading it: a non-zero count in (2) is the tax you are already paying. `DIVERGED`
in (1) is normal right after a release and harmless on its own — it compounds.

## What the survey found (30 repos)

Every squash-only `develop`+`main` project carried hand-made back-merge commits:

| Repo | Back-merges on `develop` |
|---|---|
| chapa | 40 |
| portfolio | 36 |
| archy | 33 |
| paisaxe | 18 |
| coach | 10 |
| summon | 5 |
| clarity, chapa-cli | 2 each |

Repos that promote with a **merge commit** (`spoken-letter`, `gh-glance`) had
none, and no divergence — the property holds by construction.

One summon commit names the cause outright:
`merge: back-merge main (v1.8.0 squash #625)`.

## What chapa did

Deleted the workaround instead of maintaining it:

1. Enabled `allow_merge_commit` (kept squash available for *feature* PRs).
2. Release PRs now promote with `gh pr merge --merge --auto`.
3. Deleted the auto-back-merge workflow and its tests.
4. Inverted the docs contract so `gh pr merge --squash` is now **rejected** on
   the release path — the drift cannot be reintroduced silently.

Net: 283 lines deleted, 46 added.

## What was verified first, not assumed

Two things could have made this a bad trade. Both were measured:

- **Does the release proof still hold?** chapa's playbook asserts
  `mainTreeDigest == candidateTreeDigest`. Merging `develop` into `main`
  produced a tree byte-identical to `develop`'s, so the proof is unaffected.
  Check yours with `git merge-tree --write-tree origin/main origin/develop`
  against `git rev-parse origin/develop^{tree}`.
- **Is `main`'s history still readable?** `git log --first-parent main` shows
  exactly one line per release — which is all the squash was buying.

## A warning worth passing on

chapa was not unusual in having this problem. It was unusual in **automating**
the workaround — and the automation silently failed for two releases because
its CI token could not push to a protected branch (`GH006`). A comment in the
workflow asserted it could not be blocked, so nobody investigated.

**Broken automation was worse than no automation.** In repos where a human does
the back-merge, a human notices. Automating a workaround also invented a
requirement nobody recognised: minting a privileged token so CI could push to a
protected branch. That requirement disappears entirely once you stop squashing.

If you are about to add a token, a bypass actor, or a ruleset exception to make
a back-merge work — check whether you need the back-merge at all first.

## When this does NOT apply

- **No long-lived second branch.** Trunk-based repos that squash feature PRs
  into one `main` have no divergence problem. Squash away.
- **`main`'s literal one-commit-per-release log is a hard requirement** — e.g.
  something parses it. `--first-parent` usually satisfies this, but check.
- **`main` carries content `develop` does not.** Then a merge is a real merge
  with real conflicts, and `-s ours` would silently discard that content.
  Verify with:
  `comm -23 <(git ls-tree -r --name-only origin/main | sort) <(git ls-tree -r --name-only origin/develop | sort)`
- **Release tooling parses the squash commit.** Check before switching.

## The recipe

```bash
gh api -X PATCH repos/OWNER/REPO -f allow_merge_commit=true
# reconcile once, if currently diverged:
git checkout develop && git merge -s ours origin/main && git push origin develop
# then: change the release merge command to --merge, delete any back-merge
# workflow, and add a check that rejects --squash on the release path.
```

Do the conversion **between** releases, not during one.

## Chapa's references

- Issue #1228 — the investigation, and why it closed as obsolete rather than fixed
- `d4eb9abb` — the conversion commit (283 lines deleted, 46 added)
- `docs/release/release-playbook.md` — the release procedure after the change
- `scripts/quality/validate-release-docs.ts` — the inverted contract that now
  rejects `gh pr merge --squash` on the release path
