import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("./supabase", () => ({
  getSupabase: vi.fn(),
}));

vi.mock("@/lib/auth/github", () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  encryptToken: vi.fn((token: string, _s: string) => `enc:${token}`),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  decryptToken: vi.fn((encrypted: string, _s: string) =>
    encrypted.startsWith("enc:") ? encrypted.slice(4) : null,
  ),
}));

// All DB functions that encrypt/decrypt need NEXTAUTH_SECRET
const originalEnv = process.env.NEXTAUTH_SECRET;
process.env.NEXTAUTH_SECRET = "test-secret-for-encryption";
afterAll(() => {
  if (originalEnv === undefined) delete process.env.NEXTAUTH_SECRET;
  else process.env.NEXTAUTH_SECRET = originalEnv;
});

import { getSupabase } from "./supabase";
import {
  dbGetLinkedPlatform,
  dbUpsertLinkedPlatform,
  dbDeleteLinkedPlatform,
  dbUpdatePlatformTokens,
  dbHasLinkedPlatform,
  dbGetLinkedPlatforms,
} from "./user-platforms";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockSupabase() {
  // Supabase PostgREST builders are thenable — awaiting the chain resolves
  // to { data, error }. We simulate this with a `then` on the query object.
  let _resolveValue = { data: null as unknown, error: null as unknown };

  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    upsert: vi.fn(() => query),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    // Make the query thenable — when awaited (e.g. after .delete().eq().eq()),
    // it resolves to _resolveValue. This mirrors how Supabase PostgREST works.
    then: (resolve: (v: unknown) => void) => resolve(_resolveValue),
  };

  /** Set the value that awaiting the chain will resolve to */
  function setResolveValue(value: { data?: unknown; error?: unknown }) {
    _resolveValue = { data: null, error: null, ...value };
  }

  const db = { from: vi.fn(() => query) };
  vi.mocked(getSupabase).mockReturnValue(db as never);
  return { db, query, setResolveValue };
}

// ---------------------------------------------------------------------------
// dbGetLinkedPlatform
// ---------------------------------------------------------------------------

