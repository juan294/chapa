import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalSha256, createScoringWindow, engineeringEventKey, type EngineeringEvidenceInput, type SourceCoverage } from "@chapa/shared";
import { getServiceClient } from "@/test/contract/invoke";
import { EMPTY_CHECKPOINT } from "@/lib/collection/plan";
import { seedFromPrior } from "@/lib/collection/seed";
import { computeObservedImpactV7 } from "@/lib/impact/observed-v7";
import { issueScoreReceipt } from "@/lib/profile/issue-receipt";
import { canonicalizeReceiptEvidence } from "@/lib/profile/receipt-semantic-identity";
import { createSourceContext } from "@/lib/platform/source-context";
import { checkpointCollectionJob, enqueueCollectionJob, listStagedEventKeys } from "./collection-queue";
import { readSourceObservation } from "./source-context";
import { syntheticCollectionEvents, syntheticCollectionSource, SYNTHETIC_COLLECTION_WINDOW } from "./synthetic-collection-fixture";

/** Run only through test:contract:local against the task-owned disposable stack. */
const LOCAL_API_URL = "http://127.0.0.1:55431";
const evidenceDir = resolve(process.env.SCORING_BENCHMARK_EVIDENCE_DIR
  ?? "docs/plans/2026-09-26-high-volume-badge-collection-phases/evidence/phase-1");
const counts = (process.env.SCORING_BENCHMARK_COUNTS ?? "100,17572,50000,100000")
  .split(",").map((value) => Number(value.trim()));
const db = getServiceClient;
const BATCH_SIZE = 2_000;
const seed = 294;

function assertLocal(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url !== LOCAL_API_URL || !key) throw new Error(`Benchmark requires task-owned local Supabase at ${LOCAL_API_URL}`);
  return { url, key };
}

function writeEvidence(name: string, value: unknown): void {
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(resolve(evidenceDir, name), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

async function cleanup(owner: string): Promise<void> {
  const subject = await db().from("scoring_v7_subjects").select("owner_handle").eq("owner_handle", owner).maybeSingle();
  if (subject.error) throw new Error(`Benchmark subject cleanup check failed: ${subject.error.message}`);
  if (subject.data) {
    const withdrawn = await db().rpc("scoring_v7_withdraw_with_receipts", { p_owner: owner, p_actor: owner, p_acknowledged: true });
    if (withdrawn.error) throw new Error(`Benchmark withdrawal failed: ${withdrawn.error.message}`);
  }
  for (const table of ["scoring_collection_jobs", "scoring_v7_source_observations", "scoring_v7_sources", "scoring_v7_subjects"] as const) {
    const { error } = await db().from(table).delete().eq("owner_handle", owner);
    if (error) throw new Error(`Benchmark cleanup failed for ${table}: ${error.message}`);
  }
}

/** A local-only exact-job lease avoids reclaiming an older failed benchmark row. */
async function leaseBenchmarkJob(jobId: string): Promise<string> {
  const leaseToken = randomUUID();
  const { data, error } = await db().from("scoring_collection_jobs")
    .update({ state: "running", lease_token: leaseToken, lease_expires_at: new Date(Date.now() + 120_000).toISOString() })
    .eq("id", jobId).eq("state", "queued").select("id").single();
  if (error || data?.id !== jobId) throw new Error(`Could not lease exact benchmark job: ${error?.message ?? "row mismatch"}`);
  return leaseToken;
}

async function timed<T>(operation: () => Promise<T>): Promise<{ value: T; wallMs: number }> {
  const start = performance.now();
  const value = await operation();
  return { value, wallMs: Math.round((performance.now() - start) * 100) / 100 };
}

interface FinishResult {
  readonly httpStatus: number;
  readonly responseBytes: number;
  readonly status: string | null;
  readonly observationId: string | null;
  readonly error: string | null;
}

async function finishRaw(jobId: string, leaseToken: string, observationId: string,
  coverage: object, requested: object, scope: object, access: string): Promise<FinishResult> {
  const { url, key } = assertLocal();
  const response = await fetch(`${url}/rest/v1/rpc/scoring_collection_finish`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_job_id: jobId, p_lease_token: leaseToken, p_coverage: coverage, p_observation: observationId,
      p_requested: requested, p_access: access, p_scope: scope, p_link_id: null, p_link_version: null,
    }),
  });
  const body = await response.text();
  const parsed = JSON.parse(body) as Record<string, unknown>;
  return {
    httpStatus: response.status,
    responseBytes: Buffer.byteLength(body),
    status: typeof parsed.status === "string" ? parsed.status : null,
    observationId: typeof parsed.observationId === "string" ? parsed.observationId : null,
    error: response.ok ? null : typeof parsed.message === "string" ? parsed.message : `HTTP ${response.status}`,
  };
}

