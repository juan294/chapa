import "server-only";
import { cacheDel, cacheGet, cacheSet, purgeRetiredSupplementalV7CacheBatch } from "@/lib/cache/redis";
import { buildReceiptSnapshotKeyV7 } from "@/lib/cache/snapshot-cache";
import { buildObservedReceiptKey } from "@/lib/cache/snapshot-cache-observed";
import { dbVerificationRpcV7 } from "@/lib/db/verification";
const CURSOR_KEY = "scoring:v7:revocation-sweep-cursor";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function receiptRevisionIdsV7(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(id => typeof id !== "string" || !UUID.test(id))) throw new Error("Invalid receipt cleanup batch");
  return [...new Set(value as string[])];
}
export async function deleteReceiptCachesV7(revisions: readonly string[]) {
  const ids = receiptRevisionIdsV7(revisions);
  let deleted = 0;
  for (const id of ids) {
    let complete = true;
    for (const key of [buildReceiptSnapshotKeyV7(id), buildObservedReceiptKey(id)]) {
      try { if (!(await cacheDel(key))) complete = false; } catch { complete = false; }
    }
    if (complete) deleted++;
  }
  return { attempted: ids.length, deleted, failed: ids.length - deleted };
}
/** Repeats forever: no permanent completion marker can safely exclude late writes. */
export async function sweepRevokedReceiptCachesV7() {
  const cursor = await cacheGet<unknown>(CURSOR_KEY);
  const after = typeof cursor === "string" && UUID.test(cursor) ? cursor : null;
  const ids = receiptRevisionIdsV7(await dbVerificationRpcV7("scoring_v7_revocation_batch", { p_after: after, p_limit: 100 }));
  const result = await deleteReceiptCachesV7(ids);
  let cursorSaved = false;
  if (result.failed === 0) {
    try { cursorSaved = await cacheSet(CURSOR_KEY, ids.at(-1) ?? null, 0); } catch { /* Replay this batch. */ }
  }
  return { ...result, cursorSaved };
}

/** Withdrawal commits first; cache failures never undo revocation or masquerade as completion. */
export async function withdrawReceiptPublicationV7(owner: string, actor: string, acknowledged: boolean) {
  const revisions = receiptRevisionIdsV7(await dbVerificationRpcV7("scoring_v7_withdraw_with_receipts", {
    p_owner: owner, p_actor: actor.toLowerCase(), p_acknowledged: acknowledged,
  }));
  const receipts = await deleteReceiptCachesV7(revisions);
  let privateCopiesDeleted = 0;
  const privateKeys = [`supplemental:v7:${owner}`];
  for (const key of privateKeys) {
    try { if (await cacheDel(key)) privateCopiesDeleted++; } catch { /* Report incomplete cleanup. */ }
  }
  const privateCopies = { attempted: privateKeys.length, deleted: privateCopiesDeleted, failed: privateKeys.length - privateCopiesDeleted };
  // An empty batch cannot distinguish a first withdrawal with no receipts from a
  // retry after the owner→revision mapping was erased. Only the global sweep can
  // revisit those content-free tombstones; do not infer cleanup from missing IDs.
  const status = receipts.failed > 0 || privateCopies.failed > 0 ? "failed" : revisions.length === 0 ? "pending" : "complete";
  const complete = status === "complete";
  return { success: complete, withdrawn: true, cleanup: { complete, status, receipts, privateCopies } };
}


export async function sweepRetiredSupplementalCachesV7() {
  const key = "scoring:v7:retired-supplemental-cursor";
  const stored = await cacheGet<unknown>(key);
  const cursor = typeof stored === "string" && /^\d+$/.test(stored) ? stored : "0";
  const result = await purgeRetiredSupplementalV7CacheBatch(cursor);
  const cursorSaved = result.failed === 0 ? await cacheSet(key, result.nextCursor, 0).catch(() => false) : false;
  return { attempted: result.attempted, deleted: result.deleted, failed: result.failed, cursorSaved };
}