describe("dbGetLinkedPlatform", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when DB unavailable (getSupabase returns null)", async () => {
    vi.mocked(getSupabase).mockReturnValue(null);
    const result = await dbGetLinkedPlatform("TestUser", "bitbucket");
    expect(result).toBeNull();
  });

  it("returns null when platform not linked", async () => {
    const { query } = mockSupabase();
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await dbGetLinkedPlatform("testuser", "bitbucket");
    expect(result).toBeNull();
  });

  it("returns decrypted tokens when platform is linked", async () => {
    const { query } = mockSupabase();
    query.maybeSingle.mockResolvedValue({
      data: {
        handle: "testuser",
        platform: "bitbucket",
        remote_login: "bb-user",
        access_token: "enc:my-access-token",
        refresh_token: "enc:my-refresh-token",
        token_expires_at: "2026-03-01T00:00:00Z",
        connected_at: "2026-02-23T00:00:00Z",
        updated_at: "2026-02-23T00:00:00Z",
      },
      error: null,
    });

    const result = await dbGetLinkedPlatform("testuser", "bitbucket");
    expect(result).not.toBeNull();
    expect(result!.remoteLogin).toBe("bb-user");
    expect(result!.tokens.accessToken).toBe("my-access-token");
    expect(result!.tokens.refreshToken).toBe("my-refresh-token");
    expect(result!.tokens.expiresAt).toEqual(new Date("2026-03-01T00:00:00Z"));
  });

  it("lowercases handle for lookup", async () => {
    const { db, query } = mockSupabase();
    query.maybeSingle.mockResolvedValue({ data: null, error: null });

    await dbGetLinkedPlatform("TestUser", "bitbucket");
    expect(db.from).toHaveBeenCalledWith("user_platforms");
    expect(query.eq).toHaveBeenCalledWith("handle", "testuser");
  });

  it("returns null when decryption fails", async () => {
    const { query } = mockSupabase();
    query.maybeSingle.mockResolvedValue({
      data: {
        handle: "testuser",
        platform: "bitbucket",
        remote_login: "bb-user",
        access_token: "bad-encrypted-value",
        refresh_token: null,
        token_expires_at: null,
        connected_at: "2026-02-23T00:00:00Z",
        updated_at: "2026-02-23T00:00:00Z",
      },
      error: null,
    });

    const result = await dbGetLinkedPlatform("testuser", "bitbucket");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// dbUpsertLinkedPlatform
// ---------------------------------------------------------------------------

describe("dbUpsertLinkedPlatform", () => {
  beforeEach(() => vi.clearAllMocks());

  it("encrypts tokens before storage", async () => {
    const { query } = mockSupabase();

    await dbUpsertLinkedPlatform(
      "testuser",
      "bitbucket",
      "bb-user",
      "access-123",
      "refresh-456",
      new Date("2026-03-01T00:00:00Z"),
    );

    expect(query.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token: "enc:access-123",
        refresh_token: "enc:refresh-456",
      }),
      expect.anything(),
    );
  });

  it("returns true on success", async () => {
    mockSupabase(); // default: resolves to { error: null }

    const result = await dbUpsertLinkedPlatform(
      "testuser",
      "bitbucket",
      "bb-user",
      "access-123",
      null,
      null,
    );
    expect(result).toBe(true);
  });

  it("returns false when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValue(null);
    const result = await dbUpsertLinkedPlatform(
      "testuser",
      "bitbucket",
      "bb-user",
      "access-123",
      null,
      null,
    );
    expect(result).toBe(false);
  });

  it("returns false on DB error", async () => {
    const { setResolveValue } = mockSupabase();
    setResolveValue({ error: { message: "conflict" } });

    const result = await dbUpsertLinkedPlatform(
      "testuser",
      "bitbucket",
      "bb-user",
      "access-123",
      null,
      null,
    );
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dbDeleteLinkedPlatform
// ---------------------------------------------------------------------------

describe("dbDeleteLinkedPlatform", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true on successful delete", async () => {
    mockSupabase(); // thenable query resolves to { error: null }

    const result = await dbDeleteLinkedPlatform("testuser", "bitbucket");
    expect(result).toBe(true);
  });

  it("returns false when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValue(null);
    const result = await dbDeleteLinkedPlatform("testuser", "bitbucket");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dbUpdatePlatformTokens
// ---------------------------------------------------------------------------

describe("dbUpdatePlatformTokens", () => {
  beforeEach(() => vi.clearAllMocks());

  it("encrypts new tokens and updates DB", async () => {
    const { query } = mockSupabase(); // thenable query resolves to { error: null }

    const result = await dbUpdatePlatformTokens(
      "testuser",
      "bitbucket",
      "new-access",
      "new-refresh",
      new Date("2026-03-01T00:00:00Z"),
    );
    expect(result).toBe(true);
    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token: "enc:new-access",
        refresh_token: "enc:new-refresh",
      }),
    );
  });

  it("returns false when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValue(null);
    const result = await dbUpdatePlatformTokens(
      "testuser",
      "bitbucket",
      "new-access",
      null,
      null,
    );
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dbHasLinkedPlatform
// ---------------------------------------------------------------------------

describe("dbHasLinkedPlatform", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when platform linked", async () => {
    const { query } = mockSupabase();
    query.limit.mockResolvedValue({
      data: [{ id: "uuid" }],
      error: null,
    });

    const result = await dbHasLinkedPlatform("testuser", "bitbucket");
    expect(result).toBe(true);
  });

  it("returns false when not linked", async () => {
    const { query } = mockSupabase();
    query.limit.mockResolvedValue({ data: [], error: null });

    const result = await dbHasLinkedPlatform("testuser", "bitbucket");
    expect(result).toBe(false);
  });

  it("returns false when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValue(null);
    const result = await dbHasLinkedPlatform("testuser", "bitbucket");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// dbGetLinkedPlatforms
// ---------------------------------------------------------------------------

describe("dbGetLinkedPlatforms", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns empty array when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValue(null);
    const result = await dbGetLinkedPlatforms("testuser");
    expect(result).toEqual([]);
  });

  it("returns platform metadata without tokens", async () => {
    const { query } = mockSupabase();
    query.order.mockResolvedValue({
      data: [
        {
          platform: "bitbucket",
          remote_login: "bb-user",
          connected_at: "2026-02-23T00:00:00Z",
        },
      ],
      error: null,
    });

    const result = await dbGetLinkedPlatforms("testuser");
    expect(result).toEqual([
      {
        platform: "bitbucket",
        remoteLogin: "bb-user",
        connectedAt: "2026-02-23T00:00:00Z",
      },
    ]);
  });

  it("returns empty array on DB error", async () => {
    const { query } = mockSupabase();
    query.order.mockResolvedValue({
      data: null,
      error: { message: "table does not exist" },
    });

    const result = await dbGetLinkedPlatforms("testuser");
    expect(result).toEqual([]);
  });
});
