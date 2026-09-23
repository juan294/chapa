import {
  createScoringWindow, engineeringEventKey, isWithinScoringWindow, observed, scoringInstant, unknown,
  type CoverageStatus, type EvidenceReasonCode, type EventMeasurements, type NormalizedEngineeringEvent,
  type Observation, type ScoringWindow, type SourceCoverage,
} from "@chapa/shared";
import type { CollectorCheckpoint, CollectorOperation, CollectSlice } from "@/lib/collection/plan";
import {
  budgetOrDeadlineStop, classifyFetchFailure, classifyHttpStatus, createDiagnosticRecorder, retryAfterSeconds, type SourceDiagnostic, type StopKind,
} from "@/lib/platform/evidence-diagnostics";

/**
 * v7 only. Semantics verified against https://codeberg.org/swagger.v1.json and
 * https://forgejo.org/docs/latest/user/api/usage/; Forgejo source confirms
 * commit.author.date uses the Git author signature, timeline type "close" is a
 * state event, and PR file diffs can be line-limited without an exposed flag.
 * Never substitute the activity feed, heatmap, or merged PR count for commits.
 */
type Row = Record<string, unknown>;
const row = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const text = (v: unknown): string | null => typeof v === "string" && v.length > 0 ? v : null;
const id = (v: unknown): string | null => typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? String(v) : null;
const hash = (v: unknown): string | null => typeof v === "string" && /^[a-f\d]{7,64}$/i.test(v) ? v.toLowerCase() : null;
const count = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const measuredCount = (v: unknown): Observation<number> => count(v) ? observed(v, "complete", "source_observed") : unknown("partial", "source_error");
const emptyMeasurements = (): EventMeasurements => ({
  changedFiles: unknown("unavailable", "not_supported"), additions: unknown("unavailable", "not_supported"), deletions: unknown("unavailable", "not_supported"),
  leadTimeHours: unknown("unavailable", "not_supported"), hasDescription: unknown("unavailable", "not_supported"),
  hasIssueLink: unknown("unavailable", "not_supported"), usesFeatureBranch: unknown("unavailable", "not_supported"),
});
const API = "https://codeberg.org/api/v1";
export interface CodebergEvidenceOptions {
  readonly repositoryIds?: readonly number[];
  /** One HTTP budget across discovery and every nested endpoint. Default100, max500. */
  readonly maxRequests?: number;
  /** One overall deadline, default30,000ms, max120,000ms. */
  readonly timeoutMs?: number;
}
/** Private checkpoints; repository paths must not enter the public projection. */
export interface CodebergEvidenceProgress {
  readonly path: string;
  readonly parameters: Readonly<Record<string, string>>;
  readonly nextPage: number | null;
  readonly collectedNodes: number;
  readonly complete: boolean;
  readonly reasonCodes: readonly EvidenceReasonCode[];
}
export interface CodebergEvidenceResult {
  readonly profile: { readonly userId: number; readonly username: string; readonly displayName: string | null; readonly avatarUrl: string | null };
  readonly events: readonly NormalizedEngineeringEvent[];
  readonly coverage: SourceCoverage;
  readonly progress: readonly CodebergEvidenceProgress[];
  readonly requestCount: number;
  readonly diagnostics: readonly SourceDiagnostic[];
}
/** Stable operation name for a diagnostic, derived from the request path this
 * module itself constructs (query parameters excluded).
 */
