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

let queryResult: { data: unknown; error: unknown } = { data: null, error: null };

/* eslint-disable @typescript-eslint/no-explicit-any */
const mockFrom = vi.fn((): any => ({
  select: (...args: unknown[]) => {
    mockSelect(...args);
    const chainable: any = {
      order: () => chainable,
      eq: () => chainable,
      in: () => Promise.resolve(queryResult),
      maybeSingle: () => Promise.resolve(queryResult),
      limit: () => Promise.resolve(queryResult),
      then: (resolve: (v: unknown) => void) => resolve(queryResult),
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
    return {
      eq: () => Promise.resolve(queryResult),
      in: () => Promise.resolve(queryResult),
    };
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
  getSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { getSupabase } from "./supabase";
import {
  dbGetCampaigns,
  dbGetCampaign,
  dbCreateCampaign,
  dbUpdateCampaign,
  dbDeleteCampaign,
  dbCreateCampaignSends,
  dbGetPendingSends,
  dbMarkSendsSent,
  dbMarkSendsFailed,
  dbGetCampaignStats,
} from "./campaigns";

beforeEach(() => {
  vi.clearAllMocks();
  queryResult = { data: null, error: null };
});

// ---------------------------------------------------------------------------
// Full campaign row fixture (snake_case from DB)
// ---------------------------------------------------------------------------

const fullRow = {
  id: "c-1",
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

describe("dbCreateCampaign", () => {
  const validInput = {
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
      { onConflict: "campaign_id,handle" },
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

describe("dbMarkSendsSent", () => {
  it("updates status and timestamp", async () => {
    queryResult = { data: null, error: null };
    await dbMarkSendsSent(["s-1", "s-2"]);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("does not throw when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    await expect(dbMarkSendsSent(["s-1"])).resolves.toBeUndefined();
  });

  it("does not throw on update error", async () => {
    queryResult = { data: null, error: new Error("update failed") };
    await expect(dbMarkSendsSent(["s-1"])).resolves.toBeUndefined();
  });
});

describe("dbMarkSendsFailed", () => {
  it("updates status and error", async () => {
    queryResult = { data: null, error: null };
    await dbMarkSendsFailed(["s-1"], "Send failed");
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("does not throw when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    await expect(dbMarkSendsFailed(["s-1"], "error")).resolves.toBeUndefined();
  });

  it("does not throw on update error", async () => {
    queryResult = { data: null, error: new Error("update failed") };
    await expect(dbMarkSendsFailed(["s-1"], "error")).resolves.toBeUndefined();
  });
});

describe("dbGetCampaignStats", () => {
  it("returns aggregate counts", async () => {
    queryResult = {
      data: [
        { status: "sent" },
        { status: "sent" },
        { status: "pending" },
        { status: "failed" },
      ],
      error: null,
    };

    const stats = await dbGetCampaignStats("c-1");
    expect(stats).toEqual({ sent: 2, pending: 1, failed: 1 });
  });

  it("returns zeros when DB unavailable", async () => {
    vi.mocked(getSupabase).mockReturnValueOnce(null);
    const stats = await dbGetCampaignStats("c-1");
    expect(stats).toEqual({ sent: 0, pending: 0, failed: 0 });
  });

  it("returns zeros when data is null", async () => {
    queryResult = { data: null, error: null };
    const stats = await dbGetCampaignStats("c-1");
    expect(stats).toEqual({ sent: 0, pending: 0, failed: 0 });
  });

  it("returns zeros on query error", async () => {
    queryResult = { data: null, error: new Error("query failed") };
    const stats = await dbGetCampaignStats("c-1");
    expect(stats).toEqual({ sent: 0, pending: 0, failed: 0 });
  });

  it("counts all-sent data correctly", async () => {
    queryResult = {
      data: [
        { status: "sent" },
        { status: "sent" },
        { status: "sent" },
      ],
      error: null,
    };

    const stats = await dbGetCampaignStats("c-1");
    expect(stats).toEqual({ sent: 3, pending: 0, failed: 0 });
  });

  it("ignores unknown status values in count", async () => {
    queryResult = {
      data: [
        { status: "sent" },
        { status: "unknown" },
        { status: "pending" },
      ],
      error: null,
    };

    const stats = await dbGetCampaignStats("c-1");
    expect(stats).toEqual({ sent: 1, pending: 1, failed: 0 });
  });

  it("returns zeros for empty data array", async () => {
    queryResult = { data: [], error: null };
    const stats = await dbGetCampaignStats("c-1");
    expect(stats).toEqual({ sent: 0, pending: 0, failed: 0 });
  });
});
