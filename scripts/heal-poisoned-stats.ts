#!/usr/bin/env tsx
/**
 * Read-only historical scoring inspection. The old activity-based purge and
 * --apply mode are retired: zero PRs, small changes, scope labels and upload
 * timestamps cannot establish corruption or authorize deletion.
 *
 * Usage: tsx scripts/heal-poisoned-stats.ts <handle> [<handle>...]
 * Reads only explicitly named owners' two legacy caches and up to 1000 stored
 * snapshots. Reports observed subject contradictions, not a certificate of
 * source completeness. Legacy records generally lack source/window/page proof
 * and remain unproven. A later repair requires a separately reviewed procedure.
 * Credentials are loaded only after every argument passes validation.
 */
import { createHash } from "node:crypto";
import { loadConfig, type Config } from "./lib/env";
export type { Config };

const RETIRED = "Automatic repair is retired; this command is read-only.";
const ROW_LIMIT = 1000;
export function normalizeHandle(raw: string): string {
  const handle = raw.trim().toLowerCase();
  if (!/^[a-z0-9-]{1,39}$/.test(handle)) throw new Error("Invalid handle.");
  return handle;
}
export function parseArgs(argv: string[]): { handles: string[] } {
  if (argv.some(arg => arg === "--apply" || arg.startsWith("--apply="))) throw new Error(RETIRED);
  if (argv.some(arg => arg.startsWith("-"))) throw new Error("Unknown option; only handle arguments are supported.");
  if (!argv.length) throw new Error("Missing required handle argument.");
  return { handles: [...new Set(argv.map(normalizeHandle))] };
}
export function mergedStatsKey(handle: string): string { return `stats:v2:merged:${handle}`; }
export function staleStatsKey(handle: string): string { return `stats:stale:v2:${handle}`; }

interface RecordLocation {
  kind: "merged_cache" | "stale_cache" | "metrics_snapshot";
  owner: string;
  recordId: string;
}
export interface RecordInspection extends RecordLocation {
  status: "missing" | "uninterpretable" | "unproven" | "recorded_contradiction";
  /** Private review binding only; never source truth, authorization or public evidence. */
  contentSha256: string | null;
  reasons: ("subject_mismatch")[];
}
/**
 * Compare the stored subject to the independently selected owner. This is a
 * recorded contradiction only; it does not identify which side is correct.
 * A digest binds exact observed content, but is never itself corruption proof.
 * Returned metadata excludes the record body. CLI logs omit even these private
 * identities/digests; an authorized caller can retain them for a separate review.
 */
export function inspectRecord(location: RecordLocation, raw: string | null): RecordInspection {
  const result: RecordInspection = {
    ...location, status: "missing", contentSha256: raw === null ? null : createHash("sha256").update(raw).digest("hex"), reasons: [],
  };
  if (raw === null) return result;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { ...result, status: "uninterpretable" }; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...result, status: "uninterpretable" };
  const subject = (value as Record<string, unknown>).handle;
  if (typeof subject === "string" && /^[a-z0-9-]{1,39}$/i.test(subject) && subject.toLowerCase() !== location.owner) {
    return { ...result, status: "recorded_contradiction", reasons: ["subject_mismatch"] };
  }
  return { ...result, status: "unproven" };
}

async function read(url: string, headers: Record<string, string>): Promise<Response> {
  try {
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) throw new Error();
    return response;
  } catch { throw new Error("Historical inspection read failed"); }
}
async function readCache(cfg: Config, key: string): Promise<string | null> {
  const response = await read(`${cfg.redisUrl}/GET/${encodeURIComponent(key)}`, { Authorization: `Bearer ${cfg.redisToken}` });
  try {
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || !("result" in body) || "error" in body) throw new Error();
    const value = body.result;
    if (value === null || typeof value === "string") return value;
    throw new Error();
  } catch { throw new Error("Historical inspection read failed"); }
}
function snapshotEnumeration(contentRange: string | null, count: number): "complete" | "partial" {
  // PostgREST may cap responses independently of our requested limit. Only an
  // exact count and matching range can establish complete enumeration here.
  if (contentRange === "*/0" && count === 0) return "complete";
  const match = contentRange?.match(/^0-(\d+)\/(\d+)$/);
  if (!match) return "partial";
  const end = Number(match[1]); const total = Number(match[2]);
  return Number.isSafeInteger(total) && Number.isSafeInteger(end) && end + 1 === count && total === count ? "complete" : "partial";
}
export interface HealResult {
  mode: "dry_run";
  snapshotEnumeration: "complete" | "partial";
  records: RecordInspection[];
}
/** Old programmatic callers passing true must fail before any configuration/I/O. */
export async function healHandle(cfg: Config, rawHandle: string, apply = false): Promise<HealResult> {
  if (apply !== false) throw new Error(RETIRED);
  const handle = normalizeHandle(rawHandle);
  const records: RecordInspection[] = [];
  for (const kind of ["merged_cache", "stale_cache"] as const) {
    const recordId = kind === "merged_cache" ? mergedStatsKey(handle) : staleStatsKey(handle);
    records.push(inspectRecord({ kind, owner: handle, recordId }, await readCache(cfg, recordId)));
  }
  const response = await read(`${cfg.supaUrl}/rest/v1/metrics_snapshots?handle=eq.${handle}&select=*&order=id.asc&limit=${ROW_LIMIT}`, {
    apikey: cfg.supaKey, Authorization: `Bearer ${cfg.supaKey}`, Prefer: "count=exact",
  });
  try {
    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length > ROW_LIMIT) throw new Error();
    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row) || !Number.isSafeInteger(row.id) || row.id <= 0) throw new Error();
      records.push(inspectRecord({ kind: "metrics_snapshot", owner: handle, recordId: String(row.id) }, JSON.stringify(row)));
    }
    return { mode: "dry_run", snapshotEnumeration: snapshotEnumeration(response.headers.get("content-range"), rows.length), records };
  } catch { throw new Error("Historical inspection read failed"); }
}
export async function run(rawArgs: string[]): Promise<void> {
  const { handles } = parseArgs(rawArgs);
  const cfg = loadConfig();
  console.log("Read-only historical inspection. No records are changed or deleted.");
  for (let i = 0; i < handles.length; i++) {
    const result = await healHandle(cfg, handles[i]!);
    const count = (status: RecordInspection["status"]) => result.records.filter(record => record.status === status).length;
    console.log(`Subject ${i + 1}: ${count("recorded_contradiction")} recorded contradictions; ${count("unproven")} unproven; ${count("uninterpretable")} uninterpretable; ${count("missing")} missing. Snapshot enumeration: ${result.snapshotEnumeration}.`);
  }
  console.log("Unproven does not mean correct: legacy records lack source/window/pagination proof. Activity and upload age are not corruption evidence. No automatic repair is available.");
}
const isDirectRun = typeof process !== "undefined" && !!process.argv[1] &&
  (process.argv[1].endsWith("heal-poisoned-stats.ts") || process.argv[1].endsWith("heal-poisoned-stats"));
if (isDirectRun) {
  run(process.argv.slice(2)).catch(() => {
    console.error("Historical inspection failed. Only valid handles and read-only inspection are supported.");
    process.exit(1);
  });
}
