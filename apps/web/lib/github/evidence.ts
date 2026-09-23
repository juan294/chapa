import {
  createScoringWindow, engineeringEventKey, isWithinScoringWindow, observed, scoringInstant, unknown,
  type EvidenceReasonCode, type EventMeasurements, type NormalizedEngineeringEvent,
  type Observation, type ScoringWindow, type SourceCoverage,
} from "@chapa/shared";
import { getGithubToken } from "@/lib/env";
import type { CollectorCheckpoint, CollectorOperation, CollectSlice } from "@/lib/collection/plan";
import {
  budgetOrDeadlineStop, classifyFetchFailure, classifyHttpStatus, createDiagnosticRecorder,
  isGraphqlRateLimited, retryAfterSeconds, type SourceDiagnostic, type StopKind,
} from "@/lib/platform/evidence-diagnostics";
import { GITHUB_EVIDENCE_QUERIES as queries } from "./evidence-queries";

type ObjectData = Record<string, unknown>;
const object = (value: unknown): ObjectData => value !== null && typeof value === "object" && !Array.isArray(value) ? value as ObjectData : {};
const at = (value: unknown, ...keys: string[]): unknown => keys.reduce<unknown>((v, key) => object(v)[key], value);
const string = (value: unknown): string | null => typeof value === "string" && value.length > 0 ? value : null;
const number = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
const observedNumber = (value: unknown): Observation<number> => number(value) === null ? unknown("partial", "source_error") : observed(value as number, "complete", "source_observed");
const emptyMeasurements = (): EventMeasurements => ({
  changedFiles: unknown("unavailable", "not_supported"), additions: unknown("unavailable", "not_supported"),
  deletions: unknown("unavailable", "not_supported"), leadTimeHours: unknown("unavailable", "not_supported"),
  hasDescription: unknown("unavailable", "not_supported"), hasIssueLink: unknown("unavailable", "not_supported"), usesFeatureBranch: unknown("unavailable", "not_supported"),
});

/** Private collection checkpoint. Retain alongside evidence; never expose repository IDs/cursors publicly. */
export interface GitHubEvidenceProgress {
  readonly operation: keyof typeof queries;
  readonly variables: Readonly<Record<string, string>>;
  readonly nextCursor: string | null;
  readonly collectedNodes: number;
  readonly totalCount: number | null;
  readonly complete: boolean;
  readonly reasonCodes: readonly EvidenceReasonCode[];
}
export interface GitHubEvidenceOptions {
  /** Server coordinator already selected this credential. Null means anonymous;
   * never re-read the environment after the access context has been bound.
   */
  readonly resolvedCredential?: { readonly token: string | null };
  /** Logical HTTP requests: no hidden retries. Defaults 80; maximum 500. */
  readonly maxRequests?: number;
  /** A single deadline across all requests. Defaults 30 seconds. */
  readonly timeoutMs?: number;
  /** Explicit declared repository scope; omit to discover owned/contributed repos. */
  readonly repositoryIds?: readonly string[];
}
export interface GitHubEvidenceResult {
  readonly profile: { readonly login: string; readonly name: string | null; readonly avatarUrl: string | null };
  readonly events: readonly NormalizedEngineeringEvent[];
  readonly coverage: SourceCoverage;
  readonly progress: readonly GitHubEvidenceProgress[];
  readonly requestCount: number;
  readonly diagnostics: readonly SourceDiagnostic[];
}

/**
 * Collect actual dated events, never v6 scalar estimates. Credentials are used
 * only in the request header; errors retain safe reason codes, not API bodies.
 * A missing profile returns null because no stable subject identity was established.
 * A known profile with failed collectors returns evidence plus explicit coverage.
 */
