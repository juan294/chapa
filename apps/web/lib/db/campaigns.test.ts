// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockUpsert = vi.fn();
const mockRpc = vi.fn();

let queryResult: { data: unknown; error: unknown } = { data: null, error: null };
let queryResults: Array<{ data?: unknown; error?: unknown; count?: number | null }> = [];

function nextQueryResult(): { data: unknown; error: unknown; count?: number | null } {
  if (queryResults.length > 0) {
    const next = queryResults.shift()!;
    return {
      data: next.data ?? null,
      error: next.error ?? null,
      count: next.count,
    };
  }

  return queryResult;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockFrom = vi.fn((): any => ({
  select: (...args: unknown[]) => {
    mockSelect(...args);
    const chainable: any = {
      order: () => chainable,
      eq: () => chainable,
      in: () => Promise.resolve(nextQueryResult()),
      maybeSingle: () => Promise.resolve(nextQueryResult()),
      limit: () => chainable,
      range: () => Promise.resolve(nextQueryResult()),
      then: (resolve: (v: unknown) => void) => resolve(nextQueryResult()),
    };
    return chainable;
  },
  insert: (...args: unknown[]) => {
    mockInsert(...args);
    return {
      select: () => ({
        single: () => Promise.resolve(queryResult),
      }),
    };
  },
  update: (...args: unknown[]) => {
    mockUpdate(...args);
    const chainable: any = {
      eq: () => chainable,
      in: () => chainable,
      select: () => chainable,
      maybeSingle: () => Promise.resolve(queryResult),
      then: (resolve: (v: unknown) => void) => resolve(queryResult),
    };
    return chainable;
  },
  delete: () => {
    mockDelete();
    return {
      eq: () => ({
        eq: () => Promise.resolve(queryResult),
      }),
    };
  },
  upsert: (...args: unknown[]) => {
    mockUpsert(...args);
    return Promise.resolve(queryResult);
  },
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

vi.mock("./supabase", () => ({
  getSupabase: vi.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}));

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();
vi.mock("../cache/redis", () => ({
  cacheGet: (...args: unknown[]) => mockCacheGet(...args),
  cacheSet: (...args: unknown[]) => mockCacheSet(...args),
}));

import { getSupabase } from "./supabase";
import {
  CampaignRowSchema,
  CampaignSendRowSchema,
  dbGetCampaigns,
  dbGetCampaign,
  dbCreateCampaign,
  dbUpdateCampaign,
  dbClaimCampaignForSending,
  dbReleaseCampaignClaim,
  dbDeleteCampaign,
  dbCreateCampaignSends,
  dbClaimPendingSends,
  dbReleaseCampaignSendLease,
  dbAcknowledgeCampaignSends,
  dbGetPendingSends,
  dbMarkSendsSent,
  dbMarkSendsFailed,
  dbGetCampaignStats,
  dbGetActiveEngagementCampaign,
  mapCampaignRow,
  mapSendRow,
} from "./campaigns";

beforeEach(() => {
  vi.clearAllMocks();
  queryResult = { data: null, error: null };
  queryResults = [];
});

describe("dbClaimCampaignForSending", () => {
  it("returns true only when the conditional draft update returns a row", async () => {
    queryResult = { data: { id: "c-1" }, error: null };

    await expect(
      dbClaimCampaignForSending("c-1", 12, "2026-08-04T14:00:00.000Z"),
    ).resolves.toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "sending",
      total_recipients: 12,
      started_at: "2026-08-04T14:00:00.000Z",
    });
  });

  it("returns false when another request already claimed the draft", async () => {
    queryResult = { data: null, error: null };
    await expect(
      dbClaimCampaignForSending("c-1", 12, "2026-08-04T14:00:00.000Z"),
    ).resolves.toBe(false);
  });
});

describe("dbReleaseCampaignClaim", () => {
  it("releases only the matching in-progress claim", async () => {
    queryResult = { data: { id: "c-1" }, error: null };

    await expect(
      dbReleaseCampaignClaim("c-1", "2026-08-04T14:00:00.000Z"),
    ).resolves.toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "draft",
      total_recipients: 0,
      started_at: null,
    });
  });
});

// ---------------------------------------------------------------------------
// Full campaign row fixture (snake_case from DB)
// ---------------------------------------------------------------------------

