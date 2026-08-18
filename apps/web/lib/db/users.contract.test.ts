import { afterAll, describe, expect, it } from "vitest";
import { getServiceClient } from "@/test/contract/invoke";
import { dbGetUsers, dbGetUsersWithEmail } from "./users";

/**
 * #1079 — `dbGetUsers()` (no-opts path) and `dbGetUsersWithEmail()` previously
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

const HANDLE_PREFIX = "contract-1079-user-";
const TOTAL_USERS = 1001;

describe("dbGetUsers / dbGetUsersWithEmail past the 1000-row max_rows cap (contract)", () => {
  afterAll(async () => {
    const db = getServiceClient();
    await db.from("users").delete().like("handle", `${HANDLE_PREFIX}%`);
  });

  it("seeds past the max_rows cap and returns every row from both accessors", async () => {
    const db = getServiceClient();

    // Older `registered_at` first so the earliest registrant (the one that
    // truncation at 1000 would drop, since both queries order DESC) is
    // deterministically identifiable by index 0.
    const baseTime = Date.parse("2020-01-01T00:00:00Z");
    const rows = Array.from({ length: TOTAL_USERS }, (_, i) => ({
      handle: `${HANDLE_PREFIX}${i}`,
      email: `${HANDLE_PREFIX}${i}@example.com`,
      email_notifications: true,
      registered_at: new Date(baseTime + i * 1000).toISOString(),
    }));

    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await db.from("users").insert(rows.slice(i, i + CHUNK));
      expect(error).toBeNull();
    }

    const earliestHandle = `${HANDLE_PREFIX}0`;

    const allUsers = await dbGetUsers();
    const seededUsers = allUsers.filter((u) => u.handle.startsWith(HANDLE_PREFIX));
    expect(seededUsers).toHaveLength(TOTAL_USERS);
    expect(seededUsers.map((u) => u.handle)).toContain(earliestHandle);

    const usersWithEmail = await dbGetUsersWithEmail();
    const seededWithEmail = usersWithEmail.filter((u) =>
      u.handle.startsWith(HANDLE_PREFIX),
    );
    expect(seededWithEmail).toHaveLength(TOTAL_USERS);
    expect(seededWithEmail.map((u) => u.handle)).toContain(earliestHandle);
  });
});