function operationFor(path: string): string {
  if (path === "/user") return "profile";
  if (/^\/repositories\/\d+$/.test(path)) return "repository";
  if (/\/repos$/.test(path)) return "repos";
  if (path.endsWith("/activities/feeds")) return "feeds";
  if (path.endsWith("/commits")) return "commits";
  if (/\/pulls\/\d+\/files$/.test(path)) return "files";
  if (/\/pulls\/\d+\/reviews$/.test(path)) return "reviews";
  if (/\/git\/refs\/pull\/\d+\/head$/.test(path)) return "refs";
  if (path.endsWith("/pulls")) return "pulls";
  if (/\/issues\/\d+\/timeline$/.test(path)) return "timeline";
  if (path.endsWith("/issues")) return "issues";
  return "unknown";
}
export async function fetchCodebergEvidence(
  userId: number, username: string, token: string, inputWindow: ScoringWindow, options: CodebergEvidenceOptions = {},
): Promise<CodebergEvidenceResult> {
  if (!id(userId) || !/^[a-z\d][a-z\d_.-]{0,99}$/i.test(username) || !token.trim()) throw new RangeError("Invalid Codeberg subject or credential");
  const window = createScoringWindow(inputWindow.referenceTime);
  if (window.startInclusive !== inputWindow.startInclusive || window.endExclusive !== inputWindow.endExclusive || window.referenceDate !== inputWindow.referenceDate || inputWindow.calendarDays !== 365) throw new RangeError("Inconsistent scoring window");
  const maxRequests = options.maxRequests ?? 100; const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 500 || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new RangeError("Invalid Codeberg evidence budget");
  if (options.repositoryIds && (options.repositoryIds.length > 500 || options.repositoryIds.some((value) => !id(value)))) throw new RangeError("Invalid repository scope");
  const signal = AbortSignal.timeout(timeoutMs); const reasons = new Set<EvidenceReasonCode>(); const progress: CodebergEvidenceProgress[] = [];
  const diag = createDiagnosticRecorder("codeberg");
  let requestCount = 0;
  async function request(path: string, parameters: Record<string, string> = {}): Promise<{ data: unknown; error: EvidenceReasonCode | null; headers: Headers }> {
    const operation = operationFor(path);
    // A collector's own budget or deadline is honest incompleteness, never a
    // provider-reported or structural failure: classify before attempting.
    const stop = budgetOrDeadlineStop(requestCount, maxRequests, signal);
    if (stop) return { data: null, error: diag.record(operation, stop), headers: new Headers() };
    requestCount++;
    try {
      const url = new URL(`${API}${path}`); for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
      const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token.trim()}`, Accept: "application/json" }, signal, redirect: "error" });
      if (!response.ok) {
        const stopKind = classifyHttpStatus(response.status, response.headers, [401, 403, 404]);
        return { data: null, error: diag.record(operation, stopKind, response.status, stopKind === "rate_limited" ? retryAfterSeconds(response.headers) : null), headers: response.headers };
      }
      return { data: await response.json() as unknown, error: null, headers: response.headers };
    } catch (error) {
      // The AbortSignal.timeout deadline can fire mid-flight, rejecting fetch
      // or json() with no HTTP response at all -- classify by signal/exception.
      return { data: null, error: diag.record(operation, classifyFetchFailure(error, signal)), headers: new Headers() };
    }
  }
  async function collect(path: string, parameters: Record<string, string> = {}) {
    const nodes: Row[] = []; const errors = new Set<EvidenceReasonCode>(); let page = 1; let complete = false;
    const operation = operationFor(path);
    for (;;) {
      const response = await request(path, { ...parameters, page: String(page), limit: "50" });
      if (response.error) { errors.add(response.error); break; }
      if (!Array.isArray(response.data)) { errors.add(diag.record(operation, "protocol")); break; }
      for (const value of response.data) {
        if (value === null || typeof value !== "object" || Array.isArray(value)) errors.add(diag.record(operation, "protocol"));
        else nodes.push(row(value));
      }
      if (errors.size > 0) break; // Never advance past a partially decoded page.
      const nextLink = response.headers.get("link")?.split(",").find((part) => /rel="next"/.test(part));
      if (nextLink) {
        try {
          const target = new URL(nextLink.match(/<([^>]+)>/)?.[1] ?? "");
          const next = target.searchParams.get("page");
          if (target.origin !== "https://codeberg.org" || target.pathname !== `/api/v1${path}` || target.username || target.password || target.hash || !/^\d+$/.test(next ?? "") || !Number.isSafeInteger(Number(next)) || Number(next) <= page) throw new Error("Invalid cursor");
          // Rebuild only the page from the validated link, preserving query scope.
          page = Number(next); continue;
        } catch { errors.add(diag.record(operation, "protocol")); break; }
      }
      const total = response.headers.get("x-total-count"); const more = response.headers.get("x-hasmore");
      if (total !== null) {
        if (!/^\d+$/.test(total) || !Number.isSafeInteger(Number(total)) || Number(total) < nodes.length) { errors.add("pagination_incomplete"); break; }
        if (Number(total) > nodes.length) { if (response.data.length === 0) { errors.add("pagination_incomplete"); break; } page++; continue; }
      } else if (more === "true" || response.data.length === 50) { page++; continue; }
      complete = true; break;
    }
    for (const reason of errors) reasons.add(reason);
    progress.push({ path, parameters, nextPage: complete ? null : page, collectedNodes: nodes.length, complete, reasonCodes: [...errors] });
    return { nodes, complete };
  }
  const profileResponse = await request("/user"); const profile = row(profileResponse.data);
  if (profileResponse.error) reasons.add(profileResponse.error);
  else if (profile.id !== userId || typeof profile.login !== "string" || profile.login.toLowerCase() !== username.toLowerCase()) throw new Error("Codeberg credential subject does not match requested subject");
  const subjectId = String(userId);
  const repositories = new Map<string, Row>();
  const declaredIds = new Set((options.repositoryIds ?? []).map(String));
  const explicit = options.repositoryIds !== undefined;
  function addRepo(value: unknown) {
    const repo = row(value); const repoId = id(repo.id);
    if (!repoId) { reasons.add("attribution_unknown"); return; }
    if (explicit && !declaredIds.has(repoId)) return;
    repositories.set(repoId, repo); declaredIds.add(repoId);
  }
  if (explicit) {
    for (const repoId of declaredIds) {
      const response = await request(`/repositories/${repoId}`);
      // Every branch that leaves the repository unresolved sets reason -- it
      // either fails via request() (response.error) or fails the id match
      // below (diag.record), never neither.
      let reason: EvidenceReasonCode | undefined;
      if (response.error) reason = response.error;
      else if (id(row(response.data).id) === repoId) addRepo(response.data);
      else reason = diag.record("repository", "protocol");
      if (reason) reasons.add(reason);
      progress.push({ path: `/repositories/${repoId}`, parameters: {}, nextPage: repositories.has(repoId) ? null : 1, collectedNodes: repositories.has(repoId) ? 1 : 0, complete: repositories.has(repoId), reasonCodes: repositories.has(repoId) ? [] : [reason!] });
    }
  } else {
    for (const path of [`/users/${encodeURIComponent(username)}/repos`, "/user/repos"]) for (const repo of (await collect(path)).nodes) addRepo(repo);
    const feeds = await collect(`/users/${encodeURIComponent(username)}/activities/feeds`, { "only-performed-by": "true" });
    for (const activity of feeds.nodes) {
      if (activity.act_user_id === userId || row(activity.act_user).id === userId) addRepo(activity.repo);
      else if (!id(activity.act_user_id) && !id(row(activity.act_user).id)) reasons.add("attribution_unknown");
    }
  }
  function instant(value: unknown, operation: string) {
    if (!text(value)) { reasons.add(diag.record(operation, "parse")); return null; }
    try { return scoringInstant(String(value)).toISOString(); } catch { reasons.add(diag.record(operation, "parse")); return null; }
  }
  function isSubject(value: unknown) {
    const actorId = id(row(value).id); if (!actorId) { reasons.add("attribution_unknown"); return false; }
    return actorId === subjectId;
  }
  const events = new Map<string, NormalizedEngineeringEvent>();
  const projectKey = (repositoryId: string) => `codeberg.org:repository:${repositoryId}`;
  function event(repositoryId: string, eventId: string, kind: NormalizedEngineeringEvent["kind"], value: unknown, workItemId: string, revision: string, operation: string): NormalizedEngineeringEvent | null {
    const date = instant(value, operation); if (!date || !isWithinScoringWindow(date, window)) return null;
    return {
      schemaVersion: "v7", provider: "codeberg", host: "codeberg.org", subjectId, actorId: subjectId, repositoryId, eventId, kind, occurredAt: date,
      dataThrough: window.referenceTime, canonicalProjectId: projectKey(repositoryId), workItemId, artifactRevision: revision,
      artifactReferenceIds: [eventId], attribution: "individual", provenance: "source_observed", coverage: "complete",
      categories: [], measurements: emptyMeasurements(), acceptance: unknown("unavailable", "not_assessed"),
    };
  }
  for (const [repositoryId, repo] of repositories) {
    const fullName = text(repo.full_name); const segments = fullName?.split("/");
    if (!segments || segments.length !== 2 || segments.some((part) => !part || part === "." || part === "..")) { reasons.add("not_accessible"); continue; }
    const path = `/repos/${segments.map(encodeURIComponent).join("/")}`;
    // Actual commits and author signature timestamps, never generic feed counts.
    for (const commit of (await collect(`${path}/commits`, { stat: "true", files: "false", verification: "false" })).nodes) {
      if (!isSubject(commit.author)) continue;
      const sha = hash(commit.sha); if (!sha) { reasons.add(diag.record("commits", "protocol")); continue; }
      const key = `${projectKey(repositoryId)}:commit:${sha}`;
      const base = event(repositoryId, key, "authored_commit", row(row(commit.commit).author).date, key, sha, "commits");
      if (base) events.set(key, { ...base, measurements: { ...base.measurements, additions: measuredCount(row(commit.stats).additions), deletions: measuredCount(row(commit.stats).deletions) }, acceptance: unknown("unavailable", "acceptance_time_unknown") });
    }
    const prs = await collect(`${path}/pulls`, { state: "all", sort: "recentupdate" });
    for (const pr of prs.nodes) {
      const prId = id(pr.number); if (!prId) { reasons.add(diag.record("pulls", "protocol")); continue; }
      const key = `${projectKey(repositoryId)}:pr:${prId}`;
      if (isSubject(pr.user) && pr.merged === true) {
        const mergedSha = hash(pr.merge_commit_sha);
        const base = event(repositoryId, `${key}:merged`, "accepted_change", pr.merged_at, key, mergedSha ?? key, "pulls");
        if (base) {
          const refs = await collect(`${path}/git/refs/pull/${prId}/head`);
          const archived = refs.nodes.find((ref) => ref.ref === `refs/pull/${prId}/head`);
          const archivedSha = hash(row(archived?.object).sha);
          const files = await collect(`${path}/pulls/${prId}/files`, { whitespace: "show-all" });
          const paths = new Set<string>(); const seenFiles = new Set<string>();
          let additions = 0; let deletions = 0;
          let full = refs.complete && archivedSha !== null && archivedSha === hash(row(pr.head).sha) && files.complete && count(pr.changed_files) && pr.changed_files === files.nodes.length;
          for (const file of files.nodes) {
            const filename = text(file.filename); const previous = text(file.previous_filename);
            if (!filename || seenFiles.has(filename) || !count(file.additions) || !count(file.deletions) || file.truncated === true || file.too_large === true || file.overflow === true || (file.status === "renamed" && !previous)) full = false;
            if (previous) paths.add(previous);
            if (filename) { paths.add(filename); seenFiles.add(filename); }
            if (count(file.additions)) additions += file.additions;
            if (count(file.deletions)) deletions += file.deletions;
          }
          // Forgejo's file diff can be truncated without an API flag. Reconcile
          // against its separately computed git shortstat before claiming lines.
          if (!count(additions) || !count(deletions) || !count(pr.additions) || !count(pr.deletions) || additions !== pr.additions || deletions !== pr.deletions) full = false;
          if (!full) reasons.add("partial_files");
          let leadTimeHours: Observation<number> = unknown("partial", "source_error");
          const createdAt = instant(pr.created_at, "pulls");
          if (createdAt) {
            const hours = (scoringInstant(base.occurredAt).getTime() - scoringInstant(createdAt).getTime()) / 3_600_000;
            if (hours >= 0) leadTimeHours = observed(hours, "complete", "source_observed");
          }
          events.set(base.eventId, { ...base,
            artifactReferenceIds: [...base.artifactReferenceIds, ...(mergedSha ? [`${projectKey(repositoryId)}:commit:${mergedSha}`] : [])],
            measurements: { ...base.measurements, leadTimeHours,
              changedFiles: full ? observed([...paths], "complete", "source_observed") : unknown("partial", "partial_files"),
              additions: full ? observed(additions, "complete", "source_observed") : unknown("partial", "partial_files"),
              deletions: full ? observed(deletions, "complete", "source_observed") : unknown("partial", "partial_files"),
              hasDescription: typeof pr.body === "string" ? observed(pr.body.trim().length > 0, "complete", "source_observed") : unknown("partial", "source_error"),
            },
            acceptance: observed({ method: "merged_change", acceptedAt: base.occurredAt, acceptedResultId: key }, "complete", "source_observed"),
          });
        }
      }
      for (const review of (await collect(`${path}/pulls/${prId}/reviews`)).nodes) {
        if (!isSubject(review.user) || !["APPROVED", "REQUEST_CHANGES", "COMMENT"].includes(String(review.state))) continue;
        const reviewId = id(review.id); if (!reviewId) { reasons.add(diag.record("reviews", "protocol")); continue; }
        // Build the revision from the review's stable id + commit + submitted_at
        // only (never updated_at): an edited review's updated_at otherwise
        // changes between collections and trips the immutable-identity guard
        // when events merge (packages/shared/src/scoring-aggregation-v7.ts;
        // the same hazard fixed for Bitbucket comments in #1335 phase 1.5).
        const base = event(repositoryId, `${key}:review:${reviewId}`, "review", review.submitted_at, key, `${reviewId}:${hash(review.commit_id) ?? "unknown"}:${text(review.submitted_at) ?? "unknown"}`, "reviews");
        if (base) events.set(base.eventId, base); // Even empty approvals remain unassessed.
      }
    }
    // Include reopened issues and inspect actual close events, not author/assignee
    // or current closed_at snapshots. Closing does not prove engineering authorship.
    if (repo.has_issues === false) { reasons.add("not_supported"); continue; }
    for (const issue of (await collect(`${path}/issues`, { state: "all", type: "issues", since: window.startInclusive })).nodes) {
      const issueId = id(issue.number); if (!issueId) { reasons.add(diag.record("issues", "protocol")); continue; }
      for (const closure of (await collect(`${path}/issues/${issueId}/timeline`)).nodes) {
        if (closure.type !== "close" || !isSubject(closure.user)) continue;
        const closureId = id(closure.id); if (!closureId) { reasons.add(diag.record("timeline", "protocol")); continue; }
        const key = `${projectKey(repositoryId)}:issue:${issueId}`;
        const base = event(repositoryId, `${key}:close:${closureId}`, "issue_work", closure.created_at, key, closureId, "timeline");
        if (base) {
          reasons.add("attribution_unknown");
          const ref = hash(closure.ref_commit_sha);
          events.set(base.eventId, { ...base, artifactReferenceIds: [...base.artifactReferenceIds, ...(ref ? [`${projectKey(repositoryId)}:commit:${ref}`] : [])], acceptance: unknown("partial", "attribution_unknown") });
        }
      }
    }
  }
  // Current repo/feed visibility cannot prove annual discovery completeness, and
  // author timestamps cannot establish first default-branch arrival even if old.
  reasons.add("discovery_incomplete"); reasons.add("acceptance_time_unknown"); reasons.add("not_supported");
  function component(suffix: string): CoverageStatus {
    const entries = progress.filter((p) => p.path.endsWith(suffix));
    return entries.length > 0 && entries.every((p) => !p.complete && p.collectedNodes === 0 && p.reasonCodes.includes("not_accessible")) ? "unavailable" : "partial";
  }
  return {
    profile: { userId, username: text(profile.login) ?? username, displayName: text(profile.full_name), avatarUrl: text(profile.avatar_url) },
    events: [...events.values()], progress, requestCount, diagnostics: diag.diagnostics,
    coverage: { source: { provider: "codeberg", host: "codeberg.org", subjectId }, window, dataThrough: profileResponse.error ? null : window.referenceTime,
      status: "partial", discovery: explicit ? "explicit_repositories" : "owned_and_contributed", repositoryIds: [...declaredIds].sort(), repositoryDiscoveryComplete: explicit,
      eventKinds: { accepted_change: "partial", authored_commit: component("/commits"), review: component("/reviews"), issue_work: component("/timeline"), practice_evidence: "unavailable", documentation_design: "unavailable", maintenance: "unavailable" },
      reasonCodes: [...reasons].sort(), unknownPeriods: [{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }],
    },
  };
}

// ---------------------------------------------------------------------------
// collectCodebergSlice (#1335 phase 3) -- checkpointed, resumable slice API.
// A separate, self-contained engine from fetchCodebergEvidence above (same
// reasoning as the other three slice engines).
// ---------------------------------------------------------------------------

interface CodebergPrMeta {
  readonly repositoryId: string; readonly fullName: string; readonly prId: string;
  authorIsSubject: boolean; merged: boolean; mergedAt?: string | null; createdAt?: string | null; description?: string | null;
  mergeCommitSha?: string | null; headSha?: string | null; changedFiles?: number | null; additions?: number | null; deletions?: number | null;
}
interface MutableCodebergOperation { key: string; cursor: string | null; done: boolean }
interface CodebergListOutcome { readonly kind: "done" | "stop"; readonly stop?: SourceDiagnostic }

export const collectCodebergSlice: CollectSlice = async (input, credential, checkpoint, budget, staged) => {
  const window = createScoringWindow(input.window.referenceTime);
  if (window.startInclusive !== input.window.startInclusive || window.endExclusive !== input.window.endExclusive || window.referenceDate !== input.window.referenceDate || input.window.calendarDays !== 365) throw new RangeError("Inconsistent scoring window");
  if (!credential.token || !credential.token.trim()) throw new RangeError("Codeberg collection requires a credential");
  const token = credential.token.trim();
  const login = input.requestedSource.login;
  const explicit = input.scope.discovery === "explicit_repositories";
  const signal = AbortSignal.timeout(Math.max(0, budget.deadlineAt - Date.now()));
  const diag = createDiagnosticRecorder("codeberg");
  let requestCount = 0;

  const operations: MutableCodebergOperation[] = checkpoint.operations.map((op) => ({ key: op.key, cursor: op.cursor, done: op.done }));
  const repositoryIds = new Set(checkpoint.discovered.repositoryIds);
  const state: Record<string, unknown> = { ...(checkpoint.state ?? {}) };
  const prMeta: Record<string, CodebergPrMeta> = { ...((state.pr as Record<string, CodebergPrMeta> | undefined) ?? {}) };
  state.pr = prMeta;
  const repoFullNames: Record<string, string> = { ...((state.repoFullNames as Record<string, string> | undefined) ?? {}) };
  state.repoFullNames = repoFullNames;
  const reasons = new Set<EvidenceReasonCode>((state.reasons as EvidenceReasonCode[] | undefined) ?? []);
  const newEvents = new Map<string, NormalizedEngineeringEvent>();
  const stagedKeys = new Set(staged.map(engineeringEventKey));

  function subjectId(): string | undefined { return state.subjectId as string | undefined; }
  function makeStop(operation: string, stopKind: StopKind, httpStatus: number | null = null, retryAfter: number | null = null): SourceDiagnostic {
    diag.record(operation, stopKind, httpStatus, retryAfter);
    return { provider: "codeberg", operation, stopKind, httpStatus, retryAfterSeconds: retryAfter };
  }
  function ensureOp(key: string): void { if (!operations.some((op) => op.key === key)) operations.push({ key, cursor: null, done: false }); }
  function registerRepo(repositoryId: string, fullName?: string | null): void {
    if (fullName) repoFullNames[repositoryId] = fullName;
    if (repositoryIds.has(repositoryId)) return;
    repositoryIds.add(repositoryId);
    ensureOp(`commits:${repositoryId}`);
    ensureOp(`pulls:${repositoryId}`);
    ensureOp(`issues:${repositoryId}`);
  }
  function addEvent(event: NormalizedEngineeringEvent): void { newEvents.set(engineeringEventKey(event), event); }
  const projectKey = (repositoryId: string) => `codeberg.org:repository:${repositoryId}`;
  function instant(value: unknown, operation: string): string | null {
    if (!text(value)) { reasons.add(diag.record(operation, "parse")); return null; }
    try { return scoringInstant(String(value)).toISOString(); } catch { reasons.add(diag.record(operation, "parse")); return null; }
  }
  function isSubject(value: unknown): boolean {
    const actorId = id(row(value).id); if (!actorId) { reasons.add("attribution_unknown"); return false; }
    return actorId === subjectId();
  }
  function repoPath(repositoryId: string): string | null {
    const fullName = repoFullNames[repositoryId]; const segments = fullName?.split("/");
    if (!segments || segments.length !== 2 || segments.some((part) => !part || part === "." || part === "..")) { reasons.add("not_accessible"); return null; }
    return `/repos/${segments.map(encodeURIComponent).join("/")}`;
  }

  async function request(operation: string, path: string, parameters: Record<string, string> = {}): Promise<{ data: unknown; headers: Headers; stop: SourceDiagnostic | null }> {
    const budgetStop = budgetOrDeadlineStop(requestCount, budget.maxRequests, signal);
    if (budgetStop) return { data: null, headers: new Headers(), stop: makeStop(operation, budgetStop) };
    requestCount++;
    try {
      const url = new URL(`${API}${path}`); for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
      const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal, redirect: "error" });
      if (!response.ok) {
        const stopKind = classifyHttpStatus(response.status, response.headers, [401, 403, 404]);
        return { data: null, headers: response.headers, stop: makeStop(operation, stopKind, response.status, stopKind === "rate_limited" ? retryAfterSeconds(response.headers) : null) };
      }
      return { data: await response.json() as unknown, headers: response.headers, stop: null };
    } catch (error) {
      return { data: null, headers: new Headers(), stop: makeStop(operation, classifyFetchFailure(error, signal)) };
    }
  }

  /** Drains one Codeberg page-numbered collection until exhausted or a
   * budget/deadline/protocol stop interrupts it, resuming from `op.cursor`
   * (the next page number, as a string) across slices.
   */
  async function runPagedList(op: MutableCodebergOperation, operation: string, path: string, parameters: Record<string, string>, onNode: (node: Row) => void): Promise<CodebergListOutcome> {
    let page = op.cursor ? Number(op.cursor) : 1;
    for (;;) {
      const r = await request(operation, path, { ...parameters, page: String(page), limit: "50" });
      if (r.stop) { op.cursor = String(page); return { kind: "stop", stop: r.stop }; }
      if (!Array.isArray(r.data)) { const stop = makeStop(operation, "protocol"); op.cursor = String(page); return { kind: "stop", stop }; }
      for (const value of r.data) {
        if (value === null || typeof value !== "object" || Array.isArray(value)) reasons.add(diag.record(operation, "protocol"));
        else onNode(row(value));
      }
      const nextLink = r.headers.get("link")?.split(",").find((part) => /rel="next"/.test(part));
      let next: number | null = null;
      if (nextLink) {
        try {
          const target = new URL(nextLink.match(/<([^>]+)>/)?.[1] ?? "");
          const candidate = target.searchParams.get("page");
          next = target.pathname === `/api/v1${path}` && /^\d+$/.test(candidate ?? "") ? Number(candidate) : NaN;
        } catch { next = NaN; }
      } else {
        const total = r.headers.get("x-total-count"); const more = r.headers.get("x-hasmore");
        if (total !== null) { if (/^\d+$/.test(total) && Number(total) > page * 50) next = page + 1; }
        else if (more === "true" || r.data.length === 50) next = page + 1;
      }
      if (next !== null) {
        if (!Number.isSafeInteger(next) || next <= page) { const stop = makeStop(operation, "protocol"); op.cursor = String(page); return { kind: "stop", stop }; }
        page = next; continue;
      }
      op.done = true; op.cursor = null; return { kind: "done" };
    }
  }

  async function runProfile(op: MutableCodebergOperation): Promise<"done" | "stop"> {
    const r = await request("profile", "/user");
    if (r.stop) { pendingStop = r.stop; return "stop"; }
    const profile = row(r.data);
    if (id(profile.id) === null || typeof profile.login !== "string") { pendingStop = makeStop("profile", "protocol"); return "stop"; }
    state.subjectId = String(profile.id); state.login = profile.login; state.displayName = text(profile.full_name); state.avatarUrl = text(profile.avatar_url);
    op.done = true; op.cursor = null;
    return "done";
  }
  async function runOwnRepos(op: MutableCodebergOperation, path: string): Promise<"done" | "stop"> {
    const outcome = await runPagedList(op, "repos", path, {}, (repo) => { const repoId = id(repo.id); if (repoId) registerRepo(repoId, text(repo.full_name)); else reasons.add("attribution_unknown"); });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }
  async function runFeeds(op: MutableCodebergOperation): Promise<"done" | "stop"> {
    const outcome = await runPagedList(op, "feeds", `/users/${encodeURIComponent(login)}/activities/feeds`, { "only-performed-by": "true" }, (activity) => {
      if (activity.act_user_id === Number(subjectId()) || row(activity.act_user).id === Number(subjectId())) {
        const repo = row(activity.repo); const repoId = id(repo.id); if (repoId) registerRepo(repoId, text(repo.full_name));
      } else if (!id(activity.act_user_id) && !id(row(activity.act_user).id)) reasons.add("attribution_unknown");
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }
  async function runCommits(op: MutableCodebergOperation): Promise<"done" | "stop"> {
    const repositoryId = op.key.slice("commits:".length);
    const path = repoPath(repositoryId);
    if (!path) { op.done = true; op.cursor = null; return "done"; }
    const outcome = await runPagedList(op, "commits", `${path}/commits`, { stat: "true", files: "false", verification: "false", since: window.startInclusive }, (commit) => {
      if (!isSubject(commit.author)) return;
      const sha = hash(commit.sha); if (!sha) { reasons.add(diag.record("commits", "protocol")); return; }
      const date = instant(row(row(commit.commit).author).date, "commits");
      if (!date || !isWithinScoringWindow(date, window)) return;
      const key = `${projectKey(repositoryId)}:commit:${sha}`;
      addEvent({
        schemaVersion: "v7", provider: "codeberg", host: "codeberg.org", subjectId: subjectId()!, actorId: subjectId()!, repositoryId, eventId: key,
        kind: "authored_commit", occurredAt: date, dataThrough: window.referenceTime, canonicalProjectId: projectKey(repositoryId), workItemId: key,
        artifactRevision: sha, artifactReferenceIds: [key], attribution: "individual", provenance: "source_observed", coverage: "complete", categories: [],
        measurements: { ...emptyMeasurements(), additions: measuredCount(row(commit.stats).additions), deletions: measuredCount(row(commit.stats).deletions) },
        acceptance: unknown("unavailable", "acceptance_time_unknown"),
      });
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }
  async function runPulls(op: MutableCodebergOperation): Promise<"done" | "stop"> {
    const repositoryId = op.key.slice("pulls:".length);
    const path = repoPath(repositoryId);
    if (!path) { op.done = true; op.cursor = null; return "done"; }
    const outcome = await runPagedList(op, "pulls", `${path}/pulls`, { state: "all", sort: "recentupdate" }, (pr) => {
      const prId = id(pr.number); if (!prId) { reasons.add(diag.record("pulls", "protocol")); return; }
      const key = `${projectKey(repositoryId)}:pr:${prId}`;
      const meta: CodebergPrMeta = prMeta[key] ?? { repositoryId, fullName: repoFullNames[repositoryId] ?? "", prId, authorIsSubject: false, merged: false };
      prMeta[key] = meta;
      ensureOp(`reviews:${key}`);
      if (isSubject(pr.user) && pr.merged === true) {
        meta.authorIsSubject = true; meta.merged = true; meta.mergedAt = text(pr.merged_at); meta.createdAt = text(pr.created_at);
        meta.description = typeof pr.body === "string" ? pr.body : null; meta.mergeCommitSha = hash(pr.merge_commit_sha);
        meta.headSha = hash(row(pr.head).sha); meta.changedFiles = count(pr.changed_files) ? pr.changed_files : null;
        meta.additions = count(pr.additions) ? pr.additions : null; meta.deletions = count(pr.deletions) ? pr.deletions : null;
        ensureOp(`refs:${key}`);
      }
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }
  async function runRefs(op: MutableCodebergOperation): Promise<"done" | "stop"> {
    const key = op.key.slice("refs:".length);
    const meta = prMeta[key];
    if (!meta) { op.done = true; op.cursor = null; return "done"; }
    const path = repoPath(meta.repositoryId);
    if (!path) { op.done = true; op.cursor = null; return "done"; }
    const r = await request("refs", `${path}/git/refs/pull/${meta.prId}/head`);
    if (r.stop) { pendingStop = r.stop; return "stop"; }
    const refs = Array.isArray(r.data) ? r.data : [];
    const archived = refs.find((ref) => row(ref).ref === `refs/pull/${meta.prId}/head`);
    const archivedSha = hash(row(row(archived).object).sha);
    state.refsVerified = { ...(state.refsVerified as Record<string, boolean> | undefined), [key]: archivedSha !== null && archivedSha === meta.headSha };
    op.done = true; op.cursor = null;
    ensureOp(`files:${key}`);
    return "done";
  }
  async function runFiles(op: MutableCodebergOperation): Promise<"done" | "stop"> {
    const key = op.key.slice("files:".length);
    const meta = prMeta[key];
    if (!meta || !meta.mergedAt || !isWithinScoringWindow2(meta.mergedAt, window)) { op.done = true; op.cursor = null; return "done"; }
    const path = repoPath(meta.repositoryId);
    if (!path) { op.done = true; op.cursor = null; return "done"; }
    const acc: { paths: Set<string>; additions: number; deletions: number; full: boolean; count: number } =
      (state.fileAcc as Record<string, { paths: Set<string>; additions: number; deletions: number; full: boolean; count: number }> | undefined)?.[key]
      ?? { paths: new Set(), additions: 0, deletions: 0, full: true, count: 0 };
    const outcome = await runPagedList(op, "files", `${path}/pulls/${meta.prId}/files`, { whitespace: "show-all" }, (file) => {
      const filename = text(file.filename); const previous = text(file.previous_filename);
      if (!filename || !count(file.additions) || !count(file.deletions) || file.truncated === true || file.too_large === true || file.overflow === true || (file.status === "renamed" && !previous)) acc.full = false;
      if (previous) acc.paths.add(previous);
      if (filename) acc.paths.add(filename);
      if (count(file.additions)) acc.additions += file.additions;
      if (count(file.deletions)) acc.deletions += file.deletions;
      acc.count++;
    });
    const fileAcc = (state.fileAcc as Record<string, typeof acc> | undefined) ?? {};
    fileAcc[key] = acc; state.fileAcc = fileAcc;
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    const refsVerified = (state.refsVerified as Record<string, boolean> | undefined)?.[key] ?? false;
    const full = refsVerified && acc.full && meta.changedFiles !== null && meta.changedFiles === acc.count &&
      meta.additions !== null && meta.additions === acc.additions && meta.deletions !== null && meta.deletions === acc.deletions;
    if (!full) reasons.add("partial_files");
    let leadTimeHours: Observation<number> = unknown("partial", "source_error");
    const occurredAt = instant(meta.mergedAt, "pulls");
    const createdAt = meta.createdAt ? instant(meta.createdAt, "pulls") : null;
    if (occurredAt && createdAt) {
      const hours = (scoringInstant(occurredAt).getTime() - scoringInstant(createdAt).getTime()) / 3_600_000;
      if (hours >= 0) leadTimeHours = observed(hours, "complete", "source_observed");
    }
    if (occurredAt) {
      addEvent({
        schemaVersion: "v7", provider: "codeberg", host: "codeberg.org", subjectId: subjectId()!, actorId: subjectId()!, repositoryId: meta.repositoryId,
        eventId: `${key}:merged`, kind: "accepted_change", occurredAt, dataThrough: window.referenceTime, canonicalProjectId: projectKey(meta.repositoryId),
        workItemId: key, artifactRevision: meta.mergeCommitSha ?? key, artifactReferenceIds: [`${key}:merged`], attribution: "individual",
        provenance: "source_observed", coverage: "complete", categories: [],
        measurements: {
          ...emptyMeasurements(), leadTimeHours,
          changedFiles: full ? observed([...acc.paths], "complete", "source_observed") : unknown("partial", "partial_files"),
          additions: full ? observed(acc.additions, "complete", "source_observed") : unknown("partial", "partial_files"),
          deletions: full ? observed(acc.deletions, "complete", "source_observed") : unknown("partial", "partial_files"),
          hasDescription: meta.description !== null && meta.description !== undefined ? observed(meta.description.trim().length > 0, "complete", "source_observed") : unknown("partial", "source_error"),
        },
        acceptance: observed({ method: "merged_change", acceptedAt: occurredAt, acceptedResultId: `${key}:merged` }, "complete", "source_observed"),
      });
    }
    return "done";
  }
  async function runReviews(op: MutableCodebergOperation): Promise<"done" | "stop"> {
    const key = op.key.slice("reviews:".length);
    const meta = prMeta[key];
    if (!meta) { op.done = true; op.cursor = null; return "done"; }
    const path = repoPath(meta.repositoryId);
    if (!path) { op.done = true; op.cursor = null; return "done"; }
    const outcome = await runPagedList(op, "reviews", `${path}/pulls/${meta.prId}/reviews`, {}, (review) => {
      if (!isSubject(review.user) || !["APPROVED", "REQUEST_CHANGES", "COMMENT"].includes(String(review.state))) return;
      const reviewId = id(review.id); if (!reviewId) { reasons.add(diag.record("reviews", "protocol")); return; }
      const date = instant(review.submitted_at, "reviews"); if (!date || !isWithinScoringWindow(date, window)) return;
      addEvent({
        schemaVersion: "v7", provider: "codeberg", host: "codeberg.org", subjectId: subjectId()!, actorId: subjectId()!, repositoryId: meta.repositoryId,
        eventId: `${key}:review:${reviewId}`, kind: "review", occurredAt: date, dataThrough: window.referenceTime, canonicalProjectId: projectKey(meta.repositoryId),
        workItemId: key, artifactRevision: `${reviewId}:${hash(review.commit_id) ?? "unknown"}:${text(review.submitted_at) ?? "unknown"}`,
        artifactReferenceIds: [`${key}:review:${reviewId}`], attribution: "individual", provenance: "source_observed", coverage: "complete",
        categories: [], measurements: emptyMeasurements(), acceptance: unknown("unavailable", "not_assessed"),
      });
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }
  async function runIssues(op: MutableCodebergOperation): Promise<"done" | "stop"> {
    const repositoryId = op.key.slice("issues:".length);
    const path = repoPath(repositoryId);
    if (!path) { op.done = true; op.cursor = null; return "done"; }
    const outcome = await runPagedList(op, "issues", `${path}/issues`, { state: "all", type: "issues", since: window.startInclusive }, (issue) => {
      const issueId = id(issue.number); if (!issueId) { reasons.add(diag.record("issues", "protocol")); return; }
      ensureOp(`timeline:${repositoryId}:${issueId}`);
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }
  async function runTimeline(op: MutableCodebergOperation): Promise<"done" | "stop"> {
    const rest = op.key.slice("timeline:".length);
    const [repositoryId, issueId] = rest.split(":") as [string, string];
    const path = repoPath(repositoryId);
    if (!path) { op.done = true; op.cursor = null; return "done"; }
    const outcome = await runPagedList(op, "timeline", `${path}/issues/${issueId}/timeline`, {}, (closure) => {
      if (closure.type !== "close" || !isSubject(closure.user)) return;
      const closureId = id(closure.id); if (!closureId) { reasons.add(diag.record("timeline", "protocol")); return; }
      const date = instant(closure.created_at, "timeline"); if (!date || !isWithinScoringWindow(date, window)) return;
      const key = `${projectKey(repositoryId)}:issue:${issueId}`;
      const ref = hash(closure.ref_commit_sha);
      reasons.add("attribution_unknown");
      addEvent({
        schemaVersion: "v7", provider: "codeberg", host: "codeberg.org", subjectId: subjectId()!, actorId: subjectId()!, repositoryId,
        eventId: `${key}:close:${closureId}`, kind: "issue_work", occurredAt: date, dataThrough: window.referenceTime, canonicalProjectId: projectKey(repositoryId),
        workItemId: key, artifactRevision: closureId, artifactReferenceIds: [`${key}:close:${closureId}`, ...(ref ? [`${projectKey(repositoryId)}:commit:${ref}`] : [])],
        attribution: "individual", provenance: "source_observed", coverage: "complete", categories: [], measurements: emptyMeasurements(),
        acceptance: unknown("partial", "attribution_unknown"),
      });
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }

  let pendingStop: SourceDiagnostic | null = null;

  async function processOperation(op: MutableCodebergOperation): Promise<"done" | "stop"> {
    if (op.key === "profile") return runProfile(op);
    if (op.key === "repos:own") return runOwnRepos(op, `/users/${encodeURIComponent(login)}/repos`);
    if (op.key === "repos:user") return runOwnRepos(op, "/user/repos");
    if (op.key === "feeds") return runFeeds(op);
    if (op.key.startsWith("commits:")) return runCommits(op);
    if (op.key.startsWith("pulls:")) return runPulls(op);
    if (op.key.startsWith("refs:")) return runRefs(op);
    if (op.key.startsWith("files:")) return runFiles(op);
    if (op.key.startsWith("reviews:")) return runReviews(op);
    if (op.key.startsWith("issues:")) return runIssues(op);
    if (op.key.startsWith("timeline:")) return runTimeline(op);
    op.done = true; return "done";
  }

  if (!operations.some((op) => op.key === "profile")) {
    operations.unshift({ key: "profile", cursor: null, done: false });
    if (explicit) for (const repositoryId of input.scope.repositoryIds) registerRepo(repositoryId);
    else operations.push({ key: "repos:own", cursor: null, done: false }, { key: "repos:user", cursor: null, done: false }, { key: "feeds", cursor: null, done: false });
  }

  for (const op of operations) {
    if (op.done) continue;
    const outcome = await processOperation(op);
    if (outcome === "stop") break;
  }

  function buildCheckpoint(): CollectorCheckpoint {
    return {
      version: 1,
      operations: operations.map((op): CollectorOperation => ({ key: op.key, cursor: op.cursor, done: op.done })),
      discovered: { repositoryIds: [...repositoryIds].sort() },
      state: { ...state, reasons: [...reasons] },
    };
  }
  function newEventsForCaller(): NormalizedEngineeringEvent[] { return [...newEvents.values()].filter((event) => !stagedKeys.has(engineeringEventKey(event))); }

  if (pendingStop) return { events: newEventsForCaller(), checkpoint: buildCheckpoint(), done: false, coverage: null, stop: pendingStop, requests: requestCount };

  reasons.add("discovery_incomplete"); reasons.add("acceptance_time_unknown"); reasons.add("not_supported");
  const commitsComplete = operations.filter((op) => op.key.startsWith("commits:")).every((op) => op.done);
  const reviewsComplete = operations.filter((op) => op.key.startsWith("reviews:")).every((op) => op.done);
  const timelineComplete = operations.filter((op) => op.key.startsWith("issues:") || op.key.startsWith("timeline:")).every((op) => op.done);
  const eventKinds: SourceCoverage["eventKinds"] = {
    accepted_change: "partial", authored_commit: explicit && commitsComplete ? "complete" : "partial",
    review: explicit && reviewsComplete ? "complete" : "partial", issue_work: explicit && timelineComplete ? "complete" : "partial",
    practice_evidence: "unavailable", documentation_design: "unavailable", maintenance: "unavailable",
  };
  const complete = Object.values(eventKinds).every((status) => status === "complete") && reasons.size === 0;
  const coverage: SourceCoverage = {
    source: { provider: "codeberg", host: "codeberg.org", subjectId: subjectId()! }, window, dataThrough: window.referenceTime,
    status: complete ? "complete" : "partial", discovery: explicit ? "explicit_repositories" : "owned_and_contributed",
    repositoryIds: [...repositoryIds].sort(), repositoryDiscoveryComplete: explicit,
    eventKinds, reasonCodes: [...reasons].sort(), unknownPeriods: complete ? [] : [{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }],
  };
  return { events: newEventsForCaller(), checkpoint: buildCheckpoint(), done: true, coverage, stop: null, requests: requestCount };
};

function isWithinScoringWindow2(value: string, window: ScoringWindow): boolean {
  try { return isWithinScoringWindow(value, window); } catch { return false; }
}
