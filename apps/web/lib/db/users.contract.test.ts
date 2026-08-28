import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getServiceClient } from "@/test/contract/invoke";
import {
  dbGetAllUserHandles,
  dbGetUserHandlePage,
  dbGetUsers,
  dbGetUsersWithEmail,
} from "./users";

/**
 * #1079 — user-list accessors previously
 * issued a plain, unpaginated select. PostgREST's `max_rows = 1000`
 * (supabase/config.toml:18) silently truncates any such select at 1000 rows
 * with no error. Both accessors are ordered by `registered_at DESC`, so past
 * 1000 rows the truncation silently drops the EARLIEST registrants —
 * warm-cache rotation and campaign audience targeting would never see them
 * again.
 *
 * This proves the fix against a real local Postgres/PostgREST stack, where
 * `max_rows` actually applies — the mocked unit tests in `users.test.ts`
 * cannot exercise PostgREST's real truncation behavior.
 */

const RUN_ID = randomUUID();
const HANDLE_PREFIX = `chapa-e2e-${RUN_ID.slice(0, 8)}-user-`;
const EMU_SOURCE_HANDLE = `chapa-emu-${RUN_ID.slice(0, 8)}_source`;
const TOTAL_USERS = 1001;

describe("user accessors past the 1000-row max_rows cap (contract)", () => {
  afterAll(async () => {
    const db = getServiceClient();
    await db.from("users").delete().like("handle", `${HANDLE_PREFIX}%`);
    await db.from("users").delete().eq("handle", EMU_SOURCE_HANDLE);
  });

  it("excludes an EMU source row from the primary warm-cache registry", async () => {
    const db = getServiceClient();
    const { error } = await db.from("users").insert({
      handle: EMU_SOURCE_HANDLE,
    });
    expect(error).toBeNull();

    const allHandles = await dbGetAllUserHandles();
    expect(allHandles).not.toContain(EMU_SOURCE_HANDLE);
  });

  it("seeds past the max_rows cap and returns every row from both accessors", async () => {
    const db = getServiceClient();

    // Give every row the same primary sort value. Correct pagination must use
    // the unique id tie-breaker in its keyset cursor to cross the 1000-row
    // boundary without duplicating or omitting a handle.
    const registeredAt = "2020-01-01T00:00:00.000Z";
    const rows = Array.from({ length: TOTAL_USERS }, (_, i) => ({
      handle: `${HANDLE_PREFIX}${String(i).padStart(4, "0")}`,
      email: `${HANDLE_PREFIX}${String(i).padStart(4, "0")}@example.com`,
      email_notifications: true,
      registered_at: registeredAt,
    }));

    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await db.from("users").insert(rows.slice(i, i + CHUNK));
      expect(error).toBeNull();
    }

    const boundaryHandle = `${HANDLE_PREFIX}0000`;

    const allUsers = await dbGetUsers();
    const seededUsers = allUsers.filter((u) => u.handle.startsWith(HANDLE_PREFIX));
    expect(seededUsers).toHaveLength(TOTAL_USERS);
    expect(new Set(seededUsers.map((u) => u.handle)).size).toBe(TOTAL_USERS);
    expect(seededUsers.map((u) => u.handle)).toContain(boundaryHandle);

    const usersWithEmail = await dbGetUsersWithEmail();
    const seededWithEmail = usersWithEmail.filter((u) =>
      u.handle.startsWith(HANDLE_PREFIX),
    );
    expect(seededWithEmail).toHaveLength(TOTAL_USERS);
    expect(new Set(seededWithEmail.map((u) => u.handle)).size).toBe(
      TOTAL_USERS,
    );
    expect(seededWithEmail.map((u) => u.handle)).toContain(boundaryHandle);

    const allHandles = await dbGetAllUserHandles();
    const seededHandles = allHandles.filter((handle) =>
      handle.startsWith(HANDLE_PREFIX),
    );
    expect(seededHandles).toHaveLength(TOTAL_USERS);
    expect(new Set(seededHandles).size).toBe(TOTAL_USERS);

    const firstHandlePage = await dbGetUserHandlePage({
      after: HANDLE_PREFIX,
      limit: 101,
    });
    expect(firstHandlePage.handles).toHaveLength(101);
    expect(firstHandlePage.handles[0]).toBe(`${HANDLE_PREFIX}0000`);
    expect(firstHandlePage.handles[100]).toBe(`${HANDLE_PREFIX}0100`);
    expect(firstHandlePage.total).toBeGreaterThanOrEqual(TOTAL_USERS);

    const secondHandlePage = await dbGetUserHandlePage({
      after: firstHandlePage.handles[100],
      limit: 101,
    });
    expect(secondHandlePage.handles[0]).toBe(`${HANDLE_PREFIX}0101`);
  });
});
