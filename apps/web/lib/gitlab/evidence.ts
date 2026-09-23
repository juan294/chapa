import {
  engineeringEventKey, isWithinScoringWindow, observed, scoringInstant, unknown,
  type EvidenceReasonCode,
  type NormalizedEngineeringEvent, type Observation, type SourceCoverage,
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
const emptyMeasurements = emptySliceMeasurements;

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
// ---------------------------------------------------------------------------
// collectGitlabSlice (#1335 phase 3) -- checkpointed, resumable slice API,
// and the only GitLab collector implementation (the prior single-run
// `fetchGitlabEvidence` and its `collectSource` caller were removed once the
// durable queue worker became the sole production collection path).
// ---------------------------------------------------------------------------

interface GitlabMrMeta {
  readonly projectId: string; readonly iid: string; readonly globalId: string;
  authorIsSubject: boolean; merged: boolean; mergedAt?: string | null; createdAt?: string | null; sha?: string | null; description?: string | null;
}
type MutableGitlabOperation = MutableSliceOperation;
interface GitlabListOutcome { readonly kind: "done" | "stop"; readonly stop?: SourceDiagnostic }

/** Bounds an otherwise-unbounded commit history to the scoring window via
 * GitLab's native `since`/`until` commit list filters, per #1335 phase 3.
 */
export const collectGitlabSlice: CollectSlice = async (input, credential, checkpoint, budget, stagedKeys) => {
  const window = validateSliceWindow(input);
  if (!credential.token || !credential.token.trim()) throw new RangeError("GitLab collection requires a credential");
  const token = credential.token.trim();
  const explicit = input.scope.discovery === "explicit_repositories";
  const signal = AbortSignal.timeout(Math.max(0, budget.deadlineAt - Date.now()));
  const diag = createDiagnosticRecorder("gitlab");
  let requestCount = 0;

  const operations: MutableGitlabOperation[] = checkpoint.operations.map((op) => ({ key: op.key, cursor: op.cursor, done: op.done }));
  const repositoryIds = new Set(checkpoint.discovered.repositoryIds);
  const state: Record<string, unknown> = { ...(checkpoint.state ?? {}) };
  const mrMeta: Record<string, GitlabMrMeta> = { ...((state.mr as Record<string, GitlabMrMeta> | undefined) ?? {}) };
  state.mr = mrMeta;
  const mrByGlobalId: Record<string, string> = { ...((state.mrByGlobalId as Record<string, string> | undefined) ?? {}) };
  state.mrByGlobalId = mrByGlobalId;
  const reasons = new Set<EvidenceReasonCode>((state.reasons as EvidenceReasonCode[] | undefined) ?? []);
  const verifiedEmails = new Set<string>((state.verifiedEmails as string[] | undefined) ?? []);
  const newEvents = new Map<string, NormalizedEngineeringEvent>();

  function subjectId(): string | undefined { return state.subjectId as string | undefined; }
  const makeStop = makeSliceStopFactory(diag, "gitlab");
  function ensureOp(key: string): void { ensureSliceOperation(operations, key); }
  function registerRepo(projectId: string): void {
    if (repositoryIds.has(projectId)) return;
    repositoryIds.add(projectId);
    ensureOp(`commits:${projectId}`);
    ensureOp(`issues:${projectId}`);
    ensureOp(`merge_requests:${projectId}`);
  }
  function addEvent(event: NormalizedEngineeringEvent): void { newEvents.set(engineeringEventKey(event), event); }
  const projectKey = (projectId: string) => `gitlab.com:project:${projectId}`;
  const mrKey = (projectId: string, iid: string) => `${projectKey(projectId)}:mr:${iid}`;
  function inWindow(value: unknown, operation: string): boolean {
    if (!text(value)) { reasons.add(diag.record(operation, "parse")); return false; }
    try { return isWithinScoringWindow(String(value), window); } catch { reasons.add(diag.record(operation, "parse")); return false; }
  }
  function registerMr(mr: Row): GitlabMrMeta | null {
    const projectId = id(mr.project_id); const iid = id(mr.iid); const globalId = id(mr.id);
    if (!projectId || !iid || !globalId) { reasons.add(diag.record("merge_requests", "protocol")); return null; }
    if (explicit && !repositoryIds.has(projectId)) return null;
    registerRepo(projectId);
    const key = mrKey(projectId, iid);
    const meta: GitlabMrMeta = mrMeta[key] ?? { projectId, iid, globalId, authorIsSubject: false, merged: false };
    mrMeta[key] = meta; mrByGlobalId[globalId] = key;
    ensureOp(`notes:${key}`);
    if (row(mr.author).id === Number(subjectId()) && mr.state === "merged") {
      meta.authorIsSubject = true; meta.merged = true; meta.mergedAt = text(mr.merged_at); meta.createdAt = text(mr.created_at);
      meta.sha = text(mr.sha); meta.description = typeof mr.description === "string" ? mr.description : null;
      ensureOp(`details:${key}`);
    }
    return meta;
  }

  async function request(operation: string, path: string, parameters: Record<string, string> = {}): Promise<{ data: unknown; headers: Headers; stop: SourceDiagnostic | null }> {
    const budgetStop = budgetOrDeadlineStop(requestCount, budget.maxRequests, signal);
    if (budgetStop) return { data: null, headers: new Headers(), stop: makeStop(operation, budgetStop) };
    requestCount++;
    try {
      const url = new URL(`https://gitlab.com/api/v4${path}`);
      for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
      const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` }, signal, redirect: "error" });
      if (!response.ok) {
        const stopKind = classifyHttpStatus(response.status, response.headers, [401, 403, 404]);
        return { data: null, headers: response.headers, stop: makeStop(operation, stopKind, response.status, stopKind === "rate_limited" ? retryAfterSeconds(response.headers) : null) };
      }
      return { data: await response.json() as unknown, headers: response.headers, stop: null };
    } catch (error) {
      return { data: null, headers: new Headers(), stop: makeStop(operation, classifyFetchFailure(error, signal)) };
    }
  }

  /** Drains one GitLab page-numbered collection until exhausted or a
   * budget/deadline/protocol stop interrupts it, resuming from `op.cursor`
   * (the next page number, as a string) across slices.
   */
  async function runPagedList(op: MutableGitlabOperation, operation: string, path: string, parameters: Record<string, string>, onNode: (node: Row) => void): Promise<GitlabListOutcome> {
    let page = op.cursor ? Number(op.cursor) : 1;
    for (;;) {
      const r = await request(operation, path, { ...parameters, per_page: "100", page: String(page) });
      if (r.stop) {
        // A per-item fan-out fetch (never the profile/identity operation,
        // which never reaches runPagedList) that lost access -- a project
        // gone private, an MR deleted -- must not block the receipt forever.
        // Absorb it like a malformed node: one already-deduped diagnostic,
        // this operation done with whatever was collected, coverage partial.
        if (r.stop.stopKind === "not_accessible") { reasons.add("not_accessible"); op.done = true; op.cursor = null; return { kind: "done" }; }
        op.cursor = String(page); return { kind: "stop", stop: r.stop };
      }
      if (!Array.isArray(r.data)) { const stop = makeStop(operation, "protocol"); op.cursor = String(page); return { kind: "stop", stop }; }
      let pageDegraded = false;
      for (const item of r.data) {
        if (item === null || typeof item !== "object" || Array.isArray(item)) { reasons.add(diag.record(operation, "protocol")); pageDegraded = true; }
        else onNode(row(item));
      }
      // A malformed node is not retryable: this page's outgoing cursor
      // cannot certify the missing portion was read, so this operation
      // permanently accepts partial completeness here.
      if (pageDegraded) { op.done = true; op.cursor = null; return { kind: "done" }; }
      const nextHeader = r.headers.get("x-next-page");
      const link = r.headers.get("link");
      const nextLink = link?.split(",").find((part) => /rel="next"/.test(part));
      let next: number | null = null;
      if (nextHeader !== null) { if (nextHeader !== "") next = /^\d+$/.test(nextHeader) ? Number(nextHeader) : NaN; }
      else if (nextLink) {
        const target = nextLink.match(/<([^>]+)>/);
        try { const u = new URL(target?.[1] ?? ""); next = u.origin === "https://gitlab.com" && u.pathname === `/api/v4${path}` && /^\d+$/.test(u.searchParams.get("page") ?? "") ? Number(u.searchParams.get("page")) : NaN; } catch { next = NaN; }
      } else if (r.data.length === 100) next = page + 1;
      if (next !== null) {
        if (!Number.isSafeInteger(next) || next <= page) { const stop = makeStop(operation, "protocol"); op.cursor = String(page); return { kind: "stop", stop }; }
        page = next; continue;
      }
      op.done = true; op.cursor = null; return { kind: "done" };
    }
  }

  async function runProfile(op: MutableGitlabOperation): Promise<"done" | "stop"> {
    const r = await request("profile", "/user");
    if (r.stop) { pendingStop = r.stop; return "stop"; }
    const profile = row(r.data);
    if (id(profile.id) === null || typeof profile.username !== "string") { pendingStop = makeStop("profile", "protocol"); return "stop"; }
    state.subjectId = String(profile.id); state.username = profile.username; state.name = text(profile.name); state.avatarUrl = text(profile.avatar_url);
    if (text(profile.confirmed_at) && text(profile.email)) verifiedEmails.add(String(profile.email).toLowerCase());
    op.done = true; op.cursor = null;
    return "done";
  }
  async function runEmails(op: MutableGitlabOperation): Promise<"done" | "stop"> {
    const outcome = await runPagedList(op, "emails", "/user/emails", {}, (email) => { if (text(email.confirmed_at) && text(email.email)) verifiedEmails.add(String(email.email).toLowerCase()); });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }
  async function runProjects(op: MutableGitlabOperation, path: string): Promise<"done" | "stop"> {
    const outcome = await runPagedList(op, "projects", path, {}, (project) => { const projectId = id(project.id); if (projectId) registerRepo(projectId); else reasons.add(diag.record("projects", "protocol")); });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }
  async function runAuthoredMerged(op: MutableGitlabOperation): Promise<"done" | "stop"> {
    const outcome = await runPagedList(op, "merge_requests", "/merge_requests", { scope: "all", state: "merged", author_id: subjectId()!, updated_after: window.startInclusive, order_by: "updated_at", sort: "desc" }, registerMr);
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }
  async function runProjectMergeRequests(op: MutableGitlabOperation): Promise<"done" | "stop"> {
    const projectId = op.key.slice("merge_requests:".length);
    const outcome = await runPagedList(op, "merge_requests", `/projects/${projectId}/merge_requests`, { scope: "all", state: "all", order_by: "updated_at", sort: "desc" }, registerMr);
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }
  interface GitlabMrDetails { readonly id: number | null; readonly sha: string | null; readonly changesCount: number | null }
  interface GitlabDiffAcc { paths: string[]; additions: number; deletions: number; nodeCount: number; full: boolean }

  /** GET-only: resolves the merge request's own comparison identity, then
   * hands off to the persisted `diffs:<key>` operation. Splitting the GET
   * from the (potentially multi-page) diff collection means a budget that
   * cannot finish both in one slice still keeps the GET's result, instead of
   * re-fetching it every retry (#1335 phase 3 -- a stop must always be
   * resumable progress, never a reason to redo already-successful work).
   */
  async function runDetails(op: MutableGitlabOperation): Promise<"done" | "stop"> {
    const key = op.key.slice("details:".length);
    const meta = mrMeta[key];
    if (!meta || !inWindow(meta.mergedAt, "merge_requests")) { op.done = true; op.cursor = null; return "done"; }
    const path = `/projects/${meta.projectId}/merge_requests/${meta.iid}`;
    const detailsResponse = await request("merge_request", path);
    if (detailsResponse.stop) {
      if (detailsResponse.stop.stopKind === "not_accessible") {
        // The MR's details are gone (project went private, MR deleted after
        // merge): absorb like a malformed response, not a terminal stop --
        // the accepted_change event's core identity is already determined
        // from the merge_requests list; only its file measurements are lost.
        reasons.add("not_accessible");
        op.done = true; op.cursor = null;
        emitMergedEvent(meta, { paths: [], additions: 0, deletions: 0, nodeCount: 0, full: false }, false);
        return "done";
      }
      pendingStop = detailsResponse.stop; return "stop";
    }
    const details = row(detailsResponse.data);
    const mrDetails: Record<string, GitlabMrDetails> = (state.mrDetails as Record<string, GitlabMrDetails> | undefined) ?? {};
    state.mrDetails = mrDetails;
    const count = typeof details.changes_count === "string" && /^\d+$/.test(details.changes_count) ? Number(details.changes_count) : null;
    mrDetails[key] = { id: typeof details.id === "number" ? details.id : null, sha: text(details.sha), changesCount: count };
    op.done = true; op.cursor = null;
    ensureOp(`diffs:${key}`);
    return "done";
  }

  /** Builds and stages the merge's accepted_change event. Shared by `runDiffs`
   * (which computes `full` from real cross-checks) and `runDetails`'s
   * not_accessible absorption branch (which forces `full: false` since no
   * details/diffs are reachable at all).
   */
  function emitMergedEvent(meta: GitlabMrMeta, acc: GitlabDiffAcc, full: boolean): void {
    const base = mrKey(meta.projectId, meta.iid);
    if (!full) reasons.add("partial_files");
    let leadTimeHours: Observation<number> = unknown("partial", "source_error");
    try {
      const hours = (scoringInstant(String(meta.mergedAt)).getTime() - scoringInstant(String(meta.createdAt)).getTime()) / 3_600_000;
      if (hours >= 0) leadTimeHours = observed(hours, "complete", "source_observed");
    } catch { /* Missing/invalid dates remain unknown. */ }
    addEvent({
      schemaVersion: "v7", provider: "gitlab", host: "gitlab.com", subjectId: subjectId()!, actorId: subjectId()!,
      repositoryId: meta.projectId, eventId: `${base}:merged`, kind: "accepted_change", occurredAt: scoringInstant(String(meta.mergedAt)).toISOString(),
      dataThrough: window.referenceTime, canonicalProjectId: projectKey(meta.projectId), workItemId: base, artifactRevision: meta.sha ?? base,
      artifactReferenceIds: [base], attribution: "individual", provenance: "source_observed", coverage: "complete",
      categories: [],
      measurements: {
        changedFiles: full ? observed(acc.paths, "complete", "source_observed") : unknown("partial", "partial_files"),
        additions: full ? observed(acc.additions, "complete", "source_observed") : unknown("partial", "partial_files"),
        deletions: full ? observed(acc.deletions, "complete", "source_observed") : unknown("partial", "partial_files"),
        leadTimeHours, hasDescription: meta.description !== null && meta.description !== undefined ? observed(meta.description.trim().length > 0, "complete", "source_observed") : unknown("partial", "source_error"),
        hasIssueLink: unknown("unavailable", "not_supported"), usesFeatureBranch: unknown("unavailable", "not_supported"),
      },
      acceptance: observed({ method: "merged_change", acceptedAt: scoringInstant(String(meta.mergedAt)).toISOString(), acceptedResultId: base }, "complete", "source_observed"),
    });
  }

  async function runDiffs(op: MutableGitlabOperation): Promise<"done" | "stop"> {
    const key = op.key.slice("diffs:".length);
    const meta = mrMeta[key];
    const mrDetails = (state.mrDetails as Record<string, GitlabMrDetails> | undefined) ?? {};
    const details = mrDetails[key];
    if (!meta || !details) { op.done = true; op.cursor = null; return "done"; }
    const diffAcc: Record<string, GitlabDiffAcc> = (state.diffAcc as Record<string, GitlabDiffAcc> | undefined) ?? {};
    state.diffAcc = diffAcc;
    const acc = diffAcc[key] ?? (diffAcc[key] = { paths: [], additions: 0, deletions: 0, nodeCount: 0, full: true });
    const path = `/projects/${meta.projectId}/merge_requests/${meta.iid}/diffs`;
    const outcome = await runPagedList(op, "diffs", path, {}, (d) => {
      // Retain both rename sides: moving code into a docs path is not
      // docs-only, and a collapsed/oversized/overflowed diff is never a
      // measured zero even when its unified-hunk text still parses.
      for (const p of [text(d.old_path), text(d.new_path)]) if (p && !acc.paths.includes(p)) acc.paths.push(p);
      const stats = diffLines(d.diff);
      if (stats) { acc.additions += stats.additions; acc.deletions += stats.deletions; } else acc.full = false;
      if (d.collapsed === true || d.too_large === true || d.overflow === true) acc.full = false;
      acc.nodeCount++;
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    const full = acc.full && details.id === Number(meta.globalId) && meta.sha !== null && details.sha === meta.sha && details.changesCount !== null && details.changesCount === acc.nodeCount;
    emitMergedEvent(meta, acc, full);
    op.done = true; op.cursor = null;
    return "done";
  }
  async function runNotes(op: MutableGitlabOperation): Promise<"done" | "stop"> {
    const key = op.key.slice("notes:".length);
    const meta = mrMeta[key];
    if (!meta) { op.done = true; op.cursor = null; return "done"; }
    const outcome = await runPagedList(op, "notes", `/projects/${meta.projectId}/merge_requests/${meta.iid}/notes`, { order_by: "created_at", sort: "desc" }, (note) => {
      if (!id(row(note.author).id)) { reasons.add("attribution_unknown"); return; }
      if (Number(id(row(note.author).id)) !== Number(subjectId()) || note.system !== false) return;
      const noteId = id(note.id); if (!noteId) { reasons.add(diag.record("notes", "protocol")); return; }
      if (!inWindow(note.created_at, "notes")) return;
      addEvent({
        schemaVersion: "v7", provider: "gitlab", host: "gitlab.com", subjectId: subjectId()!, actorId: subjectId()!, repositoryId: meta.projectId,
        eventId: `${key}:note:${noteId}`, kind: "review", occurredAt: scoringInstant(String(note.created_at)).toISOString(), dataThrough: window.referenceTime,
        canonicalProjectId: projectKey(meta.projectId), workItemId: key, artifactRevision: `${noteId}:${text(note.created_at) ?? "unknown"}`,
        artifactReferenceIds: [`${key}:note:${noteId}`], attribution: "individual", provenance: "source_observed", coverage: "complete",
        categories: [], measurements: emptyMeasurements(), acceptance: unknown("unavailable", "not_assessed"),
      });
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }
  async function runCommits(op: MutableGitlabOperation): Promise<"done" | "stop"> {
    const projectId = op.key.slice("commits:".length);
    const outcome = await runPagedList(op, "commits", `/projects/${projectId}/repository/commits`, { with_stats: "true", since: window.startInclusive }, (commit) => {
      const sha = text(commit.id); const email = text(commit.author_email)?.toLowerCase();
      if (!sha || !email) { reasons.add("attribution_unknown"); return; }
      if (!verifiedEmails.has(email)) return;
      if (!inWindow(commit.authored_date, "commits")) return;
      const key = `${projectKey(projectId)}:commit:${sha}`;
      addEvent({
        schemaVersion: "v7", provider: "gitlab", host: "gitlab.com", subjectId: subjectId()!, actorId: subjectId()!, repositoryId: projectId,
        eventId: key, kind: "authored_commit", occurredAt: scoringInstant(String(commit.authored_date)).toISOString(), dataThrough: window.referenceTime,
        canonicalProjectId: projectKey(projectId), workItemId: key, artifactRevision: sha, artifactReferenceIds: [key],
        attribution: "individual", provenance: "source_observed", coverage: "complete", categories: [],
        measurements: { ...emptyMeasurements(), additions: measurement(row(commit.stats).additions), deletions: measurement(row(commit.stats).deletions) },
        acceptance: unknown("unavailable", "acceptance_time_unknown"),
      });
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }
  async function runIssues(op: MutableGitlabOperation): Promise<"done" | "stop"> {
    const projectId = op.key.slice("issues:".length);
    const outcome = await runPagedList(op, "issues", `/projects/${projectId}/issues`, { scope: "all", state: "all", updated_after: window.startInclusive }, (issue) => {
      const iid = id(issue.iid); if (!iid) { reasons.add(diag.record("issues", "protocol")); return; }
      ensureOp(`resource_state_events:${projectId}:${iid}`);
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }
  async function runResourceStateEvents(op: MutableGitlabOperation): Promise<"done" | "stop"> {
    const rest = op.key.slice("resource_state_events:".length);
    const [projectId, iid] = rest.split(":") as [string, string];
    const outcome = await runPagedList(op, "resource_state_events", `/projects/${projectId}/issues/${iid}/resource_state_events`, {}, (closure) => {
      if (!id(row(closure.user).id)) { reasons.add("attribution_unknown"); return; }
      if (Number(id(row(closure.user).id)) !== Number(subjectId()) || closure.state !== "closed") return;
      const closureId = id(closure.id); if (!closureId) { reasons.add(diag.record("resource_state_events", "protocol")); return; }
      if (!inWindow(closure.created_at, "resource_state_events")) return;
      const linkedKey = closure.source_merge_request_id ? mrByGlobalId[id(closure.source_merge_request_id) ?? ""] : undefined;
      const key = `${projectKey(projectId)}:issue:${iid}`;
      const refs = [
        ...(linkedKey ? [linkedKey] : id(closure.source_merge_request_id) ? [`gitlab.com:mr-id:${closure.source_merge_request_id}`] : []),
        ...(text(closure.source_commit) ? [`${projectKey(projectId)}:commit:${closure.source_commit}`] : []),
      ];
      reasons.add("attribution_unknown");
      addEvent({
        schemaVersion: "v7", provider: "gitlab", host: "gitlab.com", subjectId: subjectId()!, actorId: subjectId()!, repositoryId: projectId,
        eventId: `${key}:state:${closureId}`, kind: "issue_work", occurredAt: scoringInstant(String(closure.created_at)).toISOString(), dataThrough: window.referenceTime,
        canonicalProjectId: projectKey(projectId), workItemId: linkedKey ?? key, artifactRevision: closureId,
        artifactReferenceIds: [`${key}:state:${closureId}`, ...refs], attribution: "individual", provenance: "source_observed", coverage: "complete",
        categories: [], measurements: emptyMeasurements(), acceptance: unknown("partial", "attribution_unknown"),
      });
    });
    if (outcome.kind === "stop") { pendingStop = outcome.stop!; return "stop"; }
    return "done";
  }

  let pendingStop: SourceDiagnostic | null = null;

  async function processOperation(op: MutableGitlabOperation): Promise<"done" | "stop"> {
    if (op.key === "profile") return runProfile(op);
    if (op.key === "emails") return runEmails(op);
    if (op.key === "projects:owned") return runProjects(op, `/users/${subjectId()}/projects`);
    if (op.key === "projects:contributed") return runProjects(op, `/users/${subjectId()}/contributed_projects`);
    if (op.key === "authored_merged") return runAuthoredMerged(op);
    if (op.key.startsWith("merge_requests:")) return runProjectMergeRequests(op);
    if (op.key.startsWith("details:")) return runDetails(op);
    if (op.key.startsWith("diffs:")) return runDiffs(op);
    if (op.key.startsWith("notes:")) return runNotes(op);
    if (op.key.startsWith("commits:")) return runCommits(op);
    if (op.key.startsWith("issues:")) return runIssues(op);
    if (op.key.startsWith("resource_state_events:")) return runResourceStateEvents(op);
    op.done = true; return "done";
  }

  if (!operations.some((op) => op.key === "profile")) {
    operations.unshift({ key: "profile", cursor: null, done: false }, { key: "emails", cursor: null, done: false }, { key: "authored_merged", cursor: null, done: false });
    if (explicit) for (const projectId of input.scope.repositoryIds) registerRepo(projectId);
    else operations.push({ key: "projects:owned", cursor: null, done: false }, { key: "projects:contributed", cursor: null, done: false });
  }

  for (const op of operations) {
    if (op.done) continue;
    const outcome = await processOperation(op);
    if (outcome === "stop") break;
  }

  function buildCheckpoint() { return buildSliceCheckpoint(operations, repositoryIds, state, reasons, { verifiedEmails: [...verifiedEmails] }); }
  function newEventsForCaller(): NormalizedEngineeringEvent[] { return newSliceEvents(newEvents, stagedKeys); }

  if (pendingStop) return { events: newEventsForCaller(), checkpoint: buildCheckpoint(), done: false, coverage: null, stop: pendingStop, requests: requestCount };

  if (verifiedEmails.size === 0) reasons.add("attribution_unknown");
  if (!explicit) reasons.add("discovery_incomplete");
  reasons.add("attribution_unknown"); reasons.add("not_supported"); reasons.add("acceptance_time_unknown");
  const commitsComplete = operations.filter((op) => op.key.startsWith("commits:")).every((op) => op.done);
  const notesComplete = operations.filter((op) => op.key.startsWith("notes:")).every((op) => op.done);
  const resourceStateComplete = operations.filter((op) => op.key.startsWith("issues:") || op.key.startsWith("resource_state_events:")).every((op) => op.done);
  const eventKinds: SourceCoverage["eventKinds"] = {
    accepted_change: "partial",
    authored_commit: explicit && commitsComplete ? "complete" : "partial",
    review: explicit && notesComplete ? "complete" : "partial",
    issue_work: explicit && resourceStateComplete ? "complete" : "partial",
    practice_evidence: "unavailable", documentation_design: "unavailable", maintenance: "unavailable",
  };
  const coverage = assembleSliceCoverage({
    provider: "gitlab", host: "gitlab.com", subjectId: subjectId()!, window, explicit, repositoryIds, eventKinds, reasons,
  });
  return { events: newEventsForCaller(), checkpoint: buildCheckpoint(), done: true, coverage, stop: null, requests: requestCount };
};
