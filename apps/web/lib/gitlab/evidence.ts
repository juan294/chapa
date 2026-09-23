import {
  createScoringWindow, isWithinScoringWindow, observed, scoringInstant, unknown,
  type CoverageStatus, type EvidenceReasonCode, type EventMeasurements,
  type NormalizedEngineeringEvent, type Observation, type ScoringWindow, type SourceCoverage,
} from "@chapa/shared";
import {
  classifyFetchFailure, createDiagnosticRecorder, isRateLimitedResponse, retryAfterSeconds, type SourceDiagnostic,
} from "@/lib/platform/evidence-diagnostics";

/**
 * v7 provider facts only; no v6 totals or automated practice classifications.
 * API semantics: https://docs.gitlab.com/api/commits/ (authored_date, default ref),
 * https://docs.gitlab.com/api/user_email_addresses/ (confirmed email linkage),
 * https://docs.gitlab.com/api/merge_requests/ (merged_at, updated_after, diff limits),
 * https://docs.gitlab.com/api/notes/ and /resource_state_events/ (actual actor/date),
 * https://docs.gitlab.com/api/projects/ (owned/contributed discovery).
 */
type Row = Record<string, unknown>;
const row = (v: unknown): Row => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const text = (v: unknown): string | null => typeof v === "string" && v.length > 0 ? v : null;
const id = (v: unknown): string | null => typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? String(v) : null;
const measurement = (v: unknown): Observation<number> => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? observed(v, "complete", "source_observed") : unknown("partial", "source_error");
const emptyMeasurements = (): EventMeasurements => ({
  changedFiles: unknown("unavailable", "not_supported"), additions: unknown("unavailable", "not_supported"),
  deletions: unknown("unavailable", "not_supported"), leadTimeHours: unknown("unavailable", "not_supported"),
  hasDescription: unknown("unavailable", "not_supported"), hasIssueLink: unknown("unavailable", "not_supported"),
  usesFeatureBranch: unknown("unavailable", "not_supported"),
});

/** Count only complete unified hunks; header-like source lines remain content. */
function diffLines(value: unknown): { additions: number; deletions: number } | null {
  if (!text(value)) return null;
  let additions = 0; let deletions = 0; let oldRemaining = 0; let newRemaining = 0; let hunks = 0;
  const lines = String(value).split("\n");
  for (const [index, line] of lines.entries()) {
    const hunk = line.match(/^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/);
    if (hunk) {
      if (oldRemaining !== 0 || newRemaining !== 0) return null;
      oldRemaining = Number(hunk[1] ?? 1); newRemaining = Number(hunk[2] ?? 1); hunks++;
    } else if (line === "\\ No newline at end of file" || (line === "" && index === lines.length - 1)) continue;
    else if (hunks === 0) return null;
    else if (line.startsWith("+")) { additions++; newRemaining--; }
    else if (line.startsWith("-")) { deletions++; oldRemaining--; }
    else if (line.startsWith(" ")) { oldRemaining--; newRemaining--; }
    else return null;
    if (oldRemaining < 0 || newRemaining < 0) return null;
  }
  return hunks > 0 && oldRemaining === 0 && newRemaining === 0 ? { additions, deletions } : null;
}
export interface GitlabEvidenceOptions {
  readonly repositoryIds?: readonly number[];
  /** Shared HTTP request budget, without hidden retries. Default 100, maximum 500. */
  readonly maxRequests?: number;
  /** Single overall deadline, milliseconds. Default 30,000, maximum 120,000. */
  readonly timeoutMs?: number;
}
/** Private checkpoints: paths/parameters may identify private projects. Never publish. */
export interface GitlabEvidenceProgress {
  readonly path: string;
  readonly parameters: Readonly<Record<string, string>>;
  readonly nextPage: number | null;
  readonly collectedNodes: number;
  readonly complete: boolean;
  readonly reasonCodes: readonly EvidenceReasonCode[];
}
export interface GitlabEvidenceResult {
  readonly profile: { readonly userId: number; readonly username: string; readonly name: string | null; readonly avatarUrl: string | null };
  readonly events: readonly NormalizedEngineeringEvent[];
  readonly coverage: SourceCoverage;
  readonly progress: readonly GitlabEvidenceProgress[];
  readonly requestCount: number;
  readonly diagnostics: readonly SourceDiagnostic[];
}
/** Stable operation name for a diagnostic, derived from the request path this
 * module itself constructs (query parameters excluded).
 */
