import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * #1010 — Regression test asserting the warm-cache cron's Vercel schedule
 * config. Prior to this fix, warm-cache ran once daily with a 50-handle
 * per-run ceiling, so any handle beyond the ceiling was only proactively
 * warmed (and its daily lifetime-history snapshot recorded) once every
 * ceil(activeUsers / 50) DAYS. Running hourly with the same per-run ceiling
 * shrinks that gap to ceil(activeUsers / 50) HOURS — roughly 24x more
 * proactive coverage per day for the same GitHub API budget (see
 * route.ts's MAX_HANDLES/BATCH_SIZE comments for the rate-limit math).
 *
 * vercel.json isn't executed by the test runner (Vercel reads it at deploy
 * time), so this test only guarantees the config *file* says what we think
 * it says — it does not prove Vercel actually schedules the cron this way.
 *
 * #1052 — that caveat was exactly right, and it bit. This test passed for
 * months while the file it reads was at the repo root, outside the Vercel
 * project's Root Directory (`apps/web`), and therefore never read by Vercel
 * at all: warm-cache was never registered and never ran once. The assertions
 * below were true about the file and false about production the whole time.
 *
 * The file now lives at `apps/web/vercel.json` (hence the shorter path), and
 * `scripts/check-vercel-config.ts` runs in CI to assert its *location* —
 * which is the part a contents test structurally cannot cover.
 */
describe("vercel.json warm-cache cron schedule (#1010)", () => {
  function readVercelConfig(): {
    crons: { path: string; schedule: string }[];
    functions: Record<string, { maxDuration: number }>;
  } {
    // apps/web/vercel.json — the Vercel Root Directory, four levels up from
    // app/api/cron/warm-cache/.
    const raw = readFileSync(join(__dirname, "../../../../vercel.json"), "utf-8");
    return JSON.parse(raw);
  }

  it("runs warm-cache hourly instead of once daily", () => {
    const config = readVercelConfig();
    const warmCacheCron = config.crons.find((c) => c.path === "/api/cron/warm-cache");

    expect(warmCacheCron).toBeDefined();
    // Hourly at minute 0 — was "0 6 * * *" (once daily at 6am UTC).
    expect(warmCacheCron?.schedule).toBe("0 * * * *");
  });

  it("keeps the warm-cache function's maxDuration unchanged at 300s", () => {
    const config = readVercelConfig();
    const warmCacheFn = config.functions["app/api/cron/warm-cache/route.ts"];

    // We deliberately did NOT raise MAX_HANDLES alongside the frequency bump
    // (see route.ts) — batching/duration math is unchanged, so the function
    // budget should stay put too.
    expect(warmCacheFn?.maxDuration).toBe(300);
  });
});