const fullRow = {
  id: "c-1",
  type: "announcement",
  name: "Test Campaign",
  subject: "Subject Line",
  preview_text: "Preview here",
  headline: "Headline",
  body_text: "Body text content",
  features: [{ text: "Feature 1" }, { text: "Feature 2" }],
  cta_text: "Click Me",
  cta_url: "https://example.com",
  status: "draft",
  total_recipients: 42,
  sent_count: 10,
  failed_count: 2,
  created_at: "2026-03-15T00:00:00Z",
  started_at: "2026-03-15T01:00:00Z",
  completed_at: "2026-03-15T02:00:00Z",
};

const minimalRow = {
  id: "c-2",
  type: "announcement",
  name: "Minimal",
  subject: "Sub",
  preview_text: undefined,
  headline: "Head",
  body_text: "Body",
  features: undefined,
  cta_text: "CTA",
  cta_url: "https://example.com",
  status: "draft",
  total_recipients: undefined,
  sent_count: undefined,
  failed_count: undefined,
  created_at: "2026-03-15T00:00:00Z",
  started_at: undefined,
  completed_at: undefined,
};

// ---------------------------------------------------------------------------
// Campaign CRUD
// ---------------------------------------------------------------------------

describe("dbGetCampaigns", () => {
  it("returns campaigns ordered by creation", async () => {
    queryResult = { data: [fullRow], error: null };

    const result = await dbGetCampaigns();
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Test Campaign");
    expect(result[0]!.ctaText).toBe("Click Me");
  });

  it("returns empty array when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbGetCampaigns();
    expect(result).toEqual([]);
  });

  it("returns empty array when data is null", async () => {
    queryResult = { data: null, error: null };
    const result = await dbGetCampaigns();
    expect(result).toEqual([]);
  });

  it("returns empty array on query error", async () => {
    queryResult = { data: null, error: new Error("query failed") };
    const result = await dbGetCampaigns();
    expect(result).toEqual([]);
  });

  it("maps row with all fields populated", async () => {
    queryResult = { data: [fullRow], error: null };

    const result = await dbGetCampaigns();
    const c = result[0]!;
    expect(c.id).toBe("c-1");
    expect(c.previewText).toBe("Preview here");
    expect(c.totalRecipients).toBe(42);
    expect(c.sentCount).toBe(10);
    expect(c.failedCount).toBe(2);
    expect(c.startedAt).toBe("2026-03-15T01:00:00Z");
    expect(c.completedAt).toBe("2026-03-15T02:00:00Z");
    expect(c.features).toEqual([{ text: "Feature 1" }, { text: "Feature 2" }]);
  });

  it("maps row with nullish fields to defaults", async () => {
    queryResult = { data: [minimalRow], error: null };

    const result = await dbGetCampaigns();
    const c = result[0]!;
    expect(c.previewText).toBeNull();
    expect(c.features).toEqual([]);
    expect(c.totalRecipients).toBe(0);
    expect(c.sentCount).toBe(0);
    expect(c.failedCount).toBe(0);
    expect(c.startedAt).toBeNull();
    expect(c.completedAt).toBeNull();
  });

  it("accepts optional status filter", async () => {
    queryResult = { data: [{ ...fullRow, status: "sending" }], error: null };

    const result = await dbGetCampaigns("sending");
    expect(result).toHaveLength(1);
    expect(result[0]!.status).toBe("sending");
  });

  it("accepts optional type filter", async () => {
    queryResult = { data: [{ ...fullRow, type: "engagement" }], error: null };

    const result = await dbGetCampaigns(undefined, "engagement");
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("engagement");
  });

  it("accepts both status and type filters", async () => {
    queryResult = { data: [{ ...fullRow, type: "engagement", status: "draft" }], error: null };

    const result = await dbGetCampaigns("draft", "engagement");
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe("engagement");
    expect(result[0]!.status).toBe("draft");
  });
});

describe("dbGetCampaign", () => {
  it("returns single campaign by ID", async () => {
    queryResult = { data: fullRow, error: null };

    const result = await dbGetCampaign("c-1");
    expect(result?.id).toBe("c-1");
    expect(result?.features).toEqual([{ text: "Feature 1" }, { text: "Feature 2" }]);
  });

  it("returns null for non-existent ID", async () => {
    queryResult = { data: null, error: null };
    const result = await dbGetCampaign("non-existent");
    expect(result).toBeNull();
  });

  it("returns null when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbGetCampaign("c-1");
    expect(result).toBeNull();
  });

  it("returns null on query error", async () => {
    queryResult = { data: null, error: new Error("query failed") };
    const result = await dbGetCampaign("c-1");
    expect(result).toBeNull();
  });
});

