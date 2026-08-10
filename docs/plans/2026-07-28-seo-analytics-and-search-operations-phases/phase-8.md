# Phase 8 — Release, Production Verification, Initial Submissions, and Handoff

**Status:** Planned
**Batch eligibility:** Not batch-eligible
**Depends on:** Phases 3–7

## Objective

Release the fixed candidate through Chapa’s exact-SHA workflow, enable Chapa’s production-only integrations, verify real collection/privacy/indexing behavior, and leave a durable operations handoff.

## Files

Modify:

- `docs/runbooks/release-checklist.md`
- `docs/runbooks/deployment-smoke.md`
- `docs/runbooks/observability.md`

Create:

- `docs/seo/setup-evidence.md`

## Authorization gates

Obtain explicit authorization immediately before:

1. setting Vercel Production analytics IDs;
2. creating the release PR and running the external release-verification workflow;
3. merging the approved release PR to `main`;
4. enabling scheduled workflows or repository enablement variables;
5. changing the GA4 and Search Console product link created in Phase 5;
6. submitting/resubmitting sitemaps, requesting indexing, running Bing Site Scan, or submitting IndexNow;
7. creating/pushing the release tag or publishing the final release.

One authorization may cover the enumerated release actions if the user approves that exact bundle.

## Implementation

1. Invoke Chapa’s `/release` workflow and read `docs/release/release-playbook.md` completely.
2. Confirm every implementation phase is complete and evidence-backed; run the playbook’s version audit/bump decision before freezing the candidate.
3. Freeze the candidate SHA on `develop`, capture the full `main...candidate` diff, and run full sequential local verification plus plan-compliance review.
4. Run `/simplify`, rerun verification, and require the final analyzer PASS as evidence rather than release authorization.
5. Read back the Preview analytics variables written in Phase 5 without exposing values, then verify the immutable preview.
6. Confirm preview `/api/version` equals the candidate SHA before any candidate-bound verification.
7. Verify:
   - all public routes, canonicals, language response, sitemap, robots, JSON-LD, and LLM routes;
   - consent accept/reject/change behavior;
   - GA4 DebugView events/parameters;
   - Clarity allowlisted marketing route and excluded profile/auth routes;
   - no new public/private data exposure.
8. Create the release PR from `develop` to `main`, preserve the playbook’s external verification and approval gates, and do not merge on analyzer output alone.
9. After explicit authorization for the enumerated production bundle, set the two Production IDs, set `CHAPA_INDEXNOW_ENABLED=true`, merge the approved release PR, and watch exact-SHA CI to green.
10. Confirm production `/api/version` equals the merged `main` commit and that the production tree matches the candidate tree.
11. Perform the playbook’s read-only production verification subset before any indexing submission.
12. Submit/resubmit:
    - Search Console sitemap;
    - Bing sitemap;
    - IndexNow through the exact-deployment workflow.
13. Inspect/request indexing for:
    - `/`;
    - `/resources`;
    - one guide;
    - one archetype;
    - one valid public profile.
14. Run Bing Site Scan with the current sitemap count.
15. After explicit scheduled-collection authorization, set `CHAPA_SEO_LEDGER_ENABLED=true` and verify the first scheduled-capable ledger run.
16. Assemble the playbook’s final evidence, then tag last only after production verification passes.
17. Record property IDs (non-secret), configuration states, CI/workflow run IDs, exact SHAs, sitemap statuses, URL Inspection outcomes, Rich Results outcomes, GA/Clarity evidence, and known provider data-lag windows in `docs/seo/setup-evidence.md`.

## Automated success criteria

Sequential local checks:

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run check:vercel-config
pnpm run check:public-surface
pnpm run build
```

Remote evidence:

- exact candidate SHA CI green;
- preview identity equals candidate SHA;
- the authorized external release-verification run passes for the immutable preview and candidate SHA;
- pre-merge and final analyzer results are PASS, recorded as evidence rather than authorization;
- production identity equals merged `main` SHA and candidate tree;
- IndexNow workflow finishes with 200/202;
- ledger workflow writes an explicit provider-status row;
- production HTTP probes return expected canonical, robots, sitemap, key file, schema, and security headers.
- the release tag points at the verified production commit and was pushed only after its separate authorization.

## Manual success criteria

- GA4 Realtime/DebugView receives a consented Chapa session and exact event parameters.
- A rejected-consent session produces no client analytics traffic.
- Clarity receives an allowlisted static page and no excluded profile/auth page recording.
- Search Console and Bing show verified Chapa ownership and accepted sitemap.
- Rich Results Test passes representative SoftwareApplication, Article/Breadcrumb, FAQ, and Person pages.
- English and Spanish editorial/metadata/consent UI pass desktop and mobile review.
- No other project shows a changed property setting, tracking ID, sitemap, DNS verification record, masking mode, workflow, or user permission.

## Rollback

If production behavior fails:

1. disable the Chapa IndexNow and ledger workflows;
2. remove only the Chapa Production GA/Clarity environment values and redeploy;
3. revert the release through the normal `main` workflow;
4. preserve vendor properties, verification history, and aggregate ledger rows;
5. verify the rollback SHA through `/api/version`;
6. leave other project settings untouched.

## Final handoff

The handoff names:

- property/project IDs and URLs without secrets;
- Vercel/GitHub variable names without values;
- initial baseline date;
- expected GA/GSC/Bing/Clarity lag;
- weekly and monthly review commands/checklists;
- exact next review dates at 7, 30, and 90 days after production launch.

## Stop gate

The plan is complete only when production identity, CI, consent/privacy behavior, vendor ownership, sitemap/IndexNow status, and the first ledger row are all evidenced. Otherwise stop with the exact unresolved external state.
