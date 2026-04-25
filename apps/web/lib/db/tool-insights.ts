import { getSupabase } from "./supabase";
import { parseRow } from "./parse-row";
import type { CraftResult, CraftTier, InsightsUpload, InsightsTool } from "@chapa/shared";

// ---------------------------------------------------------------------------
// Row shape from Supabase
// ---------------------------------------------------------------------------

interface ToolInsightsRow {
  handle: string;
  tool: string;
  report_start: string;
  report_end: string;
  raw_data: InsightsUpload;
  proficiency: number;
  effectiveness: number;
  sophistication: number;
  craft_score: number;
  craft_tier: string;
  uploaded_at: string;
}

const REQUIRED_KEYS: readonly (keyof ToolInsightsRow & string)[] = [
  "handle",
  "tool",
  "report_start",
  "report_end",
  "proficiency",
  "effectiveness",
  "sophistication",
  "craft_score",
  "craft_tier",
  "uploaded_at",
];

const SELECT_COLUMNS =
  "handle, tool, report_start, report_end, proficiency, effectiveness, sophistication, craft_score, craft_tier, uploaded_at" as const;

const VALID_TIERS: ReadonlySet<string> = new Set(["Novice", "Practitioner", "Expert", "Master"]);

function rowToCraftResult(row: ToolInsightsRow): CraftResult {
  return {
    tool: row.tool as InsightsTool,
    dimensions: {
      proficiency: row.proficiency,
      effectiveness: row.effectiveness,
      sophistication: row.sophistication,
    },
    craftScore: row.craft_score,
    tier: VALID_TIERS.has(row.craft_tier) ? (row.craft_tier as CraftTier) : "Novice",
    reportPeriod: {
      start: row.report_start,
      end: row.report_end,
    },
    computedAt: row.uploaded_at,
  };
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

/**
 * Upsert a tool insights record (one active report per handle+tool).
 * Returns the stored CraftResult, or null on failure.
 */
export async function dbUpsertToolInsights(
  handle: string,
  data: InsightsUpload,
  scores: CraftResult,
  uploadedAt: string = scores.computedAt,
): Promise<CraftResult | null> {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data: rows, error } = await db
      .from("tool_insights")
      .upsert(
        {
          handle: handle.toLowerCase(),
          tool: data.tool,
          report_start: data.reportPeriod.start,
          report_end: data.reportPeriod.end,
          raw_data: data,
          proficiency: scores.dimensions.proficiency,
          effectiveness: scores.dimensions.effectiveness,
          sophistication: scores.dimensions.sophistication,
          craft_score: scores.craftScore,
          craft_tier: scores.tier,
          uploaded_at: uploadedAt,
        },
        { onConflict: "handle,tool" },
      )
      .select()
      .single();

    if (error) throw error;

    const row = parseRow<ToolInsightsRow>(rows, REQUIRED_KEYS, "tool_insights");
    return row ? rowToCraftResult(row) : scores;
  } catch (error) {
    console.error("[db] dbUpsertToolInsights failed:", (error as Error).message);
    return null;
  }
}

/**
 * Get the active craft score for a handle.
 *
 * Authoritative selection rule until per-tool selection exists:
 * latest uploaded report wins.
 *
 * Returns null if no insights uploaded or Supabase unavailable.
 */
export async function dbGetToolInsights(
  handle: string,
): Promise<CraftResult | null> {
  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("tool_insights")
      .select(SELECT_COLUMNS)
      .eq("handle", handle.toLowerCase())
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // PGRST116 = no rows — not an error, just no data
      if (error.code === "PGRST116") return null;
      throw error;
    }

    const row = parseRow<ToolInsightsRow>(data, REQUIRED_KEYS, "tool_insights");
    return row ? rowToCraftResult(row) : null;
  } catch (error) {
    console.error("[db] dbGetToolInsights failed:", (error as Error).message);
    return null;
  }
}

