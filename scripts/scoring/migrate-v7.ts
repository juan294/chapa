#!/usr/bin/env tsx
/**
 * Rehearse the v6 → v7 transition for a bounded set of handles.
 *
 * The transition is additive: v7 receipts and v7 cache entries live in their
 * own namespace beside v6, and nothing v6 owns is rewritten or deleted. That is
 * what makes rollback a code change rather than a data recovery.
 *
 * Dry run is the default and mutates nothing — no cache write, no cache delete,
 * no database write, no network call. It reports exactly what an `--apply` run
 * would do, so the estimate, the data-access scope and the recompute count are
 * concrete before anyone asks for production authorization.
 *
 *   pnpm exec tsx scripts/scoring/migrate-v7.ts <handle>...          # dry run
 *   pnpm exec tsx scripts/scoring/migrate-v7.ts --json <handle>...
 *   pnpm exec tsx scripts/scoring/migrate-v7.ts --apply <handle>...  # local only
 *
 * `--apply` is refused unless `CHAPA_MIGRATION_TARGET=local` is set. Production
 * migration and recompute need separate explicit authorization that this script
 * deliberately cannot grant itself.
 */
import { CACHE_VERSION, SCORING_V7_CACHE_VERSION } from "../../apps/web/lib/cache/version";
import { BADGE_RENDER_VARIANT } from "../../apps/web/lib/render/badge-render-variant";

export const LOCALES = ["en", "es"] as const;

export type PlannedAction =
  | { readonly kind: "read"; readonly what: string }
  | { readonly kind: "write"; readonly what: string }
  | { readonly kind: "invalidate"; readonly what: string };

export interface HandlePlan {
  readonly handle: string;
  readonly actions: readonly PlannedAction[];
  /** Keys this handle's migration would never touch, listed so a reviewer can
   * see the blast radius rather than infer it. */
  readonly preserved: readonly string[];
}

export interface MigrationPlan {
  readonly handles: readonly HandlePlan[];
  readonly totals: {
    readonly handles: number;
    readonly reads: number;
    readonly writes: number;
    readonly invalidations: number;
    /** One recompute per handle; the bound a production request must quote. */
    readonly recomputes: number;
  };
  readonly dataAccess: readonly string[];
}

/** What one handle's transition does. Pure: building a plan touches nothing. */
export function planHandle(rawHandle: string): HandlePlan {
  const handle = rawHandle.trim().toLowerCase();
  if (!handle) throw new RangeError("Empty handle");
  const actions: PlannedAction[] = [
    { kind: "read", what: `engineering evidence ledger for ${handle}` },
    { kind: "read", what: `connected source observations for ${handle}` },
    { kind: "write", what: `scoring_v7_receipts row for ${handle} (new revision, additive)` },
    { kind: "write", what: `receipt:${SCORING_V7_CACHE_VERSION}:${handle}` },
    ...LOCALES.map(locale => ({
      kind: "invalidate" as const,
      what: `badge:${CACHE_VERSION}:${handle}:${BADGE_RENDER_VARIANT}:<today>:${locale}`,
    })),
  ];
  return {
    handle,
    actions,
    preserved: [
      `snapshot:${CACHE_VERSION}:latest:${handle}`,
      `stats:${CACHE_VERSION}:merged:${handle}`,
      `stats:stale:${CACHE_VERSION}:${handle}`,
      `metrics_snapshots rows for ${handle}`,
      `existing verification records for ${handle}`,
    ],
  };
}

export function planMigration(handles: readonly string[]): MigrationPlan {
  const unique = [...new Set(handles.map(handle => handle.trim().toLowerCase()).filter(Boolean))].sort();
  const plans = unique.map(planHandle);
  const count = (kind: PlannedAction["kind"]) =>
    plans.reduce((total, plan) => total + plan.actions.filter(action => action.kind === kind).length, 0);
  return {
    handles: plans,
    totals: {
      handles: plans.length,
      reads: count("read"),
      writes: count("write"),
      invalidations: count("invalidate"),
      recomputes: plans.length,
    },
    dataAccess: [
      "read: scoring_v7 evidence ledger and Craft portfolio for the named handles only",
      "read: stored source observations for the named handles only",
      "write: new scoring_v7 receipt revisions (additive; no existing revision is modified)",
      "invalidate: today's badge SVG cache entries for the named handles",
      "never: v6 snapshots, v6 stats caches, metrics_snapshots rows, existing verification records",
    ],
  };
}

export function renderPlan(plan: MigrationPlan): string {
  const lines = [
    `v7 transition rehearsal — ${plan.totals.handles} handle(s)`,
    "",
    `reads: ${plan.totals.reads}  writes: ${plan.totals.writes}  invalidations: ${plan.totals.invalidations}  recomputes: ${plan.totals.recomputes}`,
    "",
    "Data access scope:",
    ...plan.dataAccess.map(row => `  - ${row}`),
    "",
  ];
  for (const handle of plan.handles) {
    lines.push(`${handle.handle}:`);
    for (const action of handle.actions) lines.push(`  ${action.kind.padEnd(11)} ${action.what}`);
    lines.push(`  ${"preserved".padEnd(11)} ${handle.preserved.length} keys untouched`);
  }
  return `${lines.join("\n")}\n`;
}

/** `--apply` is a local rehearsal only. Production needs separate explicit
 * authorization, which a script may not grant itself. */
export function assertApplyAllowed(target: string | undefined): void {
  if (target !== "local") {
    throw new Error(
      "Refusing to apply: set CHAPA_MIGRATION_TARGET=local for a local rehearsal. " +
        "Production migration and recompute require separate explicit authorization.",
    );
  }
}

if (process.argv[1]?.endsWith("migrate-v7.ts")) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const apply = args.includes("--apply");
  const handles = args.filter(arg => !arg.startsWith("--"));
  if (handles.length === 0) {
    process.stderr.write("Usage: migrate-v7.ts [--apply] [--json] <handle>...\n");
    process.exit(2);
  }
  const plan = planMigration(handles);
  if (apply) assertApplyAllowed(process.env.CHAPA_MIGRATION_TARGET);
  process.stdout.write(json ? `${JSON.stringify(plan, null, 2)}\n` : renderPlan(plan));
  if (!apply) process.stdout.write("\nDry run: nothing was read, written or invalidated.\n");
}
