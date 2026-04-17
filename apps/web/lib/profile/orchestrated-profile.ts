import { updateSnapshotCache } from "@/lib/cache/snapshot-cache";
import {
  dbInsertSnapshot,
  dbReplaceSnapshot,
} from "@/lib/db/snapshots";
import {
  materializeProfile,
  type MaterializationCraftMode,
  type MaterializedProfile,
} from "./materialize-profile";

export type SnapshotPersistenceMode = "insert" | "replace";

export async function materializeOrchestratedProfile(
  handle: string,
  options: {
    token?: string;
    today?: string;
    craftMode: MaterializationCraftMode;
  },
): Promise<MaterializedProfile | null> {
  return materializeProfile(handle, {
    token: options.token,
    today: options.today,
    craftMode: options.craftMode,
    policy: "public-display",
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
