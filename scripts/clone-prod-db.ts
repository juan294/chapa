/**
 * Copy the production database into the local Supabase stack, over PostgREST.
 *
 * Local dev runs `develop`, whose migrations production has not seen, so a
 * local stack pointed at production is wrong in one direction and a local
 * stack with an empty database is wrong in the other: `/api/generate` fails on
 * missing v7 tables, `/admin` shows nobody, and the landing leaderboard has
 * nothing to rank. This gives the local schema production's rows.
 *
 * Usage:
 *   pnpm run clone-prod-db <production-env-file> [target-env-file]
 *
 * Both files are read for `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the
 * target defaults to `apps/web/.env.local`. Nothing is written to production —
 * the target must be a local host, and the script refuses otherwise.
 *
 * Get the production values without them passing through a terminal:
 *   op document get <chapa/.env.local item id> --out-file /tmp/prod.env
 *
 * The copy is destructive on the LOCAL side: every table it copies is
 * truncated first, so the result is production's rows and nothing else.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface Endpoint {
  url: string;
  key: string;
}

/** Parents before children, matching the foreign keys in `supabase/migrations`. */
const TABLES = [
  "users",
  "user_platforms",
  "platform_token_refresh_attempts",
  "email_campaigns",
  "campaign_sends",
  "feature_flags",
  "merge_operations",
  "studio_configs",
  "supplemental_stats",
  "tool_insights",
  "scoring_v7_subjects",
  "scoring_v7_sources",
  "scoring_v7_source_observations",
  "scoring_v7_evidence",
  "scoring_v7_assessments",
  "scoring_v7_evidence_references",
  "scoring_v7_raw_artifacts",
  "scoring_v7_receipts",
  "scoring_v7_reviewer_grants",
  "scoring_v7_revocations",
  "scoring_v7_trend_anchors",
  "scoring_v7_verification",
] as const;

/**
 * Tables whose `id` is a Postgres identity column (GENERATED ALWAYS).
 * PostgREST cannot supply `OVERRIDING SYSTEM VALUE`, and nothing references
 * these ids, so the local copy generates its own. Every other id in the schema
 * is a uuid and is copied verbatim, which is what keeps foreign keys pointing
 * at the same rows.
 */
const IDENTITY_ID_TABLES = new Set(["merge_operations", "users"]);

const PAGE_SIZE = 1000;

function readEnvFile(path: string): Record<string, string> {
  const entries = readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.trimStart().startsWith("#"))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()] as const;
    });
  return Object.fromEntries(entries);
}

function endpoint(path: string, label: string): Endpoint {
  const env = readEnvFile(path);
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(`${label} (${path}) is missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`);
  }
  return { url, key };
}

/** The PostgREST clone cannot write immutable generation rows or preserve the
 * job/generation FK cycle. Refuse a partial copy before deleting local rows.
 * A source predating migration 061 has no generation table or row-mode column.
 */
export async function preflightCollectionStorage(source: Endpoint): Promise<void> {
  const headers = { apikey: source.key, Authorization: `Bearer ${source.key}` };
  const inspect = async (table: string, query: string, absentCode: string): Promise<Record<string, unknown>[]> => {
    const response = await fetch(`${source.url}/rest/v1/${table}?${query}`, { headers });
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { code?: string } | null;
      if (body?.code === absentCode) return [];
      throw new Error(`Cannot inspect ${table} before clone: HTTP ${response.status} (${body?.code ?? "unknown"})`);
    }
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error(`Cannot inspect ${table} before clone: invalid response`);
    return rows as Record<string, unknown>[];
  };
  const generations = await inspect("scoring_collection_generations", "select=id&limit=1", "PGRST205");
  if (generations.length) throw new Error("Cannot clone generation-backed collection rows through PostgREST; local database is unchanged");
  const rowObservations = await inspect("scoring_v7_source_observations", "select=id&event_storage_mode=eq.rows&limit=1", "42703");
  if (rowObservations.length) throw new Error("Cannot clone row-mode observations through PostgREST; local database is unchanged");
}

async function readPage(source: Endpoint, table: string, from: number): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${source.url}/rest/v1/${table}?select=*`, {
    headers: {
      apikey: source.key,
      Authorization: `Bearer ${source.key}`,
      Range: `${from}-${from + PAGE_SIZE - 1}`,
      "Range-Unit": "items",
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
  return (await res.json()) as Record<string, unknown>[];
}

/**
 * PostgREST has no TRUNCATE and refuses an unfiltered DELETE, so the delete is
 * filtered on a column that is non-null in every row being copied. `id` is the
 * usual one, but not every table has it (`studio_configs` is keyed by handle),
 * hence picking the column from the data itself.
 */
function deleteFilterColumn(rows: Record<string, unknown>[]): string {
  const [first] = rows;
  if (!first) return "id";
  const column = Object.keys(first).find((key) => rows.every((row) => row[key] !== null && row[key] !== undefined));
  return column ?? "id";
}

async function truncate(target: Endpoint, table: string, column: string): Promise<void> {
  const res = await fetch(`${target.url}/rest/v1/${table}?${column}=not.is.null`, {
    method: "DELETE",
    headers: { apikey: target.key, Authorization: `Bearer ${target.key}`, Prefer: "return=minimal" },
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
}

async function writeRows(target: Endpoint, table: string, rows: Record<string, unknown>[]): Promise<void> {
  const res = await fetch(`${target.url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: target.key,
      Authorization: `Bearer ${target.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 240)}`);
}

export async function cloneProdDb(sourcePath: string, targetPath: string): Promise<number> {
  const source = endpoint(sourcePath, "source");
  const target = endpoint(targetPath, "target");

  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(target.url)) {
    throw new Error(`refusing to write to a non-local target: ${target.url}`);
  }
  await preflightCollectionStorage(source);

  let total = 0;
  for (const table of TABLES) {
    let from = 0;
    let copied = 0;
    let cleared = false;
    try {
      for (;;) {
        let rows: Record<string, unknown>[];
        try {
          rows = await readPage(source, table, from);
        } catch (error) {
          // A table that exists locally but not in production (a migration
          // that has not shipped yet) is expected, not a failure.
          console.log(`${table}: skipped (${String(error).slice(0, 120)})`);
          break;
        }
        if (rows.length === 0) break;
        if (!cleared) {
          await truncate(target, table, deleteFilterColumn(rows));
          cleared = true;
        }
        const payload = IDENTITY_ID_TABLES.has(table)
          ? rows.map(({ id: _id, ...rest }) => rest)
          : rows;
        await writeRows(target, table, payload);
        copied += rows.length;
        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
    } catch (error) {
      // #1335 — `metrics_snapshots` and `verification_records` are dropped by
      // a held contract migration (057) not yet applied to either side. A
      // table present in production but missing on this local target (already
      // migrated ahead) must not abort every table after it in this loop.
      console.log(`${table}: skipped, target write failed (${String(error).slice(0, 120)})`);
      continue;
    }
    if (copied > 0) {
      console.log(`${table}: ${copied}`);
      total += copied;
    }
  }
  console.log(`total rows copied: ${total}`);
  return total;
}

function main(): void {
  const [sourceArg, targetArg] = process.argv.slice(2);
  if (!sourceArg) {
    console.error("usage: pnpm run clone-prod-db <production-env-file> [target-env-file]");
    process.exit(1);
  }
  cloneProdDb(resolve(sourceArg), resolve(targetArg ?? "apps/web/.env.local")).catch((error: unknown) => {
    console.error(String(error));
    process.exit(1);
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
