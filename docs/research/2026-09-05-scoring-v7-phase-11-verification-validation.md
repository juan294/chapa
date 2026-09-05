# Scoring v7: complete receipt verification validation

Scope: S14 / #1309. Independent GPT-6 Astra review approved the final implementation and separately completed the simplify pass. A subsequent independent review approved three integration test amendments. All sequential local gates passed. S08 source integrity, S15 consumer adoption, S16/S17 public presentation and S18 empirical validation remain mandatory before relaunch.

The versioned token binds a full HMAC-SHA256 signature to the complete canonical receipt, including Craft, reference window, policy and calculation outputs. Durable issuance succeeds before a link is returned. Stored issuance, current signature authentication, available arithmetic replay and source corroboration are separate claims. A rotated or unavailable key never produces a successful authentication claim. A link identifies the original receipt; it does not inspect an edited SVG or establish the identity shown in an image.

Actual database-to-publication-adapter-to-signing-to-API tests preserve absent, unobserved, zero, full and ranged Craft. They compare complete envelopes and exercise changed dimensions, ranges, Craft presence/value and dates; unsupported policy input is rejected. Tests distinguish current, superseded, retracted and revoked revisions. Legacy codes remain readable with explicit v6/non-replayable labels. English and Spanish verification pages, forms and WebMCP transports use the same distinctions. All v7 verification transports apply no-store, including remote MCP JSON/streaming and error responses. Submitted JSON is bounded and strict UTF-8; rejected private content is neither echoed nor logged.

Consent is checked before and after asynchronous reads. Withdrawal deletes private backing data and preserves only content-free revision tombstones. Captured receipt cache keys are deleted with awaited failure reporting; recurring bounded sweeps revisit tombstones to catch delayed writes. An empty revision batch cannot prove a prior failed deletion completed after owner linkage was erased. Such retries report accepted withdrawal with cleanup pending (HTTP 202); administrative deletion reports pending and exits nonzero. Known deletion failures remain explicit. Unknown cache namespaces are retained and reported incomplete; exact owned provider negative-cache keys are recognized without permitting substring deletion of another user's data.

Two adjacent corrections preserve earlier phase guarantees. Private supplemental records no longer have a Redis mirror; authorized durable reads recheck the manifest, and withdrawal/cron remove retired copies. The real publication boundary exposed SQL serialization of receipt value `59.91152278612738` as trend value `59.9115227861274`. The existing `1e-10` internal numeric tolerance now applies only to finite raw-point values within 0–100. Canonical receipt bytes, identity, dates, policy and point/range checks remain exact. Neither the formula nor a policy constant changed.

## Sequential local verification

- Full unit/script suite: 559 files / 9,065 tests passed.
- Actual disposable database contracts: 43 files / 130 tests passed, including publication/issuance/API round trips, field mutations, NULL actor denial, service-only RPC privileges, concurrent issuance/withdrawal, lineage and backing-data deletion.
- Focused UI: 48 tests; remote MCP route: 10 tests; final cleanup/namespace fixes: 39 tests; final copy/CORS amendments: 26 tests passed. Earlier failing fixtures are retained in the logs as regression evidence.
- Final typecheck and lint passed. Lint retains three pre-existing S07 fixture unused-destructuring warnings, with no errors.
- Migration validation, write registration and circular dependency checks passed.
- Coverage passed unchanged thresholds: 94.28% statements, 89.21% branches, 95.00% functions, 96.88% lines. The separate scripts coverage suite also passed (24 files / 288 tests).
- Production build passed locally. No hosted build or deployed browser claim is implied; final SVG/PNG/browser and empirical relaunch gates remain in their later tasks.

Additive migration 044 was reviewed and applied only to the owned disposable `chapa-scoring-v7` database. SHA-256: `76fd1ecf6857f450903d57699235dd07001926c2b80da69c0f880a6400f952f5`. The tracked Supabase config was restored and prior migrations were unchanged. No push, PR, hosted CI, preview, production operation or outreach occurred.

The exact 46-file inventory and SHA-256 manifest are preserved under `logs/scoring-v7/s14-final-*`; integration logs use `s14-integration-*`. The owned adjacent test files are:

```text
apps/web/app/api/cors-mutation-guard.test.ts
apps/web/app/api/cron/warm-cache/route.test.ts
apps/web/app/api/evidence/route.contract.test.ts
apps/web/app/api/evidence/route.test.ts
apps/web/app/api/mcp/route.test.ts
apps/web/app/api/verify/[hash]/route-v7.contract.test.ts
apps/web/app/api/verify/[hash]/route-v7.test.ts
apps/web/app/api/verify/[hash]/route.test.ts
apps/web/app/simple-pages.render.test.tsx
apps/web/app/verify/VerifyForm.render.test.tsx
apps/web/app/verify/[hash]/ReceiptCard.test.tsx
apps/web/app/verify/[hash]/VerifyPageWebMcpTools.render.test.tsx
apps/web/app/verify/[hash]/page.render.test.tsx
apps/web/lib/cache/redis-retired-v7.test.ts
apps/web/lib/db/supplemental-v7.test.ts
apps/web/lib/db/verification-v7.contract.test.ts
apps/web/lib/history/snapshot-v7.test.ts
apps/web/lib/verification/cleanup.test.ts
apps/web/lib/verification/store-v7.test.ts
apps/web/lib/verification/v7.test.ts
apps/web/lib/webmcp/server-tools.test.ts
scripts/delete-user.test.ts
```
