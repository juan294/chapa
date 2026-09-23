import "server-only";
import type { CollectSlice } from "./plan";

/**
 * Placeholder for #1335 phase 3 (part B: provider slice collectors). The real
 * implementation dispatches to `lib/{github,bitbucket,gitlab,codeberg}/evidence.ts`'s
 * `collectXSlice` functions, mirroring `lib/platform/source-collectors.ts`'s
 * existing `collectSource` dispatch. Replaced at merge with that
 * implementation -- this branch (part A: queue, worker, cron) only needs the
 * `CollectSlice` shape to exist so `worker.ts` can depend on it.
 *
 * Tests must inject a fake `CollectSlice`, never call this placeholder.
 */
export const collectSourceSlice: CollectSlice = () => {
  throw new Error("collectSourceSlice is provided by the provider slice collectors (#1335 phase 3, part B)");
};
