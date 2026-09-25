import {
  engineeringEventKey, isWithinScoringWindow, observed, scoringInstant, unknown,
  type EvidenceReasonCode, type NormalizedEngineeringEvent,
  type Observation, type ScoringWindow, type SourceCoverage,
} from "@chapa/shared";
import type { CollectSlice } from "@/lib/collection/plan";
import {
  assembleSliceCoverage, buildSliceCheckpoint, computeDiscoveryComplete, emptySliceMeasurements, ensureSliceOperation, makeSliceStopFactory,
  newSliceEvents, validateSliceWindow, type MutableSliceOperation,
} from "@/lib/collection/slice-helpers";
import {
  budgetOrDeadlineStop, classifyFetchFailure, classifyHttpStatus, createDiagnosticRecorder,
  isGraphqlRateLimited, retryAfterSeconds, type SourceDiagnostic,
} from "@/lib/platform/evidence-diagnostics";
import { GITHUB_EVIDENCE_QUERIES as queries } from "./evidence-queries";
import { withRateLimit } from "./evidence-rate-limit";

type ObjectData = Record<string, unknown>;
const object = (value: unknown): ObjectData => value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectData : {};
const at = (value: unknown, ...keys: string[]): unknown => keys.reduce<unknown>((v, key) => object(v)[key], value);
const string = (value: unknown): string | null => typeof value === "string" && value.length > 0 ? value : null;
const number = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
/** True when every GraphQL error only says GitHub could not count one node's
 * lines (SERVICE_UNAVAILABLE at an additions/deletions path; observed
 * 2026-09-24 on very large commits). The rest of the page is valid data.
 */
function onlyLineCountsUnavailable(errors: readonly unknown[]): boolean {
  return errors.every((entry) => {
    const error = object(entry); const path = Array.isArray(error.path) ? error.path : [];
    return error.type === "SERVICE_UNAVAILABLE" && (path.at(-1) === "additions" || path.at(-1) === "deletions");
  });
}
const observedNumber = (value: unknown): Observation<number> => number(value) === null ? unknown("partial", "source_error") : observed(value as number, "complete", "source_observed");
const emptyMeasurements = emptySliceMeasurements;

// ---------------------------------------------------------------------------
// collectGitHubSlice (#1335 phase 3) -- the checkpointed, resumable slice API,
// and the only GitHub collector implementation (the prior single-run
// `fetchGitHubEvidence` and its `collectSource` caller were removed once the
// durable queue worker became the sole production collection path; see
// docs/plans/2026-09-23-universal-v72-reliable-collection-phases/phase-3.md).
// It advances a checkpoint by at most `budget.maxRequests` GraphQL calls or
// until `budget.deadlineAt`, sharing GITHUB_EVIDENCE_QUERIES and the
// diagnostic helpers (evidence-diagnostics.ts) that phase 1 established.
// ---------------------------------------------------------------------------

// withRateLimit lives in evidence-rate-limit.ts (a dependency-free module,
// imported above) and is re-exported here for existing importers -- see that
// file for why it is not defined in this one. The E2E collection-queue
// fixture (#1335 phase 4.8) imports it directly from evidence-rate-limit.ts
// instead, so it never pulls in this module's lib/collection/slice-helpers.ts
// ("server-only") chain.
export { withRateLimit };

/** Monthly `merged:YYYY-MM-DD..YYYY-MM-DD` boundaries covering the whole
 * scoring window (inclusive both ends, per GitHub's search date syntax).
 * Exported for its own boundary tests.
 */
export function githubMergedSearchRanges(window: ScoringWindow): readonly { readonly start: string; readonly end: string }[] {
  const endDate = window.referenceDate;
  const ranges: { start: string; end: string }[] = [];
  let cursor = window.startInclusive.slice(0, 10);
  while (cursor <= endDate) {
    const [year, month] = cursor.split("-").map(Number) as [number, number];
    const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    const rangeEnd = monthEnd < endDate ? monthEnd : endDate;
    ranges.push({ start: cursor, end: rangeEnd });
    cursor = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  }
  return ranges;
}

/** Splits a date range at its midpoint. Never called on a single-day range
 * (the caller accepts the 1,000-node cap there instead).
 */
