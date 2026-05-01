#!/usr/bin/env tsx
/**
 * Recompute every stored craft score with the current `computeCraftScore()`
 * formula and upsert it back into `tool_insights`.
 *
 * Run this once after any change to the craft scoring formula. The live read
 * paths (`materializeProfile`, `getCachedCraftScore`) only read stored values,
 * so without this backfill, old uploads keep serving stale scores until the
 * user re-uploads.
 *
 * Usage (from repo root or apps/web):
 *   pnpm --filter @chapa/web exec tsx scripts/backfill-craft-scores.ts             # apply
 *   pnpm --filter @chapa/web exec tsx scripts/backfill-craft-scores.ts --dry-run   # preview
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Idempotent — safe to re-run. Only writes when the recomputed value differs
 * from the stored one.
 *
 * Refs #824
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { InsightsUpload } from "@chapa/shared";
import { computeCraftScore } from "@/lib/insights/scoring";
import { getSupabaseUrl, getSupabaseServiceRoleKey } from "@/lib/env";

interface ToolInsightsRow {
  handle: string;
  tool: string;
  raw_data: InsightsUpload;
  proficiency: number;
  effectiveness: number;
  sophistication: number;
  craft_score: number;
  craft_tier: string;
  uploaded_at: string;
}

const PAGE_SIZE = 200;

async function fetchAllRows(supabase: SupabaseClient): Promise<ToolInsightsRow[]> {
  const rows: ToolInsightsRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("tool_insights")
      .select(
        "handle, tool, raw_data, proficiency, effectiveness, sophistication, craft_score, craft_tier, uploaded_at",
      )
      .order("uploaded_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as ToolInsightsRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseServiceRoleKey();
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });

  console.log(`\n=== Backfill craft scores ${dryRun ? "(DRY RUN)" : ""} ===\n`);

  const rows = await fetchAllRows(supabase);
  console.log(`Loaded ${rows.length} tool_insights row(s)`);

  let unchanged = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    let recomputed;
    try {
      recomputed = computeCraftScore(row.raw_data);
    } catch (err) {
      console.error(
        `  [ERROR] ${row.handle}/${row.tool}: compute failed — ${(err as Error).message}`,
      );
      errors++;
      continue;
    }

    const same =
      recomputed.craftScore === row.craft_score &&
      recomputed.tier === row.craft_tier &&
      recomputed.dimensions.proficiency === row.proficiency &&
      recomputed.dimensions.effectiveness === row.effectiveness &&
      recomputed.dimensions.sophistication === row.sophistication;

    if (same) {
      unchanged++;
      continue;
    }

    const delta = recomputed.craftScore - row.craft_score;
    const sign = delta >= 0 ? "+" : "";
    console.log(
      `  ${row.handle}/${row.tool}: ${row.craft_score} → ${recomputed.craftScore} (${sign}${delta})`,
    );

    if (dryRun) {
      updated++;
      continue;
    }

    try {
      const { error } = await supabase
        .from("tool_insights")
        .update({
          proficiency: recomputed.dimensions.proficiency,
          effectiveness: recomputed.dimensions.effectiveness,
          sophistication: recomputed.dimensions.sophistication,
          craft_score: recomputed.craftScore,
          craft_tier: recomputed.tier,
        })
        .eq("handle", row.handle)
        .eq("tool", row.tool);
      if (error) throw error;
      updated++;
    } catch (err) {
      console.error(
        `  [ERROR] ${row.handle}/${row.tool}: update failed — ${(err as Error).message}`,
      );
      errors++;
    }
  }

  console.log(
    `\nDone: ${rows.length} scanned, ${updated} ${dryRun ? "would update" : "updated"}, ${unchanged} unchanged, ${errors} errors\n`,
  );

  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
