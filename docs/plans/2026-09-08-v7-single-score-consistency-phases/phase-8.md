# Phase 8 — Executable local release proof and active documentation

Depends on phase7. Sequential. Closes DO-M1; implementation of proof tooling only, not a release.

## Files

`scripts/quality/release-result.ts`/tests, `validate-release-docs.ts`/tests, `release-verification-workflow.test.ts`, `.github/workflows/release-verification.yml`, `apps/web/playwright.config.ts` and local-candidate probe helpers; active `.claude/commands/release.md` and referenced release commands; `docs/release/release-playbook.md`, `scoring-v7-release-packet.md`, `docs/runbooks/scoring-v7-transition.md`, current scoring spec/reproduction/how-it-works, CLAUDE current scoring sections. Preserve historical research and hashed policy/engines; add supersession links rather than editing their evidence.

Current proof contract requires Preview (`scripts/quality/release-result.ts:20`, `:38`); docs-only replacement would leave validators/workflows contradictory.

## Changes / pseudocode

Add a strict schema2 release-result contract:

```text
local-candidate:
  exact commit + source tree + allowlisted build artifact digests
  environment=local, loopback target
  complete named local gates + production-mode local probe results
final:
  references local-candidate identity
  production commit/tree + actual deployment identity
  migration admission + production probes + publication/tag readback
```

Keep schema1 historical proof validation intact. Do not rename localhost as Preview, set VERCEL_ENV=preview, or fabricate a downloaded GitHub run. Local browser selectors need an explicit local-candidate mode so current Playwright ignore rules don't silently omit required scenarios. Validation must reject absent/failed/skipped required local gates. Conditional deployment-only checks remain explicitly pending; they are not required local passes and do not create remote work during phase9.

Bind the local build with an allowlisted manifest of code/artifacts; exclude env files, raw reports, logs with secrets and mutable caches. Freeze the exact qualification commit and full Git tree. Store the final proof/report/build manifest outside that tracked candidate (gitignored evidence/local report paths); do not make an evidence-writing commit before qualification or eventual promotion, because it changes the full tree too. If any tracked commit is added after qualification, invalidate/rebind proof and requalify the resulting candidate; there is no implicit docs-only tree-equality exception. Keep application artifact digests as additional evidence, not a substitute for exact source-tree identity.

Remove Preview dispatch from active workflow/procedure and update corresponding tests. Preserve exact main merge-tree identity, production schema admission, separately authorized migration/recompute/release, rollback identity and post-release proof. Pending production migration checks require real authorized read credentials later; do not substitute a local result.

Update current scoring and UX docs to v7.2 point meaning, four-core/five-visible-after-report distinction, unchanged archetype eligibility, versioned report-derived Craft, real report uncertainty, deterministic display and all-consumer contract. The old pilot is unperformed with an existing owner decision, not silently marked passed or reintroduced as an unresolved approval request.

Document the new flag-only rollback protocol with active receipts and≤305-second bounded online freshness assumptions. Include fallback/purge failure semantics and performance trade. No receipt deletion/migration rollback. Correct misleading references to shared cache namespaces and unrun rehearsal steps.

Before any later push, the release procedure must inspect remote workflow/platform triggers read-only and prove Preview creation is prevented. An Ignored Build Step that merely skips compute after creating a deployment is not that proof. If no documented non-destructive prevention is available, stop before push and identify it. Never create feature PRs as a verification loop.

## Automated acceptance

C20, C24 and all new release-schema cases: missing gates, incorrect commit/tree, wrong/non-loopback local URL, forbidden secret-bearing fields and failed production readback are rejected. Historical schema1 fixtures still validate. No active release path requests a Preview; tests distinguish local build evidence from real production proof.

```sh
pnpm exec vitest run scripts/quality/release-result.test.ts scripts/quality/validate-release-docs.test.ts scripts/quality/release-verification-workflow.test.ts --no-file-parallelism
pnpm run release:validate-docs
pnpm run check:vercel-config
pnpm run typecheck
pnpm run lint
pnpm run test
```

No workflow dispatch, hosted build, token readback or production request is run to validate the new tooling. Use fixtures and local helpers.

## Manual / stop

Read the runnable sequence from fresh checkout to local proof to separately authorized production step, verifying there is no implied Preview permission. Stop with validated docs/tooling; no PR, merge to main, tag or deployment.
