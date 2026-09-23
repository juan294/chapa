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
 * v7 only. Primary semantics: developer.atlassian.com/cloud/bitbucket/rest/
 * api-group-{users,workspaces,repositories,commits,pullrequests}/ and the published
 * https://dac-static.atlassian.com/cloud/bitbucket/swagger.v3.json schema.
 * Native issue APIs were removed 2026-08-20 (Bitbucket Cloud changelog).
 * No live issue snapshots, legacy scalars, or undated participants supply credit.
 */
type Row = Record<string, unknown>;
const row = (value: unknown): Row => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown): string | null => typeof value === "string" && value.length > 0 ? value : null;
const uuid = (value: unknown): string | null => typeof value === "string" && /^\{[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}\}$/i.test(value) ? value.toLowerCase() : null;
const hash = (value: unknown): string | null => typeof value === "string" && /^[\da-f]{7,64}$/i.test(value) ? value.toLowerCase() : null;
const numericId = (value: unknown): string | null => typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : null;
const nonnegative = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const emptyMeasurements = (): EventMeasurements => ({
  changedFiles: unknown("unavailable", "not_supported"), additions: unknown("unavailable", "not_supported"),
  deletions: unknown("unavailable", "not_supported"), leadTimeHours: unknown("unavailable", "not_supported"),
  hasDescription: unknown("unavailable", "not_supported"), hasIssueLink: unknown("unavailable", "not_supported"), usesFeatureBranch: unknown("unavailable", "not_supported"),
});
const API = "https://api.bitbucket.org/2.0";
export interface BitbucketEvidenceOptions {
  /** Stable UUIDs, not names. Omit to enumerate current visible workspaces/repos. */
  readonly repositories?: readonly { readonly workspaceId: string; readonly repositoryId: string }[];
  /** Stable repository UUIDs resolved with an empty-workspace lookup.
   * Mutually exclusive with pre-resolved workspace/repository pairs. */
  readonly repositoryIds?: readonly string[];
  readonly maxRequests?: number;
  readonly timeoutMs?: number;
}
/** Private: provider URLs can identify private repositories and must not be published. */
export interface BitbucketEvidenceProgress {
  readonly initialUrl: string;
  readonly nextUrl: string | null;
  readonly collectedNodes: number;
  readonly complete: boolean;
  readonly reasonCodes: readonly EvidenceReasonCode[];
}
export interface BitbucketEvidenceResult {
  readonly profile: { readonly uuid: string | null; readonly accountId: string | null; readonly displayName: string | null };
  readonly events: readonly NormalizedEngineeringEvent[];
  readonly coverage: SourceCoverage;
  readonly progress: readonly BitbucketEvidenceProgress[];
  readonly requestCount: number;
  readonly diagnostics: readonly SourceDiagnostic[];
}
/** Stable operation name for a diagnostic, derived from the URL shape this
 * module itself constructs (never a caller-supplied or provider-redirected
 * URL). Path segments only -- never logged or published with the URL itself.
 */