export async function fetchGitHubEvidence(
  handle: string, inputWindow: ScoringWindow, token?: string, options: GitHubEvidenceOptions = {},
): Promise<GitHubEvidenceResult | null> {
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(handle)) throw new RangeError("Invalid GitHub handle");
  const window = createScoringWindow(inputWindow.referenceTime);
  if (window.startInclusive !== inputWindow.startInclusive || window.endExclusive !== inputWindow.endExclusive || window.referenceDate !== inputWindow.referenceDate || inputWindow.calendarDays !== 365) throw new RangeError("Inconsistent scoring window");
  const maxRequests = options.maxRequests ?? 80;
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 500 || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new RangeError("Invalid GitHub evidence budget");
  if (options.repositoryIds && (options.repositoryIds.length > 500 || options.repositoryIds.some((id) => !string(id)))) throw new RangeError("Invalid explicit repository scope");
  const signal = AbortSignal.timeout(timeoutMs);
  const effectiveToken = options.resolvedCredential !== undefined
    ? options.resolvedCredential.token
    : (token ?? getGithubToken())?.trim();
  const progress: GitHubEvidenceProgress[] = [];
  const reasons = new Set<EvidenceReasonCode>();
  const diag = createDiagnosticRecorder("github");
  let requestCount = 0;
  async function request(operation: keyof typeof queries, variables: Record<string, unknown>) {
    // A collector's own budget or deadline is honest incompleteness, never a
    // provider-reported or structural failure: classify before attempting.
    const stop = budgetOrDeadlineStop(requestCount, maxRequests, signal);
    if (stop) return { data: {}, error: diag.record(operation, stop) };
    requestCount++;
    try {
      const response = await fetch("https://api.github.com/graphql", {
        method: "POST", signal, headers: { "Content-Type": "application/json", ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}) },
        body: JSON.stringify({ query: queries[operation], variables }),
      });
      if (!response.ok) {
        const stopKind = classifyHttpStatus(response.status, response.headers, [401, 403]);
        return { data: {}, error: diag.record(operation, stopKind, response.status, stopKind === "rate_limited" ? retryAfterSeconds(response.headers) : null) };
      }
      const payload = object(await response.json());
      if (Array.isArray(payload.errors) && payload.errors.length > 0) {
        return { data: object(payload.data), error: diag.record(operation, isGraphqlRateLimited(payload.errors) ? "rate_limited" : "graphql", response.status) };
      }
      return { data: object(payload.data), error: null };
    } catch (error) {
      // The AbortSignal.timeout deadline can fire mid-flight, rejecting fetch
      // or json() with no HTTP response at all -- classify by signal/exception.
      return { data: {}, error: diag.record(operation, classifyFetchFailure(error, signal)) };
    }
  }
  const profileResponse = await request("profile", { login: handle });
  const user = object(at(profileResponse.data, "user"));
  const subjectId = string(user.id);
  const login = string(user.login);
  if (!subjectId || !login) return null;
  if (profileResponse.error) reasons.add(profileResponse.error);

  async function collect(operation: keyof typeof queries, variables: Record<string, string>, path: readonly string[], search = false) {
    const nodes: ObjectData[] = [];
    const errors = new Set<EvidenceReasonCode>();
    let cursor: string | null = null;
    let totalCount: number | null = null;
    let complete = false;
    const seen = new Set<string>();
    for (;;) {
      const response = await request(operation, { ...variables, after: cursor });
      if (response.error) errors.add(response.error);
      if (operation === "commits" && at(response.data, "node", "isEmpty") === true && at(response.data, "node", "defaultBranchRef") === null && !response.error) {
        complete = true; totalCount = 0; break;
      }
      const connection = object(at(response.data, ...path));
      if (!Array.isArray(connection.nodes)) {
        if (!response.error) errors.add("not_accessible");
        break;
      }
      totalCount = number(search ? connection.issueCount : connection.totalCount);
      if (totalCount === null) errors.add(diag.record(operation, "protocol"));
      for (const node of connection.nodes) {
        if (!node || typeof node !== "object" || Array.isArray(node)) { errors.add("not_accessible"); continue; }
        nodes.push(object(node));
      }
      if (operation === "reviewDiscovery" && number(at(response.data, "user", "contributionsCollection", "restrictedContributionsCount"))) errors.add("not_accessible");
      // Keep useful nodes, but replay the entire incoming page after any API
      // error: its outgoing cursor cannot certify the missing portion was read.
      if (response.error) { errors.add("pagination_incomplete"); break; }
      const page = object(connection.pageInfo);
      const next = string(page.endCursor);
      if (typeof page.hasNextPage !== "boolean") { errors.add(diag.record(operation, "protocol")); break; }
      if (!page.hasNextPage) {
        complete = errors.size === 0 && totalCount === nodes.length;
        if (!complete && errors.size === 0) errors.add("pagination_incomplete");
        cursor = null;
        break;
      }
      if (!next || seen.has(next)) { errors.add("pagination_incomplete"); break; }
      seen.add(next);
      cursor = next;
      if (search && (totalCount ?? 0) > 1000) errors.add("discovery_incomplete");
      // GitHub search exposes at most 1,000 nodes. Save the boundary instead of
      // silently declaring issueCount observations from an inaccessible tail.
      if (search && nodes.length >= 1000) { errors.add("pagination_incomplete"); break; }
    }
    if (!complete) for (const reason of errors) reasons.add(reason);
    progress.push({ operation, variables, nextCursor: cursor, collectedNodes: nodes.length, totalCount, complete, reasonCodes: [...errors] });
    return { nodes, complete };
  }

  const repositories = new Map<string, ObjectData>();
  const addRepo = (value: unknown) => {
    const repo = object(value); const id = string(repo.id);
    if (id) repositories.set(id, repo); else reasons.add("not_accessible");
  };
  if (options.repositoryIds) for (const id of options.repositoryIds) addRepo({ id });
  else {
    for (const r of (await collect("repositories", { login }, ["user", "repositories"])).nodes) addRepo(r);
    for (const r of (await collect("contributed", { login }, ["user", "repositoriesContributedTo"])).nodes) addRepo(r);
    // 'Recently contributed' is not an exact annual discovery guarantee.
    reasons.add("discovery_incomplete");
  }
  const events = new Map<string, NormalizedEngineeringEvent>();
  const inWindow = (date: unknown, operation: string) => {
    if (!string(date)) { reasons.add(diag.record(operation, "parse")); return false; }
    try { return isWithinScoringWindow(date as string, window); } catch { reasons.add(diag.record(operation, "parse")); return false; }
  };
  function event(node: ObjectData, repo: ObjectData, kind: NormalizedEngineeringEvent["kind"], date: unknown, workItemId: string, operation: string): NormalizedEngineeringEvent | null {
    const id = string(node.id); const repositoryId = string(repo.id);
    if (!id || !repositoryId) { reasons.add("not_accessible"); return null; }
    if (!inWindow(date, operation)) return null;
    return {
      schemaVersion: "v7", provider: "github", host: "github.com", subjectId: subjectId!, actorId: subjectId!, repositoryId,
      eventId: id, kind, occurredAt: scoringInstant(date as string).toISOString(), dataThrough: window.referenceTime,
      canonicalProjectId: `github:${repositoryId}`, workItemId: `github:${workItemId}`, artifactRevision: string(node.oid) ?? string(node.headRefOid) ?? id,
      artifactReferenceIds: [`github:${id}`], attribution: "individual", provenance: "source_observed", coverage: "complete",
      measurements: emptyMeasurements(), categories: [], acceptance: unknown("unavailable", "not_supported"),
    };
  }
  const addEvent = (value: NormalizedEngineeringEvent | null) => { if (value) events.set(value.eventId, value); };
  const query = `author:${login} is:pr is:merged merged:${window.startInclusive.slice(0, 10)}..${window.referenceDate}`;
  const merged = await collect("merged", { query }, ["search"], true);
  const reviewTargets = new Map<string, ObjectData>();
  for (const pr of merged.nodes) {
    const id = string(pr.id); const repo = object(pr.repository);
    if (!id || at(pr, "author", "id") !== subjectId || pr.merged !== true) { if (!id || !at(pr, "author", "id")) reasons.add("not_accessible"); continue; }
    if (options.repositoryIds && !repositories.has(String(repo.id))) continue;
    addRepo(repo);
    const base = event(pr, repo, "accepted_change", pr.mergedAt, id, "merged");
    if (!base) continue;
    const files = await collect("files", { id }, ["node", "files"]);
    const paths = files.nodes.map((f) => string(f.path));
    const completeFiles = files.complete && paths.every((p) => p !== null) && paths.length === number(pr.changedFiles) && new Set(paths).size === paths.length;
    if (!completeFiles) reasons.add("partial_files");
    let leadTimeHours: Observation<number> = unknown("partial", "source_error");
    try {
      const duration = (scoringInstant(String(pr.mergedAt)).getTime() - scoringInstant(String(pr.createdAt)).getTime()) / 3_600_000;
      if (duration >= 0) leadTimeHours = observed(duration, "complete", "source_observed");
    } catch { /* Missing dates remain unknown measurements. */ }
    const closingCount = number(at(pr, "closingIssuesReferences", "totalCount"));
    addEvent({ ...base,
      acceptance: observed({ method: "merged_change", acceptedAt: base.occurredAt, acceptedResultId: `github:${id}` }, "complete", "source_observed"),
      measurements: { ...base.measurements, changedFiles: completeFiles ? observed(paths as string[], "complete", "source_observed") : unknown("partial", "partial_files"),
        additions: observedNumber(pr.additions), deletions: observedNumber(pr.deletions), leadTimeHours,
        hasDescription: typeof pr.body === "string" ? observed(pr.body.trim().length > 0, "complete", "source_observed") : unknown("partial", "source_error"),
        hasIssueLink: closingCount === null ? unknown("partial", "source_error") : observed(closingCount > 0, "complete", "source_observed"),
        usesFeatureBranch: unknown("unavailable", "not_supported"),
      },
    });
  }
  const reviewDiscovery = await collect("reviewDiscovery", { login, since: window.startInclusive, until: window.referenceTime }, ["user", "contributionsCollection", "pullRequestReviewContributions"]);
  // GitHub exposes the most recent review contribution per PR. A later review
  // beyond a historical reference can hide a PR with earlier eligible reviews.
  reasons.add("discovery_incomplete");
  for (const contribution of reviewDiscovery.nodes) {
    if (contribution.isRestricted === true) { reasons.add("not_accessible"); continue; }
    const pr = object(contribution.pullRequest); const id = string(pr.id); const repo = object(pr.repository);
    if (!id || !string(repo.id)) { reasons.add("not_accessible"); continue; }
    if (options.repositoryIds && !repositories.has(String(repo.id))) continue;
    addRepo(repo); reviewTargets.set(id, pr);
  }
  for (const [id, pr] of reviewTargets) {
    const reviews = await collect("reviews", { id }, ["node", "reviews"]);
    for (const review of reviews.nodes) {
      if (!string(at(review, "author", "id"))) { reasons.add("not_accessible"); continue; }
      if (at(review, "author", "id") !== subjectId || review.state === "PENDING") continue;
      addEvent(event(review, object(pr.repository), "review", review.submittedAt, id, "reviews"));
    }
  }
  for (const [id, repo] of repositories) {
    const commits = await collect("commits", { id, subjectId }, ["node", "defaultBranchRef", "target", "history"]);
    for (const commit of commits.nodes) {
      if (!string(at(commit, "author", "user", "id"))) { reasons.add("attribution_unknown"); continue; }
      if (at(commit, "author", "user", "id") !== subjectId) continue;
      const base = event(commit, repo, "authored_commit", commit.authoredDate, string(commit.oid) ?? String(commit.id), "commits");
      if (base) addEvent({ ...base, acceptance: unknown("unavailable", "acceptance_time_unknown"), measurements: { ...base.measurements, additions: observedNumber(commit.additions), deletions: observedNumber(commit.deletions) } });
    }
    const issues = await collect("issues", { id, since: window.startInclusive }, ["node", "issues"]);
    for (const issue of issues.nodes) {
      const issueId = string(issue.id);
      if (!issueId) { reasons.add("not_accessible"); continue; }
      const closures = await collect("closures", { id: issueId }, ["node", "timelineItems"]);
      for (const closure of closures.nodes) {
        if (!string(at(closure, "actor", "id"))) { reasons.add("attribution_unknown"); continue; }
        if (at(closure, "actor", "id") !== subjectId) continue;
        const closer = object(closure.closer);
        const closerId = string(closer.id);
        const linkedId = closer.__typename === "PullRequest" && closer.merged === true ? closerId : null;
        const authoredResult = linkedId !== null && at(closer, "author", "id") === subjectId;
        const base = event(closure, repo, "issue_work", closure.createdAt, linkedId ?? issueId, "closures");
        if (!base) continue;
        // Closing an issue establishes who operated the closure, not who did
        // its engineering work. Retain the diagnostic and its backing link.
        addEvent({ ...base,
          artifactReferenceIds: [...base.artifactReferenceIds, ...(closerId ? [`github:${closerId}`] : [])],
          acceptance: unknown("partial", "attribution_unknown"),
        });
        if (!authoredResult) reasons.add("attribution_unknown");
        if (closer.__typename && closer.__typename !== "PullRequest") reasons.add("not_supported");
        // Closure time and accepted-result time need not be identical. Keep the
        // actual closure diagnostic and a separate link-equivalent acceptance.
        // An authored PR already carries richer measurements, so never replace it.
        if (authoredResult && linkedId && !events.has(linkedId)) {
          const accepted = event(closer, object(closer.repository), "accepted_change", closer.mergedAt, linkedId, "closures");
          if (accepted && (!options.repositoryIds || repositories.has(accepted.repositoryId))) {
            addEvent({ ...accepted, artifactReferenceIds: [...accepted.artifactReferenceIds, ...base.artifactReferenceIds],
              acceptance: observed({ method: "merged_change", acceptedAt: accepted.occurredAt, acceptedResultId: `github:${linkedId}` }, "complete", "source_observed") });
          }
        }
      }
    }
  }
  const operationsComplete = (ops: (keyof typeof queries)[]) => progress.filter((p) => ops.includes(p.operation)).every((p) => p.complete);
  const discoveryComplete = options.repositoryIds !== undefined;
  const unidentified = ["not_accessible", "source_error", "attribution_unknown", "pagination_incomplete"].some((reason) => reasons.has(reason as EvidenceReasonCode));
  // Authored dates do not establish when older commits first reached default.
  // Missing in-window authored diagnostics cannot prove absent accepted work.
  reasons.add("acceptance_time_unknown");
  const eventKinds: SourceCoverage["eventKinds"] = {
    accepted_change: "partial",
    authored_commit: discoveryComplete && !unidentified && operationsComplete(["commits"]) ? "complete" : "partial",
    review: "partial",
    issue_work: discoveryComplete && !unidentified && operationsComplete(["issues", "closures"]) ? "complete" : "partial",
    practice_evidence: "unavailable", documentation_design: "unavailable", maintenance: "unavailable",
  };
  if (Object.values(eventKinds).some((status) => status === "unavailable")) reasons.add("not_supported");
  const complete = Object.values(eventKinds).every((status) => status === "complete") && reasons.size === 0;
  const coverage: SourceCoverage = {
    source: { provider: "github", host: "github.com", subjectId }, window, dataThrough: window.referenceTime,
    status: complete ? "complete" : "partial", discovery: discoveryComplete ? "explicit_repositories" : "owned_and_contributed",
    repositoryIds: [...repositories.keys()].sort(), repositoryDiscoveryComplete: discoveryComplete,
    eventKinds,
    reasonCodes: [...reasons].sort(), unknownPeriods: complete ? [] : [{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }],
  };
  return { profile: { login, name: string(user.name), avatarUrl: string(user.avatarUrl) }, events: [...events.values()], coverage, progress, requestCount, diagnostics: diag.diagnostics };
}

