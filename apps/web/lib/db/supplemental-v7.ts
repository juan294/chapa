import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { scoringInstant, type ScoringWindow } from "@chapa/shared";
import { cacheDel, cacheGet, cacheSet } from "@/lib/cache/redis";
import { SupplementalEvidenceConflict, ageSupplementalEvidence, parseSupplementalEvidenceV2, type StoredSupplementalEvidenceV2 } from "@/lib/platform/evidence-aging";
import { getSupabase } from "./supabase";

interface ManifestEntry { readonly uploadId: string; readonly uploadedAt: string }
interface CachedPortfolio { readonly owner: string; readonly manifest: readonly ManifestEntry[]; readonly records: readonly StoredSupplementalEvidenceV2[] }
const MAX_UPLOADS_PER_READ = 1000;
function storage() {
  const db = getSupabase();
  if (!db) throw new Error("Supplemental evidence storage unavailable");
  return db;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function entry(value: unknown): ManifestEntry {
  if (!value || typeof value !== "object") throw new Error("Invalid supplemental manifest entry");
  const row = value as Record<string, unknown>;
  if (typeof row.uploadId !== "string" || !row.uploadId || row.uploadId.length > 256 || typeof row.uploadedAt !== "string") throw new Error("Invalid supplemental manifest entry");
  return { uploadId: row.uploadId, uploadedAt: scoringInstant(row.uploadedAt).toISOString() };
}
function manifest(value: unknown): readonly ManifestEntry[] {
  if (!Array.isArray(value) || value.length > MAX_UPLOADS_PER_READ) throw new Error("Supplemental evidence manifest unavailable or exceeds read budget");
  const entries = value.map(entry).sort((a, b) => a.uploadId.localeCompare(b.uploadId, "en"));
  if (new Set(entries.map(item => item.uploadId)).size !== entries.length) throw new Error("Duplicate supplemental manifest identity");
  return entries;
}
function record(value: unknown, owner: string): StoredSupplementalEvidenceV2 {
  const identity = entry(value);
  return { ...identity, value: parseSupplementalEvidenceV2((value as Record<string, unknown>).value, owner, identity.uploadedAt) };
}
function records(value: unknown, owner: string, expected: readonly ManifestEntry[]): readonly StoredSupplementalEvidenceV2[] {
  if (!Array.isArray(value) || canonical(manifest(value)) !== canonical(expected)) throw new Error("Supplemental evidence payload differs from committed manifest");
  return value.map(item => record(item, owner)).sort((a, b) => a.uploadId.localeCompare(b.uploadId, "en"));
}

/** Only immutable database rows returned by the transaction may become visible to a cache consumer. */
export async function dbStoreSupplementalEvidenceV2(owner: string, value: unknown, referenceTime: string): Promise<StoredSupplementalEvidenceV2> {
  const lower = owner.toLowerCase();
  const parsed = parseSupplementalEvidenceV2(value, lower, referenceTime);
  const { data, error } = await storage().rpc("scoring_v7_store_supplemental", {
    p_owner: lower, p_actor: lower, p_upload: randomUUID(),
    p_digest: createHash("sha256").update(canonical(parsed)).digest("hex"), p_value: parsed,
  });
  if (error?.code === "23505") throw new SupplementalEvidenceConflict();
  if (error || !data) throw new Error("Supplemental evidence persistence failed");
  return record(data, lower);
}

/** Private source projection for server scoring. Public routes must emit only receipt allowlists. */
export async function readSupplementalEvidenceV2(owner: string, window: ScoringWindow) {
  const lower = owner.toLowerCase(), key = `supplemental:v7:${lower}`;
  const { data, error } = await storage().rpc("scoring_v7_supplemental_manifest", {
    p_owner: lower, p_actor: lower, p_reference: window.referenceTime, p_limit: MAX_UPLOADS_PER_READ + 1,
  });
  if (error) throw new Error("Supplemental evidence manifest read failed");
  const current = manifest(data);
  const cached = await cacheGet<CachedPortfolio>(key).catch(() => null);
  let stored: readonly StoredSupplementalEvidenceV2[] | null = null;
  if (cached?.owner === lower && canonical(cached.manifest) === canonical(current)) {
    try { stored = records(cached.records, lower, current); } catch { /* Durable rows repair malformed or stale cache payloads. */ }
  }
  let cacheRefreshed = stored !== null;
  if (!stored) {
    const result = current.length ? await storage().rpc("scoring_v7_read_supplemental", {
      p_owner: lower, p_actor: lower, p_upload_ids: current.map(item => item.uploadId), p_reference: window.referenceTime,
    }) : { data: [], error: null };
    if (result.error) throw new Error("Supplemental evidence payload read failed");
    stored = records(result.data, lower, current);
    const published = await cacheSet(key, { owner: lower, manifest: current, records: stored }, 86400).catch(() => false);
    cacheRefreshed = published || await cacheDel(key).catch(() => false);
  }
  // Aging is applied after either source path; the cache never contains a frozen annual score.
  return { evidence: ageSupplementalEvidence(stored, lower, window), cacheRefreshed };
}
