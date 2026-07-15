import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getServiceClient } from "@/test/contract/invoke";
import { makeSnapshot } from "../test-helpers/fixtures";
import { dbInsertSnapshot } from "./snapshots";

// #1016 — dbInsertSnapshot must detect insert-vs-duplicate via row presence in
// the `.select("id")` response, not the raw PostgREST HTTP status code (an
// undocumented supabase-js/PostgREST implementation detail). This contract
// test proves the real behavior against a real local Postgres/PostgREST
// stack — a unit-level mock cannot verify what PostgREST actually returns for
// an `.upsert(..., { ignoreDuplicates: true }).select("id")` call.

const HANDLE = "contract-snapshot-insert-outcome";
const DATE = "2026-01-15";

describe("dbInsertSnapshot insert-vs-duplicate outcome (contract)", () => {
  beforeEach(async () => {
    const db = getServiceClient();
    await db
      .from("metrics_snapshots")
      .delete()
      .eq("handle", HANDLE)
      .eq("date", DATE);
  });

  afterAll(async () => {
    const db = getServiceClient();
    await db
      .from("metrics_snapshots")
      .delete()
      .eq("handle", HANDLE)
      .eq("date", DATE);
  });

  it("reports 'inserted' with a durable row on the first write, then 'duplicate' (not an error) on a repeat write for the same handle+date", async () => {
    const snapshot = makeSnapshot({ date: DATE });

    const first = await dbInsertSnapshot(HANDLE, snapshot);
    expect(first).toBe("inserted");

    const db = getServiceClient();
    const { data: rows, error } = await db
      .from("metrics_snapshots")
      .select("id, handle, date")
      .eq("handle", HANDLE)
      .eq("date", DATE);

    expect(error).toBeNull();
    expect(rows).toHaveLength(1);

    // Same handle+date again — ON CONFLICT DO NOTHING should silently skip,
    // and dbInsertSnapshot must report this as "duplicate", not "failed".
    const second = await dbInsertSnapshot(HANDLE, snapshot);
    expect(second).toBe("duplicate");

    // Still exactly one row — the duplicate write did not create a second row.
    const { data: rowsAfter } = await db
      .from("metrics_snapshots")
      .select("id")
      .eq("handle", HANDLE)
      .eq("date", DATE);
    expect(rowsAfter).toHaveLength(1);
  });
});