// ---------------------------------------------------------------------------
// collectGitHubSlice (#1335 phase 3) -- the checkpointed, resumable slice API.
// A separate engine from fetchGitHubEvidence above: the single-run function
// keeps its own exhaustive per-fixture reason-code tests unchanged, while this
// engine is built to pause and resume across many bounded slices. Both share
// the same GraphQL query bodies (GITHUB_EVIDENCE_QUERIES) and diagnostic
// helpers (evidence-diagnostics.ts).
// ---------------------------------------------------------------------------

/** Inserts a `rateLimit { remaining resetAt cost }` selection into a query's
 * top-level selection set. Every GITHUB_EVIDENCE_QUERIES body opens with
 * `query Name(...args...) { ... }` and no `{` appears before that first
 * brace (arguments use only `(...)`), so this is a safe, generic transform.
 */
function withRateLimit(query: string): string {
  const brace = query.indexOf("{");
  return `${query.slice(0, brace + 1)} rateLimit { remaining resetAt cost }${query.slice(brace + 1)}`;
}

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
  revision?: string | null;
}
interface MutableCollectorOperation { key: string; cursor: string | null; done: boolean }
interface ListOutcome { readonly kind: "done" | "stop" | "split"; readonly stop?: SourceDiagnostic; readonly totalCount?: number | null }

