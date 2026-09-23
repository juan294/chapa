import {
  createScoringWindow, isWithinScoringWindow, observed, scoringInstant, unknown,
  type CoverageStatus, type EvidenceReasonCode, type EventMeasurements, type NormalizedEngineeringEvent,
  type Observation, type ScoringWindow, type SourceCoverage,
} from "@chapa/shared";
import {
  budgetOrDeadlineStop, classifyFetchFailure, classifyHttpStatus, createDiagnosticRecorder, retryAfterSeconds, type SourceDiagnostic,
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
