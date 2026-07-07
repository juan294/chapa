import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getServiceClient } from "@/test/contract/invoke";
import { dbGetAdminUsers } from "./admin-users";

const HANDLE_ONLY = "contract-search-handle-only"; // matches search by handle; display_name left NULL
const NAME_ONLY_HANDLE = "contract-search-name-only"; // handle does NOT contain the search term
const NAME_ONLY_DISPLAY_NAME = "Zzyxq Distinctive Name"; // matches search by display_name only
const SEARCH_TERM_FOR_NAME = "Zzyxq";
const NO_MATCH_TERM = "no-such-user-xyz123";

describe("dbGetAdminUsers search filter (contract)", () => {
  beforeAll(async () => {
    const db = getServiceClient();
    const { error: e1 } = await db
      .from("users")
      .upsert({ handle: HANDLE_ONLY, display_name: null }, { onConflict: "handle" });
    expect(e1).toBeNull();

    const { error: e2 } = await db
      .from("users")
      .upsert(
        { handle: NAME_ONLY_HANDLE, display_name: NAME_ONLY_DISPLAY_NAME },
        { onConflict: "handle" },
      );
    expect(e2).toBeNull();
  });

  afterAll(async () => {
    const db = getServiceClient();
    await db.from("users").delete().in("handle", [HANDLE_ONLY, NAME_ONLY_HANDLE]);
  });

  it("finds a user by handle even when display_name does not match (the reported bug)", async () => {
    const result = await dbGetAdminUsers({
      page: 1,
      limit: 25,
      sort: "handle",
      dir: "asc",
      search: HANDLE_ONLY,
    });
    expect(result.users.map((u) => u.handle)).toContain(HANDLE_ONLY);
  });

  it("finds a user by display_name even when handle does not match (proves true OR, not just handle-first)", async () => {
    const result = await dbGetAdminUsers({
      page: 1,
      limit: 25,
      sort: "handle",
      dir: "asc",
      search: SEARCH_TERM_FOR_NAME,
    });
    expect(result.users.map((u) => u.handle)).toContain(NAME_ONLY_HANDLE);
  });

  it("returns no results when the search term matches neither handle nor display_name", async () => {
    const result = await dbGetAdminUsers({
      page: 1,
      limit: 25,
      sort: "handle",
      dir: "asc",
      search: NO_MATCH_TERM,
    });
    expect(result.users.map((u) => u.handle)).not.toContain(HANDLE_ONLY);
    expect(result.users.map((u) => u.handle)).not.toContain(NAME_ONLY_HANDLE);
  });
});