const RATE_LIMIT_FLOOR = 200;

/**
 * One bounded slice of GitHub evidence collection. Advances the checkpoint by
 * at most `budget.maxRequests` GraphQL calls or until `budget.deadlineAt`.
 * Merged-PR search is split into monthly ranges up front and recursively
 * halved on discovery of `issueCount > 1000`; a GraphQL `rateLimit` selection
 * on every query stops the slice once `remaining` drops below 200, with
 * `retryAfterSeconds` computed from `resetAt`.
 */
export const collectGitHubSlice: CollectSlice = async (input, credential, checkpoint, budget, staged) => {
  const window = createScoringWindow(input.window.referenceTime);
  if (window.startInclusive !== input.window.startInclusive || window.endExclusive !== input.window.endExclusive || window.referenceDate !== input.window.referenceDate || input.window.calendarDays !== 365) throw new RangeError("Inconsistent scoring window");
  const login = input.requestedSource.login;
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(login)) throw new RangeError("Invalid GitHub handle");
  const explicit = input.scope.discovery === "explicit_repositories";
  const signal = AbortSignal.timeout(Math.max(0, budget.deadlineAt - Date.now()));
  const diag = createDiagnosticRecorder("github");
  const effectiveToken = credential.token ?? getGithubToken()?.trim();
  let requestCount = 0;

  const operations: MutableCollectorOperation[] = checkpoint.operations.map((op) => ({ key: op.key, cursor: op.cursor, done: op.done }));
  const repositoryIds = new Set(checkpoint.discovered.repositoryIds);
  const state: Record<string, unknown> = { ...(checkpoint.state ?? {}) };
  const prMeta: Record<string, GitHubPrMeta> = { ...((state.pr as Record<string, GitHubPrMeta> | undefined) ?? {}) };
  state.pr = prMeta;
  const issueRepo: Record<string, string> = { ...((state.issueRepo as Record<string, string> | undefined) ?? {}) };
  state.issueRepo = issueRepo;
  const reasons = new Set<EvidenceReasonCode>((state.reasons as EvidenceReasonCode[] | undefined) ?? []);
  const seededDataThrough = state.seededDataThrough as string | null | undefined;
  const newEvents = new Map<string, NormalizedEngineeringEvent>();
  const stagedKeys = new Set(staged.map(engineeringEventKey));

  function subjectId(): string | undefined { return state.subjectId as string | undefined; }
  function makeStop(operation: string, stopKind: StopKind, httpStatus: number | null = null, retryAfter: number | null = null): SourceDiagnostic {
    diag.record(operation, stopKind, httpStatus, retryAfter);
    return { provider: "github", operation, stopKind, httpStatus, retryAfterSeconds: retryAfter };
  }
  function ensureOp(key: string): void { if (!operations.some((op) => op.key === key)) operations.push({ key, cursor: null, done: false }); }
  function registerRepo(repositoryId: string): void {
    if (repositoryIds.has(repositoryId)) return;
    repositoryIds.add(repositoryId);
    ensureOp(`commits:${repositoryId}`);
    ensureOp(`issues:${repositoryId}`);
  }
  function addEvent(event: NormalizedEngineeringEvent): void { newEvents.set(engineeringEventKey(event), event); }
  function inWindow(date: unknown, operation: keyof typeof queries): boolean {
    if (!string(date)) { reasons.add(diag.record(operation, "parse")); return false; }
    try { return isWithinScoringWindow(date as string, window); } catch { reasons.add(diag.record(operation, "parse")); return false; }
  }

  async function request(queryName: keyof typeof queries, variables: Record<string, unknown>): Promise<{ data: ObjectData; stop: SourceDiagnostic | null }> {
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
        return { data: object(payload.data), stop: makeStop(queryName, isGraphqlRateLimited(payload.errors) ? "rate_limited" : "graphql", response.status) };
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
    op: MutableCollectorOperation, queryName: keyof typeof queries, variables: Record<string, unknown>, path: readonly string[],
    onNode: (node: ObjectData) => void,
    options: { readonly search?: boolean; readonly onPage?: (data: ObjectData) => void; readonly emptyOk?: (data: ObjectData) => boolean } = {},
  ): Promise<ListOutcome> {
    let cursor = op.cursor;
    let isFirstFetch = cursor === null;
    for (;;) {
      const r = await request(queryName, { ...variables, after: cursor });
      if (r.stop) { op.cursor = cursor; return { kind: "stop", stop: r.stop }; }
      options.onPage?.(r.data);
      if (options.emptyOk?.(r.data)) { op.done = true; op.cursor = null; return { kind: "done", totalCount: 0 }; }
      const connection = object(at(r.data, ...path));
      const totalCount = number(options.search ? connection.issueCount : connection.totalCount);
      if (options.search && isFirstFetch && totalCount !== null && totalCount > 1000) return { kind: "split", totalCount };
      isFirstFetch = false;
      if (!Array.isArray(connection.nodes)) { const stop = makeStop(queryName, "protocol"); op.cursor = cursor; return { kind: "stop", stop }; }
      for (const node of connection.nodes) {
        if (node && typeof node === "object" && !Array.isArray(node)) onNode(object(node));
        else reasons.add("not_accessible");
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
        const complete = outcome.totalCount != null && paths.length === outcome.totalCount && new Set(paths).size === paths.length;
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
      const outcome = await runPagedList(op, "commits", { id: repositoryId, subjectId: subjectId() }, ["node", "defaultBranchRef", "target", "history"], (node) => {
        const authorId = string(at(node, "author", "user", "id"));
        if (!authorId) { reasons.add("attribution_unknown"); return; }
        if (authorId !== subjectId()) return;
        const eventId = string(node.oid) ?? string(node.id); if (!eventId) { reasons.add("not_accessible"); return; }
        if (!inWindow(node.authoredDate, "commits")) return;
        addEvent({
          schemaVersion: "v7", provider: "github", host: "github.com", subjectId: subjectId()!, actorId: subjectId()!,
          repositoryId, eventId, kind: "authored_commit", occurredAt: scoringInstant(String(node.authoredDate)).toISOString(), dataThrough: window.referenceTime,
          canonicalProjectId: `github:${repositoryId}`, workItemId: `github:${eventId}`, artifactRevision: eventId,
          artifactReferenceIds: [`github:${eventId}`], attribution: "individual", provenance: "source_observed", coverage: "complete",
          measurements: { ...emptyMeasurements(), additions: observedNumber(node.additions), deletions: observedNumber(node.deletions) },
          categories: [], acceptance: unknown("unavailable", "acceptance_time_unknown"),
        });
      }, { emptyOk: (data) => at(data, "node", "isEmpty") === true && at(data, "node", "defaultBranchRef") === null });
      if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
      return "done";
    }
    if (op.key.startsWith("issues:")) {
      const repositoryId = op.key.slice("issues:".length);
      const since = seededDataThrough && seededDataThrough > window.startInclusive ? seededDataThrough : window.startInclusive;
      const outcome = await runPagedList(op, "issues", { id: repositoryId, since }, ["node", "issues"], (node) => {
        const issueId = string(node.id); if (!issueId) { reasons.add("not_accessible"); return; }
        issueRepo[issueId] = repositoryId;
        ensureOp(`closures:${issueId}`);
      });
      if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
      return "done";
    }
    if (op.key.startsWith("closures:")) {
      const issueId = op.key.slice("closures:".length);
      const repositoryId = issueRepo[issueId];
      const outcome = await runPagedList(op, "closures", { id: issueId }, ["node", "timelineItems"], (node) => {
        const actorId = string(at(node, "actor", "id"));
        if (!actorId) { reasons.add("attribution_unknown"); return; }
        if (actorId !== subjectId()) return;
        const closureId = string(node.id); if (!closureId) { reasons.add("not_accessible"); return; }
        if (!inWindow(node.createdAt, "closures")) return;
        if (!repositoryId) { reasons.add("not_accessible"); return; }
        const closer = object(node.closer);
        const closerId = string(closer.id);
        const linkedId = closer.__typename === "PullRequest" && closer.merged === true ? closerId : null;
        const authoredResult = linkedId !== null && string(at(closer, "author", "id")) === subjectId();
        const occurredAt = scoringInstant(String(node.createdAt)).toISOString();
        const workItemId = linkedId ? `github:${linkedId}` : `github:${issueId}`;
        addEvent({
          schemaVersion: "v7", provider: "github", host: "github.com", subjectId: subjectId()!, actorId: subjectId()!,
          repositoryId, eventId: closureId, kind: "issue_work", occurredAt, dataThrough: window.referenceTime,
          canonicalProjectId: `github:${repositoryId}`, workItemId, artifactRevision: closureId,
          artifactReferenceIds: [`github:${closureId}`, ...(closerId ? [`github:${closerId}`] : [])],
          attribution: "individual", provenance: "source_observed", coverage: "complete",
          measurements: emptyMeasurements(), categories: [], acceptance: unknown("partial", "attribution_unknown"),
        });
        if (!authoredResult) reasons.add("attribution_unknown");
        if (closer.__typename && closer.__typename !== "PullRequest") reasons.add("not_supported");
        if (authoredResult && linkedId) {
          const linkedWorkItemId = `github:${linkedId}`;
          const linkedRepo = string(at(closer, "repository", "id"));
          if (linkedRepo && (!explicit || repositoryIds.has(linkedRepo)) && !prMeta[linkedWorkItemId]) {
            prMeta[linkedWorkItemId] = { repositoryId: linkedRepo, mergedAt: string(closer.mergedAt), revision: string(closer.headRefOid) ?? linkedId };
            registerRepo(linkedRepo);
            ensureOp(`files:${linkedWorkItemId}`);
          }
        }
      });
      if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
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

  function buildCheckpoint(): CollectorCheckpoint {
    return {
      version: 1,
      operations: operations.map((op): CollectorOperation => ({ key: op.key, cursor: op.cursor, done: op.done })),
      discovered: { repositoryIds: [...repositoryIds].sort() },
      state: { ...state, reasons: [...reasons] },
    };
  }
  function newEventsForCaller(): NormalizedEngineeringEvent[] {
    return [...newEvents.values()].filter((event) => !stagedKeys.has(engineeringEventKey(event)));
  }

  if (pendingStop) {
    return { events: newEventsForCaller(), checkpoint: buildCheckpoint(), done: false, coverage: null, stop: pendingStop, requests: requestCount };
  }

  // Every operation is done: compute coverage from the full staged + new set.
  if (!explicit) reasons.add("discovery_incomplete");
  reasons.add("acceptance_time_unknown");
  const commitsComplete = operations.filter((op) => op.key.startsWith("commits:")).every((op) => op.done);
  const issuesComplete = operations.filter((op) => op.key.startsWith("issues:") || op.key.startsWith("closures:")).every((op) => op.done);
  const unidentified = ["not_accessible", "source_error", "attribution_unknown", "pagination_incomplete"].some((reason) => reasons.has(reason as EvidenceReasonCode));
  const eventKinds: SourceCoverage["eventKinds"] = {
    accepted_change: "partial",
    authored_commit: explicit && !unidentified && commitsComplete ? "complete" : "partial",
    review: "partial",
    issue_work: explicit && !unidentified && issuesComplete ? "complete" : "partial",
    practice_evidence: "unavailable", documentation_design: "unavailable", maintenance: "unavailable",
  };
  reasons.add("not_supported");
  const complete = Object.values(eventKinds).every((status) => status === "complete") && reasons.size === 0;
  const coverage: SourceCoverage = {
    source: { provider: "github", host: "github.com", subjectId: subjectId()! }, window, dataThrough: window.referenceTime,
    status: complete ? "complete" : "partial", discovery: explicit ? "explicit_repositories" : "owned_and_contributed",
    repositoryIds: [...repositoryIds].sort(), repositoryDiscoveryComplete: explicit,
    eventKinds, reasonCodes: [...reasons].sort(), unknownPeriods: complete ? [] : [{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }],
  };
  return { events: newEventsForCaller(), checkpoint: buildCheckpoint(), done: true, coverage, stop: null, requests: requestCount };
};