function splitDateRange(start: string, end: string): readonly [{ readonly start: string; readonly end: string }, { readonly start: string; readonly end: string }] {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  const midMs = startMs + Math.floor((endMs - startMs) / 2 / 86_400_000) * 86_400_000;
  const mid = new Date(midMs).toISOString().slice(0, 10);
  const nextDay = new Date(midMs + 86_400_000).toISOString().slice(0, 10);
  return [{ start, end: mid < start ? start : mid }, { start: nextDay > end ? end : nextDay, end }];
}

interface GitHubPrMeta {
  repositoryId: string;
  mergedAt?: string | null;
  createdAt?: string | null;
  additions?: number | null;
  deletions?: number | null;
  hasDescription?: boolean | null;
  closingIssuesCount?: number | null;
  changedFiles?: number | null;
  revision?: string | null;
}
type MutableCollectorOperation = MutableSliceOperation;
interface ListOutcome { readonly kind: "done" | "stop" | "split"; readonly stop?: SourceDiagnostic; readonly totalCount?: number | null }
/** Outcome of a commit-history page-size ladder retry (#1351). `recovered`
 * carries the page data the smaller/no-line-count query returned, so the
 * caller processes it exactly like a normal successful page.
 */
type LadderOutcome =
  | { readonly kind: "recovered"; readonly data: ObjectData }
  | { readonly kind: "absorbed" }
  | { readonly kind: "stop"; readonly stop: SourceDiagnostic };

const RATE_LIMIT_FLOOR = 200;

/**
 * One bounded slice of GitHub evidence collection. Advances the checkpoint by
 * at most `budget.maxRequests` GraphQL calls or until `budget.deadlineAt`.
 * Merged-PR search is split into monthly ranges up front and recursively
 * halved on discovery of `issueCount > 1000`; a GraphQL `rateLimit` selection
 * on every query stops the slice once `remaining` drops below 200, with
 * `retryAfterSeconds` computed from `resetAt`.
 */
/** Replaces each null node in `primary`'s connection at `path` with the
 * node at the same index of `fallback`'s (the same page, same cursor). Pages
 * of different lengths are left unchanged, so their nulls stay unaccounted.
 */
function fillNullNodes(primary: ObjectData, fallback: ObjectData, path: readonly string[]): ObjectData {
  const connection = object(at(primary, ...path)); const nodes = connection.nodes; const recovered = object(at(fallback, ...path)).nodes;
  if (!Array.isArray(nodes) || !Array.isArray(recovered) || nodes.length !== recovered.length) return primary;
  const filled = nodes.map((node, i) => node ?? recovered[i]);
  const rebuilt: ObjectData = { ...primary };
  let parent = rebuilt;
  for (const key of path.slice(0, -1)) { const child = { ...object(parent[key]) }; parent[key] = child; parent = child; }
  parent[path.at(-1)!] = { ...connection, nodes: filled };
  return rebuilt;
}

const COMMIT_HISTORY_SINCE_MARGIN_MS = 30 * 86_400_000;
// A commit page whose line counts GitHub cannot compute inside its gateway
// timeout answers 502, even at first:50 (measured 2026-09-25, evidence file
// phase-4-commits-502.md). Retry the same page smaller, then without line
// counts, before absorbing that repository's history as partial coverage.
const COMMIT_PAGE_LADDER = [50, 20, 10] as const;
const COMMIT_LADDER_ABSORB_AFTER = 3;

/** Operation keys/prefixes whose processing can call `registerRepo`/`ensureOp`
 * -- i.e. can still grow the checkpoint's operation count (#1342). Derived
 * from this file's own call sites: `repositories`/`contributed` register
 * discovered repositories; `merged:*` registers a PR's repository, queues a
 * `files:` operation, and can split into two more `merged:*` ranges;
 * `reviewDiscovery` registers a reviewed PR's repository and queues a
 * `reviews:` operation. `profile`, `files:*`, `reviews:*` and `commits:*`
 * never call either function once processed, however their data turns out --
 * see the contract test for the same claim proven against the live engine. */
export const GITHUB_EXPANDING_OPERATIONS = ["repositories", "contributed", "reviewDiscovery", "merged:"] as const;