async function benchmark(count: number): Promise<void> {
  assertLocal();
  if (!Number.isSafeInteger(count) || count < 1 || count > 100_000) throw new Error("Invalid benchmark count");
  const owner = `contract-volume-${count}`;
  const window = SYNTHETIC_COLLECTION_WINDOW;
  const source = syntheticCollectionSource(seed);
  const requested = { provider: "github" as const, host: "github.com", login: owner };
  const scope = { discovery: "owned_and_contributed" as const, repositoryIds: [] as string[], eventKinds: [] as string[] };
  const access = createSourceContext({ owner, requestedSource: requested, window, scope }, { kind: "github" }).accessContextId;
  let peakRssBytes = process.memoryUsage().rss;
  const memorySampler = setInterval(() => { peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss); }, 100);
  const summary: Record<string, unknown> = {
    count, seed, localApiUrl: LOCAL_API_URL, batchSize: BATCH_SIZE, claimMode: "local_exact_job_lease", outcome: "started",
    stagesMs: {}, peakRssBytes,
  };
  let finishSucceeded = false;
  try {
    const generated = await timed(async () => syntheticCollectionEvents({ count, seed, window }));
    const events = generated.value;
    (summary.stagesMs as Record<string, number>).fixture = generated.wallMs;
    const bytes = Buffer.from(JSON.stringify(events));
    summary.fixture = {
      uncompressedBytes: bytes.length,
      gzipBytes: gzipSync(bytes).length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      kinds: Object.fromEntries(["authored_commit", "accepted_change", "review"].map(kind => [kind, events.filter(event => event.kind === kind).length])),
      repositories: new Set(events.map(event => event.repositoryId)).size,
    };
    if (new Set(events.map(engineeringEventKey)).size !== count) throw new Error("Fixture event keys are not unique");

    await cleanup(owner);
    const ensured = await db().rpc("scoring_v7_ensure_subject", { p_owner: owner });
    if (ensured.error) throw new Error(`Subject setup failed: ${ensured.error.message}`);
    const job = await enqueueCollectionJob(owner, "github", "signup", window.referenceTime);
    const lease = { id: job.id, leaseToken: await leaseBenchmarkJob(job.id) };
    const coverage: SourceCoverage = {
      source, window, dataThrough: window.referenceTime, status: "complete", discovery: scope.discovery,
      repositoryIds: [...new Set(events.map(event => event.repositoryId))].sort(), repositoryDiscoveryComplete: true,
      eventKinds: {}, reasonCodes: [], unknownPeriods: [],
    };
    const profile = { count, seed, owner, jobId: job.id, source, requested, scope, window, coverage, accessContextId: access };
    writeEvidence(`count-${count}-profile.json`, profile);

    let staged = 0;
    let checkpointWallMs = 0;
    let checkpointOutcome = "ok";
    for (let from = 0; from < events.length; from += BATCH_SIZE) {
      const batch = events.slice(from, from + BATCH_SIZE);
      const batchStart = performance.now();
      try {
        const stage = await checkpointCollectionJob(lease, EMPTY_CHECKPOINT, batch,
          { operationsDone: 0, operationsKnown: 0, events: from + batch.length, requests: 0 }, false);
        checkpointWallMs += performance.now() - batchStart;
        checkpointOutcome = stage.status;
        staged = stage.status === "event_limit" ? stage.stagedCount : from + batch.length;
        if (stage.status !== "ok") break;
      } catch (error) {
        checkpointWallMs += performance.now() - batchStart;
        const message = error instanceof Error ? error.message : String(error);
        if (!/scoring_collection_checkpoint failed: canceling statement due to statement timeout/i.test(message)) throw error;
        checkpointOutcome = "statement_timeout";
        summary.failedCheckpointBatch = { startIndex: from, count: batch.length, attemptedTotal: from + batch.length };
        summary.checkpointError = message;
        const countRead = await db().from("scoring_collection_staged_events")
          .select("event_key", { count: "exact", head: true }).eq("job_id", job.id);
        if (countRead.error) {
          summary.stagedCountReadError = countRead.error.message;
        } else {
          staged = countRead.count ?? staged;
        }
        break;
      }
    }
    (summary.stagesMs as Record<string, number>).checkpoint = Math.round(checkpointWallMs * 100) / 100;
    summary.stagedCount = staged;
    summary.checkpointOutcome = checkpointOutcome;
    writeEvidence(`count-${count}.json`, { ...summary, peakRssBytes });
    if (checkpointOutcome === "event_limit") {
      summary.outcome = "current_event_limit";
      return;
    }
    if (checkpointOutcome === "statement_timeout") {
      summary.outcome = "checkpoint_statement_timeout";
      return;
    }
    if (checkpointOutcome !== "ok") throw new Error(`Unexpected checkpoint status: ${checkpointOutcome}`);

    const keys = await timed(() => listStagedEventKeys(job.id));
    (summary.stagesMs as Record<string, number>).stagedKeys = keys.wallMs;
    summary.stagedKeys = keys.value.size;
    if (keys.value.size !== count) throw new Error(`Expected ${count} staged keys, found ${keys.value.size}`);

    const observationId = randomUUID();
    const finished = await timed(() => finishRaw(job.id, lease.leaseToken, observationId, coverage, requested, scope, access));
    (summary.stagesMs as Record<string, number>).finish = finished.wallMs;
    summary.finish = finished.value;
    if (finished.value.status !== "ok" || finished.value.observationId !== observationId) {
      summary.outcome = finished.value.error?.includes("statement timeout") ? "finish_statement_timeout" : "finish_failed";
      return;
    }
    finishSucceeded = true;

    const context = { owner, requestedSource: requested, source, window, scope, accessContextId: access, link: null };
    const read = await timed(() => readSourceObservation(context));
    (summary.stagesMs as Record<string, number>).sourceRead = read.wallMs;
    summary.readEvents = read.value?.events.length ?? null;
    if (!read.value || read.value.events.length !== count) throw new Error("Stored source read did not match fixture count");
    summary.sourceReadParsedBytes = Buffer.byteLength(JSON.stringify(read.value));

    const nextWindow = createScoringWindow(new Date(Date.parse(window.referenceTime) + 86_400_000).toISOString());
    const seeded = await timed(async () => seedFromPrior({ events: read.value!.events }, nextWindow));
    (summary.stagesMs as Record<string, number>).priorSeed = seeded.wallMs;
    summary.seededEvents = seeded.value.seededEvents.length;
    summary.seededEventsJsonBytes = Buffer.byteLength(JSON.stringify(seeded.value.seededEvents));

    const issued = await timed(() => issueScoreReceipt(owner, { referenceTime: window.referenceTime }));
    (summary.stagesMs as Record<string, number>).receiptIssuance = issued.wallMs;
    summary.receiptIssuance = issued.value;
    if (issued.value.status === "failed") {
      summary.outcome = "issuance_failed";
      return;
    }

    const input: EngineeringEvidenceInput = {
      schemaVersion: "v7", window,
      scope: { sources: [coverage], excludedSources: [], ledgerRevisionIds: [] },
      events: read.value.events, repositoryAliases: [], equivalentWorkItems: [], assessments: [],
    };
    try {
      const scored = await timed(async () => computeObservedImpactV7(input));
      (summary.stagesMs as Record<string, number>).pureObservedScore = scored.wallMs;
      summary.coreExact = scored.value.core.composite.exact;
      const digested = await timed(() => canonicalSha256(canonicalizeReceiptEvidence(input)));
      (summary.stagesMs as Record<string, number>).canonicalEvidenceDigest = digested.wallMs;
      summary.canonicalEvidenceSha256 = digested.value;
    } catch (error) {
      summary.scoreOrDigestError = error instanceof Error ? error.message : String(error);
      summary.outcome = "score_or_digest_failed";
      return;
    }
    summary.outcome = "complete";
  } catch (error) {
    summary.outcome = "benchmark_error";
    summary.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    clearInterval(memorySampler);
    summary.peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
    writeEvidence(`count-${count}.json`, summary);
    if (summary.outcome === "complete" && finishSucceeded) await cleanup(owner);
    if (count === 100) expect(summary.outcome).toBe("complete");
  }
}

// Phase 1 baseline is historical evidence for the legacy queue. Running it
// after the v2 migration would call the old finish RPC on row-mode jobs and
// overwrite the pinned measurements. Opt in only when profiling that path.
const baselineSuite = process.env.SCORING_RUN_LEGACY_BASELINE === "1" ? describe : describe.skip;
baselineSuite("local high-volume collection baseline", () => {
  for (const count of counts) {
    it(`records ${count} synthetic events through the real queue`, async () => benchmark(count), 900_000);
  }
});
