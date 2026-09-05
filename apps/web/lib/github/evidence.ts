import {
  createScoringWindow, isWithinScoringWindow, observed, scoringInstant, unknown,
  type EvidenceReasonCode, type EventMeasurements, type NormalizedEngineeringEvent,
  type Observation, type ScoringWindow, type SourceCoverage,
} from "@chapa/shared";
import { getGithubToken } from "@/lib/env";
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
  const effectiveToken = (token ?? getGithubToken())?.trim();
  const progress: GitHubEvidenceProgress[] = [];
  const reasons = new Set<EvidenceReasonCode>();
  let requestCount = 0;
  async function request(operation: keyof typeof queries, variables: Record<string, unknown>) {
    if (requestCount >= maxRequests || signal.aborted) return { data: {}, error: "pagination_incomplete" as const };
    requestCount++;
    try {
      const response = await fetch("https://api.github.com/graphql", {
        method: "POST", signal, headers: { "Content-Type": "application/json", ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}) },
        body: JSON.stringify({ query: queries[operation], variables }),
      });
      if (!response.ok) return { data: {}, error: response.status === 401 || response.status === 403 ? "not_accessible" as const : "source_error" as const };
      const payload = object(await response.json());
      return { data: object(payload.data), error: Array.isArray(payload.errors) && payload.errors.length > 0 ? "source_error" as const : null };
    } catch { return { data: {}, error: "source_error" as const }; }
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
      if (totalCount === null) errors.add("source_error");
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
      if (typeof page.hasNextPage !== "boolean") { errors.add("source_error"); break; }
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
  const inWindow = (date: unknown) => {
    if (!string(date)) { reasons.add("source_error"); return false; }
    try { return isWithinScoringWindow(date as string, window); } catch { reasons.add("source_error"); return false; }
  };
  function event(node: ObjectData, repo: ObjectData, kind: NormalizedEngineeringEvent["kind"], date: unknown, workItemId: string): NormalizedEngineeringEvent | null {
    const id = string(node.id); const repositoryId = string(repo.id);
    if (!id || !repositoryId) { reasons.add("not_accessible"); return null; }
    if (!inWindow(date)) return null;
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
    const base = event(pr, repo, "accepted_change", pr.mergedAt, id);
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
      addEvent(event(review, object(pr.repository), "review", review.submittedAt, id));
    }
  }
  for (const [id, repo] of repositories) {
    const commits = await collect("commits", { id, subjectId }, ["node", "defaultBranchRef", "target", "history"]);
    for (const commit of commits.nodes) {
      if (!string(at(commit, "author", "user", "id"))) { reasons.add("attribution_unknown"); continue; }
      if (at(commit, "author", "user", "id") !== subjectId) continue;
      const base = event(commit, repo, "authored_commit", commit.authoredDate, string(commit.oid) ?? String(commit.id));
      if (base) { reasons.add("acceptance_time_unknown"); addEvent({ ...base, acceptance: unknown("unavailable", "acceptance_time_unknown"), measurements: { ...base.measurements, additions: observedNumber(commit.additions), deletions: observedNumber(commit.deletions) } }); }
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
        const base = event(closure, repo, "issue_work", closure.createdAt, linkedId ?? issueId);
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
          const accepted = event(closer, object(closer.repository), "accepted_change", closer.mergedAt, linkedId);
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
  const eventKinds: SourceCoverage["eventKinds"] = {
    accepted_change: discoveryComplete && merged.complete && !unidentified && !reasons.has("acceptance_time_unknown") ? "complete" : "partial",
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
  return { profile: { login, name: string(user.name), avatarUrl: string(user.avatarUrl) }, events: [...events.values()], coverage, progress, requestCount };
}