describe("mapCampaignRow runtime validation", () => {
  it("rejects rows with missing required fields", () => {
    expect(() => mapCampaignRow({})).toThrow(/validation/i);
  });

  it("exposes a schema-like parse function for campaign rows", () => {
    expect(typeof CampaignRowSchema.parse).toBe("function");
  });
});

describe("mapSendRow runtime validation", () => {
  it("rejects rows with missing required fields", () => {
    expect(() => mapSendRow({})).toThrow(/validation/i);
  });

  it("exposes a schema-like parse function for send rows", () => {
    expect(typeof CampaignSendRowSchema.parse).toBe("function");
  });
});

describe("dbCreateCampaign", () => {
  const validInput = {
    type: "announcement" as const,
    name: "Test",
    subject: "Subject",
    previewText: null,
    headline: "Headline",
    bodyText: "Body",
    features: [] as { text: string }[],
    ctaText: "Click",
    ctaUrl: "https://example.com",
  };

  it("inserts and returns UUID", async () => {
    queryResult = { data: { id: "new-uuid" }, error: null };

    const result = await dbCreateCampaign(validInput);

    expect(result).toBe("new-uuid");
    expect(mockInsert).toHaveBeenCalled();
  });

  it("returns null when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbCreateCampaign(validInput);
    expect(result).toBeNull();
  });

  it("returns null on insert error", async () => {
    queryResult = { data: null, error: new Error("insert failed") };
    const result = await dbCreateCampaign(validInput);
    expect(result).toBeNull();
  });

  it("returns null when data.id is missing", async () => {
    queryResult = { data: {}, error: null };
    const result = await dbCreateCampaign(validInput);
    // data?.id is undefined, ?? null → null
    expect(result).toBeNull();
  });

  it("passes snake_case fields to the insert", async () => {
    queryResult = { data: { id: "new-uuid" }, error: null };

    await dbCreateCampaign({
      ...validInput,
      previewText: "Some preview",
      features: [{ text: "F1" }],
    });

    expect(mockInsert).toHaveBeenCalledWith({
      type: "announcement",
      name: "Test",
      subject: "Subject",
      preview_text: "Some preview",
      headline: "Headline",
      body_text: "Body",
      features: [{ text: "F1" }],
      cta_text: "Click",
      cta_url: "https://example.com",
    });
  });
});

