import {
  engineeringEventKey, isWithinScoringWindow, observed, scoringInstant, unknown,
  type EvidenceReasonCode, type NormalizedEngineeringEvent,
  type Observation, type SourceCoverage,
} from "@chapa/shared";
import type { CollectSlice } from "@/lib/collection/plan";
import {
  assembleSliceCoverage, buildSliceCheckpoint, emptySliceMeasurements, ensureSliceOperation, makeSliceStopFactory, newSliceEvents,
  validateSliceWindow, type MutableSliceOperation,
} from "@/lib/collection/slice-helpers";
import {
  budgetOrDeadlineStop, classifyFetchFailure, classifyHttpStatus, createDiagnosticRecorder, retryAfterSeconds, type SourceDiagnostic,
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
const emptyMeasurements = emptySliceMeasurements;
const API = "https://api.bitbucket.org/2.0";
// ---------------------------------------------------------------------------
// collectBitbucketSlice (#1335 phase 3) -- checkpointed, resumable slice API,
// and the only Bitbucket collector implementation (the prior single-run
// `fetchBitbucketEvidence` and its `collectSource` caller were removed once
// the durable queue worker became the sole production collection path).
// Every repository-scoped request uses Bitbucket's `{}` empty-workspace UUID
// form, so no workspace tracking is needed once a repository UUID is known.
// ---------------------------------------------------------------------------

interface BitbucketPrMeta {
  readonly repositoryId: string;
  readonly prId: string;
  authorIsSubject: boolean;
  merged: boolean;
  createdAt?: string | null;
  description?: string | null;
  mergeCommitHash?: string | null;
}
type MutableBitbucketOperation = MutableSliceOperation;
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

export const collectBitbucketSlice: CollectSlice = async (input, credential, checkpoint, budget, stagedKeys) => {
  const window = validateSliceWindow(input);
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

  function subjectId(): string | undefined { return state.subjectId as string | undefined; }
  const makeStop = makeSliceStopFactory(diag, "bitbucket");
  function ensureOp(key: string): void { ensureSliceOperation(operations, key); }
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
    const initial = new URL(initialUrl);
    // The checkpoint is pure data with no URLs that carry a host (plan.ts) --
    // store only path+query and rebuild against the fixed API origin on resume.
    const toRelative = (absolute: string): string => { const u = new URL(absolute); return `${u.pathname}${u.search}`; };
    let url = op.cursor ? new URL(op.cursor, initial.origin).toString() : initialUrl;
    for (;;) {
      const r = await request(operation, url);
      if (r.stop) {
        // A per-item fan-out fetch that lost access (a repo gone private, a
        // PR deleted after merge) must not block the receipt forever. Absorb
        // it like a malformed node: this operation done with whatever was
        // collected, one already-deduped diagnostic, final coverage partial.
        if (r.stop.stopKind === "not_accessible") { reasons.add("not_accessible"); op.done = true; op.cursor = null; return { kind: "done" }; }
        op.cursor = toRelative(url); return { kind: "stop", stop: r.stop };
      }
      if (!Array.isArray(r.data.values)) { const stop = makeStop(operation, "protocol"); op.cursor = toRelative(url); return { kind: "stop", stop }; }
      let pageDegraded = false;
      for (const value of r.data.values) {
        if (value === null || typeof value !== "object" || Array.isArray(value)) { reasons.add(diag.record(operation, "protocol")); pageDegraded = true; }
        else onNode(row(value));
      }
      if (r.data.truncated === true || r.data.is_truncated === true || r.data.overflow === true) { reasons.add("pagination_incomplete"); pageDegraded = true; }
      // A malformed node or a provider-reported truncation is not retryable:
      // this page's outgoing cursor cannot certify the missing portion was
      // read, so this operation permanently accepts partial completeness
      // here rather than following a cursor whose provenance it cannot trust.
      if (pageDegraded) { op.done = true; op.cursor = null; return { kind: "done" }; }
      if (r.data.next === undefined || r.data.next === null || r.data.next === "") {
        if (r.data.size !== undefined && (!nonnegative(r.data.size))) reasons.add("pagination_incomplete");
        op.done = true; op.cursor = null; return { kind: "done" };
      }
      try {
        const next = new URL(String(r.data.next));
        if (next.origin !== initial.origin || next.pathname !== initial.pathname || next.username || next.password || next.hash) throw new Error("Invalid cursor");
        url = next.toString();
      } catch { const stop = makeStop(operation, "protocol"); op.cursor = toRelative(url); return { kind: "stop", stop }; }
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
    const outcome = await runPagedList(op, "workspaces", url.toString(), (permission) => {
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
    const outcome = await runPagedList(op, "repositories", url.toString(), (repo) => {
      const repositoryId = uuid(repo.uuid);
      if (!repositoryId) { reasons.add("attribution_unknown"); return; }
      registerRepo(repositoryId);
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }

  async function runCommits(op: MutableBitbucketOperation): Promise<"done" | "stop"> {
    const repositoryId = op.key.slice("commits:".length);
    const outcome = await runPagedList(op, "commits", commitsPath(repositoryId, window.startInclusive), (commit) => {
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
    const outcome = await runPagedList(op, "pullrequests", url.toString(), (pr) => {
      const prId = numericId(pr.id); if (!prId) { reasons.add(diag.record("pullrequests", "protocol")); return; }
      const key = `${projectKey(repositoryId)}:pr:${prId}`;
      prMeta[key] = {
        repositoryId, prId, authorIsSubject: isSubject(pr.author), merged: pr.state === "MERGED",
        createdAt: text(pr.created_on), description: typeof pr.description === "string" ? pr.description : null,
        mergeCommitHash: hash(row(pr.merge_commit).hash),
      };
      ensureOp(`activity:${key}`);
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }

  interface BitbucketMergeInfo { readonly mergedAt: string }
  interface BitbucketDiffAcc { paths: string[]; additions: number; deletions: number; full: boolean }

  interface BitbucketActivityAcc { dates: string[]; invalidMergeDate: boolean }

  async function runActivity(op: MutableBitbucketOperation): Promise<"done" | "stop"> {
    const key = op.key.slice("activity:".length);
    const meta = prMeta[key];
    if (!meta) { reasons.add("not_accessible"); op.done = true; op.cursor = null; return "done"; }
    // Persisted across slices: a MERGED update found on an earlier page of a
    // multi-slice pagination must not be forgotten once this op resumes.
    const activityAcc: Record<string, BitbucketActivityAcc> = (state.activityAcc as Record<string, BitbucketActivityAcc> | undefined) ?? {};
    state.activityAcc = activityAcc;
    const acc = activityAcc[key] ?? (activityAcc[key] = { dates: [], invalidMergeDate: false });
    const url = new URL(`${API}/repositories/%7B%7D/${encodeURIComponent(meta.repositoryId)}/pullrequests/${meta.prId}/activity`);
    url.searchParams.set("pagelen", "100");
    const outcome = await runPagedList(op, "activity", url.toString(), (entry) => {
      const update = row(entry.update);
      if (update.state === "MERGED") { const date = instant(update.date, "activity"); if (date) acc.dates.push(date); else acc.invalidMergeDate = true; }
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
    // A single malformed MERGED update anywhere in the history makes the
    // whole timestamp untrustworthy -- never fall back to a different, valid
    // update instead (matches the single-run adapter's `invalidMergeDate`).
    if (!meta.authorIsSubject || !meta.merged || acc.invalidMergeDate || acc.dates.length === 0) {
      if (meta.merged && meta.authorIsSubject) reasons.add("acceptance_time_unknown");
      delete activityAcc[key];
      return "done";
    }
    const mergedAt = [...acc.dates].sort((a, b) => a.localeCompare(b))[0]!;
    delete activityAcc[key];
    if (!isWithinScoringWindow(mergedAt, window)) return "done";
    const mergeInfo: Record<string, BitbucketMergeInfo> = (state.mergeInfo as Record<string, BitbucketMergeInfo> | undefined) ?? {};
    mergeInfo[key] = { mergedAt }; state.mergeInfo = mergeInfo;
    ensureOp(`diffstat:${key}`);
    return "done";
  }

  /** GET-only: resolves the diffstat redirect's authoritative comparison URL,
   * then hands off to the persisted `diff:<key>` operation. Splitting the
   * redirect resolution from the (potentially multi-page) diff collection
   * means a budget that cannot finish both in one slice keeps the redirect's
   * result instead of re-resolving it every retry -- the same fix as GitLab's
   * details:/diffs: split, applied here to close the analogous bug where a
   * tight budget reported `partial_files` even though the data was available.
   */
  async function runDiffstat(op: MutableBitbucketOperation): Promise<"done" | "stop"> {
    const key = op.key.slice("diffstat:".length);
    const meta = prMeta[key];
    if (!meta) { op.done = true; op.cursor = null; return "done"; }
    const redirectUrl = `${API}/repositories/%7B%7D/${encodeURIComponent(meta.repositoryId)}/pullrequests/${meta.prId}/diffstat`;
    const redirect = await request("diffstat", redirectUrl, { inspectRedirect: true });
    if (redirect.stop) {
      if (redirect.stop.stopKind === "not_accessible") {
        // The PR's diffstat is gone (repo went private, PR deleted after
        // merge): absorb like a malformed redirect, not a terminal stop --
        // the accepted_change event itself is already fully determined.
        reasons.add("not_accessible");
        op.done = true; op.cursor = null;
        emitAcceptedChange(key, meta, { paths: [], additions: 0, deletions: 0, full: false });
        return "done";
      }
      pendingStop = redirect.stop; return "stop";
    }
    op.done = true; op.cursor = null;
    const diffUrls: Record<string, string> = (state.diffUrl as Record<string, string> | undefined) ?? {};
    state.diffUrl = diffUrls;
    try {
      if (typeof redirect.location !== "string") throw new Error("Missing diff redirect");
      const target = new URL(redirect.location);
      // Never forward credentials via an embedded userinfo, and require an
      // immutable hash..hash (or single-hash) comparison under a real
      // repositories path -- rejects a foreign host, a mutable ref like
      // `main..develop`, and a fragment-smuggled redirect.
      if (target.origin !== "https://api.bitbucket.org" || target.username || target.password || target.hash) throw new Error("Invalid diff redirect");
      if (!/^\/2\.0\/repositories\/[^/]+\/[^/]+\/diffstat\/[a-f\d]{7,64}(?:\.\.[a-f\d]{7,64})?$/i.test(target.pathname)) throw new Error("Invalid diff redirect");
      target.searchParams.set("pagelen", "100");
      diffUrls[key] = target.toString();
      ensureOp(`diff:${key}`);
    } catch {
      // A malformed/unsafe redirect is structural, not retryable: proceed to
      // the event with unknown file measurements rather than looping forever.
      reasons.add("partial_files");
      emitAcceptedChange(key, meta, { paths: [], additions: 0, deletions: 0, full: false });
    }
    return "done";
  }

  async function runDiff(op: MutableBitbucketOperation): Promise<"done" | "stop"> {
    const key = op.key.slice("diff:".length);
    const meta = prMeta[key];
    const diffUrls = (state.diffUrl as Record<string, string> | undefined) ?? {};
    const initialUrl = diffUrls[key];
    if (!meta || !initialUrl) { op.done = true; op.cursor = null; return "done"; }
    const diffAcc: Record<string, BitbucketDiffAcc> = (state.diffAcc as Record<string, BitbucketDiffAcc> | undefined) ?? {};
    state.diffAcc = diffAcc;
    const acc = diffAcc[key] ?? (diffAcc[key] = { paths: [], additions: 0, deletions: 0, full: true });
    const outcome = await runPagedList(op, "diff", initialUrl, (value) => {
      const oldPath = text(row(value.old).path); const newPath = text(row(value.new).path);
      if (oldPath && !acc.paths.includes(oldPath)) acc.paths.push(oldPath);
      if (newPath && !acc.paths.includes(newPath)) acc.paths.push(newPath);
      if (nonnegative(value.lines_added)) acc.additions += value.lines_added; else acc.full = false;
      if (nonnegative(value.lines_removed)) acc.deletions += value.lines_removed; else acc.full = false;
      if (value.truncated === true || value.overflow === true || value.too_large === true) acc.full = false;
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    emitAcceptedChange(key, meta, acc);
    return "done";
  }

  function emitAcceptedChange(key: string, meta: BitbucketPrMeta, diff: BitbucketDiffAcc): void {
    const mergeInfo = (state.mergeInfo as Record<string, BitbucketMergeInfo> | undefined)?.[key];
    if (!mergeInfo) { reasons.add("not_accessible"); return; }
    const mergedAt = mergeInfo.mergedAt;
    if (!diff.full) reasons.add("partial_files");
    let leadTimeHours: Observation<number> = unknown("partial", "source_error");
    const createdAt = meta.createdAt ? instant(meta.createdAt, "pullrequests") : null;
    if (createdAt) {
      const hours = (scoringInstant(mergedAt).getTime() - scoringInstant(createdAt).getTime()) / 3_600_000;
      if (hours >= 0) leadTimeHours = observed(hours, "complete", "source_observed");
    }
    addEvent({
      schemaVersion: "v7", provider: "bitbucket", host: "bitbucket.org", subjectId: subjectId()!, actorId: subjectId()!, repositoryId: meta.repositoryId,
      eventId: `${key}:merged`, kind: "accepted_change", occurredAt: mergedAt, dataThrough: window.referenceTime, canonicalProjectId: projectKey(meta.repositoryId),
      workItemId: key, artifactRevision: key,
      artifactReferenceIds: [`${key}:merged`, ...(meta.mergeCommitHash ? [`${projectKey(meta.repositoryId)}:commit:${meta.mergeCommitHash}`] : [])],
      attribution: "individual", provenance: "source_observed", coverage: "complete",
      categories: [],
      measurements: {
        ...emptyMeasurements(), leadTimeHours,
        changedFiles: diff.full ? observed(diff.paths, "complete", "source_observed") : unknown("partial", "partial_files"),
        additions: diff.full ? observed(diff.additions, "complete", "source_observed") : unknown("partial", "partial_files"),
        deletions: diff.full ? observed(diff.deletions, "complete", "source_observed") : unknown("partial", "partial_files"),
        hasDescription: meta.description !== null && meta.description !== undefined ? observed(meta.description.trim().length > 0, "complete", "source_observed") : unknown("partial", "source_error"),
      },
      acceptance: observed({ method: "merged_change", acceptedAt: mergedAt, acceptedResultId: `${key}:merged` }, "complete", "source_observed"),
    });
  }

  let pendingStop: SourceDiagnostic | null = null;

  async function processOperation(op: MutableBitbucketOperation): Promise<"done" | "stop"> {
    if (op.key === "profile") return runProfile(op);
    if (op.key === "workspaces") return runWorkspaces(op);
    if (op.key.startsWith("workspace-repos:")) return runWorkspaceRepos(op);
    if (op.key.startsWith("commits:")) return runCommits(op);
    if (op.key.startsWith("pullrequests:")) return runPullRequests(op);
    if (op.key.startsWith("activity:")) return runActivity(op);
    if (op.key.startsWith("diffstat:")) return runDiffstat(op);
    if (op.key.startsWith("diff:")) return runDiff(op);
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

  function buildCheckpoint() { return buildSliceCheckpoint(operations, repositoryIds, state, reasons); }
  function newEventsForCaller(): NormalizedEngineeringEvent[] { return newSliceEvents(newEvents, stagedKeys); }

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
  const coverage = assembleSliceCoverage({
    provider: "bitbucket", host: "bitbucket.org", subjectId: subjectId()!, window, explicit, repositoryIds, eventKinds, reasons,
  });
  return { events: newEventsForCaller(), checkpoint: buildCheckpoint(), done: true, coverage, stop: null, requests: requestCount };
};
