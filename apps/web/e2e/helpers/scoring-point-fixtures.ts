/** Disposable browser fixture only; never imported by application runtime. */
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalJson, canonicalSha256, createScoringWindow, DEFAULT_BADGE_CONFIG, type CoreCountInputs, type PublicObservedCraft, type StatsData } from "@chapa/shared";
import { observedReceiptFixture } from "../../lib/history/__fixtures__/receipts-observed";
import { calculateReportCraftInputs } from "../../lib/insights/report-craft";
import { observedSemanticIdentity } from "../../lib/profile/receipt-semantic-identity";
import { DEMO_IMPACT } from "../../lib/render/demoData";
import { buildStatsCacheEnvelope, statsCacheBindingBytes } from "../../lib/cache/stats-cache-envelope";
import { buildRedesignGitHubFixture } from "./redesign-github";
import { localCandidateTarget } from "./local-candidate";

/** Mirrors `FRESH_SECONDS` in `lib/cache/stats-cache.ts` (that module cannot
 * be imported here — see `stats-cache-envelope.ts`'s header). Kept as a
 * literal rather than re-derived so a change to the real constant is a
 * visible diff here too. */
const STATS_CACHE_FRESH_SECONDS = 6 * 60 * 60;

export const SCORING_POINT_HANDLES = ["chapa-score-chromium", "chapa-score-mobile", "chapa-score-expired", "chapa-score-boundary"] as const;
const DAY = 86_400_000;
export function assertScoringFixtureEnvironment(env: Record<string, string | undefined>): void {
  localCandidateTarget("local", "local-candidate", env.SUPABASE_URL ?? "");
  if (new URL(env.SUPABASE_URL!).port !== "55331") throw new Error("Dedicated scoring fixture database must use port 55331");
  if (env.REDESIGN_DISPOSABLE_PROJECT !== "chapa-redesign") throw new Error("Disposable scoring project acknowledgment required");
}
export function scoringReportHtml(point: 57 | 0, referenceTime: string): string {
  const time = Date.parse(referenceTime);
  if (!Number.isFinite(time)) throw new Error("Invalid fixture clock");
  const day = (offset: number) => new Date(time + offset * DAY).toISOString().slice(0, 10);
  return readFileSync(resolve(__dirname, `../fixtures/scoring-point/report-${point}.html`), "utf8").replace("{{START}}", day(-7)).replace("{{END}}", day(-1));
}
export async function buildScoringPointSeeds(referenceTime: string) {
  const window = createScoringWindow(referenceTime);
  return Promise.all(SCORING_POINT_HANDLES.map(async handle => {
    let craft: PublicObservedCraft = { status: "no_report", unlocked: false, report: null };
    if (handle.endsWith("expired")) {
      const old = Date.parse(referenceTime) - 500 * DAY;
      const calculation = calculateReportCraftInputs({ policyVersion: "v7.2", classifierRevision: "cc-outcomes-v7.2", window: createScoringWindow(new Date(old).toISOString()), reportPeriod: { startInclusive: new Date(old - 7 * DAY).toISOString(), endExclusive: new Date(old).toISOString() }, totalSessions: 10, outcomes: { fully_achieved: 4, mostly_achieved: 2, partially_achieved: 1, not_achieved: 1 }, unknownSessions: 1, unclassifiedSessions: 1 });
      if (calculation.status !== "valid" || calculation.result.status !== "scored") throw new Error("Invalid expired fixture");
      craft = { status: "expired", unlocked: true, report: null, lastReport: { reportRef: randomUUID(), supersedesReportRef: null, inputs: calculation.inputs, result: calculation.result } };
    }
    const fixed = (n: number) => ({ lower: n, upper: n });
    const counts: CoreCountInputs | undefined = handle.endsWith("boundary") ? { deliveryUnits: fixed(14), quality: { rationale: fixed(1), verification: fixed(1), review_or_correction: fixed(1), outcome_followup: fixed(1) }, activeIsoWeeks: fixed(35), eligibleProjects: fixed(4), eligibleCategories: fixed(4) } : undefined;
    const envelope = await observedReceiptFixture({ referenceTime: window.referenceTime, craft, counts });
    const stats = buildRedesignGitHubFixture(handle, referenceTime).stats;
    const legacyImpact = { ...DEMO_IMPACT, handle, adjustedComposite: 80, compositeScore: 80, archetype: "Builder" as const, dimensions: { delivery: 100, quality: 74, consistency: 67, breadth: 71, craft: 83 }, computedAt: referenceTime };
    return { handle, envelope, stats, legacyImpact };
  }));
}
/** The existing fixture session uses the same local-only token as the server.
 * Bind stats to that actual credential; never weaken the production cache.
 * Mirrors `createSourceContext`'s `accessContextId` bytes exactly (that
 * module also carries `import "server-only"` and cannot be imported here),
 * then signs `statsCacheBindingBytes` — the pure, shared bytes builder in
 * `stats-cache-envelope.ts` — so the binding itself can never drift from
 * `statsCacheBinding`'s domain string or field shape. */
