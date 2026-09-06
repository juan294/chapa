import {
  createScoringWindow, isWithinScoringWindow, observed, scoringInstant, unknown,
  type CoverageStatus, type EvidenceReasonCode, type EventMeasurements, type NormalizedEngineeringEvent,
  type Observation, type ScoringWindow, type SourceCoverage,
} from "@chapa/shared";

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
  let requestCount = 0;
  async function request(url: string, inspectRedirect = false): Promise<{ data: Row; error: EvidenceReasonCode | null; location?: string | null }> {
    if (requestCount >= maxRequests || signal.aborted) return { data: {}, error: "pagination_incomplete" as const };
    requestCount++;
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token.trim()}`, Accept: "application/json" }, signal, redirect: inspectRedirect ? "manual" : "error" });
      if (inspectRedirect && response.status === 302) return { data: {}, error: null, location: response.headers.get("location") };
      if (!response.ok) return { data: {}, error: [401, 403, 404].includes(response.status) ? "not_accessible" as const : "source_error" as const };
      const data = row(await response.json());
      return { data, error: data.type === "error" || data.error ? "source_error" as const : null };
    } catch { return { data: {}, error: "source_error" as const }; }
  }
  const makeUrl = (path: string, parameters: readonly (readonly [string, string])[] = []) => {
    const url = new URL(`${API}${path}`); url.searchParams.set("pagelen", "100");
    for (const [key, value] of parameters) url.searchParams.append(key, value);
    return url.toString();
  };
  async function collect(initialUrl: string) {
    const nodes: Row[] = []; const errors = new Set<EvidenceReasonCode>(); const seen = new Set<string>();
    const initial = new URL(initialUrl);
    let nextUrl: string | null = initialUrl; let complete = false;
    for (;;) {
      seen.add(nextUrl!);
      const response = await request(nextUrl!);
      if (response.error) { errors.add(response.error); break; }
      if (!Array.isArray(response.data.values)) { errors.add("source_error"); break; }
      for (const value of response.data.values) {
        if (value === null || typeof value !== "object" || Array.isArray(value)) errors.add("source_error");
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
        } catch { errors.add("source_error"); break; }
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
      const reason = metadata.error ?? (uuid(repo.uuid) !== repositoryId || !workspaceId ? "source_error" : null);
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
  function instant(value: unknown): string | null {
    if (!text(value)) { reasons.add("source_error"); return null; }
    try { return scoringInstant(String(value)).toISOString(); } catch { reasons.add("source_error"); return null; }
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
      else reasons.add("source_error");
    }
    // Bitbucket exposes actual commit objects across all refs. date is its
    // provider commit timestamp, never a first-default-branch reachability time.
    for (const commit of (await collect(makeUrl(`${path}/commits`))).nodes) {
      if (!isSubject(row(commit.author).user)) continue;
      const sha = hash(commit.hash); const date = instant(commit.date);
      if (!sha || !date) { reasons.add("source_error"); continue; }
      const key = `${projectKey(repositoryId)}:commit:${sha}`;
      const base = event(repositoryId, key, "authored_commit", date, key, sha);
      if (base) events.set(key, { ...base, acceptance: unknown("unavailable", "acceptance_time_unknown") });
    }
    const prs = await collect(makeUrl(`${path}/pullrequests`, [
      ["state", "OPEN"], ["state", "MERGED"], ["state", "DECLINED"], ["state", "SUPERSEDED"],
    ]));
    for (const pr of prs.nodes) {
      const prId = numericId(pr.id); if (!prId) { reasons.add("source_error"); continue; }
      const key = `${projectKey(repositoryId)}:pr:${prId}`;
      const activity = await collect(makeUrl(`${path}/pullrequests/${prId}/activity`));
      const mergeUpdates: { update: Row; date: string }[] = [];
      let invalidMergeDate = false;
      for (const entry of activity.nodes) {
        const update = row(entry.update);
        if (update.state === "MERGED") {
          const date = instant(update.date); if (date) mergeUpdates.push({ update, date }); else invalidMergeDate = true;
        }
        for (const kind of ["approval", "changes_requested", "comment"] as const) {
          if (!entry[kind]) continue;
          const detail = row(entry[kind]);
          if (!isSubject(detail.user)) continue;
          if (detail.deleted === true) { reasons.add("not_accessible"); continue; }
          const date = instant(kind === "comment" ? detail.created_on : detail.date); if (!date) continue;
          const identity = kind === "comment" ? numericId(detail.id) : `${subjectId}:${date}`;
          if (!identity) { reasons.add("source_error"); continue; }
          const eventId = `${key}:${kind}:${identity}`;
          const base = event(repositoryId, eventId, "review", date, key, kind === "comment" ? `${identity}:${instant(detail.updated_on ?? detail.created_on) ?? date}` : eventId);
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
      if (redirect.error) reasons.add(redirect.error);
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
        } catch { reasons.add("source_error"); }
      }
      progress.push({ initialUrl: redirectUrl, nextUrl: diffUrl ? null : redirectUrl, collectedNodes: 0, complete: diffUrl !== null,
        reasonCodes: diffUrl ? [] : [redirect.error ?? "source_error"] });
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
      const createdAt = instant(pr.created_on);
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
    events: [...events.values()], progress, requestCount,
    coverage: { source: { provider: "bitbucket", host: "bitbucket.org", subjectId }, window,
      dataThrough: profileResponse.error ? null : window.referenceTime, status: "partial",
      discovery: explicit ? "explicit_repositories" : "owned_and_contributed", repositoryIds: [...repositories.keys()].sort(), repositoryDiscoveryComplete,
      eventKinds, reasonCodes: [...reasons].sort(), unknownPeriods: [{ startInclusive: window.startInclusive, endExclusive: window.endExclusive }],
    },
  };
}