describe("dbUpdateCampaign", () => {
  it("updates specified fields", async () => {
    queryResult = { data: null, error: null };

    const result = await dbUpdateCampaign("c-1", { status: "sending" });
    expect(result).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({ status: "sending" });
  });

  it("returns false when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbUpdateCampaign("c-1", { name: "New Name" });
    expect(result).toBe(false);
  });

  it("returns false on update error", async () => {
    queryResult = { data: null, error: new Error("update failed") };
    const result = await dbUpdateCampaign("c-1", { name: "New Name" });
    expect(result).toBe(false);
  });

  it("maps all camelCase update fields to snake_case", async () => {
    queryResult = { data: null, error: null };

    await dbUpdateCampaign("c-1", {
      name: "Updated",
      subject: "New Subject",
      previewText: "Preview",
      headline: "New Headline",
      bodyText: "New Body",
      features: [{ text: "New Feature" }],
      ctaText: "New CTA",
      ctaUrl: "https://new.example.com",
      status: "sent",
      totalRecipients: 100,
      sentCount: 95,
      failedCount: 5,
      startedAt: "2026-03-15T01:00:00Z",
      completedAt: "2026-03-15T02:00:00Z",
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      name: "Updated",
      subject: "New Subject",
      preview_text: "Preview",
      headline: "New Headline",
      body_text: "New Body",
      features: [{ text: "New Feature" }],
      cta_text: "New CTA",
      cta_url: "https://new.example.com",
      status: "sent",
      total_recipients: 100,
      sent_count: 95,
      failed_count: 5,
      started_at: "2026-03-15T01:00:00Z",
      completed_at: "2026-03-15T02:00:00Z",
    });
  });

  it("only includes fields that are explicitly provided (not undefined)", async () => {
    queryResult = { data: null, error: null };

    await dbUpdateCampaign("c-1", { name: "Only Name" });

    expect(mockUpdate).toHaveBeenCalledWith({ name: "Only Name" });
  });

  it("rejects invalid campaign statuses before writing", async () => {
    await expect(
      dbUpdateCampaign("c-1", { status: "bogus" as unknown as "draft" }),
    ).rejects.toThrow(/invalid campaign status/i);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("dbDeleteCampaign", () => {
  it("deletes campaign", async () => {
    queryResult = { data: null, error: null };

    const result = await dbDeleteCampaign("c-1");
    expect(result).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("returns false when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbDeleteCampaign("c-1");
    expect(result).toBe(false);
  });

  it("returns false on delete error", async () => {
    queryResult = { data: null, error: new Error("delete failed") };
    const result = await dbDeleteCampaign("c-1");
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Campaign sends
// ---------------------------------------------------------------------------

describe("dbCreateCampaignSends", () => {
  it("bulk inserts pending sends", async () => {
    queryResult = { data: null, error: null };

    const count = await dbCreateCampaignSends("c-1", [
      { handle: "alice", email: "alice@example.com" },
      { handle: "bob", email: "bob@example.com" },
    ]);

    expect(count).toBe(2);
    expect(mockUpsert).toHaveBeenCalledWith(
      [
        { campaign_id: "c-1", handle: "alice", email: "alice@example.com", status: "pending" },
        { campaign_id: "c-1", handle: "bob", email: "bob@example.com", status: "pending" },
      ],
      { onConflict: "campaign_id,handle", ignoreDuplicates: true },
    );
  });

  it("returns 0 when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const count = await dbCreateCampaignSends("c-1", [
      { handle: "alice", email: "alice@example.com" },
    ]);
    expect(count).toBe(0);
  });

  it("returns 0 on upsert error", async () => {
    queryResult = { data: null, error: new Error("upsert failed") };
    const count = await dbCreateCampaignSends("c-1", [
      { handle: "alice", email: "alice@example.com" },
    ]);
    expect(count).toBe(0);
  });
});

describe("dbGetPendingSends", () => {
  it("returns pending sends with limit", async () => {
    queryResult = {
      data: [
        {
          id: "s-1",
          campaign_id: "c-1",
          handle: "alice",
          email: "alice@example.com",
          status: "pending",
          sent_at: null,
          error: null,
        },
      ],
      error: null,
    };

    const result = await dbGetPendingSends("c-1", 50);
    expect(result).toHaveLength(1);
    expect(result[0]!.handle).toBe("alice");
    expect(result[0]!.campaignId).toBe("c-1");
    expect(result[0]!.sentAt).toBeNull();
    expect(result[0]!.error).toBeNull();
  });

  it("returns empty array when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbGetPendingSends("c-1", 50);
    expect(result).toEqual([]);
  });

  it("returns empty array when data is null", async () => {
    queryResult = { data: null, error: null };
    const result = await dbGetPendingSends("c-1", 50);
    expect(result).toEqual([]);
  });

  it("returns empty array on query error", async () => {
    queryResult = { data: null, error: new Error("query failed") };
    const result = await dbGetPendingSends("c-1", 50);
    expect(result).toEqual([]);
  });

  it("maps send row with non-null sent_at and error", async () => {
    queryResult = {
      data: [
        {
          id: "s-2",
          campaign_id: "c-1",
          handle: "bob",
          email: "bob@example.com",
          status: "failed",
          sent_at: "2026-03-15T01:00:00Z",
          error: "timeout",
        },
      ],
      error: null,
    };

    const result = await dbGetPendingSends("c-1", 50);
    expect(result[0]!.sentAt).toBe("2026-03-15T01:00:00Z");
    expect(result[0]!.error).toBe("timeout");
  });
});

describe("dbClaimPendingSends", () => {
  it("claims a bounded batch through the RPC", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: "s-1",
          campaign_id: "c-1",
          handle: "alice",
          email: "alice@example.com",
          status: "processing",
          sent_at: null,
          error: null,
        },
      ],
      error: null,
    });

    const result = await dbClaimPendingSends(
      "c-1",
      25,
      "lease-token",
      "2026-04-23T12:10:00.000Z",
    );

    expect(mockRpc).toHaveBeenCalledWith("claim_campaign_sends", {
      p_campaign_id: "c-1",
      p_limit: 25,
      p_lease_token: "lease-token",
      p_lease_expires_at: "2026-04-23T12:10:00.000Z",
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: "s-1",
        campaignId: "c-1",
        status: "processing",
      }),
    ]);
  });

  it("returns empty array when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const result = await dbClaimPendingSends(
      "c-1",
      10,
      "lease-token",
      "2026-04-23T12:10:00.000Z",
    );
    expect(result).toEqual([]);
  });

  it("returns empty array on RPC error", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: new Error("rpc failed"),
    });

    const result = await dbClaimPendingSends(
      "c-1",
      10,
      "lease-token",
      "2026-04-23T12:10:00.000Z",
    );

    expect(result).toEqual([]);
  });

  it("fails closed before the RPC when the lease token is blank", async () => {
    const result = await dbClaimPendingSends(
      "c-1",
      10,
      "   ",
      "2026-04-23T12:10:00.000Z",
    );

    expect(result).toEqual([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("dbReleaseCampaignSendLease", () => {
  it("releases a lease group back to pending through the RPC", async () => {
    mockRpc.mockResolvedValueOnce({ data: 3, error: null });

    const result = await dbReleaseCampaignSendLease("lease-token", 3);

    expect(mockRpc).toHaveBeenCalledWith("release_campaign_send_lease", {
      p_lease_token: "lease-token",
    });
    expect(result).toBe(true);
  });

  it("fails closed when the released count does not match the caller's expectation", async () => {
    mockRpc.mockResolvedValueOnce({ data: 2, error: null });

    const result = await dbReleaseCampaignSendLease("lease-token", 3);

    expect(result).toBe(false);
  });

  it("returns false when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    const result = await dbReleaseCampaignSendLease("lease-token", 3);

    expect(result).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns false on RPC error", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error("rpc failed") });

    const result = await dbReleaseCampaignSendLease("lease-token", 3);

    expect(result).toBe(false);
  });

  it("fails closed before the RPC when the lease token is blank", async () => {
    const result = await dbReleaseCampaignSendLease("   ", 3);

    expect(result).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("fails closed before the RPC when the expected count is not positive", async () => {
    const result = await dbReleaseCampaignSendLease("lease-token", 0);

    expect(result).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("dbAcknowledgeCampaignSends", () => {
  it("delegates the complete provider result set to one RPC", async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    const results = [
      { id: "s-1", status: "sent" as const, error: null },
      { id: "s-2", status: "failed" as const, error: "rejected" },
    ];

    await expect(
      dbAcknowledgeCampaignSends(results, "lease-token"),
    ).resolves.toBe(true);
    expect(mockRpc).toHaveBeenCalledWith("acknowledge_campaign_sends", {
      p_lease_token: "lease-token",
      p_results: results,
    });
  });

  it("fails closed when the RPC cannot acknowledge the whole lease", async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(
      dbAcknowledgeCampaignSends(
        [{ id: "s-1", status: "sent", error: null }],
        "lease-token",
      ),
    ).resolves.toBe(false);
  });

  it("fails closed before the RPC when the result set is empty", async () => {
    await expect(
      dbAcknowledgeCampaignSends([], "lease-token"),
    ).resolves.toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("fails closed before the RPC when the lease token is blank", async () => {
    await expect(
      dbAcknowledgeCampaignSends(
        [{ id: "s-1", status: "sent", error: null }],
        "   ",
      ),
    ).resolves.toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

describe("dbMarkSendsSent", () => {
  it("updates claimed sends by lease token", async () => {
    queryResult = { data: null, error: null };
    queryResult = { data: [{ id: "s-1" }, { id: "s-2" }], error: null };
    await expect(dbMarkSendsSent(["s-1", "s-2"], "lease-token")).resolves.toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: "sent",
      lease_token: null,
    }));
  });

  it("does not throw when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    await expect(dbMarkSendsSent(["s-1"])).resolves.toBe(false);
  });

  it("does not throw on update error", async () => {
    queryResult = { data: null, error: new Error("update failed") };
    await expect(dbMarkSendsSent(["s-1"])).resolves.toBe(false);
  });
});

describe("dbMarkSendsFailed", () => {
  it("updates claimed sends with status and error", async () => {
    queryResult = { data: null, error: null };
    queryResult = { data: [{ id: "s-1" }], error: null };
    await expect(dbMarkSendsFailed(["s-1"], "Send failed", "lease-token")).resolves.toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: "failed",
      error: "Send failed",
      lease_token: null,
    }));
  });

  it("does not throw when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    await expect(dbMarkSendsFailed(["s-1"], "error")).resolves.toBe(false);
  });

  it("does not throw on update error", async () => {
    queryResult = { data: null, error: new Error("update failed") };
    await expect(dbMarkSendsFailed(["s-1"], "error")).resolves.toBe(false);
  });
});

describe("dbGetCampaignStats", () => {
  it("returns aggregate counts from a single status-only query", async () => {
    queryResults = [
      {
        data: [
          { status: "sent" },
          { status: "sent" },
          { status: "pending" },
          { status: "processing" },
          { status: "processing" },
          { status: "processing" },
          { status: "failed" },
        ],
        error: null,
      },
    ];

    const stats = await dbGetCampaignStats("c-1");
    expect(stats).toEqual({ sent: 2, pending: 1, processing: 3, failed: 1 });
  });

  it("issues exactly one round trip, selecting only the status column", async () => {
    queryResults = [{ data: [{ status: "sent" }], error: null }];

    await dbGetCampaignStats("c-1");

    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockSelect).toHaveBeenCalledWith("status");
  });

  it("returns zeros when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const stats = await dbGetCampaignStats("c-1");
    expect(stats).toEqual({ sent: 0, pending: 0, processing: 0, failed: 0 });
  });

  it("returns zeros when data is null", async () => {
    queryResults = [{ data: null, error: null }];
    const stats = await dbGetCampaignStats("c-1");
    expect(stats).toEqual({ sent: 0, pending: 0, processing: 0, failed: 0 });
  });

  it("returns zeros on query error", async () => {
    queryResults = [{ error: new Error("query failed") }];
    const stats = await dbGetCampaignStats("c-1");
    expect(stats).toEqual({ sent: 0, pending: 0, processing: 0, failed: 0 });
  });

  it("counts all-sent data correctly", async () => {
    queryResults = [
      {
        data: [{ status: "sent" }, { status: "sent" }, { status: "sent" }],
        error: null,
      },
    ];

    const stats = await dbGetCampaignStats("c-1");
    expect(stats).toEqual({ sent: 3, pending: 0, processing: 0, failed: 0 });
  });

  it("ignores rows with an unrecognized status instead of throwing", async () => {
    queryResults = [
      {
        data: [{ status: "sent" }, { status: "bogus-status" }],
        error: null,
      },
    ];

    const stats = await dbGetCampaignStats("c-1");
    expect(stats).toEqual({ sent: 1, pending: 0, processing: 0, failed: 0 });
  });

  it("returns zeros for empty data array", async () => {
    queryResults = [{ data: [], error: null }];
    const stats = await dbGetCampaignStats("c-1");
    expect(stats).toEqual({ sent: 0, pending: 0, processing: 0, failed: 0 });
  });
});

// ---------------------------------------------------------------------------
// dbGetActiveEngagementCampaign
// ---------------------------------------------------------------------------

describe("dbGetActiveEngagementCampaign", () => {
  beforeEach(() => {
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);
  });

  it("returns cached campaign on cache hit", async () => {
    const cached = {
      id: "c-cached",
      type: "engagement",
      name: "Cached Campaign",
      subject: "Subject",
      previewText: null,
      headline: "Head",
      bodyText: "Body",
      features: [],
      ctaText: "CTA",
      ctaUrl: "https://example.com",
      status: "sent",
      totalRecipients: 10,
      sentCount: 10,
      failedCount: 0,
      createdAt: "2026-03-15T00:00:00Z",
      startedAt: null,
      completedAt: null,
    };
    mockCacheGet.mockResolvedValue(cached);

    const result = await dbGetActiveEngagementCampaign();

    expect(result).toEqual(cached);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it("fetches from DB on cache miss and caches result", async () => {
    const engagementRow = { ...fullRow, type: "engagement" };
    queryResult = { data: engagementRow, error: null };

    const result = await dbGetActiveEngagementCampaign();

    expect(result).not.toBeNull();
    expect(result!.type).toBe("engagement");
    expect(mockCacheGet).toHaveBeenCalledWith("campaign:active-engagement");
    expect(mockCacheSet).toHaveBeenCalledWith(
      "campaign:active-engagement",
      expect.objectContaining({ type: "engagement" }),
      3600,
    );
  });

  it("returns null when DB returns no data (cache miss)", async () => {
    queryResult = { data: null, error: null };

    const result = await dbGetActiveEngagementCampaign();

    expect(result).toBeNull();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it("returns null on DB error (catch block)", async () => {
    queryResult = { data: null, error: new Error("DB connection lost") };

    const result = await dbGetActiveEngagementCampaign();

    expect(result).toBeNull();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });

  it("returns null when Supabase is unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);

    const result = await dbGetActiveEngagementCampaign();

    expect(result).toBeNull();
    expect(mockCacheSet).not.toHaveBeenCalled();
  });
});
