import { updateSnapshotCache } from "@/lib/cache/snapshot-cache";
import {
  dbInsertSnapshot,
  dbReplaceSnapshot,
} from "@/lib/db/snapshots";
import {
  materializeProfile,
  type MaterializedProfile,
} from "./materialize-profile";

export type SnapshotPersistenceMode = "insert" | "replace";

export async function materializeOrchestratedProfile(
  handle: string,
  options: {
    token?: string;
    today?: string;
    /** #930 — Skip the snapshot lookup so admin recalculates always apply the fresh score. */
    ignoreSnapshot?: boolean;
  } = {},
): Promise<MaterializedProfile | null> {
  return materializeProfile(handle, {
    token: options.token,
    today: options.today,
    policy: "public-display",
    ignoreSnapshot: options.ignoreSnapshot,
  });
}

export async function persistOrchestratedSnapshot(
  handle: string,
  materialized: MaterializedProfile,
  options: { mode: SnapshotPersistenceMode },
): Promise<boolean> {
  const persisted = options.mode === "replace"
    ? await dbReplaceSnapshot(handle, materialized.snapshot)
    : await dbInsertSnapshot(handle, materialized.snapshot);

  if (persisted) {
    await updateSnapshotCache(handle, materialized.snapshot);
  }

  return persisted;
}