export function fixtureStatsBinding(handle: string, secret: string, token: string) {
  const accessContextId = createHmac("sha256", secret).update(canonicalJson({ version: "source-context-v1", owner: handle, requestedSource: { provider: "github", host: "github.com", login: handle }, scope: { discovery: "legacy_upload", repositoryIds: [], eventKinds: [] }, link: null, credential: token })).digest("hex");
  return createHmac("sha256", secret).update(statsCacheBindingBytes({ accessContextId, links: "unlinked|unlinked|unlinked" })).digest("hex");
}

/** Seeds the exact `{ schemaVersion: 2, ... }` envelope `readCachedStats`
 * accepts as `fresh`, via the same pure builder `writeCachedStats` uses. */
export function fixtureStatsCacheEntry(handle: string, referenceDate: string, secret: string, token: string, stats: StatsData, now = new Date()): string {
  const binding = fixtureStatsBinding(handle, secret, token);
  return JSON.stringify(buildStatsCacheEnvelope(binding, referenceDate, stats, now, STATS_CACHE_FRESH_SECONDS));
}
export async function bootstrapScoringPointFixtures(db: SupabaseClient, options: { referenceTime: string }) {
  assertScoringFixtureEnvironment(process.env);
  const secret = process.env.NEXTAUTH_SECRET, signing = process.env.CHAPA_VERIFICATION_SECRET, token = process.env.GITHUB_TOKEN;
  if (!secret || !signing || token !== "redesign-local-fixture") throw new Error("Explicit local fixture secrets/token required");
  const check = async <T extends { error: unknown }>(operation: PromiseLike<T>): Promise<T> => { const result = await operation; if (result.error) throw result.error; return result; };
  const existing = await check(db.from("users").select("handle").in("handle", [...SCORING_POINT_HANDLES]));
  if (existing.data?.length) throw new Error("Refusing to overwrite scoring fixture owners");
  const flag = await check(db.from("feature_flags").select("*").eq("key", "scoring_v7_rendering"));
  const cleanup = async () => {
    const errors: unknown[] = [];
    for (const owner of SCORING_POINT_HANDLES) await check(db.rpc("scoring_v7_withdraw", { p_owner: owner })).catch(error => errors.push(error));
    for (const table of ["verification_records", "studio_configs", "tool_insights", "metrics_snapshots", "users"]) await check(db.from(table).delete().in("handle", [...SCORING_POINT_HANDLES])).catch(error => errors.push(error));
    await check(db.from("feature_flags").delete().eq("key", "scoring_v7_rendering")).catch(error => errors.push(error));
    if (flag.data?.length) await check(db.from("feature_flags").upsert(flag.data, { onConflict: "key" })).catch(error => errors.push(error));
    for (const table of ["scoring_v7_subjects", "scoring_v7_sources", "scoring_v7_evidence", "scoring_v7_raw_artifacts", "scoring_v7_receipts", "scoring_observed_current", "report_craft_reports", "report_craft_selection"]) {
      const residue = await check(db.from(table).select("owner_handle").in("owner_handle", [...SCORING_POINT_HANDLES])).catch(error => { errors.push(error); return null; });
      if (residue?.data?.length) errors.push(new Error(`Scoring fixture residue in ${table}`));
    }
    const tombstones = await check(db.from("scoring_v7_revocations").select("receipt_id", { count: "exact", head: true }));
    // Content-free tombstones intentionally survive withdrawal until the dedicated task database is disposed.
    console.info(`[scoring fixture cleanup] dedicated55331 retained ${tombstones.count ?? 0} content-free revocation tombstones`);
    if (errors.length) throw new AggregateError(errors, "Scoring fixture cleanup failed");
  };
  try {
    await check(db.from("feature_flags").upsert({ key: "scoring_v7_rendering", enabled: true, config: {}, description: "Disposable scoring qualification" }, { onConflict: "key" }));
    const seeds = await buildScoringPointSeeds(options.referenceTime);
    const cache: Record<string, string> = {};
    const owners: Record<string, { revisionId: string; receiptId: string; contentHash: string; verificationToken: string }> = {};
    for (const seed of seeds) {
      const { handle, envelope, stats, legacyImpact } = seed; const receipt = envelope.receipt;
      await check(db.from("users").insert({ handle, display_name: handle }));
      await check(db.from("studio_configs").insert({ handle, config: DEFAULT_BADGE_CONFIG }));
      await check(db.from("tool_insights").insert({ handle, tool: "claude-code", report_start: receipt.window.referenceDate, report_end: receipt.window.referenceDate, raw_data: { sentinel: "SCORING_PRIVATE_SENTINEL" }, proficiency: 83, effectiveness: 83, sophistication: 83, craft_score: 83, craft_tier: "Expert" }));
      await check(db.from("metrics_snapshots").insert({ handle, date: receipt.window.referenceDate, captured_at: options.referenceTime, commits_total: stats.commitsTotal, prs_merged_count: stats.prsMergedCount, prs_merged_weight: stats.prsMergedWeight, reviews_submitted: stats.reviewsSubmittedCount, issues_closed: stats.issuesClosedCount, repos_contributed: stats.reposContributed, active_days: stats.activeDays, lines_added: stats.linesAdded, lines_deleted: stats.linesDeleted, total_stars: stats.totalStars, total_forks: stats.totalForks, total_watchers: stats.totalWatchers, top_repo_share: stats.topRepoShare, building: 100, guarding: 74, consistency: 67, breadth: 71, archetype: "Builder", profile_type: legacyImpact.profileType, composite_score: 80, adjusted_composite: 80, confidence: 90, tier: "High", craft: 83 }));
      await check(db.rpc("scoring_v7_ensure_subject", { p_owner: handle }));
      const coreDigest = await canonicalSha256({ fixture: "scoring-point-v1", counts: receipt.inputs.counts });
      await check(db.rpc("scoring_observed_publish_receipt", { p_owner: handle, p_actor: handle, p_receipt: receipt, p_canonical: canonicalJson(receipt), p_semantic_digest: await observedSemanticIdentity(coreDigest, receipt.craft), p_core_semantic_digest: coreDigest }));
      const signature = createHmac("sha256", signing).update(canonicalJson(receipt)).digest("hex");
      await check(db.rpc("scoring_v7_issue_verification", { p_owner: handle, p_actor: handle, p_revision: receipt.revisionId, p_key_version: "v7-1", p_signature: signature, p_canonical: canonicalJson(receipt) }));
      cache[`stats:v3:${handle}`] = fixtureStatsCacheEntry(handle, receipt.window.referenceDate, secret, token, stats, new Date(options.referenceTime));
      cache[`stats:stale:v2:${handle}`] = JSON.stringify(stats);
      owners[handle] = { revisionId: receipt.revisionId, receiptId: receipt.receiptId, contentHash: envelope.contentHash.value, verificationToken: `v7.${receipt.revisionId}.${signature}` };
    }
    return { cache, publicManifest: { referenceTime: options.referenceTime, owners }, cleanup };
  } catch (error) { try { await cleanup(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], "Scoring bootstrap and cleanup failed"); } throw error; }
}
