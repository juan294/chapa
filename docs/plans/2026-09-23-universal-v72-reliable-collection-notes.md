# Notes: `2026-09-23-universal-v72-reliable-collection`

## Deviations

### Phase 1

- **Revision hazard scope.** Plan said: fix the `updated_on` artifact-revision hazard for Bitbucket comments (step 1.5). Found: the same hazard in GitLab notes (`updated_at`) and Codeberg reviews. Chose: fix all three, each with a regression test. Why: phase 3 merges events across slices for every provider, and the immutable-identity guard applies to all of them.
- **Date-parse diagnostics.** Plan said: an exhaustive per-branch diagnostic matrix for Bitbucket (step 1.3). Found: GitHub, GitLab and Codeberg have equivalent structural and date-parse `source_error` sites. Chose: give every such site a stable `{operation, stopKind: "parse" | "protocol"}` diagnostic with a test. Why: phase 7 reads telemetry for every provider, not only Bitbucket.
- **Diagnostic dedupe.** Plan said: one `evidence_source_stop` event per diagnostic. Found: per-row validation inside page loops could record up to 100 identical diagnostics for one malformed page. Chose: the recorder keeps at most one diagnostic per `(operation, stopKind)`. Why: one failure should produce one event, not up to 100 outbound PostHog calls.
- **GraphQL rate-limit shapes.** Plan said: detect GraphQL `RATE_LIMITED` by error type. Chose: check `type`, `extensions.type` and `code`, defined locally in `evidence-diagnostics.ts`. Why: `lib/github/queries.ts` already handles all three shapes, and it is v6 code that phase 5 deletes.
- **Deferred.** Provider-reported truncation (Bitbucket `truncated`, Codeberg `x-hasmore` mismatch and similar) is still `pagination_incomplete` but has no diagnostic. It needs a new `StopKind`; phase 3 owns the stop-kind set.

### Phase 2

- **Subject default.** Plan said: `ALTER COLUMN public_evidence_consent SET DEFAULT true`. Found: `CHECK (NOT public_evidence_consent OR consent_recorded_at IS NOT NULL)` rejects a bare subject insert under that default. Chose: also `ALTER COLUMN consent_recorded_at SET DEFAULT now()`. Why: without it, `scoring_v7_ensure_subject` and ledger admission fail on every new subject.
- **`scoring_v7_ensure_subject` definition.** Plan said: `LANGUAGE sql ... SET search_path = public`. Chose: `SET search_path = ''` with `public.`-qualified names and `btrim(lower(...))`. Why: this matches every other `SECURITY DEFINER` function in the repo, and the subject CHECK expects a trimmed handle.
- **Field rename.** Plan said nothing about `consentVersion`. Chose: rename it to `subjectVersion` (it now holds the subject registration time), and `requireConsent` to `requireSubject`. Why: the old name described a gate that no longer exists.
- **Retired action.** Chose: `withdraw` stays a recognised request shape that answers `400 retired_action`, and `consent` is removed from the schema. Why: an old client gets an explicit answer instead of a generic parse error.
- **Copy.** Plan said: delete the `settings.consent*` keys. Found: `about.scoring` and `verifyReceipt` still told users that publication was opt-in, and the insights import still had a dead "publish your score" confirmation. Chose: rewrite that copy in both locales and delete the dead branch and its keys. Why: public pages must not describe a consent screen that no longer exists.
- **Inventory doc.** Removed the `app/api/evidence/route.ts` row from `docs/scoring-consumer-inventory.md`. Why: the route no longer calls issuance, so the existing inventory test requires the removal.
- **Kept for phase 5.** `p_acknowledged` and the always-true `consented` result on the report-craft RPC stay, for signature stability, until the contract migration 058.