export const collectGitHubSlice: CollectSlice = async (input, credential, checkpoint, budget, stagedKeys) => {
  const window = validateSliceWindow(input);
  // Commit history's `since` is a committed-date bound. Committed dates
  // normally follow authored dates, so a margin before the window keeps every
  // in-window authored commit; inWindow() stays the authored-date filter.
  const commitHistorySince = new Date(Date.parse(`${window.startInclusive.slice(0, 10)}T00:00:00.000Z`) - COMMIT_HISTORY_SINCE_MARGIN_MS).toISOString();
  const login = input.requestedSource.login;
  // Enterprise Managed User logins are "<idp-handle>_<shortcode>": they may
  // contain underscores and run longer than an ordinary 39-character login.
  if (!/^[a-z\d](?:[a-z\d_-]{0,98}[a-z\d])?$/i.test(login)) throw new RangeError("Invalid GitHub handle");
  const explicit = input.scope.discovery === "explicit_repositories";
  const signal = AbortSignal.timeout(Math.max(0, budget.deadlineAt - Date.now()));
  const diag = createDiagnosticRecorder("github");
  // The credential is always pre-resolved by the caller in this contract
  // (the worker's own credential resolution runs before every slice) --
  // never fall back to reading the server token here. An explicitly null
  // credential must stay anonymous, not silently upgrade to a later/rotated
  // env token (the exact hazard evidence-context.test.ts guards against).
  const effectiveToken = credential.token?.trim() || undefined;
  let requestCount = 0;

  // Legacy in-flight checkpoints (#1351) may still carry `issues:`/`closures:`
  // operations from before this scan was dropped -- drop them on load so a
  // resumed job never re-requests them.
  const operations: MutableCollectorOperation[] = checkpoint.operations
    .filter((op) => !op.key.startsWith("issues:") && !op.key.startsWith("closures:"))
    .map((op) => ({ key: op.key, cursor: op.cursor, done: op.done }));
  const repositoryIds = new Set(checkpoint.discovered.repositoryIds);
  const state: Record<string, unknown> = { ...(checkpoint.state ?? {}) };
  const prMeta: Record<string, GitHubPrMeta> = { ...((state.pr as Record<string, GitHubPrMeta> | undefined) ?? {}) };
  state.pr = prMeta;
  delete state.issueRepo; // drop the legacy map from resumed checkpoints
  const reasons = new Set<EvidenceReasonCode>((state.reasons as EvidenceReasonCode[] | undefined) ?? []);
  const newEvents = new Map<string, NormalizedEngineeringEvent>();

  function subjectId(): string | undefined { return state.subjectId as string | undefined; }
  const makeStop = makeSliceStopFactory(diag, "github");
  function ensureOp(key: string): void { ensureSliceOperation(operations, key); }
  function registerRepo(repositoryId: string): void {
    if (repositoryIds.has(repositoryId)) return;
    repositoryIds.add(repositoryId);
    ensureOp(`commits:${repositoryId}`);
  }
  function addEvent(event: NormalizedEngineeringEvent): void { newEvents.set(engineeringEventKey(event), event); }
  function inWindow(date: unknown, operation: keyof typeof queries): boolean {
    if (!string(date)) { reasons.add(diag.record(operation, "parse")); return false; }
    try { return isWithinScoringWindow(date as string, window); } catch { reasons.add(diag.record(operation, "parse")); return false; }
  }

  async function request(queryName: keyof typeof queries, variables: Record<string, unknown>): Promise<{ data: ObjectData; stop: SourceDiagnostic | null; lineCountsUnavailable?: boolean }> {
    const budgetStop = budgetOrDeadlineStop(requestCount, budget.maxRequests, signal);
    if (budgetStop) return { data: {}, stop: makeStop(queryName, budgetStop) };
    requestCount++;
    try {
      const response = await fetch("https://api.github.com/graphql", {
        method: "POST", signal, headers: { "Content-Type": "application/json", ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}) },
        body: JSON.stringify({ query: withRateLimit(queries[queryName]), variables }),
      });
      if (!response.ok) {
        const stopKind = classifyHttpStatus(response.status, response.headers, [401, 403]);
        return { data: {}, stop: makeStop(queryName, stopKind, response.status, stopKind === "rate_limited" ? retryAfterSeconds(response.headers) : null) };
      }
      const payload = object(await response.json());
      if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        if (onlyLineCountsUnavailable(payload.errors)) return { data: object(payload.data), stop: null, lineCountsUnavailable: true };
        const limited = isGraphqlRateLimited(payload.errors);
        return { data: object(payload.data), stop: makeStop(queryName, limited ? "rate_limited" : "graphql", response.status, limited ? retryAfterSeconds(response.headers) : null) };
      }
      return { data: object(payload.data), stop: null };
    } catch (error) {
      return { data: {}, stop: makeStop(queryName, classifyFetchFailure(error, signal)) };
    }
  }

  function rateLimitStop(queryName: keyof typeof queries, data: ObjectData): SourceDiagnostic | null {
    const rateLimit = object(data.rateLimit);
    const remaining = number(rateLimit.remaining);
    if (remaining === null || remaining >= RATE_LIMIT_FLOOR) return null;
    const resetAt = typeof rateLimit.resetAt === "string" ? rateLimit.resetAt : null;
    const seconds = resetAt !== null ? Math.ceil((Date.parse(resetAt) - Date.now()) / 1000) : null;
    return makeStop(queryName, "rate_limited", null, seconds !== null && Number.isFinite(seconds) ? Math.max(0, seconds) : null);
  }

  /**
   * Drains one checkpointed list operation: pages `queryName` at `path`,
   * calling `onNode` for each node, until the connection is exhausted or a
   * budget/deadline/rate-limit/protocol stop interrupts it. `options.search`
   * reads `issueCount` instead of `totalCount` and reports a `"split"`
   * outcome (never processing that page) the first time this operation sees
   * more than 1,000 matches, so the caller can replace it with two
   * half-range operations instead of hitting GitHub search's 1,000-node cap.
   */
  async function runPagedList(
    op: MutableCollectorOperation, queryName: keyof typeof queries, variables: Record<string, unknown> | (() => Record<string, unknown>), path: readonly string[],
    onNode: (node: ObjectData) => void,
    options: {
      readonly search?: boolean; readonly onPage?: (data: ObjectData) => void; readonly emptyOk?: (data: ObjectData) => boolean;
      /** The same query without line counts, to recover nodes GitHub nulled because it could not count their lines. */
      readonly withoutLineCounts?: keyof typeof queries;
      /** Runs when a page answers an HTTP 5xx, so the caller can retry it
       * smaller or absorb the operation instead of stopping the whole slice
       * (#1351, commit-history page-size ladder). */
      readonly onServerError?: (cursor: string | null) => Promise<LadderOutcome>;
    } = {},
  ): Promise<ListOutcome> {
    let cursor = op.cursor;
    let isFirstFetch = cursor === null;
    for (;;) {
      // A thunk lets the commits ladder read its current (possibly reduced)
      // page size fresh on every page, instead of the fixed object every
      // other caller passes.
      const pageVariables = typeof variables === "function" ? variables() : variables;
      let r = await request(queryName, { ...pageVariables, after: cursor });
      if (r.lineCountsUnavailable && options.withoutLineCounts) {
        const fallback = await request(options.withoutLineCounts, { ...pageVariables, after: cursor });
        r = fallback.stop ? fallback : { data: fillNullNodes(r.data, fallback.data, path), stop: null };
      }
      if (r.stop && r.stop.stopKind === "http" && (r.stop.httpStatus ?? 0) >= 500 && options.onServerError) {
        const ladder = await options.onServerError(cursor);
        if (ladder.kind === "recovered") r = { data: ladder.data, stop: null };
        else if (ladder.kind === "absorbed") { op.done = true; op.cursor = null; return { kind: "done", totalCount: null }; }
        else { op.cursor = cursor; return { kind: "stop", stop: ladder.stop }; }
      }
      options.onPage?.(r.data);
      if (!r.stop && options.emptyOk?.(r.data)) { op.done = true; op.cursor = null; return { kind: "done", totalCount: 0 }; }
      const connection = object(at(r.data, ...path));
      const totalCount = number(options.search ? connection.issueCount : connection.totalCount);
      if (!r.stop && options.search && isFirstFetch && totalCount !== null && totalCount > 1000) return { kind: "split", totalCount };
      isFirstFetch = false;
      // A GraphQL response can carry usable partial data alongside its errors
      // array (the request-level stop below) -- never call that data complete,
      // but never discard it either: retain every node this page did return.
      if (Array.isArray(connection.nodes)) {
        for (const node of connection.nodes) {
          if (node && typeof node === "object" && !Array.isArray(node)) onNode(object(node));
          else reasons.add("not_accessible");
        }
      } else if (!r.stop) { const stop = makeStop(queryName, "protocol"); op.cursor = cursor; return { kind: "stop", stop }; }
      if (r.stop) {
        // A per-item fan-out fetch (this is never the profile/identity
        // operation, which never reaches runPagedList) that lost access --
        // e.g. a PR deleted after it merged, or a repo gone private -- must
        // not block the receipt forever. Absorb it like a malformed node:
        // one deduped diagnostic (already recorded inside request()), this
        // operation done with whatever was collected, final coverage partial.
        if (r.stop.stopKind === "not_accessible") { reasons.add("not_accessible"); op.done = true; op.cursor = null; return { kind: "done", totalCount: null }; }
        op.cursor = cursor; return { kind: "stop", stop: r.stop };
      }
      const page = object(connection.pageInfo);
      if (typeof page.hasNextPage !== "boolean") { const stop = makeStop(queryName, "protocol"); op.cursor = cursor; return { kind: "stop", stop }; }
      if (!page.hasNextPage) { op.done = true; op.cursor = null; return { kind: "done", totalCount }; }
      const rl = rateLimitStop(queryName, r.data);
      const next = string(page.endCursor);
      if (!next || next === cursor) { const stop = makeStop(queryName, "protocol"); op.cursor = cursor; return { kind: "stop", stop }; }
      if (rl) { op.cursor = next; return { kind: "stop", stop: rl }; }
      cursor = next;
    }
  }

  function onMergedNode(pr: ObjectData): void {
    const prId = string(pr.id); const repo = object(pr.repository); const repositoryId = string(repo.id);
    if (!prId || at(pr, "author", "id") !== subjectId() || pr.merged !== true || !repositoryId) { if (!prId || !at(pr, "author", "id")) reasons.add("not_accessible"); return; }
    if (explicit && !repositoryIds.has(repositoryId)) return;
    registerRepo(repositoryId);
    const workItemId = `github:${prId}`;
    prMeta[workItemId] = {
      repositoryId, mergedAt: string(pr.mergedAt), createdAt: string(pr.createdAt),
      additions: number(pr.additions), deletions: number(pr.deletions),
      hasDescription: typeof pr.body === "string" ? pr.body.trim().length > 0 : null,
      closingIssuesCount: number(at(pr, "closingIssuesReferences", "totalCount")),
      changedFiles: number(pr.changedFiles),
      revision: string(pr.headRefOid) ?? prId,
    };
    ensureOp(`files:${workItemId}`);
  }

  function buildAcceptedChangeEvent(workItemId: string, meta: GitHubPrMeta, paths: readonly string[], filesComplete: boolean): NormalizedEngineeringEvent | null {
    if (!inWindow(meta.mergedAt ?? null, "merged")) return null;
    const prId = workItemId.slice("github:".length);
    const repositoryId = meta.repositoryId;
    const occurredAt = scoringInstant(String(meta.mergedAt)).toISOString();
    let leadTimeHours: Observation<number> = unknown("partial", "source_error");
    if (meta.createdAt) {
      try {
        const duration = (scoringInstant(String(meta.mergedAt)).getTime() - scoringInstant(meta.createdAt).getTime()) / 3_600_000;
        if (duration >= 0) leadTimeHours = observed(duration, "complete", "source_observed");
      } catch { /* Missing/invalid dates remain unknown measurements. */ }
    }
    if (!filesComplete) reasons.add("partial_files");
    return {
      schemaVersion: "v7", provider: "github", host: "github.com", subjectId: subjectId()!, actorId: subjectId()!,
      repositoryId, eventId: prId, kind: "accepted_change", occurredAt, dataThrough: window.referenceTime,
      canonicalProjectId: `github:${repositoryId}`, workItemId, artifactRevision: meta.revision ?? prId,
      artifactReferenceIds: [`github:${prId}`], attribution: "individual", provenance: "source_observed", coverage: "complete",
      measurements: {
        changedFiles: filesComplete ? observed([...paths], "complete", "source_observed") : unknown("partial", "partial_files"),
        additions: meta.additions != null ? observed(meta.additions, "complete", "source_observed") : unknown("partial", "source_error"),
        deletions: meta.deletions != null ? observed(meta.deletions, "complete", "source_observed") : unknown("partial", "source_error"),
        leadTimeHours,
        hasDescription: meta.hasDescription != null ? observed(meta.hasDescription, "complete", "source_observed") : unknown("partial", "source_error"),
        hasIssueLink: meta.closingIssuesCount != null ? observed(meta.closingIssuesCount > 0, "complete", "source_observed") : unknown("partial", "source_error"),
        usesFeatureBranch: unknown("unavailable", "not_supported"),
      },
      categories: [], acceptance: observed({ method: "merged_change", acceptedAt: occurredAt, acceptedResultId: `github:${prId}` }, "complete", "source_observed"),
    };
  }

  let pendingStop: SourceDiagnostic | null = null;

  async function processOperation(op: MutableCollectorOperation, index: number): Promise<"done" | "stop" | "replaced"> {
    if (op.key === "profile") {
      const r = await request("profile", { login });
      if (r.stop) { pendingStop = r.stop; return "stop"; }
      const user = object(at(r.data, "user"));
      const uSubjectId = string(user.id); const uLogin = string(user.login);
      if (!uSubjectId || !uLogin) { pendingStop = makeStop("profile", "protocol"); return "stop"; }
      state.subjectId = uSubjectId; state.login = uLogin; state.name = string(user.name); state.avatarUrl = string(user.avatarUrl);
      op.done = true; op.cursor = null;
      const rl = rateLimitStop("profile", r.data);
      if (rl) { pendingStop = rl; return "stop"; }
      return "done";
    }
    if (op.key === "repositories" || op.key === "contributed") {
      const path = op.key === "repositories" ? ["user", "repositories"] : ["user", "repositoriesContributedTo"];
      const outcome = await runPagedList(op, op.key, { login }, path, (node) => { const id = string(node.id); if (id) registerRepo(id); else reasons.add("not_accessible"); });
      if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
      return "done";
    }
    const mergedRange = /^merged:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(op.key);
    if (mergedRange) {
      const [, start, end] = mergedRange as unknown as [string, string, string];
      const query = `author:${login} is:pr is:merged merged:${start}..${end}`;
      const outcome = await runPagedList(op, "merged", { query }, ["search"], onMergedNode, { search: true });
      if (outcome.kind === "split") {
        if (start === end) { reasons.add("discovery_incomplete"); op.done = true; op.cursor = null; return "done"; }
        const [first, second] = splitDateRange(start, end);
        operations.splice(index, 1, { key: `merged:${first.start}..${first.end}`, cursor: null, done: false }, { key: `merged:${second.start}..${second.end}`, cursor: null, done: false });
        return "replaced";
      }
      if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
      return "done";
    }
    if (op.key.startsWith("files:")) {
      const workItemId = op.key.slice("files:".length);
      const nodeId = workItemId.startsWith("github:") ? workItemId.slice("github:".length) : workItemId;
      const filePaths: Record<string, string[]> = (state.filePaths as Record<string, string[]> | undefined) ?? {};
      state.filePaths = filePaths;
      const paths = filePaths[workItemId] ?? (filePaths[workItemId] = []);
      const outcome = await runPagedList(op, "files", { id: nodeId }, ["node", "files"], (node) => { const p = string(node.path); if (p !== null) paths.push(p); });
      if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
      const meta = prMeta[workItemId];
      if (meta) {
        const complete = outcome.totalCount != null && paths.length === outcome.totalCount && new Set(paths).size === paths.length &&
          meta.changedFiles != null && paths.length === meta.changedFiles;
        const event = buildAcceptedChangeEvent(workItemId, meta, paths, complete);
        if (event) addEvent(event);
      } else reasons.add("not_accessible");
      delete filePaths[workItemId];
      return "done";
    }
    if (op.key === "reviewDiscovery") {
      reasons.add("discovery_incomplete");
      const outcome = await runPagedList(op, "reviewDiscovery", { login, since: window.startInclusive, until: window.referenceTime }, ["user", "contributionsCollection", "pullRequestReviewContributions"], (node) => {
        if (node.isRestricted === true) { reasons.add("not_accessible"); return; }
        const pr = object(node.pullRequest); const prId = string(pr.id); const repo = object(pr.repository); const repositoryId = string(repo.id);
        if (!prId || !repositoryId) { reasons.add("not_accessible"); return; }
        if (explicit && !repositoryIds.has(repositoryId)) return;
        registerRepo(repositoryId);
        const workItemId = `github:${prId}`;
        if (!prMeta[workItemId]) prMeta[workItemId] = { repositoryId };
        ensureOp(`reviews:${workItemId}`);
      }, { onPage: (data) => { if (number(at(data, "user", "contributionsCollection", "restrictedContributionsCount"))) reasons.add("not_accessible"); } });
      if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
      return "done";
    }
    if (op.key.startsWith("reviews:")) {
      const workItemId = op.key.slice("reviews:".length);
      const nodeId = workItemId.startsWith("github:") ? workItemId.slice("github:".length) : workItemId;
      const meta = prMeta[workItemId];
      const outcome = await runPagedList(op, "reviews", { id: nodeId }, ["node", "reviews"], (node) => {
        const authorId = string(at(node, "author", "id"));
        if (!authorId) { reasons.add("not_accessible"); return; }
        if (authorId !== subjectId() || node.state === "PENDING") return;
        const reviewId = string(node.id); if (!reviewId) { reasons.add("not_accessible"); return; }
        if (!inWindow(node.submittedAt, "reviews")) return;
        if (!meta?.repositoryId) { reasons.add("not_accessible"); return; }
        const occurredAt = scoringInstant(String(node.submittedAt)).toISOString();
        addEvent({
          schemaVersion: "v7", provider: "github", host: "github.com", subjectId: subjectId()!, actorId: subjectId()!,
          repositoryId: meta.repositoryId, eventId: reviewId, kind: "review", occurredAt, dataThrough: window.referenceTime,
          canonicalProjectId: `github:${meta.repositoryId}`, workItemId, artifactRevision: reviewId,
          artifactReferenceIds: [`github:${reviewId}`], attribution: "individual", provenance: "source_observed", coverage: "complete",
          measurements: emptyMeasurements(), categories: [], acceptance: unknown("unavailable", "not_supported"),
        });
      });
      if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
      return "done";
    }
    if (op.key.startsWith("commits:")) {
      const repositoryId = op.key.slice("commits:".length);
      // Per-op page size and ladder-failure bookkeeping, carried in checkpoint
      // state across slices (#1351). Reduced once a smaller size works;
      // failures count separate ladder exhaustions, reset on any success.
      const commitPageSizes: Record<string, number> = (state.commitPageSize as Record<string, number> | undefined) ?? {};
      state.commitPageSize = commitPageSizes;
      const commitLadderFailures: Record<string, number> = (state.commitLadderFailures as Record<string, number> | undefined) ?? {};
      state.commitLadderFailures = commitLadderFailures;
      const commitQueryVariables = (first: number) => ({ id: repositoryId, subjectId: subjectId(), since: commitHistorySince, first });
      /** Retries the failing page at each smaller ladder size, then without
       * line counts at the smallest size. Absorbs the whole operation as
       * partial coverage after COMMIT_LADDER_ABSORB_AFTER separate failed
       * ladders. Any other stop (budget, deadline, rate limit, ...) mid-ladder
       * propagates immediately and is never counted as a ladder failure. */
      async function retryCommitsLadder(cursor: string | null): Promise<LadderOutcome> {
        const currentSize = commitPageSizes[op.key] ?? COMMIT_PAGE_LADDER[0];
        for (const size of COMMIT_PAGE_LADDER.filter((candidate) => candidate < currentSize)) {
          const r = await request("commits", { ...commitQueryVariables(size), after: cursor });
          if (!r.stop) { commitPageSizes[op.key] = size; return { kind: "recovered", data: r.data }; }
          if (r.stop.stopKind !== "http" || (r.stop.httpStatus ?? 0) < 500) return { kind: "stop", stop: r.stop };
        }
        const smallest = COMMIT_PAGE_LADDER.at(-1)!;
        const fallback = await request("commitsWithoutLines", { ...commitQueryVariables(smallest), after: cursor });
        if (!fallback.stop) { commitPageSizes[op.key] = smallest; return { kind: "recovered", data: fallback.data }; }
        if (fallback.stop.stopKind !== "http" || (fallback.stop.httpStatus ?? 0) < 500) return { kind: "stop", stop: fallback.stop };
        const failures = (commitLadderFailures[op.key] ?? 0) + 1;
        if (failures >= COMMIT_LADDER_ABSORB_AFTER) {
          reasons.add("source_error");
          delete commitPageSizes[op.key];
          delete commitLadderFailures[op.key];
          return { kind: "absorbed" };
        }
        commitLadderFailures[op.key] = failures;
        return { kind: "stop", stop: fallback.stop };
      }
      const outcome = await runPagedList(op, "commits", () => commitQueryVariables(commitPageSizes[op.key] ?? COMMIT_PAGE_LADDER[0]), ["node", "defaultBranchRef", "target", "history"], (node) => {
        const authorId = string(at(node, "author", "user", "id"));
        if (!authorId) { reasons.add("attribution_unknown"); return; }
        if (authorId !== subjectId()) return;
        const eventId = string(node.id); if (!eventId) { reasons.add("not_accessible"); return; }
        if (!inWindow(node.authoredDate, "commits")) return;
        const revision = string(node.oid) ?? eventId;
        addEvent({
          schemaVersion: "v7", provider: "github", host: "github.com", subjectId: subjectId()!, actorId: subjectId()!,
          repositoryId, eventId, kind: "authored_commit", occurredAt: scoringInstant(String(node.authoredDate)).toISOString(), dataThrough: window.referenceTime,
          canonicalProjectId: `github:${repositoryId}`, workItemId: `github:${revision}`, artifactRevision: revision,
          artifactReferenceIds: [`github:${eventId}`], attribution: "individual", provenance: "source_observed", coverage: "complete",
          measurements: { ...emptyMeasurements(), additions: observedNumber(node.additions), deletions: observedNumber(node.deletions) },
          categories: [], acceptance: unknown("unavailable", "acceptance_time_unknown"),
        });
      }, {
        emptyOk: (data) => at(data, "node", "isEmpty") === true && at(data, "node", "defaultBranchRef") === null,
        withoutLineCounts: "commitsWithoutLines",
        onServerError: retryCommitsLadder,
        // A page that returns real history data, from any source (the normal
        // request, the line-counts-unavailable fallback, or the ladder),
        // resets the failure counter -- a later slice made progress.
        onPage: (data) => { if (Array.isArray(object(at(data, "node", "defaultBranchRef", "target", "history")).nodes)) delete commitLadderFailures[op.key]; },
      });
      if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
      delete commitPageSizes[op.key];
      return "done";
    }
    op.done = true;
    return "done";
  }

  if (!operations.some((op) => op.key === "profile")) {
    const scaffold: MutableCollectorOperation[] = [{ key: "profile", cursor: null, done: false }];
    if (!explicit) scaffold.push({ key: "repositories", cursor: null, done: false }, { key: "contributed", cursor: null, done: false });
    for (const range of githubMergedSearchRanges(window)) scaffold.push({ key: `merged:${range.start}..${range.end}`, cursor: null, done: false });
    scaffold.push({ key: "reviewDiscovery", cursor: null, done: false });
    operations.unshift(...scaffold);
    if (explicit) for (const id of input.scope.repositoryIds) registerRepo(id);
  }

  let index = 0;
  while (index < operations.length) {
    const op = operations[index]!;
    if (op.done) { index++; continue; }
    const outcome = await processOperation(op, index);
    if (outcome === "stop") break;
    if (outcome === "replaced") continue;
    index++;
  }

  function buildCheckpoint() { return buildSliceCheckpoint(operations, repositoryIds, state, reasons); }
  function newEventsForCaller(): NormalizedEngineeringEvent[] { return newSliceEvents(newEvents, stagedKeys); }
  const discoveryComplete = computeDiscoveryComplete(operations, GITHUB_EXPANDING_OPERATIONS);

  if (pendingStop) {
    return { events: newEventsForCaller(), checkpoint: buildCheckpoint(), done: false, coverage: null, stop: pendingStop, requests: requestCount, discoveryComplete };
  }

  // Every operation is done: assemble coverage from operations/reasons.
  if (!explicit) reasons.add("discovery_incomplete");
  reasons.add("acceptance_time_unknown");
  const commitsComplete = operations.filter((op) => op.key.startsWith("commits:")).every((op) => op.done);
  const unidentified = ["not_accessible", "source_error", "attribution_unknown", "pagination_incomplete"].some((reason) => reasons.has(reason as EvidenceReasonCode));
  const eventKinds: SourceCoverage["eventKinds"] = {
    accepted_change: "partial",
    authored_commit: explicit && !unidentified && commitsComplete ? "complete" : "partial",
    review: "partial",
    // GitHub issue closures are not collected (#1351): every issue_work event
    // this scan could produce was inadmissible for scoring (v7-evidence.ts's
    // acceptedKind never accepts one), so there is nothing to report here.
    issue_work: "unavailable",
    practice_evidence: "unavailable", documentation_design: "unavailable", maintenance: "unavailable",
  };
  reasons.add("not_supported");
  const coverage = assembleSliceCoverage({
    provider: "github", host: "github.com", subjectId: subjectId()!, window, explicit, repositoryIds, eventKinds, reasons,
  });
  return { events: newEventsForCaller(), checkpoint: buildCheckpoint(), done: true, coverage, stop: null, requests: requestCount, discoveryComplete };
};