function operationFor(url: string): string {
  const path = new URL(url).pathname.replace(/^\/2\.0/, "");
  const segments = path.split("/").filter(Boolean);
  if (segments[0] === "user" && segments.length === 1) return "profile";
  if (segments[0] === "user" && segments[1] === "workspaces") return "workspaces";
  if (segments[0] === "repositories" && segments.length === 2) return "repositories";
  if (segments[0] === "repositories" && segments.length === 3) return "repository";
  if (segments.includes("diffstat") && segments.indexOf("diffstat") < segments.length - 1) return "diff";
  if (path.endsWith("/diffstat")) return "diffstat";
  if (path.endsWith("/commits")) return "commits";
  if (path.endsWith("/pullrequests")) return "pullrequests";
  if (path.endsWith("/activity")) return "activity";
  return "unknown";
}
export async function fetchBitbucketEvidence(
  stableAccountId: string, token: string, inputWindow: ScoringWindow, options: BitbucketEvidenceOptions = {},
): Promise<BitbucketEvidenceResult> {
  if (!stableAccountId.trim() || !token.trim()) throw new RangeError("Invalid Bitbucket subject or credential");
  const window = createScoringWindow(inputWindow.referenceTime);
  if (window.startInclusive !== inputWindow.startInclusive || window.endExclusive !== inputWindow.endExclusive || window.referenceDate !== inputWindow.referenceDate || inputWindow.calendarDays !== 365) throw new RangeError("Inconsistent scoring window");
  const maxRequests = options.maxRequests ?? 100; const timeoutMs = options.timeoutMs ?? 30_000;
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 500 || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new RangeError("Invalid Bitbucket evidence budget");
  if (options.repositories && (options.repositories.length > 500 || options.repositories.some((r) => !uuid(r.repositoryId) || !uuid(r.workspaceId)))) throw new RangeError("Invalid Bitbucket repository UUIDs");
  if (options.repositories !== undefined && options.repositoryIds !== undefined) throw new RangeError("Ambiguous Bitbucket repository scope");
  if (options.repositoryIds && (options.repositoryIds.length > 500 || options.repositoryIds.some(id => !uuid(id)))) throw new RangeError("Invalid Bitbucket repository UUIDs");
  const signal = AbortSignal.timeout(timeoutMs);
  const reasons = new Set<EvidenceReasonCode>();
  const progress: BitbucketEvidenceProgress[] = [];
  const diag = createDiagnosticRecorder("bitbucket");
  let requestCount = 0;
  async function request(url: string, inspectRedirect = false): Promise<{ data: Row; error: EvidenceReasonCode | null; location?: string | null }> {
    const operation = operationFor(url);
    // A collector's own budget or deadline is honest incompleteness, never a
    // provider-reported or structural failure: classify before attempting.
    const stop = budgetOrDeadlineStop(requestCount, maxRequests, signal);
    if (stop) return { data: {}, error: diag.record(operation, stop) };
    requestCount++;
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token.trim()}`, Accept: "application/json" }, signal, redirect: inspectRedirect ? "manual" : "error" });
      if (inspectRedirect && response.status === 302) return { data: {}, error: null, location: response.headers.get("location") };
      if (!response.ok) {
        const stopKind = classifyHttpStatus(response.status, response.headers, [401, 403, 404]);
        return { data: {}, error: diag.record(operation, stopKind, response.status, stopKind === "rate_limited" ? retryAfterSeconds(response.headers) : null) };
      }
      const data = row(await response.json());
      if (data.type === "error" || data.error) return { data, error: diag.record(operation, "protocol", response.status) };
      return { data, error: null };
    } catch (error) {
      // The AbortSignal.timeout deadline can fire mid-flight, rejecting fetch
      // or json() with no HTTP response at all -- classify by signal/exception.
      return { data: {}, error: diag.record(operation, classifyFetchFailure(error, signal)) };
    }
  }
  const makeUrl = (path: string, parameters: readonly (readonly [string, string])[] = []) => {
    const url = new URL(`${API}${path}`); url.searchParams.set("pagelen", "100");
    for (const [key, value] of parameters) url.searchParams.append(key, value);
    return url.toString();
  };
  async function collect(initialUrl: string) {
    const nodes: Row[] = []; const errors = new Set<EvidenceReasonCode>(); const seen = new Set<string>();
    const initial = new URL(initialUrl);
    const operation = operationFor(initialUrl);
    let nextUrl: string | null = initialUrl; let complete = false;
    for (;;) {
      seen.add(nextUrl!);
      const response = await request(nextUrl!);
      if (response.error) { errors.add(response.error); break; }
      if (!Array.isArray(response.data.values)) { errors.add(diag.record(operation, "protocol")); break; }
      for (const value of response.data.values) {
        if (value === null || typeof value !== "object" || Array.isArray(value)) errors.add(diag.record(operation, "protocol"));
        else nodes.push(row(value));
      }
      if (response.data.truncated === true || response.data.is_truncated === true || response.data.overflow === true) errors.add("pagination_incomplete");
      if (errors.size > 0) break; // Replay this incoming page, retaining valid nodes.
      if (response.data.next !== undefined && response.data.next !== null && response.data.next !== "") {
        try {
          const next = new URL(String(response.data.next));
          if (next.origin !== initial.origin || next.pathname !== initial.pathname || next.username || next.password || next.hash || seen.has(next.toString())) throw new Error("Invalid cursor");
          for (const key of new Set(initial.searchParams.keys())) {
            if (key !== "pagelen" && JSON.stringify(next.searchParams.getAll(key)) !== JSON.stringify(initial.searchParams.getAll(key))) throw new Error("Changed query scope");
          }
          nextUrl = next.toString();
        } catch { errors.add(diag.record(operation, "protocol")); break; }
        continue;
      }
      if (response.data.size !== undefined && (!nonnegative(response.data.size) || response.data.size !== nodes.length)) { errors.add("pagination_incomplete"); break; }
      complete = true; nextUrl = null; break;
    }
    for (const reason of errors) reasons.add(reason);
    progress.push({ initialUrl, nextUrl, collectedNodes: nodes.length, complete, reasonCodes: [...errors] });
    return { nodes, complete };
  }
  const profileResponse = await request(`${API}/user`); const profile = row(profileResponse.data);
  const profileUuid = uuid(profile.uuid); const accountId = text(profile.account_id);
  if (profileResponse.error) reasons.add(profileResponse.error);
  else if ((accountId === null || stableAccountId !== accountId) && (profileUuid === null || uuid(stableAccountId) !== profileUuid)) throw new Error("Bitbucket credential subject does not match requested subject");
  if (!profileUuid && !accountId) reasons.add("attribution_unknown");
  const subjectId = profileUuid ?? accountId ?? stableAccountId;
  function isSubject(value: unknown) {
    const actor = row(value); const actorUuid = uuid(actor.uuid); const actorAccount = text(actor.account_id);
    if (!actorUuid && !actorAccount) { reasons.add("attribution_unknown"); return false; }
    if (actorUuid && profileUuid) return actorUuid === profileUuid && (!actorAccount || !accountId || actorAccount === accountId);
    return actorAccount !== null && accountId !== null && actorAccount === accountId;
  }
  const repositories = new Map<string, { workspaceId: string; repositoryId: string; fullName?: string }>();
  function addRepo(value: unknown, workspaceId: string) {
    const repo = row(value); const repositoryId = uuid(repo.uuid);
    if (!repositoryId) { reasons.add("attribution_unknown"); return; }
    repositories.set(repositoryId, { workspaceId, repositoryId, ...(text(repo.full_name) ? { fullName: String(repo.full_name) } : {}) });
  }
  const explicit = options.repositories !== undefined || options.repositoryIds !== undefined;
  let repositoryDiscoveryComplete = explicit;
  if (options.repositoryIds !== undefined) {
    // https://developer.atlassian.com/cloud/bitbucket/rest/intro/#repository-object-and-uuid
    // Resolve only declared repositories, within the same bounded HTTP budget.
    for (const repositoryId of new Set(options.repositoryIds.map(id => uuid(id)!))) {
      const initialUrl = `${API}/repositories/%7B%7D/${encodeURIComponent(repositoryId)}`;
      const metadata = await request(initialUrl);
      const repo = row(metadata.data); const workspaceId = uuid(row(repo.workspace).uuid);
      const reason = metadata.error ?? (uuid(repo.uuid) !== repositoryId || !workspaceId ? diag.record("repository", "protocol") : null);
      progress.push({ initialUrl, nextUrl: reason ? initialUrl : null, collectedNodes: reason ? 0 : 1,
        complete: reason === null, reasonCodes: reason ? [reason] : [] });
      if (reason) { reasons.add(reason); repositoryDiscoveryComplete = false; continue; }
      addRepo(repo, workspaceId!);
    }
  } else if (options.repositories !== undefined) for (const repo of options.repositories) repositories.set(uuid(repo.repositoryId)!, { workspaceId: uuid(repo.workspaceId)!, repositoryId: uuid(repo.repositoryId)! });
  else {
    const workspaces = await collect(makeUrl("/user/workspaces"));
    for (const permission of workspaces.nodes) {
      const workspaceId = uuid(row(permission.workspace).uuid);
      if (!workspaceId) { reasons.add("attribution_unknown"); continue; }
      for (const repo of (await collect(makeUrl(`/repositories/${encodeURIComponent(workspaceId)}`))).nodes) addRepo(repo, workspaceId);
    }
  }
  function instant(value: unknown, operation: string): string | null {
    if (!text(value)) { reasons.add(diag.record(operation, "parse")); return null; }
    try { return scoringInstant(String(value)).toISOString(); } catch { reasons.add(diag.record(operation, "parse")); return null; }
  }
  const events = new Map<string, NormalizedEngineeringEvent>();
  const projectKey = (repo: string) => `bitbucket.org:repository:${repo}`;
  function event(repositoryId: string, eventId: string, kind: NormalizedEngineeringEvent["kind"], occurredAt: string, workItemId: string, revision: string): NormalizedEngineeringEvent | null {
    if (!isWithinScoringWindow(occurredAt, window)) return null;
    return {
      schemaVersion: "v7", provider: "bitbucket", host: "bitbucket.org", subjectId, actorId: subjectId, repositoryId, eventId, kind, occurredAt,
      dataThrough: window.referenceTime, canonicalProjectId: projectKey(repositoryId), workItemId, artifactRevision: revision,
      artifactReferenceIds: [eventId], attribution: "individual", provenance: "source_observed", coverage: "complete",
      categories: [], measurements: emptyMeasurements(), acceptance: unknown("unavailable", "not_assessed"),
    };
  }
  for (const { repositoryId, workspaceId, fullName: discoveredName } of repositories.values()) {
    const path = `/repositories/${encodeURIComponent(workspaceId)}/${encodeURIComponent(repositoryId)}`;
    let fullName = discoveredName;
    if (!fullName) {
      const metadata = await request(`${API}${path}`); const repo = row(metadata.data);
      if (metadata.error) reasons.add(metadata.error);
      else if (uuid(repo.uuid) === repositoryId && uuid(row(repo.workspace).uuid) === workspaceId) fullName = text(repo.full_name) ?? undefined;
      else reasons.add(diag.record("repository", "protocol"));
    }
    // Bitbucket exposes actual commit objects across all refs. date is its
    // provider commit timestamp, never a first-default-branch reachability time.
    for (const commit of (await collect(makeUrl(`${path}/commits`))).nodes) {
      if (!isSubject(row(commit.author).user)) continue;
      const sha = hash(commit.hash); const date = instant(commit.date, "commits");
      if (!sha) reasons.add(diag.record("commits", "protocol"));
      if (!sha || !date) continue;
      const key = `${projectKey(repositoryId)}:commit:${sha}`;
      const base = event(repositoryId, key, "authored_commit", date, key, sha);
      if (base) events.set(key, { ...base, acceptance: unknown("unavailable", "acceptance_time_unknown") });
    }
    const prs = await collect(makeUrl(`${path}/pullrequests`, [
      ["state", "OPEN"], ["state", "MERGED"], ["state", "DECLINED"], ["state", "SUPERSEDED"],
    ]));
    for (const pr of prs.nodes) {
      const prId = numericId(pr.id); if (!prId) { reasons.add(diag.record("pullrequests", "protocol")); continue; }
      const key = `${projectKey(repositoryId)}:pr:${prId}`;
      const activity = await collect(makeUrl(`${path}/pullrequests/${prId}/activity`));
      const mergeUpdates: { update: Row; date: string }[] = [];
      let invalidMergeDate = false;
      for (const entry of activity.nodes) {
        const update = row(entry.update);
        if (update.state === "MERGED") {
          const date = instant(update.date, "activity"); if (date) mergeUpdates.push({ update, date }); else invalidMergeDate = true;
        }
        for (const kind of ["approval", "changes_requested", "comment"] as const) {
          if (!entry[kind]) continue;
          const detail = row(entry[kind]);
          if (!isSubject(detail.user)) continue;
          if (detail.deleted === true) { reasons.add(diag.record("activity", "not_accessible")); continue; }
          const date = instant(kind === "comment" ? detail.created_on : detail.date, "activity"); if (!date) continue;
          const identity = kind === "comment" ? numericId(detail.id) : `${subjectId}:${date}`;
          if (!identity) { reasons.add(diag.record("activity", "protocol")); continue; }
          const eventId = `${key}:${kind}:${identity}`;
          // Build the revision from the comment's stable id + created_on only
          // (never updated_on): an edited comment's updated_on otherwise
          // changes between collections and trips the immutable-identity guard
          // (packages/shared/src/scoring-aggregation-v7.ts) when events merge.
          const base = event(repositoryId, eventId, "review", date, key, kind === "comment" ? `${identity}:${date}` : eventId);
          if (base) events.set(eventId, base); // Rubric assessment is separate, including empty approvals.
        }
      }
      if (!isSubject(pr.author) || pr.state !== "MERGED") continue;
      // Updates repeat current state even for title edits. Only the earliest
      // MERGED update in an exhausted history can supply the merge timestamp.
      if (!activity.complete || invalidMergeDate || mergeUpdates.length === 0) { reasons.add("acceptance_time_unknown"); continue; }
      mergeUpdates.sort((a, b) => a.date.localeCompare(b.date));
      const first = mergeUpdates[0];
      if (!first) continue;
      const sourceHash = hash(row(row(first.update.source).commit).hash);
      const base = event(repositoryId, `${key}:merged`, "accepted_change", first.date, key, sourceHash ?? hash(row(pr.merge_commit).hash) ?? key);
      if (!base) continue;
      let measurements = emptyMeasurements();
      // The PR endpoint chooses the authoritative comparison; reconstructing a
      // destination from a post-merge snapshot can wrongly produce an empty diff.
      // Inspect its 302 without automatically forwarding any credential.
      const redirectUrl = `${API}${path}/pullrequests/${prId}/diffstat`;
      const redirect = await request(redirectUrl, true);
      let diffUrl: string | null = null;
      // Every branch that leaves diffUrl null sets reason -- a diffstat
      // request either fails via request() (redirect.error) or fails the
      // local redirect validation below (diag.record), never neither.
      let reason: EvidenceReasonCode | undefined = redirect.error ?? undefined;
      if (reason) reasons.add(reason);
      else {
        try {
          const target = new URL("location" in redirect && typeof redirect.location === "string" ? redirect.location : "");
          const decoded = decodeURIComponent(target.pathname);
          const allowedPrefixes = [`/2.0${decodeURIComponent(path)}/diffstat/`, ...(fullName && /^[^/]+\/[^/]+$/.test(fullName) ? [`/2.0/repositories/${fullName}/diffstat/`] : [])];
          const prefix = allowedPrefixes.find((p) => decoded.startsWith(p));
          if (target.origin !== "https://api.bitbucket.org" || target.username || target.password || target.hash || !prefix ||
            !/^[a-f\d]{7,64}(?:\.\.[a-f\d]{7,64})?$/i.test(decoded.slice(prefix.length)) ||
            [...target.searchParams.keys()].some((key) => !["topic", "pagelen"].includes(key))) throw new Error("Invalid diff comparison");
          target.searchParams.set("pagelen", "100"); diffUrl = target.toString();
        } catch { reason = diag.record("diffstat", "protocol"); reasons.add(reason); }
      }
      progress.push({ initialUrl: redirectUrl, nextUrl: diffUrl ? null : redirectUrl, collectedNodes: 0, complete: diffUrl !== null,
        reasonCodes: diffUrl ? [] : [reason!] });
      if (diffUrl) {
        const diffs = await collect(diffUrl);
        const paths = new Set<string>(); let additions = 0; let deletions = 0; let full = diffs.complete;
        const seenPaths = new Set<string>();
        for (const diff of diffs.nodes) {
          const oldPath = text(row(diff.old).path); const newPath = text(row(diff.new).path);
          const validPaths = diff.status === "added" ? newPath !== null : diff.status === "removed" ? oldPath !== null : ["modified", "renamed"].includes(String(diff.status)) && oldPath !== null && newPath !== null;
          const pair = JSON.stringify([oldPath, newPath]);
          if (!validPaths || seenPaths.has(pair) || !nonnegative(diff.lines_added) || !nonnegative(diff.lines_removed) || diff.truncated === true || diff.overflow === true || diff.too_large === true) full = false;
          seenPaths.add(pair);
          for (const p of [oldPath, newPath]) if (p) paths.add(p);
          if (nonnegative(diff.lines_added)) additions += diff.lines_added;
          if (nonnegative(diff.lines_removed)) deletions += diff.lines_removed;
        }
        if (!Number.isSafeInteger(additions) || !Number.isSafeInteger(deletions)) full = false;
        if (!full) reasons.add("partial_files");
        measurements = { ...measurements,
          changedFiles: full ? observed([...paths], "complete", "source_observed") : unknown("partial", "partial_files"),
          additions: full ? observed(additions, "complete", "source_observed") : unknown("partial", "partial_files"),
          deletions: full ? observed(deletions, "complete", "source_observed") : unknown("partial", "partial_files"),
        };
      } else reasons.add("partial_files");
      let leadTimeHours: Observation<number> = unknown("partial", "source_error");
      const createdAt = instant(pr.created_on, "pullrequests");
      if (createdAt) {
        const hours = (scoringInstant(first.date).getTime() - scoringInstant(createdAt).getTime()) / 3_600_000;
        if (hours >= 0) leadTimeHours = observed(hours, "complete", "source_observed");
      }
      events.set(base.eventId, { ...base,
        artifactReferenceIds: [...base.artifactReferenceIds, key, ...(hash(row(pr.merge_commit).hash) ? [`${projectKey(repositoryId)}:commit:${hash(row(pr.merge_commit).hash)}`] : [])],
        measurements: { ...measurements, leadTimeHours,
          hasDescription: typeof first.update.description === "string" ? observed(first.update.description.trim().length > 0, "complete", "source_observed") : unknown("partial", "source_error"),
        },
        acceptance: observed({ method: "merged_change", acceptedAt: base.occurredAt, acceptedResultId: key }, "complete", "source_observed"),
      });
    }
  }
  // Direct-commit first reachability is unsupported even with no authored-date
  // observations. Removed issues and unseen/deleted history remain unknown.
  reasons.add("acceptance_time_unknown"); reasons.add("not_supported"); reasons.add("discovery_incomplete");
  function statusFor(suffix: string): CoverageStatus {
    const entries = progress.filter((p) => new URL(p.initialUrl).pathname.endsWith(suffix));
    return entries.length > 0 && entries.every((p) => !p.complete && p.collectedNodes === 0 && p.reasonCodes.includes("not_accessible")) ? "unavailable" : "partial";
  }
  const eventKinds: SourceCoverage["eventKinds"] = {
    accepted_change: "partial", authored_commit: statusFor("/commits"), review: statusFor("/activity"),
    issue_work: "unavailable", practice_evidence: "unavailable", documentation_design: "unavailable", maintenance: "unavailable",
  };
  return {
    profile: { uuid: profileUuid, accountId, displayName: text(profile.display_name) },
    events: [...events.values()], progress, requestCount, diagnostics: diag.diagnostics,
    coverage: { source: { provider: "bitbucket", host: "bitbucket.org", subjectId }, window,
      dataThrough: profileResponse.error ? null : window.referenceTime, status: "partial",
      discovery: explicit ? "explicit_repositories" : "owned_and_contributed", repositoryIds: [...repositories.keys()].sort(), repositoryDiscoveryComplete,
      eventKinds, reasonCodes: [...reasons].sort(), unknownPeriods: [{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }],
    },
  };
}

// ---------------------------------------------------------------------------
// collectBitbucketSlice (#1335 phase 3) -- checkpointed, resumable slice API.
// A separate, self-contained engine from fetchBitbucketEvidence above (same
// reasoning as the GitHub slice engine: the single-run function keeps its own
// exhaustive fixture tests unchanged). Every repository-scoped request uses
// Bitbucket's `{}` empty-workspace UUID form, so no workspace tracking is
// needed once a repository UUID is known.
// ---------------------------------------------------------------------------

interface BitbucketPrMeta {
  readonly repositoryId: string;
  readonly prId: string;
  authorIsSubject: boolean;
  merged: boolean;
  createdAt?: string | null;
  description?: string | null;
}
interface MutableBitbucketOperation { key: string; cursor: string | null; done: boolean }
interface BitbucketListOutcome { readonly kind: "done" | "stop"; readonly stop?: SourceDiagnostic }

/** Bounds an otherwise-unbounded commit history to the scoring window via
 * Bitbucket Query Language (`q=date>=...`), per #1335 phase 3.
 */
function commitsPath(repositoryId: string, sinceIso: string): string {
  const url = new URL(`${API}/repositories/%7B%7D/${encodeURIComponent(repositoryId)}/commits`);
  url.searchParams.set("pagelen", "100");
  url.searchParams.set("q", `date>=${sinceIso}`);
  return url.toString();
}

export const collectBitbucketSlice: CollectSlice = async (input, credential, checkpoint, budget, staged) => {
  const window = createScoringWindow(input.window.referenceTime);
  if (window.startInclusive !== input.window.startInclusive || window.endExclusive !== input.window.endExclusive || window.referenceDate !== input.window.referenceDate || input.window.calendarDays !== 365) throw new RangeError("Inconsistent scoring window");
  if (!credential.token || !credential.token.trim()) throw new RangeError("Bitbucket collection requires a credential");
  const token = credential.token.trim();
  const explicit = input.scope.discovery === "explicit_repositories";
  const signal = AbortSignal.timeout(Math.max(0, budget.deadlineAt - Date.now()));
  const diag = createDiagnosticRecorder("bitbucket");
  let requestCount = 0;

  const operations: MutableBitbucketOperation[] = checkpoint.operations.map((op) => ({ key: op.key, cursor: op.cursor, done: op.done }));
  const repositoryIds = new Set(checkpoint.discovered.repositoryIds);
  const state: Record<string, unknown> = { ...(checkpoint.state ?? {}) };
  const prMeta: Record<string, BitbucketPrMeta> = { ...((state.pr as Record<string, BitbucketPrMeta> | undefined) ?? {}) };
  state.pr = prMeta;
  const reasons = new Set<EvidenceReasonCode>((state.reasons as EvidenceReasonCode[] | undefined) ?? []);
  const newEvents = new Map<string, NormalizedEngineeringEvent>();
  const stagedKeys = new Set(staged.map(engineeringEventKey));

  function subjectId(): string | undefined { return state.subjectId as string | undefined; }
  function makeStop(operation: string, stopKind: StopKind, httpStatus: number | null = null, retryAfter: number | null = null): SourceDiagnostic {
    diag.record(operation, stopKind, httpStatus, retryAfter);
    return { provider: "bitbucket", operation, stopKind, httpStatus, retryAfterSeconds: retryAfter };
  }
  function ensureOp(key: string): void { if (!operations.some((op) => op.key === key)) operations.push({ key, cursor: null, done: false }); }
  function registerRepo(repositoryId: string): void {
    if (repositoryIds.has(repositoryId)) return;
    repositoryIds.add(repositoryId);
    ensureOp(`commits:${repositoryId}`);
    ensureOp(`pullrequests:${repositoryId}`);
  }
  function addEvent(event: NormalizedEngineeringEvent): void { newEvents.set(engineeringEventKey(event), event); }
  const projectKey = (repositoryId: string) => `bitbucket.org:repository:${repositoryId}`;
  function instant(value: unknown, operation: string): string | null {
    if (!text(value)) { reasons.add(diag.record(operation, "parse")); return null; }
    try { return scoringInstant(String(value)).toISOString(); } catch { reasons.add(diag.record(operation, "parse")); return null; }
  }
  function isSubject(value: unknown): boolean {
    const actor = row(row(value).user ?? value); const actorUuid = uuid(actor.uuid); const actorAccount = text(actor.account_id);
    if (!actorUuid && !actorAccount) { reasons.add("attribution_unknown"); return false; }
    const profileUuid = state.profileUuid as string | null | undefined; const accountId = state.accountId as string | null | undefined;
    if (actorUuid && profileUuid) return actorUuid === profileUuid;
    return actorAccount !== null && accountId !== undefined && actorAccount === accountId;
  }

  async function request(operation: string, url: string, opts: { readonly inspectRedirect?: boolean } = {}): Promise<{ data: Row; stop: SourceDiagnostic | null; location?: string | null }> {
    const budgetStop = budgetOrDeadlineStop(requestCount, budget.maxRequests, signal);
    if (budgetStop) return { data: {}, stop: makeStop(operation, budgetStop) };
    requestCount++;
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal, redirect: opts.inspectRedirect ? "manual" : "error" });
      if (opts.inspectRedirect && response.status === 302) return { data: {}, stop: null, location: response.headers.get("location") };
      if (!response.ok) {
        const stopKind = classifyHttpStatus(response.status, response.headers, [401, 403, 404]);
        return { data: {}, stop: makeStop(operation, stopKind, response.status, stopKind === "rate_limited" ? retryAfterSeconds(response.headers) : null) };
      }
      const data = row(await response.json());
      if (data.type === "error" || data.error) return { data, stop: makeStop(operation, "protocol", response.status) };
      return { data, stop: null };
    } catch (error) {
      return { data: {}, stop: makeStop(operation, classifyFetchFailure(error, signal)) };
    }
  }

  /** Drains one Bitbucket `next`-linked page collection until exhausted or a
   * budget/deadline/protocol stop interrupts it, resuming from `op.cursor`
   * (the raw next URL) across slices.
   */
  async function runPagedList(op: MutableBitbucketOperation, operation: string, initialUrl: string, onNode: (node: Row) => void): Promise<BitbucketListOutcome> {
    let url = op.cursor ?? initialUrl;
    const initial = new URL(initialUrl);
    for (;;) {
      const r = await request(operation, url);
      if (r.stop) { op.cursor = url; return { kind: "stop", stop: r.stop }; }
      if (!Array.isArray(r.data.values)) { const stop = makeStop(operation, "protocol"); op.cursor = url; return { kind: "stop", stop }; }
      for (const value of r.data.values) {
        if (value === null || typeof value !== "object" || Array.isArray(value)) reasons.add(diag.record(operation, "protocol"));
        else onNode(row(value));
      }
      if (r.data.truncated === true || r.data.is_truncated === true || r.data.overflow === true) reasons.add("pagination_incomplete");
      if (r.data.next === undefined || r.data.next === null || r.data.next === "") {
        if (r.data.size !== undefined && (!nonnegative(r.data.size))) reasons.add("pagination_incomplete");
        op.done = true; op.cursor = null; return { kind: "done" };
      }
      try {
        const next = new URL(String(r.data.next));
        if (next.origin !== initial.origin || next.pathname !== initial.pathname || next.username || next.password || next.hash) throw new Error("Invalid cursor");
        url = next.toString();
      } catch { const stop = makeStop(operation, "protocol"); op.cursor = url; return { kind: "stop", stop }; }
    }
  }

  async function runProfile(op: MutableBitbucketOperation): Promise<"done" | "stop"> {
    const r = await request("profile", `${API}/user`);
    if (r.stop) { pendingStop = r.stop; return "stop"; }
    const profileUuid = uuid(r.data.uuid); const accountId = text(r.data.account_id);
    if (!profileUuid && !accountId) { reasons.add("attribution_unknown"); }
    state.profileUuid = profileUuid; state.accountId = accountId; state.subjectId = profileUuid ?? accountId ?? input.owner;
    state.displayName = text(r.data.display_name);
    op.done = true; op.cursor = null;
    return "done";
  }

  async function runWorkspaces(op: MutableBitbucketOperation): Promise<"done" | "stop"> {
    const url = new URL(`${API}/user/workspaces`); url.searchParams.set("pagelen", "100");
    const outcome = await runPagedList(op, "workspaces", op.cursor ?? url.toString(), (permission) => {
      const workspaceId = uuid(row(permission.workspace).uuid);
      if (!workspaceId) { reasons.add("attribution_unknown"); return; }
      ensureOp(`workspace-repos:${workspaceId}`);
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }

  async function runWorkspaceRepos(op: MutableBitbucketOperation): Promise<"done" | "stop"> {
    const workspaceId = op.key.slice("workspace-repos:".length);
    const url = new URL(`${API}/repositories/${encodeURIComponent(workspaceId)}`); url.searchParams.set("pagelen", "100");
    const outcome = await runPagedList(op, "repositories", op.cursor ?? url.toString(), (repo) => {
      const repositoryId = uuid(repo.uuid);
      if (!repositoryId) { reasons.add("attribution_unknown"); return; }
      registerRepo(repositoryId);
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }

  async function runCommits(op: MutableBitbucketOperation): Promise<"done" | "stop"> {
    const repositoryId = op.key.slice("commits:".length);
    const outcome = await runPagedList(op, "commits", op.cursor ?? commitsPath(repositoryId, window.startInclusive), (commit) => {
      if (!isSubject(commit.author)) return;
      const sha = hash(commit.hash); const date = instant(commit.date, "commits");
      if (!sha) { reasons.add(diag.record("commits", "protocol")); return; }
      if (!date || !isWithinScoringWindow(date, window)) return;
      const key = `${projectKey(repositoryId)}:commit:${sha}`;
      addEvent({
        schemaVersion: "v7", provider: "bitbucket", host: "bitbucket.org", subjectId: subjectId()!, actorId: subjectId()!, repositoryId,
        eventId: key, kind: "authored_commit", occurredAt: date, dataThrough: window.referenceTime, canonicalProjectId: projectKey(repositoryId),
        workItemId: key, artifactRevision: sha, artifactReferenceIds: [key], attribution: "individual", provenance: "source_observed", coverage: "complete",
        categories: [], measurements: emptyMeasurements(), acceptance: unknown("unavailable", "acceptance_time_unknown"),
      });
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }

  async function runPullRequests(op: MutableBitbucketOperation): Promise<"done" | "stop"> {
    const repositoryId = op.key.slice("pullrequests:".length);
    const url = new URL(`${API}/repositories/%7B%7D/${encodeURIComponent(repositoryId)}/pullrequests`);
    url.searchParams.set("pagelen", "100");
    for (const state_ of ["OPEN", "MERGED", "DECLINED", "SUPERSEDED"]) url.searchParams.append("state", state_);
    const outcome = await runPagedList(op, "pullrequests", op.cursor ?? url.toString(), (pr) => {
      const prId = numericId(pr.id); if (!prId) { reasons.add(diag.record("pullrequests", "protocol")); return; }
      const key = `${projectKey(repositoryId)}:pr:${prId}`;
      prMeta[key] = {
        repositoryId, prId, authorIsSubject: isSubject(pr.author), merged: pr.state === "MERGED",
        createdAt: text(pr.created_on), description: typeof pr.description === "string" ? pr.description : null,
      };
      ensureOp(`activity:${key}`);
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }

  /** Fetches every diff page for a merged PR's comparison and reduces the
   * paths/line counts. Best-effort within the slice's own remaining budget:
   * an incomplete result is reported via `partial_files`, never a hard stop,
   * since the PR's accepted_change event is already fully determined.
   */
  async function collectDiff(repositoryId: string, prId: string): Promise<{ paths: string[]; additions: number; deletions: number; complete: boolean }> {
    const redirectUrl = `${API}/repositories/%7B%7D/${encodeURIComponent(repositoryId)}/pullrequests/${prId}/diffstat`;
    const redirect = await request("diffstat", redirectUrl, { inspectRedirect: true });
    if (redirect.stop || typeof redirect.location !== "string") return { paths: [], additions: 0, deletions: 0, complete: false };
    let diffUrl: string;
    try {
      const target = new URL(redirect.location);
      if (target.origin !== "https://api.bitbucket.org") throw new Error("Invalid diff redirect");
      target.searchParams.set("pagelen", "100"); diffUrl = target.toString();
    } catch { return { paths: [], additions: 0, deletions: 0, complete: false }; }
    const paths = new Set<string>(); let additions = 0; let deletions = 0; let full = true; let url: string | null = diffUrl;
    while (url) {
      const r = await request("diff", url);
      if (r.stop || !Array.isArray(r.data.values)) return { paths: [...paths], additions, deletions, complete: false };
      for (const diff of r.data.values) {
        const d = row(diff); const oldPath = text(row(d.old).path); const newPath = text(row(d.new).path);
        if (oldPath) paths.add(oldPath); if (newPath) paths.add(newPath);
        if (nonnegative(d.lines_added)) additions += d.lines_added; else full = false;
        if (nonnegative(d.lines_removed)) deletions += d.lines_removed; else full = false;
        if (d.truncated === true || d.overflow === true || d.too_large === true) full = false;
      }
      url = typeof r.data.next === "string" && r.data.next ? r.data.next : null;
    }
    return { paths: [...paths], additions, deletions, complete: full };
  }

  async function runActivity(op: MutableBitbucketOperation): Promise<"done" | "stop"> {
    const key = op.key.slice("activity:".length);
    const meta = prMeta[key];
    if (!meta) { reasons.add("not_accessible"); op.done = true; op.cursor = null; return "done"; }
    const mergeUpdates: { readonly date: string }[] = [];
    const url = new URL(`${API}/repositories/%7B%7D/${encodeURIComponent(meta.repositoryId)}/pullrequests/${meta.prId}/activity`);
    url.searchParams.set("pagelen", "100");
    const outcome = await runPagedList(op, "activity", op.cursor ?? url.toString(), (entry) => {
      const update = row(entry.update);
      if (update.state === "MERGED") { const date = instant(update.date, "activity"); if (date) mergeUpdates.push({ date }); }
      for (const kind of ["approval", "changes_requested", "comment"] as const) {
        if (!entry[kind]) continue;
        const detail = row(entry[kind]);
        if (!isSubject(detail)) continue;
        if (detail.deleted === true) { reasons.add(diag.record("activity", "not_accessible")); continue; }
        const date = instant(kind === "comment" ? detail.created_on : detail.date, "activity"); if (!date || !isWithinScoringWindow(date, window)) continue;
        const identity = kind === "comment" ? numericId(detail.id) : `${subjectId()}:${date}`;
        if (!identity) { reasons.add(diag.record("activity", "protocol")); continue; }
        const eventId = `${key}:${kind}:${identity}`;
        addEvent({
          schemaVersion: "v7", provider: "bitbucket", host: "bitbucket.org", subjectId: subjectId()!, actorId: subjectId()!, repositoryId: meta.repositoryId,
          eventId, kind: "review", occurredAt: date, dataThrough: window.referenceTime, canonicalProjectId: projectKey(meta.repositoryId),
          workItemId: key, artifactRevision: kind === "comment" ? `${identity}:${date}` : eventId, artifactReferenceIds: [eventId],
          attribution: "individual", provenance: "source_observed", coverage: "complete", categories: [], measurements: emptyMeasurements(),
          acceptance: unknown("unavailable", "not_assessed"),
        });
      }
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    if (!meta.authorIsSubject || !meta.merged || mergeUpdates.length === 0) { if (meta.merged && meta.authorIsSubject) reasons.add("acceptance_time_unknown"); return "done"; }
    mergeUpdates.sort((a, b) => a.date.localeCompare(b.date));
    const mergedAt = mergeUpdates[0]!.date;
    if (!isWithinScoringWindow(mergedAt, window)) return "done";
    const diff = await collectDiff(meta.repositoryId, meta.prId);
    if (!diff.complete) reasons.add("partial_files");
    let leadTimeHours: Observation<number> = unknown("partial", "source_error");
    const createdAt = meta.createdAt ? instant(meta.createdAt, "pullrequests") : null;
    if (createdAt) {
      const hours = (scoringInstant(mergedAt).getTime() - scoringInstant(createdAt).getTime()) / 3_600_000;
      if (hours >= 0) leadTimeHours = observed(hours, "complete", "source_observed");
    }
    addEvent({
      schemaVersion: "v7", provider: "bitbucket", host: "bitbucket.org", subjectId: subjectId()!, actorId: subjectId()!, repositoryId: meta.repositoryId,
      eventId: `${key}:merged`, kind: "accepted_change", occurredAt: mergedAt, dataThrough: window.referenceTime, canonicalProjectId: projectKey(meta.repositoryId),
      workItemId: key, artifactRevision: key, artifactReferenceIds: [`${key}:merged`], attribution: "individual", provenance: "source_observed", coverage: "complete",
      categories: [],
      measurements: {
        ...emptyMeasurements(), leadTimeHours,
        changedFiles: diff.complete ? observed(diff.paths, "complete", "source_observed") : unknown("partial", "partial_files"),
        additions: diff.complete ? observed(diff.additions, "complete", "source_observed") : unknown("partial", "partial_files"),
        deletions: diff.complete ? observed(diff.deletions, "complete", "source_observed") : unknown("partial", "partial_files"),
        hasDescription: meta.description !== null && meta.description !== undefined ? observed(meta.description.trim().length > 0, "complete", "source_observed") : unknown("partial", "source_error"),
      },
      acceptance: observed({ method: "merged_change", acceptedAt: mergedAt, acceptedResultId: `${key}:merged` }, "complete", "source_observed"),
    });
    return "done";
  }

  let pendingStop: SourceDiagnostic | null = null;

  async function processOperation(op: MutableBitbucketOperation): Promise<"done" | "stop"> {
    if (op.key === "profile") return runProfile(op);
    if (op.key === "workspaces") return runWorkspaces(op);
    if (op.key.startsWith("workspace-repos:")) return runWorkspaceRepos(op);
    if (op.key.startsWith("commits:")) return runCommits(op);
    if (op.key.startsWith("pullrequests:")) return runPullRequests(op);
    if (op.key.startsWith("activity:")) return runActivity(op);
    op.done = true; return "done";
  }

  if (!operations.some((op) => op.key === "profile")) {
    operations.unshift({ key: "profile", cursor: null, done: false });
    if (explicit) for (const id of input.scope.repositoryIds) registerRepo(id);
    else operations.push({ key: "workspaces", cursor: null, done: false });
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

  if (!explicit) reasons.add("discovery_incomplete");
  reasons.add("acceptance_time_unknown"); reasons.add("not_supported");
  const commitsComplete = operations.filter((op) => op.key.startsWith("commits:")).every((op) => op.done);
  const activityComplete = operations.filter((op) => op.key.startsWith("activity:")).every((op) => op.done);
  const eventKinds: SourceCoverage["eventKinds"] = {
    accepted_change: "partial", authored_commit: explicit && commitsComplete ? "complete" : "partial",
    review: explicit && activityComplete ? "complete" : "partial",
    issue_work: "unavailable", practice_evidence: "unavailable", documentation_design: "unavailable", maintenance: "unavailable",
  };
  const complete = Object.values(eventKinds).every((status) => status === "complete") && reasons.size === 0;
  const coverage: SourceCoverage = {
    source: { provider: "bitbucket", host: "bitbucket.org", subjectId: subjectId()! }, window, dataThrough: window.referenceTime,
    status: complete ? "complete" : "partial", discovery: explicit ? "explicit_repositories" : "owned_and_contributed",
    repositoryIds: [...repositoryIds].sort(), repositoryDiscoveryComplete: explicit,
    eventKinds, reasonCodes: [...reasons].sort(), unknownPeriods: complete ? [] : [{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }],
  };
  return { events: newEventsForCaller(), checkpoint: buildCheckpoint(), done: true, coverage, stop: null, requests: requestCount };
};
