import "server-only";
import { discoverStoredSource, readSourceObservation } from "@/lib/db/source-context";
import { enqueueCollectionJob, isCollectionJobInProgress } from "@/lib/db/collection-queue";
import { createSourceCoordinator } from "./source-coordinator";
import { readSourceAuthorization } from "./source-authorization";

/** Live v7.2 entry point; legacy scalar consumers remain a separate boundary.
 * Read-only since #1335 phase 3: collection happens exclusively in the
 * durable queue worker (`lib/collection/worker.ts`), via `collectSourceSlice`
 * (`lib/collection/collect-source-slice.ts`). The single-run `collectSource`
 * dispatch and the per-provider `fetchXEvidence` functions it called were
 * removed with this file's rewiring onto the slice API (#1335 phase 3 part
 * B/C) once neither had a production caller left.
 */
export const selectSourceEvidence = createSourceCoordinator({
  authorize: readSourceAuthorization,
  discover: discoverStoredSource,
  read: readSourceObservation,
  enqueue: enqueueCollectionJob,
  jobInProgress: isCollectionJobInProgress,
});
