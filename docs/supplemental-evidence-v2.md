# Supplemental dated evidence v2

S07 / #1302 is independently reviewed and locally verified. This protocol is implemented; adoption by all public consumers remains part of the mandatory S15 migration before relaunch.

POST `/api/supplemental` accepts a Chapa CLI bearer token belonging to `targetHandle`. A versioned upload contains dated event declarations from a different work account. Authentication proves who uploaded the document. It does not verify ownership of the claimed source account, establish factual truth, authorize reviewer assessments or certify engineering outcomes.

The upload schema is `supplemental-v2`. Required top-level fields are `schemaVersion`, `targetHandle`, `source`, `observationPeriod`, `observedThrough` and `events`. Source fields are `provider` (github, gitlab, bitbucket or codeberg), `host`, immutable claimed `subjectId`, and descriptive `handle`. Every event's `actorId` must match that subject. A GitHub source handle matching the primary target is rejected. Unknown fields, including purported provenance, assessments and repository aliases, are rejected.

Each event has `eventId`, `repositoryId`, `actorId`, `workItemId`, `kind`, `occurredAt` and `artifactRevision`. The producer must use stable source identities across overlapping uploads. It may provide `files`, `additions`, `deletions`, `leadTimeHours`, `hasDescription`, `hasIssueLink`, `usesFeatureBranch` and an acceptance declaration containing `method`, `acceptedAt`, `acceptedResultId`. Omitted measurements remain unknown. Every acceptance date must equal the event date. Event kinds and acceptance methods use the shared v7 contract; these declarations do not earn automatic acceptance credit.

Use explicit RFC3339 timestamps. The observation period is half-open; every event must be within it and no later than observedThrough. The period and observedThrough cannot be in the future at upload. The request is limited to 256 KiB, 1,000 events, 1,000 file paths per event, 10 million additions/deletions per event, and 1 million lead-time hours. Counts must be finite nonnegative safe integers; lead-time hours may be fractional. These are input-resource limits, not scoring thresholds.

The server stores normalized private declarations in immutable source-observation rows until owner withdrawal. It unions overlapping uploads, deduplicates immutable event identities and clips actual event timestamps to each requested scoring window. Upload time only controls whether a document existed for historical replay. It never replaces an event date. Conflicting immutable event facts fail explicitly. Within one source, the event key is repository, actor, kind and eventId; its work identity, normalized occurrence instant and artifact revision cannot change. Within-upload conflicts return 400. Conflicts against committed uploads return 409 with `persisted: false`; the transaction retains prior rows and caches. Optional measurements can be enriched, and conflicting or missing measurements remain unknown through shared aggregation. These checks do not promote declarations to verified facts.

A successful v2 response includes `persisted: true`, the immutable `uploadId` and `uploadedAt`, `eligibility: "dated_self_reported"`, `coverage: "partial"` and `cacheRefreshed`. Core scoring cannot treat an imported assertion as verified evidence. Unknown temporal coverage spans the entire requested scoring window, including time before observedThrough: a partial self-report never establishes that earlier dates were comprehensively observed. Submit backing artifacts through the separately documented engineering evidence ledger for an accountable assessment. Historical issue artifacts can be assessed without a live issue-tracker endpoint; their actual event and outcome dates still govern eligibility.

Every cached read first checks the current authorized database manifest. A stale cache, withdrawn document or historical request cannot bypass that manifest. Both Redis hits and database fallback age the same immutable events. Failed cache publication never rolls back a successful durable upload; `cacheRefreshed: false` reports a deferred rebuild. A manifest exceeding 1,000 upload rows fails explicitly rather than silently truncating the portfolio or reporting zero; capacity failure must remain unavailable coverage in the consumer.

Legacy scalar uploads remain durably stored and return `eligibility: "historical_only"`, `coverage: "legacy"`, `reasonCode: "legacy_aggregate"`. Their annual totals cannot be converted into dated v7 events or prorated into the current year. Legacy v6 consumers remain separate until the mandatory consumer migration; the v7 reader only reads versioned dated rows.

## Executable fixture client

From the repository root, generate a reproducible fixture without credentials or network access:

```sh
pnpm exec tsx --tsconfig tsconfig.scripts.json scripts/supplemental-evidence-client.ts --fixture --target alice --source alice-work --reference 2026-09-05T12:00:00.000Z
```

Use your authenticated local account as target and a distinct source handle when testing. To submit an actual producer JSON file to the local application, set `CHAPA_CLI_TOKEN` in your shell and run:

```sh
pnpm exec tsx --tsconfig tsconfig.scripts.json scripts/supplemental-evidence-client.ts --file /absolute/path/evidence.json --send --base-url http://127.0.0.1:3000
```

The client does not read `.env.local`, place tokens in URLs, or follow redirects. The generated fixture has explicitly synthetic source identities and must not be presented as real engineering evidence. JSON files use the same endpoint and strict server validation.

Disposable local Supabase verification uses `pnpm run test:contract:local` with the scoring-local project configuration. Contracts exercise real persistence, replay, access control, withdrawal and cache failure; fixture/unit tests also exercise strict input validation and exact aging. No remote service, production upload or deployment is needed.
