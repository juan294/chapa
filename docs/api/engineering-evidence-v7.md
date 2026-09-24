# Private engineering evidence ledger (v7)

The authenticated API works without an AI tool, an insights report, or a live issue tracker. It stores an owner's claim as **self-reported**, then separately records an authorized reviewer's rubric assessment. Upload time, CI checks, PR descriptions, tool names, lines changed, and an issue close click establish no semantic verdict.

Use the existing Chapa CLI bearer token or authenticated session. Examples below target a locally running app; replace the token placeholder locally. No production deployment is needed to exercise this workflow. All responses containing evidence are private JSON with `Cache-Control: private, no-store`.

`POST /api/evidence` accepts one command. Unknown properties are rejected. Dates are explicit ISO instants. The request limit is 256 KiB, at most 32 references, and 64 KiB per optional raw artifact body. No URL is fetched. HTTPS locators cannot contain credentials, IP literals, private host suffixes, or nonstandard ports. Offline artifacts can use `urn:chapa:artifact:<UUID>` and an optional text body. Never submit secrets unnecessary for review.

## Submit a claim

```json
{
  "action": "claim", "owner": "your-handle", "channel": "core", "previousRevisionId": null,
  "category": "performance_accessibility", "artifactRevision": "release-sha",
  "occurredAt": "2026-08-01T00:00:00Z", "claim": "Reduced query latency",
  "baseline": {"kind": "measured", "value": "100ms median on fixed sample"},
  "observedResult": "80ms median", "method": "Same workload before and after the release",
  "contributorRole": "Implemented the optimization", "attribution": "individual",
  "observationPeriod": {"startInclusive": "2026-08-02T00:00:00Z", "endExclusive": "2026-09-01T00:00:00Z"},
  "references": [{"artifactUri": "https://example.org/benchmark/release-sha", "artifactRevision": "release-sha", "observedAt": "2026-09-01T00:00:00Z", "body": "Optional archived benchmark output"}],
  "limitations": ["One workload"], "counterevidence": ["Increased memory use"]
}
```

Save this JSON as a local file and submit it with:

```sh
curl --fail-with-body http://localhost:3000/api/evidence \
  -H 'Authorization: Bearer YOUR_LOCAL_CLI_TOKEN' \
  -H 'Content-Type: application/json' --data-binary @claim.json
```

The response supplies immutable `revisionId`, `claimId`, `workItemId`, and `referenceIds`. Amend with another full claim and `previousRevisionId` set to the current revision. The transaction retains the original claim and work identity. A stale revision returns 409. Retract with `{"action":"retract","owner":"your-handle","revisionId":"CURRENT_UUID","rationale":"Measurement superseded"}`. Retractions append history; they do not rewrite previous receipts.

All seven outcome categories are first-class: `delivered_benefit`, `correctness_security`, `performance_accessibility`, `reliability_cost`, `design_documentation`, `mentoring_review`, and `maintenance_incident_recovery`. Baseline absence must be explicit as `{"kind":"not_available","explanation":"Reason"}`. Attribution is `individual`, `team_participation`, or `unclear`; a team outcome is never silently assigned to one person. Limitations and counterevidence arrays may be empty, but must be provided.

`occurredAt` describes the actual performed work. The observed measurement horizon must be finite, ordered, and completed by submission and assessment. Work can precede its subsequent outcome observation period. Assessment date and upload date cannot rejuvenate old work.

## Grant access and assess

The owner grants a reviewer with `{"action":"grant","owner":"your-handle","reviewer":"reviewer-handle","enabled":true}`. Revocation uses `enabled:false`. A current grant permits private reads and assessments; a future or revoked grant does not. Owners cannot assess their own claims. The transaction captures the verified reviewer, grant start, assessment time, and recording time. Caller-supplied authorization/provenance is rejected. Later revocation or regrant preserves previously authorized verdicts for the owner's historical replay.

An authorized reviewer submits:

```json
{
  "action":"assessment", "owner":"your-handle", "previousRevisionId":null,
  "claimRevisionId":"CLAIM_UUID", "criterion":"verification", "status":"accepted",
  "rubricVersion":"v7", "rationale":"Reproduced the before/after benchmark at the stated release",
  "evaluatorType":"human", "evaluatorVersion":"rubric-v7-human",
  "independentlyCorroborated":false, "conflicts":[], "referenceIds":["REFERENCE_UUID"],
  "facts": {
    "identity":{"projectKey":"reviewed-project","workKey":"reviewed-work","referenceIds":["REFERENCE_UUID"],"repository":null,"equivalentWork":null},
    "occurredAt":"2026-08-01T00:00:00Z", "kind":"maintenance", "attribution":"individual", "categories":[],
    "acceptance":{"method":"accepted_artifact","acceptedAt":"2026-08-01T00:00:00Z","acceptedResultId":"reviewed-release-sha","referenceIds":["REFERENCE_UUID"]}
  }
}
```

`facts` is a separate explicit review of dated activity, attributable acceptance, and identity. It can be null when those facts have not been established, leaving relevant core activity unknown. A quality criterion alone cannot establish Delivery. An accepted artifact needs a reviewed result and acceptance instant, backed by matching references. Allowed acceptance methods are merged change, default-branch first reachability, linked issue result, or accepted artifact, constrained to the appropriate event kind. A closed issue, assignment, or approval snapshot does not establish these facts. Archived Bitbucket issues use the same workflow without a live Bitbucket issue API.

Core criteria are `rationale`, `verification`, `review_or_correction`, and `outcome_followup`. Ordinary accountable assessments can be human or explicitly labeled model assessments; a model must declare its version. Conflicts must be disclosed and prevent scoring credit. Strong independent corroboration requires a human with no declared conflicts. Status is `accepted`, `rejected`, `unassessed`, or `retracted`. Corrections/retractions name `previousRevisionId` and retain the same reviewer, claim revision, and criterion.

Reviewers verify canonical identity using evidence references. `identity.repository`, when established, names `{provider,host,subjectId,repositoryId}` from a connected provider. `identity.equivalentWork`, when established, names `{canonicalWorkItemId,acceptedEventId}` to reconcile the same accepted work across sources. Do not invent mappings from similar names. These fields are unavailable to claimants. Unresolved or conflicting identity remains unknown.

For optional Craft, submit `channel:"craft"`, then assess `framing`, `verification_debugging`, `tool_judgment`, and `accepted_outcome`. The same workflow admits non-AI work and requires no report. Craft reviewers must also establish the episode identity in `facts.identity`; an unresolved identity leaves the verdict unassessed for scoring. Exact retained artifact URI/revision matches and verified same-work mappings deduplicate repeated submissions. Conflicting mappings withhold credit until corrected. A conflicted assessment correction remains in the revision chain and cannot revive the previous verdict. Reviewed performed-work/acceptance dates govern scoring instead of owner upload dates. Reuploading an old artifact cannot rejuvenate it; inconsistent reviewed dates retain an unknown range without established credit. Craft stays separate from all four core dimensions. Artificer requires all four independently corroborated criteria on one eligible episode plus its frozen score threshold; submitting a tool report cannot award it.

## Read, publish, and withdraw

`GET /api/evidence?owner=your-handle` returns the private ledger to its owner/current reviewer. Optional `referenceTime` selects historical recorded evidence; future times are rejected. `GET /api/evidence?owner=your-handle&artifactReferenceId=REFERENCE_UUID` returns one unexpired raw body as JSON. A missing/expired body returns 404. Reviewers must not render raw text as executable HTML.

Raw bodies expire within 30 days of receipt; current retention applies even to historical reads. Extracted claims, dated observations, assessment rationale, and durable backing references remain until withdrawal, so raw expiry does not erase established practice credit.

Aggregate publication has no consent action: every signed-up subject (a
handle with a `user_platforms` row for `github`) is scored and published by
the versioned scoring pipeline automatically, and public output never exposes
private claim text, rationale, URLs, or artifact bodies regardless. The old
`{"action":"consent",...}` shape is removed from the schema; sending it is a
generic parse error, not a recognized retired action. `{"action":"withdraw","owner":"your-handle","publicationAcknowledged":true}`
remains a recognized request shape, but now answers `400 retired_action` — it
no longer removes evidence. Deleting a subject's own evidence and receipts is
a separate lifecycle action outside this endpoint. Previously downloaded
public artifacts cannot be recalled.

Local contract fixtures cover these flows in `apps/web/app/api/evidence/route.contract.test.ts` and `apps/web/lib/db/engineering-evidence.contract.test.ts`. Run only against the repository's explicitly validated disposable local Supabase target, with verification coordinated with the integration owner.