function operationFor(path: string): string {
  if (path === "/user") return "profile";
  if (path === "/user/emails") return "emails";
  if (path.endsWith("/projects") || path.endsWith("/contributed_projects")) return "projects";
  if (/\/merge_requests\/\d+\/diffs$/.test(path)) return "diffs";
  if (/\/merge_requests\/\d+\/notes$/.test(path)) return "notes";
  if (/\/merge_requests\/\d+$/.test(path)) return "merge_request";
  if (path.endsWith("/merge_requests")) return "merge_requests";
  if (path.endsWith("/repository/commits")) return "commits";
  if (/\/issues\/\d+\/resource_state_events$/.test(path)) return "resource_state_events";
  if (path.endsWith("/issues")) return "issues";
  return "unknown";
}

export async function fetchGitlabEvidence(
  userId: number, username: string, token: string, inputWindow: ScoringWindow, options: GitlabEvidenceOptions = {},
): Promise<GitlabEvidenceResult> {
  if (!id(userId) || !username.trim() || !token.trim()) throw new RangeError("Invalid GitLab subject or credential");
  const window = createScoringWindow(inputWindow.referenceTime);
  if (window.startInclusive !== inputWindow.startInclusive || window.endExclusive !== inputWindow.endExclusive || window.referenceDate !== inputWindow.referenceDate || inputWindow.calendarDays !== 365) throw new RangeError("Inconsistent scoring window");
  const maxRequests = options.maxRequests ?? 100; const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 500 || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new RangeError("Invalid GitLab evidence budget");
  if (options.repositoryIds && (options.repositoryIds.length > 500 || options.repositoryIds.some((value) => !id(value)))) throw new RangeError("Invalid repository scope");
  const signal = AbortSignal.timeout(timeoutMs);
  const reasons = new Set<EvidenceReasonCode>();
  const progress: GitlabEvidenceProgress[] = [];
  const diag = createDiagnosticRecorder("gitlab");
  let requestCount = 0;
  async function request(path: string, parameters: Record<string, string> = {}) {
    const operation = operationFor(path);
    // A collector's own budget or deadline is honest incompleteness, never a
    // provider-reported or structural failure: classify before attempting.
    if (requestCount >= maxRequests) return { data: null, headers: new Headers(), error: diag.record(operation, "budget") };
    if (signal.aborted) return { data: null, headers: new Headers(), error: diag.record(operation, "deadline") };
    requestCount++;
    try {
      const url = new URL(`https://gitlab.com/api/v4${path}`);
      for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
      const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token.trim()}` }, signal, redirect: "error" });
      if (!response.ok) {
        if (isRateLimitedResponse(response.status, response.headers)) return { data: null, headers: response.headers, error: diag.record(operation, "rate_limited", response.status, retryAfterSeconds(response.headers)) };
        if ([401, 403, 404].includes(response.status)) return { data: null, headers: response.headers, error: diag.record(operation, "not_accessible", response.status) };
        return { data: null, headers: response.headers, error: diag.record(operation, "http", response.status) };
      }
      return { data: await response.json() as unknown, headers: response.headers, error: null };
    } catch (error) {
      // The AbortSignal.timeout deadline can fire mid-flight, rejecting fetch
      // or json() with no HTTP response at all -- classify by signal/exception.
      return { data: null, headers: new Headers(), error: diag.record(operation, classifyFetchFailure(error, signal)) };
    }
  }
  async function collect(path: string, parameters: Record<string, string> = {}) {
    const nodes: Row[] = []; const errors = new Set<EvidenceReasonCode>();
    const operation = operationFor(path);
    let page = 1; let complete = false;
    for (;;) {
      const response = await request(path, { ...parameters, per_page: "100", page: String(page) });
      if (response.error) { errors.add(response.error); break; }
      if (!Array.isArray(response.data)) { errors.add(diag.record(operation, "protocol")); break; }
      for (const item of response.data) {
        if (item === null || typeof item !== "object" || Array.isArray(item)) errors.add(diag.record(operation, "protocol"));
        else nodes.push(row(item));
      }
      // Retain the incoming page on malformed/partial data, not its successor.
      if (errors.size > 0) break;
      const nextHeader = response.headers.get("x-next-page");
      const link = response.headers.get("link");
      const nextLink = link?.split(",").find((part) => /rel="next"/.test(part));
      let next: number | null = null;
      if (nextHeader !== null) {
        if (nextHeader !== "") next = /^\d+$/.test(nextHeader) ? Number(nextHeader) : NaN;
      } else if (nextLink) {
        const target = nextLink.match(/<([^>]+)>/);
        try {
          const url = new URL(target?.[1] ?? "");
          // Read only a cursor from Link, never follow an arbitrary provider URL.
          next = url.origin === "https://gitlab.com" && url.pathname === `/api/v4${path}` && /^\d+$/.test(url.searchParams.get("page") ?? "") ? Number(url.searchParams.get("page")) : NaN;
        } catch { next = NaN; }
      } else if (response.data.length === 100) next = page + 1;
      if (next !== null) {
        if (!Number.isSafeInteger(next) || next <= page) { errors.add("pagination_incomplete"); break; }
        page = next; continue;
      }
      const total = response.headers.get("x-total");
      if (total !== null && (!/^\d+$/.test(total) || Number(total) !== nodes.length)) { errors.add("pagination_incomplete"); break; }
      complete = true; break;
    }
    for (const reason of errors) reasons.add(reason);
    progress.push({ path, parameters, nextPage: complete ? null : page, collectedNodes: nodes.length, complete, reasonCodes: [...errors] });
    return { nodes, complete, errors };
  }
  const profileResponse = await request("/user");
  const profile = row(profileResponse.data);
  if (profileResponse.error) reasons.add(profileResponse.error);
  if (!profileResponse.error && (profile.id !== userId || typeof profile.username !== "string" || profile.username.toLowerCase() !== username.toLowerCase())) throw new Error("GitLab credential subject does not match requested subject");
  const subjectId = String(userId);
  const verifiedEmails = new Set<string>();
  // Never treat an arbitrary display name or caller-supplied email as attribution.
  if (!profileResponse.error) {
    const emails = await collect("/user/emails");
    for (const email of emails.nodes) if (text(email.confirmed_at) && text(email.email)) verifiedEmails.add(String(email.email).toLowerCase());
    if (text(profile.confirmed_at) && text(profile.email)) verifiedEmails.add(String(profile.email).toLowerCase());
  }
  if (verifiedEmails.size === 0) reasons.add("attribution_unknown");
  const repositories = new Set<string>((options.repositoryIds ?? []).map(String));
  const explicit = options.repositoryIds !== undefined;
  if (!explicit) {
    for (const path of [`/users/${userId}/projects`, `/users/${userId}/contributed_projects`]) {
      for (const project of (await collect(path)).nodes) {
        const projectId = id(project.id); if (projectId) repositories.add(projectId); else reasons.add(diag.record("projects", "protocol"));
      }
    }
    // Current visible/project-contribution lists cannot prove annual private scope.
    reasons.add("discovery_incomplete");
  }
  const events = new Map<string, NormalizedEngineeringEvent>();
  const mrs = new Map<string, Row>();
  const mrByGlobalId = new Map<string, Row>();
  const projectKey = (projectId: string) => `gitlab.com:project:${projectId}`;
  const mrKey = (projectId: string, iid: string) => `${projectKey(projectId)}:mr:${iid}`;
  function inWindow(value: unknown) {
    if (!text(value)) { reasons.add("source_error"); return false; }
    try { return isWithinScoringWindow(String(value), window); } catch { reasons.add("source_error"); return false; }
  }
  function event(projectId: string, eventId: string, kind: NormalizedEngineeringEvent["kind"], date: unknown, workItemId: string, revision: string): NormalizedEngineeringEvent | null {
    if (!inWindow(date)) return null;
    return {
      schemaVersion: "v7", provider: "gitlab", host: "gitlab.com", subjectId, actorId: subjectId,
      repositoryId: projectId, eventId, kind, occurredAt: scoringInstant(String(date)).toISOString(), dataThrough: window.referenceTime,
      canonicalProjectId: projectKey(projectId), workItemId, artifactRevision: revision,
      artifactReferenceIds: [eventId], attribution: "individual", provenance: "source_observed", coverage: "complete",
      categories: [], measurements: emptyMeasurements(), acceptance: unknown("unavailable", "not_assessed"),
    };
  }
  function addMr(mr: Row) {
    const projectId = id(mr.project_id); const iid = id(mr.iid); const globalId = id(mr.id);
    if (!projectId || !iid || !globalId) { reasons.add(diag.record("merge_requests", "protocol")); return; }
    if (explicit && !repositories.has(projectId)) return;
    repositories.add(projectId); mrs.set(mrKey(projectId, iid), mr); mrByGlobalId.set(globalId, mr);
  }
  // updated_after is a candidate superset of merge time; never created_after.
  const merged = await collect("/merge_requests", { scope: "all", state: "merged", author_id: subjectId, updated_after: window.startInclusive, order_by: "updated_at", sort: "desc" });
  for (const mr of merged.nodes) addMr(mr);
  // Enumerate all MRs in each declared/discovered project. This includes old
  // merges with fresh reviews, and avoids trusting reviewer assignments.
  for (const projectId of repositories) {
    for (const mr of (await collect(`/projects/${projectId}/merge_requests`, { scope: "all", state: "all", order_by: "updated_at", sort: "desc" })).nodes) addMr(mr);
  }
  for (const [key, mr] of mrs) {
    const projectId = String(mr.project_id); const iid = String(mr.iid);
    const path = `/projects/${projectId}/merge_requests/${iid}`;
    if (row(mr.author).id === userId && mr.state === "merged" && inWindow(mr.merged_at)) {
      const base = event(projectId, `${key}:merged`, "accepted_change", mr.merged_at, key, text(mr.sha) ?? key)!;
      const detailsResponse = await request(path); const details = row(detailsResponse.data);
      if (detailsResponse.error) reasons.add(detailsResponse.error);
      const diffs = await collect(`${path}/diffs`);
      const count = typeof details.changes_count === "string" && /^\d+$/.test(details.changes_count) ? Number(details.changes_count) : null;
      // Retain both rename sides: moving code into a docs path is not docs-only.
      const pathPairs = diffs.nodes.map((d) => [text(d.old_path), text(d.new_path)]);
      const paths = [...new Set(pathPairs.flat())];
      const lineStats = diffs.nodes.map((d) => diffLines(d.diff));
      const full = !detailsResponse.error && details.id === mr.id && text(mr.sha) !== null && details.sha === mr.sha && diffs.complete &&
        count !== null && count === diffs.nodes.length && new Set(pathPairs.map((p) => JSON.stringify(p))).size === diffs.nodes.length && paths.every((p) => p !== null) &&
        details.overflow !== true && lineStats.every((s) => s !== null) && diffs.nodes.every((d) => d.collapsed === false && d.too_large === false && d.overflow !== true);
      const additions = lineStats.reduce((sum, s) => sum + (s?.additions ?? 0), 0);
      const deletions = lineStats.reduce((sum, s) => sum + (s?.deletions ?? 0), 0);
      if (!full) reasons.add("partial_files");
      let leadTimeHours: Observation<number> = unknown("partial", "source_error");
      try {
        const hours = (scoringInstant(String(mr.merged_at)).getTime() - scoringInstant(String(mr.created_at)).getTime()) / 3_600_000;
        if (hours >= 0) leadTimeHours = observed(hours, "complete", "source_observed");
      } catch { /* Keep missing dates unknown. */ }
      events.set(base.eventId, { ...base,
        acceptance: observed({ method: "merged_change", acceptedAt: base.occurredAt, acceptedResultId: key }, "complete", "source_observed"),
        measurements: { ...base.measurements, leadTimeHours,
          changedFiles: full ? observed(paths as string[], "complete", "source_observed") : unknown("partial", "partial_files"),
          additions: full ? observed(additions, "complete", "source_observed") : unknown("partial", "partial_files"),
          deletions: full ? observed(deletions, "complete", "source_observed") : unknown("partial", "partial_files"),
          hasDescription: typeof mr.description === "string" ? observed(mr.description.trim().length > 0, "complete", "source_observed") : unknown("partial", "source_error"),
        },
      });
    }
    for (const note of (await collect(`${path}/notes`, { order_by: "created_at", sort: "desc" })).nodes) {
      if (!id(row(note.author).id)) { reasons.add("attribution_unknown"); continue; }
      if (row(note.author).id !== userId || note.system !== false) continue;
      const noteId = id(note.id); if (!noteId) { reasons.add(diag.record("notes", "protocol")); continue; }
      // Build the revision from the note's stable id + created_at only (never
      // updated_at): an edited note's updated_at otherwise changes between
      // collections and trips the immutable-identity guard when events merge
      // (packages/shared/src/scoring-aggregation-v7.ts; the same hazard fixed
      // for Bitbucket comments in #1335 phase 1.5).
      const base = event(projectId, `${key}:note:${noteId}`, "review", note.created_at, key, `${noteId}:${text(note.created_at) ?? "unknown"}`);
      if (base) events.set(base.eventId, base); // Empty approvals/notes receive no rubric/category credit.
    }
  }
  for (const projectId of repositories) {
    // No API date filter: since/until are not documented as authored-date filters.
    // The default branch history supplies actual commits, not calendar/MR counts.
    for (const commit of (await collect(`/projects/${projectId}/repository/commits`, { with_stats: "true" })).nodes) {
      const sha = text(commit.id); const email = text(commit.author_email)?.toLowerCase();
      if (!sha || !email) { reasons.add("attribution_unknown"); continue; }
      if (!verifiedEmails.has(email)) continue;
      const key = `${projectKey(projectId)}:commit:${sha}`;
      const base = event(projectId, key, "authored_commit", commit.authored_date, key, sha);
      if (base) {
        events.set(key, { ...base, acceptance: unknown("unavailable", "acceptance_time_unknown"), measurements: { ...base.measurements, additions: measurement(row(commit.stats).additions), deletions: measurement(row(commit.stats).deletions) } });
      }
    }
    // Include reopened issues; their earlier closed state remains a dated event.
    for (const issue of (await collect(`/projects/${projectId}/issues`, { scope: "all", state: "all", updated_after: window.startInclusive })).nodes) {
      const iid = id(issue.iid); if (!iid) { reasons.add(diag.record("issues", "protocol")); continue; }
      for (const closure of (await collect(`/projects/${projectId}/issues/${iid}/resource_state_events`)).nodes) {
        if (!id(row(closure.user).id)) { reasons.add("attribution_unknown"); continue; }
        if (row(closure.user).id !== userId || closure.state !== "closed") continue;
        const closureId = id(closure.id); if (!closureId) { reasons.add(diag.record("resource_state_events", "protocol")); continue; }
        const linked = mrByGlobalId.get(id(closure.source_merge_request_id) ?? "");
        const linkedKey = linked ? mrKey(String(linked.project_id), String(linked.iid)) : null;
        const key = `${projectKey(projectId)}:issue:${iid}`;
        const refs = [
          ...(linkedKey ? [linkedKey] : id(closure.source_merge_request_id) ? [`gitlab.com:mr-id:${closure.source_merge_request_id}`] : []),
          ...(text(closure.source_commit) ? [`${projectKey(projectId)}:commit:${closure.source_commit}`] : []),
        ];
        const base = event(projectId, `${key}:state:${closureId}`, "issue_work", closure.created_at, linkedKey ?? key, closureId);
        if (base) {
          reasons.add("attribution_unknown");
          events.set(base.eventId, { ...base, artifactReferenceIds: [...base.artifactReferenceIds, ...refs], acceptance: unknown("partial", "attribution_unknown") });
        }
      }
    }
  }
  const component = (matches: (p: GitlabEvidenceProgress) => boolean): CoverageStatus => {
    const entries = progress.filter(matches);
    if (entries.length && entries.every((p) => !p.complete && p.collectedNodes === 0 && p.reasonCodes.includes("not_accessible"))) return "unavailable";
    return explicit && entries.every((p) => p.complete) ? "complete" : "partial";
  };
  // Even exhaustive visible endpoints cannot recover removed email links or
  // deleted review bodies. Those limitations must not become known zeroes.
  reasons.add("attribution_unknown"); reasons.add("discovery_incomplete"); reasons.add("not_supported");
  // Author dates cannot rule out an older commit first reaching the default
  // branch inside this window. This gap exists even with no dated diagnostics.
  reasons.add("acceptance_time_unknown");
  const reviewStatus = component((p) => p.path.endsWith("/notes"));
  const eventKinds: SourceCoverage["eventKinds"] = {
    accepted_change: "partial",
    authored_commit: component((p) => p.path.endsWith("/repository/commits")) === "unavailable" ? "unavailable" : "partial",
    review: reviewStatus === "unavailable" ? "unavailable" : "partial",
    issue_work: component((p) => p.path.endsWith("/resource_state_events")) === "unavailable" ? "unavailable" : "partial",
    practice_evidence: "unavailable", documentation_design: "unavailable", maintenance: "unavailable",
  };
  const complete = Object.values(eventKinds).every((status) => status === "complete") && reasons.size === 0;
  return {
    profile: { userId, username: text(profile.username) ?? username, name: text(profile.name), avatarUrl: text(profile.avatar_url) },
    events: [...events.values()], progress, requestCount, diagnostics: diag.diagnostics,
    coverage: { source: { provider: "gitlab", host: "gitlab.com", subjectId }, window,
      dataThrough: profileResponse.error ? null : window.referenceTime, status: complete ? "complete" : "partial",
      discovery: explicit ? "explicit_repositories" : "owned_and_contributed", repositoryIds: [...repositories].sort(), repositoryDiscoveryComplete: explicit,
      eventKinds, reasonCodes: [...reasons].sort(), unknownPeriods: complete ? [] : [{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }],
    },
  };
}
