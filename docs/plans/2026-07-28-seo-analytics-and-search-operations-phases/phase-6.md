# Phase 6 — Sitemap-Derived IndexNow and Exact-Deployment Workflow

**Status:** Planned
**Batch eligibility:** `[batch-eligible]` with Phase 3 after Phase 2
**Depends on:** Phase 2

## Objective

Add deterministic, same-host IndexNow submission that runs only after production serves the exact triggering `main` SHA.

## Files

Create:

- `scripts/seo/submit-indexnow.ts`
- `scripts/seo/submit-indexnow.test.ts`
- `scripts/seo/indexnow-workflow.test.ts`
- one generated 32-character hexadecimal key file in `apps/web/public/`
- `.github/workflows/indexnow.yml`

Modify:

- `package.json`

## Implementation

1. Generate a unique 32-character hexadecimal key for Chapa.
2. Commit a public text file named after the key and containing exactly the key plus a final newline.
3. Add `pnpm run submit-indexnow`.
4. Fetch the live production sitemap and parse only `<loc>` elements.
5. Decode XML entities, normalize, dedupe, and validate every URL against the exact `https://chapa.thecreativetoken.com` origin.
6. Fetch the production key file and require exact parity before submitting.
7. POST the full batch to the global IndexNow endpoint with `host`, `key`, `keyLocation`, and `urlList`.
8. Accept only 200 or 202. Make 400/403/422/429 failures actionable without logging the key unnecessarily.
9. Add a workflow declared for pushes to `main` and manual dispatch, with the submission job guarded by `vars.CHAPA_INDEXNOW_ENABLED == 'true'`. The variable is absent/false when this phase lands.
10. Poll `https://chapa.thecreativetoken.com/api/version` with a bounded timeout/backoff until `commitSha` equals `github.sha`.
11. Run the submission only after the identity check. Never trigger on `develop`.

## Pseudocode

```text
waitForProduction(expectedSha):
  repeat with bounded backoff:
    version = GET /api/version no-store
    if version.commitSha == expectedSha: return
  fail without submitting

urls = parseLocElements(GET /sitemap.xml)
assert urls.length > 0
assert every url.origin == productionOrigin
assert GET keyLocation == generatedKey
POST api.indexnow.org/indexnow
assert status in [200, 202]
```

## Automated success criteria

- Parser tests cover XML entities, whitespace, duplicate `<loc>`, `xhtml:link` attributes, malformed/empty sitemap, and off-host URLs.
- Key tests prove filename/content/module parity and fail on one-character drift.
- Response tests cover 200, 202, and each documented failure class.
- Workflow contract tests prove:
   - `main` push and manual dispatch only;
   - no `develop` trigger;
   - no network submission when `CHAPA_INDEXNOW_ENABLED` is absent or false;
   - exact-SHA `/api/version` gate precedes submission;
   - no fixed sleep is used as release proof.
- Typecheck, lint, test, and build pass sequentially.

## Manual success criteria

- Before any submission, direct HTTP reads show the production key file and sitemap.
- A dry-run prints only URL count/origin and does not transmit.
- First real submission is deferred to Phase 8 authorization.

## Stop gate

Commit and stop with `CHAPA_INDEXNOW_ENABLED` absent/false. Do not manually dispatch, enable the variable, or call IndexNow.
