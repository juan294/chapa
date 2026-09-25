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
const emptyMeasurements = emptySliceMeasurements;
const API = "https://codeberg.org/api/v1";
// ---------------------------------------------------------------------------
// collectCodebergSlice (#1335 phase 3) -- checkpointed, resumable slice API,
// and the only Codeberg collector implementation (the prior single-run
// `fetchCodebergEvidence` and its `collectSource` caller were removed once
// the durable queue worker became the sole production collection path).
// ---------------------------------------------------------------------------

interface CodebergPrMeta {
  readonly repositoryId: string; readonly fullName: string; readonly prId: string;
  authorIsSubject: boolean; merged: boolean; mergedAt?: string | null; createdAt?: string | null; description?: string | null;
  mergeCommitSha?: string | null; headSha?: string | null; changedFiles?: number | null; additions?: number | null; deletions?: number | null;
}
type MutableCodebergOperation = MutableSliceOperation;
interface CodebergListOutcome { readonly kind: "done" | "stop"; readonly stop?: SourceDiagnostic }

/** Operations that can still add operations (contract: `computeDiscoveryComplete`,
 * #1342). From this file's call sites: `repos:own`/`repos:user` and `feeds`
 * register discovered repositories; `pulls:*` always queues a `reviews:`
 * operation and, for a subject-authored merge, a `refs:` operation; `refs:*`
 * queues a `files:` operation on both its success path and its
 * `not_accessible` absorb path; `issues:*` queues a `timeline:` operation per
 * issue. `profile`, `commits:*`, `files:*`, `reviews:*` and `timeline:*`
 * never add operations. */
export const CODEBERG_EXPANDING_OPERATIONS = ["repos:own", "repos:user", "feeds", "pulls:", "refs:", "issues:"] as const;

export const collectCodebergSlice: CollectSlice = async (input, credential, checkpoint, budget, stagedKeys) => {
  const window = validateSliceWindow(input);
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

  function subjectId(): string | undefined { return state.subjectId as string | undefined; }
  const makeStop = makeSliceStopFactory(diag, "codeberg");
  function ensureOp(key: string): void { ensureSliceOperation(operations, key); }
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
      if (r.stop) {
        // A per-item fan-out fetch (never the profile/identity operation,
        // which never reaches runPagedList) that lost access -- a repo gone
        // private, a PR deleted -- must not block the receipt forever.
        // Absorb it like a malformed node: one already-deduped diagnostic,
        // this operation done with whatever was collected, coverage partial.
        if (r.stop.stopKind === "not_accessible") { reasons.add("not_accessible"); op.done = true; op.cursor = null; return { kind: "done" }; }
        op.cursor = String(page); return { kind: "stop", stop: r.stop };
      }
      if (!Array.isArray(r.data)) { const stop = makeStop(operation, "protocol"); op.cursor = String(page); return { kind: "stop", stop }; }
      let pageDegraded = false;
      for (const value of r.data) {
        if (value === null || typeof value !== "object" || Array.isArray(value)) { reasons.add(diag.record(operation, "protocol")); pageDegraded = true; }
        else onNode(row(value));
      }
      // A malformed node is not retryable: this page's outgoing cursor
      // cannot certify the missing portion was read, so this operation
      // permanently accepts partial completeness here.
      if (pageDegraded) { op.done = true; op.cursor = null; return { kind: "done" }; }
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
    if (r.stop) {
      if (r.stop.stopKind === "not_accessible") {
        // The PR's ref is gone (repo went private, PR deleted after merge):
        // absorb like any other lost-access fan-out item. Files remain
        // independently attempted -- refsVerified simply stays unset (false).
        reasons.add("not_accessible");
        op.done = true; op.cursor = null;
        ensureOp(`files:${key}`);
        return "done";
      }
      pendingStop = r.stop; return "stop";
    }
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
    if (!meta || !meta.mergedAt || !isMergedDateInWindow(meta.mergedAt, window)) { op.done = true; op.cursor = null; return "done"; }
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
        workItemId: key, artifactRevision: meta.mergeCommitSha ?? key,
        artifactReferenceIds: [`${key}:merged`, ...(meta.mergeCommitSha ? [`${projectKey(meta.repositoryId)}:commit:${meta.mergeCommitSha}`] : [])],
        attribution: "individual",
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

  function buildCheckpoint() { return buildSliceCheckpoint(operations, repositoryIds, state, reasons); }
  function newEventsForCaller(): NormalizedEngineeringEvent[] { return newSliceEvents(newEvents, stagedKeys); }
  const discoveryComplete = computeDiscoveryComplete(operations, CODEBERG_EXPANDING_OPERATIONS);

  if (pendingStop) return { events: newEventsForCaller(), checkpoint: buildCheckpoint(), done: false, coverage: null, stop: pendingStop, requests: requestCount, discoveryComplete };

  reasons.add("discovery_incomplete"); reasons.add("acceptance_time_unknown"); reasons.add("not_supported");
  const commitsComplete = operations.filter((op) => op.key.startsWith("commits:")).every((op) => op.done);
  const reviewsComplete = operations.filter((op) => op.key.startsWith("reviews:")).every((op) => op.done);
  const timelineComplete = operations.filter((op) => op.key.startsWith("issues:") || op.key.startsWith("timeline:")).every((op) => op.done);
  const eventKinds: SourceCoverage["eventKinds"] = {
    accepted_change: "partial", authored_commit: explicit && commitsComplete ? "complete" : "partial",
    review: explicit && reviewsComplete ? "complete" : "partial", issue_work: explicit && timelineComplete ? "complete" : "partial",
    practice_evidence: "unavailable", documentation_design: "unavailable", maintenance: "unavailable",
  };
  const coverage = assembleSliceCoverage({
    provider: "codeberg", host: "codeberg.org", subjectId: subjectId()!, window, explicit, repositoryIds, eventKinds, reasons,
  });
  return { events: newEventsForCaller(), checkpoint: buildCheckpoint(), done: true, coverage, stop: null, requests: requestCount, discoveryComplete };
};

/** `meta.mergedAt` is a raw provider timestamp string that has not yet been
 * through `instant()`'s own parse-diagnostic path -- this is a cheap gate
 * ("is it even worth fetching files for this merge?"), so a malformed date
 * here safely reads as "not in window" rather than throwing. */
function isMergedDateInWindow(value: string, window: ScoringWindow): boolean {
  try { return isWithinScoringWindow(value, window); } catch { return false; }
}
